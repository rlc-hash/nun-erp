// v4.30 / servidor v0.9.16 — 📦 Hacer remisión en pedidos VIEJOS (Bind) sin mover inventario; venta directa ya no aparta inventario.
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
  const it=JSON.stringify([{sku:'RL004M',descripcion:'MALETA RL004 MORADO',cantidad:3,precio_unitario:1000,iva_pct:16}]);
  const stock=async()=>{const p=(await post({accion:'erp_listar',tabla:'productos'})).items.find(x=>x.id==='pr1');return (+p.stock_actual)+'/'+(+p.stock_comprometido||0);};
  r.stock0=await stock();
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cv',razon_social:'DAVID PRUEBA MORENO'}});
  await post({accion:'erp_upsert_batch',tabla:'pedidos',items:[]});
  // pedido viejo de Bind (se inserta tal cual, como vino de Bind: sin apartar)
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_ord_x1',folio:'1010',fecha:'2025-08-25',cliente:'DAVID PRUEBA MORENO',vendedor:'EDGAR',estatus:'entregado',subtotal:3000,iva:480,total:3480,items_json:it,_sin_inventario:true}});
  r.stock1=await stock();
  // venta directa → pedido: no debe apartar
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'fv',folio:'77',fecha:'2025-09-01',cliente:'DAVID PRUEBA MORENO',estatus:'timbrada',total:3480,subtotal:3000,iva:480,items_json:it}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza','productos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  await w.eval("nunPedidoDeVentaDirecta('facturas', State.data.facturas.find(x=>x.id==='fv'))"); await sleep(200);
  r.stockVD=await stock();
  // botones
  await w.eval("cargarTabla('pedidos')");
  r.viejo=w.eval("nunPedidoViejoRemisionable(State.data.pedidos.find(x=>x.id==='bind_ord_x1'))");
  r.vd=w.eval("nunPedidoViejoRemisionable(State.data.pedidos.find(x=>x.id==='ped_vd_fv'))");
  // pedido del flujo nuevo (cotización confirmada) → no lleva remisión
  w.eval("navegar('pedidos')"); await sleep(300);
  w.eval("abrirDoc('pedidos','bind_ord_x1')"); await sleep(600);
  r.boton=[...d.querySelectorAll('button')].some(b=>/Hacer remisión/.test(b.textContent));
  // hacer la remisión
  await w.eval("nunDesdePedidos('bind_ord_x1','remisiones')"); await sleep(400);
  r.botonModal=!!d.getElementById('dpBotonR');
  await w.eval("nunDesdePedidosCrear('remisiones')"); await sleep(1500);
  const rems=(await post({accion:'erp_listar',tabla:'remisiones'})).items, cob=(await post({accion:'erp_listar',tabla:'cobranza'})).items, mov=(await post({accion:'erp_listar',tabla:'movinventario'})).items||[];
  const rm=rems.find(x=>x.pedido_origen==='1010');
  r.rem=rm?[rm.folio,rm.total,rm.estatus].join(' '):'(no)';
  r.cobro=rm?cob.filter(c=>String(c.factura_origen)===String(rm.id)).map(c=>c.total+' '+c.tipo).join():'';
  r.stockFin=await stock(); r.movs=mov.filter(m=>m.sku==='RL004M').length;
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.stock1!==r.stock0||r.stockVD!==r.stock0) r.fallas.push('aparta-inventario');
  if(!r.viejo||r.vd) r.fallas.push('quien-lleva-remision');
  if(!r.boton||!r.botonModal) r.fallas.push('botones');
  if(!/^R\d{4} 3480 entregada$/.test(r.rem)) r.fallas.push('remision');
  if(!/^3480 /.test(r.cobro)) r.fallas.push('cobro');
  if(r.stockFin!==r.stock0||r.movs!==0) r.fallas.push('mueve-inventario');
  if(!/v4\.(3\d|[4-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
