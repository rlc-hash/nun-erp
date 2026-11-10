// v4.74 (Rafa 10 nov): en el teléfono salía "El servidor no respondió…". Ahora las listas se piden de 4 en 4 (nunca más de 4 a la vez) y si una
// falla el aviso dice que se reintenta sola y, al reintentar con éxito, se quita el aviso y se ven los datos nuevos. Servidor simulado, sin red.
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 let activos=0,max=0,fallaCobranza=true;
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'X',usuario:{codigo:'X',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ let b={}; try{b=JSON.parse(o&&o.body||'{}')}catch(e){}
     if(b.accion==='erp_listar'){ activos++; max=Math.max(max,activos); await sleep(30); activos--;
       if(b.tabla==='cobranza'&&fallaCobranza) return {ok:false,json:async()=>{throw new Error('html')},text:async()=>'<html>',clone(){return this;}};
       const items=b.tabla==='cobranza'?[{id:'c1',numero:'F1',cliente:'CLIENTE A',total:100,cobrado:0,pendiente:100}]:[];
       return {ok:true,json:async()=>({ok:true,items}),text:async()=>'{}',clone(){return this;}}; }
     return {ok:true,json:async()=>({ok:true}),text:async()=>'{}',clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(2500);
 await w.eval("Promise.all(['clientes','productos','cotizaciones','pedidos','remisiones','facturas','notascredito','cobranza','ingresos'].map(t=>cargarTabla(t,{ttl:0}).catch(()=>{})))");
 r.maxALaVez=max; if(max>4) r.fallas.push('mas_de_4');
 const av=d.getElementById('nunAvisoCopia'); r.aviso=av&&av.textContent; r.programado=w.eval('!!_nunReintento.timer');
 if(!av||!/reintenta sola/i.test(av.textContent)||!r.programado) r.fallas.push('aviso');
 fallaCobranza=false; await w.eval('nunReintentarListas(true)');
 r.avisoDespues=!!d.getElementById('nunAvisoCopia'); r.cobranza=w.eval('(State.data.cobranza||[]).length'); r.timerDespues=w.eval('!!_nunReintento.timer');
 if(r.avisoDespues||r.cobranza!==1||r.timerDespues) r.fallas.push('reintento');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; if(!/v4\.(7[4-9]|[89]\d)/.test(r.version||'')) r.fallas.push('version');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
