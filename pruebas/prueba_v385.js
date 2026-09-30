// v3.85 — vendedores a corregir (YASMIN de Bind → vendedor del cliente), folios del servidor REM-2026 (poner folio NUN o cancelar),
// aviso al convertir pedidos de Bind / ya entregados. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE PRUEBA BETA';
const DB={clientes:[{id:'cl1',razon_social:N,vendedor:'EDGAR'},{id:'cl2',razon_social:'OTRO SIN VENDEDOR',vendedor:''}],
 remisiones:[{id:'r1',folio:'REM-2026-0001',cliente:N,total:95000,estatus:'borrador',fecha:'2026-09-30',pedido_origen:'1111',vendedor:'YASMIN'},
   {id:'r2',folio:'R0002',cliente:N,total:95000,estatus:'entregada',fecha:'2026-09-30',vendedor:'YASMIN'},{id:'r3',folio:'67',cliente:'OTRO SIN VENDEDOR',total:10,estatus:'pendiente',vendedor:'YASMIN'}],
 cobranza:[{id:'cob_r1',numero:'REM-2026-0001',cliente:N,total:95000,cobrado:0,pendiente:95000,factura_origen:'r1',vendedor:'YASMIN'}],
 pedidos:[{id:'bind_ord_9',folio:'1111',cliente:N,estatus:'entregado',total:95000,items_json:'[]',vendedor:'YASMIN'}],facturas:[],ingresos:[],usuarios:[],clientescat:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['clientes','remisiones','cobranza','pedidos','facturas']) await w.eval(`cargarTabla('${t}')`);
 // 1) vendedores a corregir
 await w.eval("nunVendedoresACorregir()"); await sleep(200);
 r.vac=w.eval("window._nunVAC.map(x=>x.t+':'+x.d.id+'>'+(x.prop||'-'))");
 w.eval("window.confirmDialog=async()=>true"); await w.eval("nunVendedoresACorregirGuardar()"); await sleep(200);
 r.vacGuardado={r1:DB.remisiones[0].vendedor,r3:DB.remisiones[2].vendedor,cob:DB.cobranza[0].vendedor,ped:DB.pedidos[0].vendedor};
 // 2) folios del servidor
 w.eval("navegar('remisiones')"); await sleep(300);
 r.botonFS=[...d.querySelectorAll('button')].some(b=>/Folios REM\/FAC \(1\)/.test(b.textContent));
 w.eval("nunRevisarFoliosServidor('remisiones')"); await sleep(100);
 r.parecidas=(d.getElementById('modalFS')||{}).textContent.includes('Remisión R0002');
 await w.eval("nunFolioServidorRenombrar('remisiones','r1')"); await sleep(300);
 r.renombrar={folio:DB.remisiones[0].folio,estatus:DB.remisiones[0].estatus,cobro:DB.cobranza[0].numero};
 // 3) convertir un pedido de Bind ya entregado: pide confirmación y si dice que no, no convierte
 let preguntas=0; w.confirmDialog=async(o)=>{ preguntas++; return preguntas===1; };
 const antes=enviados.length; await w.eval("convertirDocConItems('pedidos','bind_ord_9','remisiones')"); await sleep(200);
 r.guardBind={preguntas,convirtio:enviados.slice(antes).some(b=>b.accion==='convertir_documento')};
 r.fallas=[]; if(r.vac.join()!=='remisiones:r1>EDGAR,remisiones:r2>EDGAR,remisiones:r3>-,cobranza:cob_r1>EDGAR,pedidos:bind_ord_9>EDGAR'&&r.vac.length!==5) r.fallas.push('vacLista');
 if(r.vacGuardado.r1!=='EDGAR'||r.vacGuardado.r3!=='YASMIN'||r.vacGuardado.cob!=='EDGAR'||r.vacGuardado.ped!=='EDGAR') r.fallas.push('vacGuardar');
 if(!r.botonFS||!r.parecidas) r.fallas.push('foliosLista');
 if(r.renombrar.folio!=='R0003'||r.renombrar.estatus!=='entregada'||r.renombrar.cobro!=='R0003') r.fallas.push('renombrar');
 if(r.guardBind.preguntas!==2||r.guardBind.convirtio) r.fallas.push('guardBind');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},4000);
