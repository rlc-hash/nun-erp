// v4.65 — Avisos de lo que suben los vendedores: la campana cuenta cotizaciones por confirmar y pagos por verificar;
// si llega una nueva con el sistema abierto sale un aviso arriba (una sola vez); la lista dice "por confirmar"; ya no avisa de Bind.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const T={cotizaciones:[{id:'q1',folio:'C0001',fecha:'2026-11-04',cliente:'CLIENTE A',vendedor:'EDGAR',estatus:'enviada',total:1110,items_json:'[]'}],
  pagosverificar:[{id:'v1',cliente:'CLIENTE A',monto:500,vendedor:'LUIS',estatus:'por_verificar'}]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.localStorage.setItem('nun_sync_ultima', new Date(Date.now()-10*3600e3).toISOString());
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:T[b.tabla]||[]}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  await w.eval("nunAvisosRevisar('callado')"); await sleep(200);
  r.bannerAlAbrir=!!d.getElementById('nunAvisoBanner'); // lo que ya estaba pendiente no sale como aviso (sí en la campana)
  r.notifs=JSON.parse(w.eval("JSON.stringify(generarNotificaciones().map(n=>[n.tipo,n.titulo]))"));
  if(r.bannerAlAbrir||!r.notifs.some(n=>n[0]==='cotizaciones'&&/1 cotización por confirmar/.test(n[1]))||!r.notifs.some(n=>n[0]==='pagos_verificar')||r.notifs.some(n=>n[0]==='sync_viejo')) r.fallas.push('campana');
  // llega una nueva
  T.cotizaciones.push({id:'q2',folio:'C0002',fecha:'2026-11-04',cliente:'CLIENTE B',vendedor:'LUIS',estatus:'enviada',total:2000,items_json:'[]'});
  await w.eval("nunAvisosRevisar()"); await sleep(200);
  r.aviso=txt(d.getElementById('nunAvisoBanner'));
  if(!/Cotización nueva C0002 de LUIS/.test(r.aviso)||/C0001/.test(r.aviso)) r.fallas.push('aviso');
  d.getElementById('nunAvisoBanner').innerHTML='';
  await w.eval("nunAvisosRevisar()"); await sleep(200);
  r.noRepite=!txt(d.getElementById('nunAvisoBanner')); if(!r.noRepite) r.fallas.push('repite');
  await w.eval("navegar('cotizaciones')"); await sleep(1200);
  r.lista=/C0001.*por confirmar/.test(txt(d.querySelector('#dt_cotizaciones')||d.body)); if(!r.lista) r.fallas.push('lista');
  r.push=w.eval("typeof nunPushActivar==='function' && typeof nunPushEstado==='function'"); if(!r.push) r.fallas.push('push');
  r.version=txt(d.querySelector('.rwd-version')); if(!/v4\.(6[5-9]|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
