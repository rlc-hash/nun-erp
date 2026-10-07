// v4.15 — CANDADO: un pedido con piezas ya facturadas no se puede guardar quitando o bajando esas piezas (caso pedido 1332 de Dulce).
// Base: v4.14 — FLUJO NUEVO DE VENTA probado contra el servidor de verdad (backend/Codigo.gs corriendo en el emulador de Supabase):
// cotización (aparta) → ✅ Confirmar → pedido (venta: descuenta inventario, 1 cobro) → 🧾 factura sin otro cobro → tablero y saldo.
// Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
(async()=>{
 const E=await import(path.join(__dirname,'..','supabase','functions','nun','emulador.js'));
 const fn=E.compilar(fs.readFileSync(path.join(__dirname,'..','backend','Codigo.gs'),'utf8'));
 const DB=new Map(); let PROPS={en_supabase:'1'}; const COD='DUENO-PRUEBA1';
 const servidor=async(tipo,payload)=>{ const r=await E.atender({fn,existentes:[...DB.keys()],props:PROPS,cargar:async ns=>new Map(ns.map(n=>[n,JSON.parse(JSON.stringify(DB.get(n)||[]))])),
   sesion:c=>String(c||'').toUpperCase()===COD,admin:c=>String(c||'').toUpperCase()===COD,tipo,payload});
   for(const s of r.sucias) DB.set(s.nombre,JSON.parse(JSON.stringify(s.filas))); if(r.props) PROPS=r.props; return r.texto; };
 const post=async b=>JSON.parse(await servidor('post',JSON.stringify(Object.assign({codigo:COD},b))));
 await post({accion:'inicializar'});
 await post({accion:'erp_crear',tabla:'productos',item:{id:'pr1',sku:'RL004M',descripcion:'MALETA RL004 MORADO',stock_actual:10,stock_comprometido:0}});
 await post({accion:'erp_crear',tabla:'clientes',item:{id:'c1',razon_social:'CLIENTE PRUEBA',credito_dias:15}});
 const cot=await post({accion:'erp_crear',tabla:'cotizaciones',item:{id:'cot1',folio:'',fecha:'2026-10-07',cliente:'CLIENTE PRUEBA',vendedor:'EDGAR',estatus:'enviada',subtotal:3000,iva:480,total:3480,
   items_json:JSON.stringify([{sku:'RL004M',descripcion:'MALETA RL004 MORADO',cantidad:2,precio_unitario:1500,iva_pct:16}])}});
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';

 await sleep(3000); const r={fallas:[]};
 try{
  const ITS=[{sku:'GA',descripcion:'SET GA',cantidad:1,precio_unitario:1650,iva_pct:0},{sku:'RD',descripcion:'SET RD',cantidad:2,precio_unitario:1650,iva_pct:0},{sku:'N',descripcion:'SET N',cantidad:2,precio_unitario:1650,iva_pct:0}];
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'pd1',folio:'1332',fecha:'2026-09-17',cliente:'CLIENTE PRUEBA',estatus:'confirmado',subtotal:8250,iva:0,total:8250,items_json:JSON.stringify(ITS)}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'fx',folio:'FT0009',fecha:'2026-10-06',cliente:'CLIENTE PRUEBA',pedido_origen:'1332',estatus:'timbrada',total:5250,items_json:JSON.stringify([{sku:'GA',cantidad:1,precio_unitario:1750},{sku:'RD',cantidad:1,precio_unitario:1750},{sku:'N',cantidad:1,precio_unitario:1750}])}});
  for(const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true"); w.__t=[]; const tt=w.eval("toast"); w.eval("window.toast=(m,o)=>{ window.__t.push(String(m)); }");
  // 1) guardar el pedido solo con lo pendiente (como pasó): NO se guarda
  w.eval("abrirDoc('pedidos','pd1')"); await sleep(300);
  w.eval("docItems.length=0; docItems.push({sku:'RD',descripcion:'SET RD',cantidad:1,precio_unitario:1293.10,iva_pct:16},{sku:'N',descripcion:'SET N',cantidad:1,precio_unitario:1293.10,iva_pct:16}); try{renderDocItems()}catch(e){}");
  await w.eval("guardarDoc('pedidos','pd1')"); await sleep(300);
  const p1=(await post({accion:'erp_listar',tabla:'pedidos'})).items.find(x=>x.id==='pd1');
  r.quitar={total:p1.total,renglones:JSON.parse(p1.items_json).length,aviso:(w.__t.find(m=>/No se guardó: ya salieron/.test(m))||'').slice(0,90)};
  // 2) cambiar notas sin tocar piezas: SÍ se guarda
  try{ w.eval('cerrarDrawer()'); }catch(e){}
  w.eval("abrirDoc('pedidos','pd1')"); await sleep(300); w.document.getElementById('dNotas').value='nota nueva';
  await w.eval("guardarDoc('pedidos','pd1')"); await sleep(300);
  const p2=(await post({accion:'erp_listar',tabla:'pedidos'})).items.find(x=>x.id==='pd1');
  r.notas={total:p2.total,notas:/nota nueva/.test(p2.notas||'')};
  r.version=txt(d.querySelector('.rwd-version'));
  if(+r.quitar.total!==8250||r.quitar.renglones!==3||!r.quitar.aviso) r.fallas.push('candado');
  if(+r.notas.total!==8250||!r.notas.notas) r.fallas.push('notas');
  if(!/v4\.(1[5-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
