// v4.94 (Rafa 12 nov: "Yazmín ya las confirmó y siguen en por confirmar") — la lista que estás viendo se redibuja sola cuando cambia en el servidor
// (el sistema revisa cada minuto); no si tienes una ficha abierta. Y guardar una cotización ya no espera a bajar Cobranza. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE X'}],cotizaciones:[{id:'q1',folio:'C0018',fecha:'2026-11-12',cliente:'CLIENTE X',vendedor:'EDGAR',estatus:'enviada',total:3300,items_json:'[]'}],pedidos:[],cobranza:[]};
 const LLAM=[];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/#/cotizaciones',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; LLAM.push(b.accion+':'+(b.tabla||'')); let x={ok:true,items:[],valores:{}};
     if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     if(b.accion==='erp_upsert_batch'){ b.items.forEach(it=>Object.assign(DB[b.tabla].find(d=>d.id===it.id),it)); x={ok:true,resultado:{actualizados:1}}; }
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; for(let i=0;i<30&&!(w.State&&(w.State.data.cotizaciones||[]).some(c=>c.items_json!==undefined));i++) await sleep(300); await sleep(500);
 w.eval("navegar('cotizaciones')"); await sleep(200);
 const fila=()=>{ const tr=[...d.querySelectorAll('#appMain tr')].find(t=>/C0018/.test(t.textContent)); return tr?tr.textContent.replace(/\s+/g,' '):''; };
 r.antes=fila(); if(!/por confirmar/.test(r.antes)) r.fallas.push('antes: por confirmar');
 // Yazmín la confirma en otro equipo
 DB.cotizaciones[0].estatus='convertida'; DB.pedidos.push({id:'p1',folio:'P0071',cliente:'CLIENTE X',estatus:'confirmado',total:3300,cotizacion_origen:'C0018'});
 await w.eval("cargarTabla('cotizaciones',{ttl:1})"); await sleep(100);
 r.despues=fila(); if(/por confirmar/.test(r.despues)) r.fallas.push('se debió redibujar sola');
 // con una ficha abierta no se redibuja (no te mueve lo que estás viendo)
 w.eval("abrirDoc('cotizaciones','q1')"); await sleep(200); const pinta=w.eval('(()=>{let n=0;const o=renderCurrent;renderCurrent=function(){n++;return o.apply(this,arguments)};window.__n=()=>n;return 1})()');
 DB.cotizaciones[0].total=3400; await w.eval("cargarTabla('cotizaciones',{ttl:1})"); await sleep(100);
 r.conFicha=w.eval('__n()'); if(r.conFicha!==0) r.fallas.push('no redibujar con ficha abierta');
 w.eval('cerrarDrawer()');
 // guardar una cotización no baja Cobranza
 DB.cotizaciones.push({id:'q2',folio:'C0022',fecha:'2026-11-12',cliente:'CLIENTE X',vendedor:'EDGAR',estatus:'enviada',total:100,items_json:'[{"sku":"A","descripcion":"A","cantidad":1,"precio_unitario":100,"iva_pct":0}]'});
 await w.eval("cargarTabla('cotizaciones',{ttl:1})"); await sleep(100); w.eval("abrirDoc('cotizaciones','q2')"); await sleep(300);
 LLAM.length=0; await w.eval("guardarDoc('cotizaciones','q2')"); await sleep(300);
 r.llamadas=LLAM.slice(); if(!LLAM.includes('erp_upsert_batch:cotizaciones')) r.fallas.push('guardó'); if(LLAM.some(x=>/cobranza/.test(x))) r.fallas.push('no debe bajar Cobranza al guardar cotización');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
