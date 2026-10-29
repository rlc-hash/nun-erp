// v4.60 — Tocar el logo NUN actualiza los datos (vuelve a bajar las tablas) · una factura de remisiones (FT0016 = "R0023, R0024, REM 262")
// se ve en el pedido de cada remisión en "Pedidos (como tu Excel)", aunque esté en borrador, sin cambiar lo que falta.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', C='CLIENTA PRUEBA';
 const T={clientes:[{id:'c1',razon_social:C}],
  pedidos:[{id:'p1',folio:'1224',fecha:'2026-05-01',cliente:C,estatus:'entregado',total:1000},{id:'p2',folio:'1257',fecha:'2026-05-20',cliente:C,estatus:'entregado',total:500}],
  remisiones:[{id:'r1',folio:'R0023',fecha:'2026-05-06',cliente:C,estatus:'entregada',total:1000,pedido_origen:'1224'},{id:'r2',folio:'262',fecha:'2026-08-04',cliente:C,estatus:'pendiente',total:500,pedido_origen:'1257'}],
  facturas:[{id:'f1',folio:'FT0016',fecha:'2026-10-29',cliente:C,estatus:'borrador',total:1500,pedido_origen:'R0023, REM 262',items_json:'[]'}],
  cobranza:[{id:'k1',numero:'R0023',cliente:C,tipo:'Remisión',total:1000,cobrado:400,pendiente:600,factura_origen:'r1'},{id:'k2',numero:'V01262',cliente:C,tipo:'Remisión',total:500,cobrado:0,pendiente:500,factura_origen:'r2'}]};
 let llamadas=0;
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion==='erp_listar') llamadas++; const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:T[b.tabla]||[]}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  await w.eval("Promise.all(['clientes','pedidos','remisiones','facturas','cobranza'].map(t=>cargarTabla(t)))");
  const P=JSON.parse(w.eval("JSON.stringify(nunPedidosExcelCalc(State.data.clientes[0]).map(x=>[nunFolioStr(x.p),x.falta,x.docs.map(d=>d.L+d.folio+(d.bor?'(b)':'')).join(' ')]))"));
  r.pedidos=P;
  if(JSON.stringify(P)!=='[["1224",600,"RR0023 FFT0016(b)"],["1257",500,"R262 FFT0016(b)"]]') r.fallas.push('factura-en-pedido');
  r.onclickLogo=d.querySelector('.rwd-brand').getAttribute('onclick');
  if(r.onclickLogo!=='nunActualizarTodo()') r.fallas.push('logo');
  T.facturas[0].estatus='timbrada'; const antes=llamadas;
  await w.eval("nunActualizarTodo()"); await sleep(300);
  r.llamadas=llamadas-antes; r.estatusNuevo=w.eval("State.data.facturas[0].estatus");
  if(r.llamadas<5||r.estatusNuevo!=='timbrada') r.fallas.push('actualizar');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(6\d|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
