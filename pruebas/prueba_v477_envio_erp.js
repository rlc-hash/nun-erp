// v4.77 — 🚚 Envío (por dónde se manda: fletera/paquetería) en cotización/pedido/remisión/factura del ERP: se ve, sugiere los usados y se guarda.
// Sin red; datos inventados.
const ENV=[];
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion==='erp_upsert_batch'||b.accion==='erp_crear') ENV.push(b); const t=JSON.stringify({ok:true,items:[],valores:{},item:b.item}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
 await sleep(1500);
 w.eval(`State.data.cotizaciones=[{id:'q1',folio:'C0011',fecha:'2026-11-10',cliente:'CLIENTE X',estatus:'enviada',total:10,envio:'Fletera Castores',items_json:'[{"sku":"A","descripcion":"x","cantidad":1,"precio_unitario":10}]'}];
   State.data.pedidos=[{id:'p1',folio:'P0001',cliente:'CLIENTE X',envio:'Paquetexpress'}]; abrirDoc('cotizaciones','q1');`);
 await sleep(500);
 const e=d.getElementById('dEnvio'); const r={campo:!!e&&e.value==='Fletera Castores',sugiere:[...d.querySelectorAll('#dEnvioLista option')].map(o=>o.value).join()};
 e.value='Recoge en bodega'; await w.eval("guardarDoc('cotizaciones','q1')"); await sleep(800);
 const g=ENV.find(x=>x.tabla==='cotizaciones'); r.guardado=g&&((g.items&&g.items[0].envio)||(g.item&&g.item.envio));
 w.eval("abrirDoc('notascredito',null)"); await sleep(200); r.ncSinCampo=!d.getElementById('dEnvio');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errores=errs.slice(0,3);
 const ok=r.campo&&r.sugiere==='Fletera Castores,Paquetexpress'&&r.guardado==='Recoge en bodega'&&r.ncSinCampo;
 console.log(JSON.stringify(Object.assign(r,ok?{}:{error:'falla'}),null,1)); process.exit(0);
})().catch(e=>{console.log(JSON.stringify({error:String(e.stack).slice(0,500)}));process.exit(0);});
