// v4.34 — pedido reactivado a mano (cancelado → confirmado) que ya tiene su remisión: al guardar pasa solo a "entregado".
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
  const it=JSON.stringify([{sku:'X1',cantidad:2,precio_unitario:1000}]);
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'gr',razon_social:'GERARDO PRUEBA REYES'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_ord_g',folio:'1028',fecha:'2025-11-10',cliente:'GERARDO PRUEBA REYES',vendedor:'EDGAR',comision_pct:6,estatus:'cancelado',total:2000,items_json:it,_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'remisiones',item:{id:'bind_rem_g',folio:'65',fecha:'2025-11-12',cliente:'GERARDO PRUEBA REYES',estatus:'pendiente',total:2000,pedido_origen:'1028',items_json:it,_sin_inventario:true}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  w.eval("navegar('pedidos')"); await sleep(300); w.eval("abrirDoc('pedidos','bind_ord_g')"); await sleep(600);
  d.getElementById('dEstatus').value='confirmado'; const pc=d.getElementById('dComisionPct'); if(pc&&!pc.value) pc.value='6';
  await w.eval("guardarDoc('pedidos','bind_ord_g')"); await sleep(1200);
  const p=(await post({accion:'erp_listar',tabla:'pedidos'})).items.find(x=>x.id==='bind_ord_g');
  r.estatus=p.estatus; r.nota=/Estatus confirmado → entregado/.test(p.notas||'');
  r.cobros=(await post({accion:'erp_listar',tabla:'cobranza'})).items.filter(c=>c.factura_origen==='bind_ord_g').length;
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.estatus!=='entregado'||!r.nota) r.fallas.push('estatus');
  if(r.cobros!==0) r.fallas.push('no-debe-crear-venta');
  if(!/v4\.(3[4-9])/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
