// v4.62 — un cobro encontrado solo por folio debe ser del mismo cliente: la F1124 de NUN (Público en General) chocaba con la 1124 de Bind
// de otro cliente y salía pagada. Al timbrar una factura PUE pregunta si se registra su pago.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', A='CLIENTE A PRUEBA', B='Público en General';
 const T={clientes:[{id:'c1',razon_social:A},{id:'c2',razon_social:B}],
  facturas:[{id:'bind_x1',folio:'1124',fecha:'2026-01-10',cliente:A,estatus:'timbrada',uuid_sat:'AAA',total:1000,metodo_pago:'PPD'},
   {id:'fac_n1',folio:'1124',fecha:'2026-07-10',cliente:B,estatus:'timbrada',uuid_sat:'bbb',total:178.52,metodo_pago:'PUE'},
   {id:'fac_n2',folio:'777',fecha:'2026-07-10',cliente:A,estatus:'timbrada',uuid_sat:'ccc',total:500,metodo_pago:'PUE'}],
  cobranza:[{id:'k1',numero:'1124',cliente:A,total:1000,cobrado:1000,pendiente:0},{id:'k2',numero:'777',cliente:'Cliente A Prueba',total:500,cobrado:0,pendiente:500}]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:T[b.tabla]||[]}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  await w.eval("Promise.all(['clientes','facturas','cobranza'].map(t=>cargarTabla(t)))");
  r.saldos=JSON.parse(w.eval("JSON.stringify(State.data.facturas.map(f=>nunSaldoDoc(f,'facturas')))"));
  if(JSON.stringify(r.saldos)!=='[0,178.52,500]') r.fallas.push('saldos');
  r.cobros=JSON.parse(w.eval("JSON.stringify(State.data.facturas.map(f=>(nunCobroDeDoc('facturas',f)||{}).id||null))"));
  if(JSON.stringify(r.cobros)!=='["k1",null,"k2"]') r.fallas.push('cobros');
  r.avisoPUE=/PUE[^]*nunPagoDesdeDoc/.test(w.eval("facturaTimbrar.toString()"));
  if(!r.avisoPUE) r.fallas.push('aviso-pue');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(6[2-9]|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
