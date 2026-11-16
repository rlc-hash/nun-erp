// v5.03 (auditoría 16 nov) — la R0031 se canceló con $9,000 ya cobrados para hacer un pedido y factura nuevos: el pago y la salida de inventario
// quedaron DOS veces. Ahora: remisión (o factura sin timbrar) con pagos NO se deja cancelar (ni con el botón ni cambiando el estatus) y explica qué
// hacer; sin pagos se cancela normal; factura timbrada con pagos pide confirmación fuerte antes de cancelar ante el SAT. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', C='CLIENTE CANCELA';
 const T={clientes:[{id:'c1',razon_social:C}],
  remisiones:[{id:'r1',folio:'R0031',cliente:C,total:9000,estatus:'entregada',items_json:'[]'},{id:'r2',folio:'R0032',cliente:C,total:500,estatus:'entregada',items_json:'[]'}],
  facturas:[{id:'f1',folio:'FT0030',cliente:C,total:1160,estatus:'timbrada',uuid_sat:'u-1',items_json:'[]',notas:'Facturama ID: abc'}],
  cobranza:[{id:'k1',numero:'R0031',cliente:C,tipo:'Remisión',total:9000,cobrado:9000,pendiente:0,factura_origen:'r1'},{id:'k2',numero:'R0032',cliente:C,tipo:'Remisión',total:500,cobrado:0,pendiente:500,factura_origen:'r2'},
   {id:'k3',numero:'FT0030',cliente:C,tipo:'Factura',total:1160,cobrado:1160,pendiente:0,factura_origen:'f1'}],pedidos:[],ingresos:[]};
 const llamadas=[];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion&&!/^(erp_listar|kv_leer|listar_|obtener_|version)/.test(b.accion)) llamadas.push(b);
    if(b.accion==='erp_upsert_batch'&&T[b.tabla]) b.items.forEach(it=>Object.assign(T[b.tabla].find(x=>x.id===it.id)||{},it));
    const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:T[b.tabla]||[]}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); w.prompt=()=>'02'; w.confirm=()=>true; }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
 await sleep(3000); const r={fallas:[]};
 try{
  w.eval("window._preg=[]; confirmDialog = async (o) => { window._preg.push(o.title + ' | ' + o.message); return /cancelar ante el SAT|Cancelar documento/.test(o.ok||'') ? window._resp !== false : true; }");
  await w.eval("Promise.all(['clientes','remisiones','facturas','cobranza'].map(t=>cargarTabla(t)))");
  // 1) remisión con pagos: el botón no la cancela
  await w.eval("eliminarDoc('remisiones','r1')"); await sleep(300);
  r.r1=T.remisiones[0].estatus; r.preg1=w.eval('window._preg.slice(-1)[0]||""').slice(0,400);
  if(r.r1!=='entregada'||!/No se puede cancelar la remisión R0031/.test(r.preg1)||!/\$9,000\.00/.test(r.preg1)||!/Facturar remisión/.test(r.preg1)) r.fallas.push('remisión con pagos no se cancela (botón)');
  // 2) remisión con pagos: cambiar el estatus en el editor tampoco
  r.puede=await w.eval("nunPuedeCancelarDoc('remisiones', State.data.remisiones[0])"); if(r.puede!==false) r.fallas.push('candado del editor');
  // 3) remisión sin pagos: se cancela normal (y su cobro)
  await w.eval("eliminarDoc('remisiones','r2')"); await sleep(400);
  r.r2=[T.remisiones[1].estatus,T.cobranza[1].estatus]; if(r.r2[0]!=='cancelada'||r.r2[1]!=='cancelado') r.fallas.push('sin pagos se cancela normal');
  // 4) factura timbrada con pagos: pregunta fuerte; si dice que no, no se cancela ante el SAT
  w.eval('window._resp=false'); const n0=llamadas.filter(b=>b.accion==='facturama_cancelar').length;
  await w.eval("facturaCancelar('f1')"); await sleep(300);
  r.preg4=w.eval('window._preg.slice(-1)[0]||""').slice(0,160);
  if(!/La factura FT0030 ya tiene \$1,160\.00 cobrados/.test(r.preg4)||llamadas.filter(b=>b.accion==='facturama_cancelar').length!==n0) r.fallas.push('factura timbrada con pagos: pregunta y respeta el no');
  r.borrados=llamadas.filter(b=>/borrar|eliminar/.test(b.accion)).length; if(r.borrados) r.fallas.push('borrado');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
