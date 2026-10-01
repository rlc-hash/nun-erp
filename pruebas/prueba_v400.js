// v4.00 — Ligar remisiones/facturas a un pedido lo puede hacer quien edita ventas (ej. rol cobranza), no solo admin;
// y desde una remisión o factura: "Ligar a un pedido" (pedidos del mismo cliente; lo que decía antes se anota). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
function correr(sesion){ return new Promise(res=>{
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE OCHO';
const DB={pedidos:[{id:'p1',folio:'900',cliente:N,estatus:'entregado',total:1000,fecha:'2026-07-01',items_json:'[]'},{id:'p2',folio:'P0002',cliente:N,estatus:'confirmado',total:500,fecha:'2026-08-01',items_json:'[]'},{id:'p3',folio:'P0003',cliente:'OTRO',estatus:'confirmado',total:5,items_json:'[]'}],
 remisiones:[{id:'r1',folio:'1201',cliente:N,estatus:'entregada',total:600,pedido_origen:'OC-77',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0009',cliente:N,estatus:'timbrada',total:400,uuid_sat:'x',items_json:'[]'},{id:'f2',folio:'FT0010',cliente:N,estatus:'timbrada',total:400,pedido_origen:'REM 1201',items_json:'[]'}],
 cobranza:[],ingresos:[],pagosclientes:[],notascredito:[],clientes:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify(sesion));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['pedidos','remisiones','facturas']) await w.eval(`cargarTabla('${t}')`);
 w.eval("window.confirmDialog=async()=>true");
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 const btns=(t,id)=>{ w.eval(`abrirDoc('${t}','${id}')`); const b=[...d.querySelectorAll('.drawer button')].map(x=>x.textContent.trim()); w.eval("cerrarDrawer()"); return b; };
 r.botones={pedido:btns('pedidos','p1').includes('🔗 Ligar remisiones'),remision:btns('remisiones','r1').includes('🔗 Ligar a un pedido'),factura:btns('facturas','f1').includes('🔗 Ligar a un pedido'),facturaDeRem:btns('facturas','f2').includes('🔗 Ligar a un pedido'),cobrarOtra:btns('facturas','f1').some(t=>/Cobrar en otra venta/.test(t))};
 if(r.botones.remision){
  await w.eval("nunLigarDocAPedido('remisiones','r1')"); await sleep(200);
  r.lista=[...d.querySelectorAll('#modalLDP tbody tr')].map(tr=>tr.querySelectorAll('td')[1].textContent).join();
  d.querySelectorAll('#modalLDP input[name=ldpSel]')[[...d.querySelectorAll('#modalLDP tbody tr')].findIndex(tr=>tr.querySelectorAll('td')[1].textContent==='900')].checked=true;
  await w.eval("nunLigarDocAPedidoGuardar()"); await sleep(300);
  r.guardado=DB.remisiones[0].pedido_origen+'|'+/antes decía OC-77/.test(DB.remisiones[0].notas||'');
 }
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); w.close(); res(r);},3500); }); }
(async()=>{ const out={};
 out.cobranza=await correr({codigo:'COBR-PRUEBA1',usuario:{codigo:'COBR-PRUEBA1',nombre:'Cobranza',rol:'cobranza'},permisos:{ver_operacion:true,editar_operacion:true,ver_catalogos:true},ts:1});
 out.consulta=await correr({codigo:'VEND-PRUEBA2',usuario:{codigo:'VEND-PRUEBA2',nombre:'Vend',rol:'vendedor'},permisos:{ver_operacion:true,editar_operacion:false,solo_consulta:true},ts:1});
 out.fallas=[]; const c=out.cobranza.botones||{}, q=out.consulta.botones||{};
 if(!c.pedido||!c.remision||!c.factura||c.facturaDeRem||c.cobrarOtra) out.fallas.push('cobranzaBotones');
 if(out.cobranza.lista!=='P0002,900'||out.cobranza.guardado!=='900|true') out.fallas.push('ligar');
 if(q.pedido||q.remision||q.factura) out.fallas.push('soloConsulta');
 if(out.cobranza.error||out.consulta.error) out.error=out.cobranza.error||out.consulta.error;
 console.log(JSON.stringify(out,null,1)); })();
