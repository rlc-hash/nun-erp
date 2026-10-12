// v4.22 — VENTA DIRECTA → PEDIDO: de una factura/remisión sin pedido se crea su pedido (misma fecha, cliente, productos), ligado, sin cobro nuevo y sin doble.
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
  const it=JSON.stringify([{sku:'X1',descripcion:'MALETA',cantidad:2,precio_unitario:500,iva_pct:16,pedido:'viejo'}]);
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cv',razon_social:'CLIENTE VD'}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'fv1',folio:'10',fecha:'2025-08-21T06:00:00.000Z',cliente:'CLIENTE VD',vendedor:'EDGAR',estatus:'timbrada',subtotal:1000,iva:160,total:1160,items_json:it,notas:'Importada desde Bind · [venta directa, sin pedido] (2026-10-12)'}});
  await post({accion:'erp_crear',tabla:'remisiones',item:{id:'rv1',folio:'120',fecha:'2025-09-02',cliente:'CLIENTE VD',vendedor:'LUIS',estatus:'entregada',subtotal:1000,iva:160,total:1160,items_json:it}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cobf',numero:'10',cliente:'CLIENTE VD',factura_origen:'fv1',total:1160,estatus:'pendiente'}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza','productos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  const db=async t=>(await post({accion:'erp_listar',tabla:t})).items;
  const stock0=JSON.stringify(await db('productos'));
  // 1) factura marcada venta directa → pedido
  r.f1=await w.eval("nunPedidoDeVentaDirecta('facturas', State.data.facturas.find(x=>x.id==='fv1'))");
  // 2) otra vez: no se hace doble
  r.f1b=await w.eval("nunPedidoDeVentaDirecta('facturas', Object.assign({}, State.data.facturas.find(x=>x.id==='fv1'), {pedido_origen:''}))");
  // 3) remisión desde el botón de la ficha del cliente
  w.eval("abrirDetalleCliente('cv')"); await sleep(800); w.eval("window._nunDocsCliFiltro='';nunDocsClienteRepintar()");
  r.botones=[...d.querySelectorAll('#nunDocsCliMount button')].filter(b=>/Crear pedido/.test(b.textContent)).length;
  await w.eval("nunDocsCliCrearPedido('remisiones','rv1')"); await sleep(300);
  const ps=await db('pedidos'), f=(await db('facturas')).find(x=>x.id==='fv1'), rm=(await db('remisiones')).find(x=>x.id==='rv1'), cob=await db('cobranza');
  const pf=ps.find(x=>x.id==='ped_vd_fv1'), pr=ps.find(x=>x.id==='ped_vd_rv1');
  r.pedidos=ps.map(p=>[p.id,p.folio,String(p.fecha).slice(0,10),p.cliente,p.vendedor,p.total,p.estatus].join(' '));
  r.ligas={f:f.pedido_origen, r:rm.pedido_origen};
  r.items=JSON.parse(pf.items_json);
  r.cobros=cob.length; r.stockIgual=JSON.stringify(await db('productos'))===stock0;
  w.eval("nunDocsClienteRepintar()");
  r.botonesDespues=[...d.querySelectorAll('#nunDocsCliMount button')].filter(b=>/Crear pedido/.test(b.textContent)).length;
  r.ligadoA=[...d.querySelectorAll('#nunDocsCliMount tbody tr')].map(tr=>txt(tr.children[1])+':'+txt(tr.children[5]));
  r.version=txt(d.querySelector('.rwd-version'));
  if(!pf||r.f1!==pf.folio||!/^P\d{4}$/.test(pf.folio)) r.fallas.push('pedido-factura');
  if(r.f1b!==r.f1) r.fallas.push('doble');
  if(ps.length!==2) r.fallas.push('cuantos');
  if(!pf||String(pf.fecha).slice(0,10)!=='2025-08-21'||pf.cliente!=='CLIENTE VD'||pf.vendedor!=='EDGAR'||+pf.total!==1160||pf.estatus!=='facturado') r.fallas.push('datos-factura');
  if(!pr||String(pr.fecha).slice(0,10)!=='2025-09-02'||pr.vendedor!=='LUIS'||pr.estatus!=='entregado') r.fallas.push('datos-remision');
  if(r.ligas.f!==pf.folio||r.ligas.r!==pr.folio) r.fallas.push('ligas');
  if(r.items.length!==1||r.items[0].pedido||+r.items[0].cantidad!==2) r.fallas.push('items');
  if(r.cobros!==1||!r.stockIgual) r.fallas.push('sin-cobro-ni-inventario');
  if(r.botones!==1||r.botonesDespues!==0) r.fallas.push('boton');
  if(!/v4\.(2[2-9]|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
