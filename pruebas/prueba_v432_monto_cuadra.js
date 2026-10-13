// v4.32 — pedido con piezas 32/34 pero el MONTO de sus documentos cuadra exacto (cambiaron modelos) = surtido, no parcial.
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
  const L=(a)=>JSON.stringify(a.map(([s,c])=>({sku:s,cantidad:c,precio_unitario:100})));
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_p1',folio:'1029',fecha:'2025-11-10',cliente:'ELSA PRUEBA',estatus:'confirmado',total:1000,items_json:L([['A',5],['B',5]]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_p2',folio:'1030',fecha:'2025-11-10',cliente:'ELSA PRUEBA',estatus:'confirmado',total:1000,items_json:L([['A',5],['B',5]]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f1',folio:'1075',cliente:'ELSA PRUEBA',estatus:'timbrada',total:1000,pedido_origen:'1029',items_json:L([['A',6],['B',2]])}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f2',folio:'1076',cliente:'ELSA PRUEBA',estatus:'timbrada',total:600,pedido_origen:'1030',items_json:L([['A',3],['B',3]])}});
  for(const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  r.sit1=w.eval("(()=>{const x=document.createElement('div');x.innerHTML=nunSituacionHTML('pedidos',State.data.pedidos.find(p=>p.id==='bind_p1'));return x.textContent})()");
  r.sit2=w.eval("(()=>{const x=document.createElement('div');x.innerHTML=nunSituacionHTML('pedidos',State.data.pedidos.find(p=>p.id==='bind_p2'));return x.textContent})()");
  r.aldia=w.eval("nunPedidosAlDiaCalc().map(x=>x.p.folio+'→'+x.nuevo).join()");
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/^surtido.*piezas 8\/10, el monto cuadra/.test(r.sit1)) r.fallas.push('monto-cuadra');
  if(!/^parcial 6\/10/.test(r.sit2)) r.fallas.push('parcial-de-verdad');
  if(r.aldia!=='1029→facturado') r.fallas.push('estatus');
  if(!/v4\.(3[2-9])/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
