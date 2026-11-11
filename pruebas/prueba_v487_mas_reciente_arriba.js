// v4.87 / app v2.1.18 (Rafa: "en cotizaciones que aparezca la más reciente arriba; sale 15, 14 y la 16 no") — listas de documentos del ERP
// y "Cotizaciones por confirmar" de la app: fecha más nueva arriba y, el mismo día, el folio más alto. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const COTS=[{id:'a',folio:'C0014',fecha:'2026-11-10T06:00:00.000Z',cliente:'A',estatus:'enviada',total:1,items_json:'[]'},{id:'b',folio:'C0016',fecha:'2026-11-11',cliente:'B',estatus:'enviada',total:1,items_json:'[]'},
  {id:'c',folio:'C0015',fecha:'2026-11-11T06:00:00.000Z',cliente:'C',estatus:'enviada',total:1,items_json:'[]'},{id:'d',folio:'C0009',fecha:'2026-11-11',cliente:'D',estatus:'enviada',total:1,items_json:'[]'}];
(async()=>{const r={fallas:[]};try{
 // ERP
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:b.tabla==='cotizaciones'?COTS:[]}:{ok:true,items:[],valores:{}}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window; await sleep(2500); await w.eval("cargarTabla('cotizaciones')"); await w.eval("navegar('cotizaciones')"); await sleep(800);
 r.erp=[...w.document.querySelectorAll('#dt_cotizaciones tbody tr, table.dt tbody tr')].map(tr=>(tr.textContent.match(/C00\d\d/)||[''])[0]).filter(Boolean);
 if(r.erp.join()!=='C0016,C0015,C0009,C0014') r.fallas.push('orden ERP');
 r.version=(w.document.querySelector('.rwd-version')||{}).textContent; r.errsErp=errs.slice(0,2);
 // app de vendedores (la misma regla)
 const H=fs.readFileSync(path.join(__dirname,'..','ventas','index.html'),'utf8');
 const f10=H.match(/function fecha10\(f\)\{[^\n]*\n/)[0], fn=H.match(/function folioNum\(f\)\{[^\n]*\n/)[0], mr=H.match(/function masReciente\(a, b\)\{[^\n]*\n/)[0];
 const masReciente=new Function(f10+fn+mr+'return masReciente;')();
 r.app=COTS.slice().sort(masReciente).map(c=>c.folio); if(r.app.join()!=='C0016,C0015,C0009,C0014') r.fallas.push('orden app');
 r.inicioOrdena=/c\.estatus === 'enviada'\)\)\.sort\(masReciente\)/.test(H); if(!r.inicioOrdena) r.fallas.push('inicio de la app ordenado');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
