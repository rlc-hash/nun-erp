// v4.14 — FLUJO NUEVO DE VENTA probado contra el servidor de verdad (backend/Codigo.gs corriendo en el emulador de Supabase):
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
  r.cotizacion={folio:cot.item.folio,stock:await stock()};
  for(const t of ['cotizaciones','pedidos','remisiones','facturas','cobranza','productos','ingresos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  // 1) cotización: botón Confirmar → Pedido
  w.eval("abrirDoc('cotizaciones','cot1')"); await sleep(300);
  r.botonConfirmar=/Confirmar → Pedido/.test(txt(d.querySelector('.drawer'))); r.sinViejoBoton=!/→ Pedido<\/button>/.test(d.querySelector('.drawer').innerHTML.replace('✅ Confirmar → Pedido',''));
  await w.eval("nunConfirmarCotizacion('cot1')"); await sleep(300);
  const ped=w.eval("State").data.pedidos.find(p=>p.cotizacion_origen===cot.item.folio);
  const cob=w.eval("State").data.cobranza.filter(c=>c.factura_origen===(ped||{}).id);
  r.pedido={folio:ped&&ped.folio,estatus:ped&&ped.estatus,stock:await stock(),cobros:cob.map(c=>c.tipo+' '+c.numero+' '+c.total),cot:w.eval("State").data.cotizaciones.find(x=>x.id==='cot1').estatus};
  // 2) pedido: sin "Confirmar" (ya es venta), con "Hacer factura"; en la ventana no hay "Hacer remisión"
  w.eval(`abrirDoc('pedidos','${ped.id}')`); await sleep(300); const dr=txt(d.querySelector('.drawer'));
  r.drawerPedido={hacerFactura:/Hacer factura/.test(dr),confirmar:/✅ Confirmar pedido/.test(dr),saldo:/Saldo \$3,480\.00/.test(dr)};
  try{ w.eval('cerrarDrawer()'); }catch(e){}
  await w.eval(`nunDesdePedidos('${ped.id}','facturas')`); await sleep(300);
  r.sinRemision=!d.getElementById('dpBotonR')&&!!d.getElementById('dpBoton');
  const sel=d.getElementById('dpIva'); if(sel){ const op=[...sel.options].find(o=>/NO incluye/.test(o.textContent))||sel.options[1]; sel.value=op.value; sel.dispatchEvent(new w.Event('change')); }
  await w.eval("nunDesdePedidosCrear('facturas')"); await sleep(800);
  await w.eval("Promise.all(['facturas','cobranza','pedidos'].map(t=>cargarTabla(t)))");
  const fac=w.eval("State").data.facturas.find(f=>String(f.pedido_origen)===String(ped.folio));
  r.factura={folio:fac&&fac.folio,total:fac&&fac.total,cobrosNuevos:w.eval("State").data.cobranza.filter(c=>c.factura_origen===(fac||{}).id).length,
    cobroQueUsa:fac&&(w.eval(`nunCobroDeDoc('facturas',State.data.facturas.find(f=>f.id==='${fac.id}'))`)||{}).id, cobrosTotales:w.eval("State").data.cobranza.length};
  // 3) tablero: cuenta el pedido (venta) y no la factura
  const ven=w.eval("nunTableroVentas()"); r.tablero=ven.map(v=>v.total);
  // 4) cancelar pedido con factura viva: no; con factura cancelada: sí, regresa inventario y cancela su cobro
  r.cancelarConFactura=await w.eval(`nunCancelarPedidoVentaSiAplica(State.data.pedidos.find(p=>p.id==='${ped.id}'))`);
  await post({accion:'erp_upsert_batch',tabla:'facturas',items:[{id:fac.id,estatus:'cancelada'}]});
  r.cancelar=await w.eval(`nunCancelarPedidoVentaSiAplica(State.data.pedidos.find(p=>p.id==='${ped.id}'))`);
  r.trasCancelar={stock:await stock(),cobro:(await post({accion:'erp_listar',tabla:'cobranza'})).items.find(c=>c.factura_origen===ped.id).estatus};
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.cotizacion.folio!=='C0001'||r.cotizacion.stock!=='10/2') r.fallas.push('cotizacion');
  if(!r.botonConfirmar||!r.sinViejoBoton) r.fallas.push('botonCotizacion');
  if(!/^P\d{4}$/.test(r.pedido.folio||'')||r.pedido.estatus!=='confirmado'||r.pedido.stock!=='8/0'||r.pedido.cobros.join()!=='Pedido '+r.pedido.folio+' 3480'||r.pedido.cot!=='convertida') r.fallas.push('confirmar');
  if(!r.drawerPedido.hacerFactura||r.drawerPedido.confirmar||!r.drawerPedido.saldo||!r.sinRemision) r.fallas.push('pedido');
  if(!r.factura.folio||r.factura.cobrosNuevos!==0||r.factura.cobroQueUsa!=='cob_'+ped.id) r.fallas.push('factura');
  if(r.tablero.join()!=='3480') r.fallas.push('tablero');
  if(r.cancelarConFactura!==false||r.cancelar!==true||r.trasCancelar.stock!=='10/0'||r.trasCancelar.cobro!=='cancelado') r.fallas.push('cancelar');
  if(!/v4\.(1[4-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
