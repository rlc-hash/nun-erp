// v4.29 — cadena de documentos arriba de la factura: con folio de pedido repetido (cinco 1070, cuatro cancelados) solo sale el vivo.
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
  const it=JSON.stringify([{sku:'X1',cantidad:1,precio_unitario:1000}]);
  const P=(id,est,total)=>post({accion:'erp_crear',tabla:'pedidos',item:{id,folio:'1070',fecha:'2025-12-08',cliente:'CECILIA PRUEBA',estatus:est,total,items_json:it}});
  await P('a','cancelado',6400); await P('b','cancelado',8000); await P('c','cancelado',24000); await P('v','facturado',30000); await P('e','cancelado',8000);
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f',folio:'1040',fecha:'2026-02-04',cliente:'LUIS PRUEBA',estatus:'timbrada',total:30000,pedido_origen:'1070',items_json:it}});
  await P('z1','cancelado',100).then(()=>post({accion:'erp_upsert_batch',tabla:'pedidos',items:[{id:'z1',folio:'1999'}]}));
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'z2',folio:'1999',fecha:'2025-12-08',cliente:'X',estatus:'cancelado',total:200,items_json:it}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'g',folio:'1041',fecha:'2026-02-04',cliente:'X',estatus:'timbrada',total:200,pedido_origen:'1999',items_json:it}});
  for(const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  r.cadena=w.eval("nunRelDoc('facturas', State.data.facturas.find(x=>x.id==='f')).pedidos.map(p=>p.id).join()");
  r.todosCancelados=w.eval("nunRelDoc('facturas', State.data.facturas.find(x=>x.id==='g')).pedidos.map(p=>p.id).sort().join()");
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.cadena!=='v') r.fallas.push('solo-vivo');
  if(r.todosCancelados!=='z1,z2') r.fallas.push('si-no-hay-vivo');
  if(!/v4\.(29|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
