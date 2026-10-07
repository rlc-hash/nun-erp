// v4.16 — Historial de cambios por documento (quién y cuándo) y el sistema manda el nombre de quien hace cada cambio. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const LOG=[];
const DB={pedidos:[{id:'p1',folio:'1332',cliente:'CLIENTE X',estatus:'confirmado',total:8250,fecha:'2026-09-17',items_json:'[]'}],remisiones:[],facturas:[],cobranza:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; LOG.push(b); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='historial_doc') return J({ok:true,cambios:[{fecha:'2026-10-07 13:35:03',accion:'erp_upsert_batch pedidos p1',quien:'Yazmín',ok:true},{fecha:'2026-10-06 18:00:00',accion:'erp_crear pedidos p1',quien:'',ok:true}]});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={fallas:[]};try{
 for(const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
 r.mandaNombre=LOG.filter(b=>b.accion).every(b=>b._quien==='Rafa');
 w.eval("abrirDoc('pedidos','p1')"); await sleep(300); r.boton=/🕘 Cambios/.test(txt(d.querySelector('.drawer')));
 await w.eval("nunHistorialDoc('p1')"); await sleep(100);
 const m=txt(d.getElementById('modalHIS')); r.ventana={hora:/2026-10-07 13:35:03\s*Se guardó \/ cambió\s*Yazmín/.test(m),creado:/Se creó\s*—/.test(m)};
 r.version=txt(d.querySelector('.rwd-version'));
 if(!r.mandaNombre) r.fallas.push('nombre'); if(!r.boton) r.fallas.push('boton'); if(!r.ventana.hora||!r.ventana.creado) r.fallas.push('ventana');
 if(!/v4\.(1[6-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
