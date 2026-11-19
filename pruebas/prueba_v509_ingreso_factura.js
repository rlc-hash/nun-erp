// v5.09 (Rafa 19 nov: "estos pagos me salen en remisión y deben de ser facturas") — el pago de una factura PUE que se cobra en el cobro de su
// remisión (comentario "Pago de la factura FT…") se ve en Ingresos como 🧾 FT… (cobro R…). Los demás pagos se ven igual. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const DB={ingresos:[{id:'i1',fecha:'2026-10-29',cliente:'CLIENTE X',factura:'R0024',cuenta:'BBVA',tipo:'cobro',monto:49105,comentarios:'Pago de Remisión R0024 · Pago de la factura FT0016 (PUE)'},
  {id:'i2',fecha:'2026-10-28',cliente:'CLIENTE Y',factura:'V01325',cuenta:'BBVA',tipo:'cobro',monto:25000,comentarios:'Pago de Remisión V01325'}]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(2500); await w.eval("cargarTabla('ingresos')"); w.eval("navegar('ingresos')"); await sleep(500);
 const filas=[...d.querySelectorAll('table tbody tr')].filter(t=>/BBVA/.test(t.textContent)).map(t=>t.textContent.replace(/\s+/g,' '));
 r.f1=filas.find(x=>/CLIENTE X/.test(x)); r.f2=filas.find(x=>/CLIENTE Y/.test(x));
 if(!/🧾 FT0016 \(cobro R0024\)/.test(r.f1||'')) r.fallas.push('pago de factura muestra la factura');
 if(!/V01325/.test(r.f2||'')||/🧾/.test(r.f2||'')) r.fallas.push('los demás igual');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; if(!/^v5\.(09|[1-9]\d)/.test(r.version)) r.fallas.push('version');
 if(errs.length){r.errs=errs.slice(0,3);r.fallas.push('errores');}
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
