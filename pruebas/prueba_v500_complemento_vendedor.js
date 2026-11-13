// v5.00 — pago reportado por el vendedor sobre una factura PPD timbrada: en "Pagos por confirmar" sale 🧾 Confirmar y timbrar complemento.
// Abre "Pago y complemento" con lo reportado (monto, fecha, cuenta, forma 03, referencia); pide confirmación; timbra (Facturama simulado),
// apunta el REP en la factura, registra el pago en el cobro del pago reportado con notas "Reportado por…" y lo deja verificado. Nada se borra.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', C='CLIENTE PRUEBA';
 const T={clientes:[{id:'c1',razon_social:C,vendedor:'EDGAR',rfc:'XAXX010101000',cp:'06020',regimen_fiscal:'601'}],cuentas:[{nombre:'BBVA',activa:true},{nombre:'Efectivo',activa:true}],
  pedidos:[{id:'p1',folio:'P0001',cliente:C,total:1160,estatus:'confirmado',vendedor:'EDGAR'}],
  facturas:[{id:'f1',folio:'FT0010',cliente:C,total:1160,subtotal:1000,iva:160,metodo_pago:'PPD',forma_pago:'99',uuid_sat:'aaaaaaaa-1111-2222-3333-444444444444',estatus:'timbrada',pedido_origen:'P0001',
    items_json:JSON.stringify([{sku:'X1',cantidad:1,precio_unitario:1000,iva_pct:16}]),notas:'Cobro en P0001 (id cob_p1)'},
   {id:'f2',folio:'FT0011',cliente:C,total:500,metodo_pago:'PUE',uuid_sat:'bbbb',estatus:'timbrada',notas:''}],
  cobranza:[{id:'cob_p1',numero:'P0001',cliente:C,tipo:'Pedido',total:1160,cobrado:0,pendiente:1160,factura_origen:'p1',vendedor:'EDGAR'},
   {id:'cob_f2',numero:'FT0011',cliente:C,tipo:'Factura',total:500,cobrado:0,pendiente:500,factura_origen:'f2'}],
  pagosverificar:[{id:'v1',fecha:'2026-11-12',cliente:C,cobro_id:'cob_p1',documento:'Pedido P0001',monto:600,cuenta:'BBVA',forma:'Transferencia',referencia:'RASTREO9',vendedor:'EDGAR',estatus:'por_verificar'},
   {id:'v2',fecha:'2026-11-12',cliente:C,cobro_id:'cob_f2',documento:'Factura FT0011',monto:100,cuenta:'BBVA',forma:'Efectivo',vendedor:'EDGAR',estatus:'por_verificar'}]};
 const llamadas=[];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion&&!/^(erp_listar|kv_leer|listar_|obtener_|version|archivo_)/.test(b.accion)) llamadas.push(b);
    let res={ok:true,valores:{},mensaje:'ok'};
    if(b.accion==='capturar_pago_cliente'){ const k=T.cobranza.find(x=>x.id===b.id_doc); k.cobrado+=b.monto; k.pendiente-=b.monto; }
    if(b.accion==='erp_upsert_batch'&&T[b.tabla]) b.items.forEach(it=>Object.assign(T[b.tabla].find(x=>x.id===it.id),it));
    if(b.accion==='facturama_timbrar') res={ok:true,uuid:'cccccccc-0000-0000-0000-000000000001',id:'fx1',xml:'<x/>'};
    if(b.accion==='erp_listar') res={ok:true,items:T[b.tabla]||[]}; if(b.accion==='listar_cuentas') res={ok:true,cuentas:T.cuentas};
    if(b.accion==='archivo_listar') res={ok:true,items:[]};
    const t=JSON.stringify(res); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  w.eval("window._conf=[]; confirmDialog = async (o) => { window._conf.push(o.title); return true; }");
  await w.eval("Promise.all(['clientes','cobranza','facturas','pedidos','pagosverificar'].map(t=>cargarTabla(t)))"); await w.eval("State.data.cuentas = [{nombre:'BBVA',activa:true},{nombre:'Efectivo',activa:true}]");
  r.ppd=w.eval("[nunPVFacturasPPD(State.data.pagosverificar[0]).map(f=>f.folio), nunPVFacturasPPD(State.data.pagosverificar[1]).map(f=>f.folio)]");
  if(JSON.stringify(r.ppd)!=='[["FT0010"],[]]') r.fallas.push('detecta PPD');
  await w.eval("nunPVAbrir()"); await sleep(200);
  r.modal=txt(d.getElementById('modalPV'));
  if(!/Confirmar y timbrar complemento \(FT0010\)/.test(r.modal)||!/Solo registrar \(sin complemento\)/.test(r.modal)||!/factura PPD/.test(r.modal)) r.fallas.push('botón');
  if((r.modal.match(/timbrar complemento/g)||[]).length!==1) r.fallas.push('solo el PPD');
  await w.eval("nunPVComplemento('v1','f1')"); await sleep(600);
  const v=id=>(d.getElementById(id)||{}).value;
  r.form={monto:v('repMonto'),fecha:v('repFecha'),forma:v('repForma'),cuenta:v('repCuenta'),op:v('repOperacion'),pv:!!d.getElementById('modalPV'),boton:txt(d.getElementById('repBoton'))};
  if(r.form.monto!=='600'||r.form.fecha!=='2026-11-12'||r.form.forma!=='03'||r.form.cuenta!=='BBVA'||r.form.op!=='RASTREO9'||r.form.pv) r.fallas.push('prellenado');
  await w.eval("nunConfirmarComplementoPago('f1')"); await sleep(1500);
  const tim=llamadas.find(b=>b.accion==='facturama_timbrar'), cap=llamadas.find(b=>b.accion==='capturar_pago_cliente');
  r.conf=w.eval("window._conf"); if(!/Timbrar el complemento/.test(r.conf.join())) r.fallas.push('pide confirmación');
  r.timbre=tim&&{monto:tim.cfdi.Complemento.Payments[0].Amount,forma:tim.cfdi.Complemento.Payments[0].PaymentForm,ant:tim.cfdi.Complemento.Payments[0].RelatedDocuments[0].PreviousBalanceAmount,op:tim.cfdi.Complemento.Payments[0].OperationNumber};
  if(!tim||r.timbre.monto!==600||r.timbre.forma!=='03'||r.timbre.ant!==1160||r.timbre.op!=='RASTREO9') r.fallas.push('timbre');
  r.captura=cap&&{id:cap.id_doc,monto:cap.monto,cuenta:cap.cuenta,notas:cap.notas};
  if(!cap||cap.id_doc!=='cob_p1'||cap.monto!==600||!/^Reportado por EDGAR/.test(cap.notas)||!/con complemento/.test(cap.notas)) r.fallas.push('pago');
  r.notasFac=T.facturas[0].notas; if(!/REP CP0001 uuid=cccccccc-0000-0000-0000-000000000001 monto=600\.00 fecha=2026-11-12 parc=1/.test(r.notasFac)) r.fallas.push('REP en factura');
  r.v1=T.pagosverificar[0].estatus; if(r.v1!=='verificado') r.fallas.push('verificado');
  r.v2=T.pagosverificar[1].estatus; if(r.v2!=='por_verificar') r.fallas.push('v2 intacto');
  r.timbres=llamadas.filter(b=>b.accion==='facturama_timbrar').length; if(r.timbres!==1) r.fallas.push('un timbre');
  // ya verificado: no se vuelve a timbrar
  await w.eval("nunPVComplemento('v1','f1')"); await sleep(400);
  if(llamadas.filter(b=>b.accion==='facturama_timbrar').length!==1||d.getElementById('modalREP')) r.fallas.push('doble');
  r.borrados=llamadas.filter(b=>/borrar|eliminar/.test(b.accion)).length; if(r.borrados) r.fallas.push('borrado');
  r.version=txt(d.querySelector('.rwd-version')); if(!/v5\.\d\d/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
