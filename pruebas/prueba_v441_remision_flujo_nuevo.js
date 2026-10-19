// v4.41 — Se cierra con remisiones: un pedido confirmado (con su cobro) SÍ lleva remisión y la remisión SE LLEVA el cobro
// (con sus pagos), sin cobrar doble ni sacar inventario otra vez.
// Base v4.14 — FLUJO NUEVO DE VENTA probado contra el servidor de verdad (backend/Codigo.gs corriendo en el emulador de Supabase):
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
  const stock=async()=>{ const p=(await post({accion:'erp_listar',tabla:'productos'})).items.find(x=>x.sku==='RL004M'); return p.stock_actual+'/'+p.stock_comprometido; };
  for(const t of ['cotizaciones','pedidos','remisiones','facturas','cobranza','productos','ingresos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  await w.eval("nunConfirmarCotizacion('cot1')"); await sleep(300);
  await w.eval("Promise.all(['pedidos','cobranza'].map(t=>cargarTabla(t)))");
  const ped=w.eval("State").data.pedidos.find(p=>p.cotizacion_origen===cot.item.folio);
  const cob0=w.eval("State").data.cobranza.find(c=>c.factura_origen===ped.id);
  r.pedido={folio:ped.folio,estatus:ped.estatus,cobro:cob0&&(cob0.numero+' '+cob0.total)}; r.stockConf=await stock();
  const pg=await post({accion:'capturar_pago_cliente',id_doc:cob0.id,monto:1000,fecha:'2026-10-08',cuenta:'BBVA',usuario:'prueba'}); r.pago=pg.ok;
  for(const t of ['cobranza','ingresos','pedidos']) await w.eval(`cargarTabla('${t}')`);
  r.boton=w.eval(`nunPedidoViejoRemisionable(State.data.pedidos.find(p=>p.id==='${ped.id}'))`);
  await w.eval(`nunDesdePedidos('${ped.id}','remisiones')`); await sleep(400);
  r.botonModal=!!d.getElementById('dpBotonR');
  await w.eval("nunDesdePedidosCrear('remisiones')"); await sleep(1500);
  r.error_modal=txt(d.getElementById('dpError'));
  const L=async t=>(await post({accion:'erp_listar',tabla:t})).items;
  const rem=(await L('remisiones')).find(x=>String(x.pedido_origen)===String(ped.folio));
  const cobs=(await L('cobranza')).filter(c=>c.cliente==='CLIENTE PRUEBA'&&!/cancel/i.test(c.estatus||''));
  const ings=(await L('ingresos')).filter(i=>i.cliente==='CLIENTE PRUEBA');
  const p2=(await L('pedidos')).find(p=>p.id===ped.id);
  r.rem=rem&&{folio:rem.folio,total:rem.total}; r.cobros=cobs.map(c=>({n:c.numero,t:c.tipo,tot:c.total,cob:c.cobrado,pend:c.pendiente,fo:c.factura_origen===(rem||{}).id}));
  r.ings=ings.map(i=>i.factura+' '+i.monto); r.pedEst=p2.estatus; r.stockFin=await stock();
  if(!r.boton||!r.botonModal) r.fallas.push('sin-boton');
  if(!rem) r.fallas.push('no-creo-remision');
  if(cobs.length!==1) r.fallas.push('cobros-'+cobs.length);
  else if(cobs[0].numero!==rem.folio||cobs[0].tipo!=='Remisión'||!r.cobros[0].fo||+cobs[0].cobrado!==1000||Math.abs(+cobs[0].pendiente-2480)>0.01) r.fallas.push('cobro-no-paso');
  if(!ings.length||ings.some(i=>i.factura!==(rem||{}).folio)) r.fallas.push('pago-no-paso');
  if(r.stockFin!==r.stockConf) r.fallas.push('inventario-doble');
  if(!/entregado/.test(p2.estatus)) r.fallas.push('estatus-pedido');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(4[1-9]|[5-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
