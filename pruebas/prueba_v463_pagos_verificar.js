// v4.63 — Pagos que reportan los vendedores (tabla pagosverificar): aviso en Cobranza, ✅ Verificar = capturar_pago_cliente
// (con la cuenta y fecha que se eligen) + queda "verificado"; ✕ Rechazar = queda "rechazado" con motivo. Nada se borra.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', C='CLIENTE PRUEBA';
 const T={clientes:[{id:'c1',razon_social:C,vendedor:'LUIS'}],cuentas:[{nombre:'BBVA',activa:true},{nombre:'Efectivo Transferencia',activa:true}],
  cobranza:[{id:'k1',numero:'P0001',cliente:C,tipo:'Pedido',total:1000,cobrado:0,pendiente:1000,vendedor:'LUIS'}],
  pagosverificar:[{id:'v1',fecha:'2026-11-02',cliente:C,cobro_id:'k1',documento:'Pedido P0001',monto:400,cuenta:'BBVA',forma:'Transferencia',referencia:'ABC',vendedor:'LUIS',estatus:'por_verificar'},
   {id:'v2',fecha:'2026-11-03',cliente:C,cobro_id:'k1',documento:'Pedido P0001',monto:100,cuenta:'',forma:'Efectivo',vendedor:'LUIS',estatus:'por_verificar'},
   {id:'v3',fecha:'2026-11-01',cliente:C,cobro_id:'k1',monto:50,vendedor:'LUIS',estatus:'verificado'}]};
 const llamadas=[];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion&&b.accion!=='erp_listar'&&b.accion!=='kv_leer') llamadas.push(b);
    if(b.accion==='capturar_pago_cliente'){ const k=T.cobranza.find(x=>x.id===b.id_doc); k.cobrado+=b.monto; k.pendiente-=b.monto; }
    if(b.accion==='erp_upsert_batch'&&b.tabla==='pagosverificar') b.items.forEach(it=>Object.assign(T.pagosverificar.find(x=>x.id===it.id),it));
    const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:T[b.tabla]||[]}:b.accion==='listar_cuentas'?{ok:true,cuentas:T.cuentas}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); w.prompt=()=>'No llegó el depósito'; }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  w.eval("confirmDialog = async () => true");
  await w.eval("Promise.all(['clientes','cobranza'].map(t=>cargarTabla(t)))"); await w.eval("State.data.cuentas = [{nombre:'BBVA',activa:true},{nombre:'Efectivo Transferencia',activa:true}]");
  await w.eval("navegar('cobranza')"); await sleep(1500);
  r.banner=txt(d.getElementById('nunPVBanner'));
  if(!/2 pagos reportados/.test(r.banner)||!/\$500\.00/.test(r.banner)) r.fallas.push('banner');
  await w.eval("nunPVAbrir()"); await sleep(200);
  r.modal=txt(d.getElementById('modalPV')).slice(0,200);
  if(!/Pagos por verificar \(2\)/.test(r.modal)||!/LUIS/.test(r.modal)) r.fallas.push('modal');
  // v2 no trae cuenta: no deja verificar sin cuenta
  await w.eval("nunPVVerificar('v2')"); await sleep(200);
  r.sinCuenta=!llamadas.some(b=>b.accion==='capturar_pago_cliente');
  d.getElementById('pvC_v1').value='BBVA'; d.getElementById('pvF_v1').value='2026-11-02';
  await w.eval("nunPVVerificar('v1')"); await sleep(400);
  const cap=llamadas.find(b=>b.accion==='capturar_pago_cliente');
  r.captura=cap&&{id:cap.id_doc,monto:cap.monto,fecha:cap.fecha,cuenta:cap.cuenta,notas:cap.notas};
  r.v1=T.pagosverificar[0].estatus; r.k1=T.cobranza[0].pendiente;
  if(!r.sinCuenta||!cap||cap.id_doc!=='k1'||cap.monto!==400||cap.cuenta!=='BBVA'||cap.fecha!=='2026-11-02'||!/LUIS/.test(cap.notas)||!/ref ABC/.test(cap.notas)||r.v1!=='verificado'||r.k1!==600) r.fallas.push('verificar');
  // no se verifica dos veces
  await w.eval("nunPVVerificar('v1')"); await sleep(200);
  r.capturas=llamadas.filter(b=>b.accion==='capturar_pago_cliente').length; if(r.capturas!==1) r.fallas.push('doble');
  await w.eval("nunPVRechazar('v2')"); await sleep(300);
  r.v2=[T.pagosverificar[1].estatus,T.pagosverificar[1].motivo]; if(r.v2[0]!=='rechazado'||r.v2[1]!=='No llegó el depósito') r.fallas.push('rechazar');
  r.borrados=llamadas.filter(b=>/borrar|eliminar/.test(b.accion)).length; if(r.borrados) r.fallas.push('borrado');
  r.version=txt(d.querySelector('.rwd-version')); if(!/v4\.(6[3-9]|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
