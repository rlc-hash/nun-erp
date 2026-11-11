// v4.89 (Rafa 11 nov: "le piqué al aviso y me llevó otra vez al dashboard") — al abrir el sistema desde el aviso (?ir=…&id=…) el destino ya no se
// pierde cuando arranca el sistema (boot ponía #/dashboard) y se abre el documento aunque su lista llegue tarde. Y el service worker: si la app
// abierta no contesta (dormida en el teléfono) carga la liga del aviso. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');const vm=require('vm');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE X'}],cotizaciones:[{id:'q1',folio:'C0016',fecha:'2026-11-11',cliente:'CLIENTE X',estatus:'enviada',total:3300,items_json:'[]'}],pedidos:[],facturas:[],cobranza:[],remisiones:[],ingresos:[]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/?ir=cotizaciones&id=q1',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar'){ if(b.tabla==='cotizaciones') await sleep(4000); x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))}; }
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; const titulo=()=>((d.getElementById('drawerTitle')||{}).textContent||'')+' '+((d.getElementById('drawerSub')||{}).textContent||'');
 await sleep(1500);
 r.hashMientrasCarga=w.location.hash; r.moduloMientrasCarga=w.eval('State.modulo');
 if(r.hashMientrasCarga!=='#/cotizaciones'||r.moduloMientrasCarga!=='cotizaciones') r.fallas.push('se fue al Inicio mientras cargaba');
 for(let i=0;i<20&&!/C0016/.test(titulo());i++) await sleep(500);
 r.abierto=titulo().replace(/\s+/g,' ').trim(); if(!/C0016/.test(r.abierto)) r.fallas.push('no abrió la cotización');
 r.ligaLimpia=!/ir=/.test(w.location.search); if(!r.ligaLimpia) r.fallas.push('liga limpia');
 r.pendienteBorrado=w.sessionStorage.getItem('nun_ir_pendiente')===null; if(!r.pendienteBorrado) r.fallas.push('pendiente sin borrar');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3);
 // service worker: 3 casos
 const code=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 async function clic(cliente){ const ev={}, log=[]; const self={ registration:{ scope:'https://x.io/nun-erp/', showNotification(){} },
   clients:{ matchAll:async()=>cliente?[cliente(log)]:[], openWindow:async u=>{log.push('open '+u);}, claim(){} }, skipWaiting(){},
   addEventListener:(n,f)=>{ev[n]=f;} };
  vm.runInNewContext(code,{self,URL,MessageChannel,setTimeout,Promise});
  let p; ev.notificationclick({ notification:{ close(){}, data:{ url:'./?ir=cotizaciones&id=q1' } }, waitUntil:x=>{p=x;} }); await p; return log; }
 const cli=(contesta)=>log=>({ url:'https://x.io/nun-erp/#/dashboard', focus:async function(){log.push('focus');return this;},
   postMessage(m,ports){ log.push('msg '+m.nunIr+' '+m.id); if(contesta) ports[0].postMessage({ok:1}); }, navigate:async u=>{log.push('navigate '+u); return {};} });
 r.swDespierta=await clic(cli(true)); if(r.swDespierta.some(x=>/navigate|open/.test(x))||!r.swDespierta.includes('msg cotizaciones q1')) r.fallas.push('sw: app despierta');
 r.swDormida=await clic(cli(false)); if(!r.swDormida.some(x=>/navigate .*ir=cotizaciones&id=q1/.test(x))) r.fallas.push('sw: app dormida');
 r.swCerrada=await clic(null); if(!r.swCerrada.some(x=>/open .*ir=cotizaciones&id=q1/.test(x))) r.fallas.push('sw: app cerrada');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
