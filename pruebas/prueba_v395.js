// v3.95 — Caso "venta partida": pedido viejo de Bind de $95,000 (su cobro quedó a otro nombre y decía pagado, con solo $25,000 en
// Ingresos); desde el pedido se hizo una remisión nueva de $46,000 y su factura. "Cobrar en otra venta" busca en todos los clientes,
// cancela la remisión nueva (no es venta nueva) y cuadra la venta vieja; luego el pago se registra una vez, sin timbrar otro. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA PRUEBA CUATRO';
const DB={
 pedidos:[{id:'bind_ord_1046',folio:'1046',cliente:N,estatus:'entregado',total:95000,fecha:'2025-11-21',items_json:'[]'}],
 remisiones:[{id:'rem_x',folio:'REM-2026-0001',cliente:N,estatus:'entregada',total:46000,pedido_origen:'1046',fecha:'2026-09-30',items_json:'[]'}],
 facturas:[{id:'f3',folio:'FT0003',cliente:N,estatus:'timbrada',total:46000,fecha:'2026-09-30',uuid_sat:'aaaa3',metodo_pago:'PPD',pedido_origen:'REM REM-2026-0001',
   notas:'Factura de la remisión REM-2026-0001 · REP CP0003 uuid=cccc3 monto=46000.00 fecha=2026-09-30 parc=1 sant=46000.00',items_json:'[]'}],
 cobranza:[{id:'bind_cob_465',numero:'V01465',cliente:'OTRO NOMBRE DE LA VENTA',total:95000,cobrado:95000,pendiente:0,fecha_entrega:'2025-11-21'},
  {id:'bind_cob_9',numero:'V01009',cliente:N,total:1000,cobrado:0,pendiente:1000}],
 ingresos:[{id:'i1',cliente:'OTRO NOMBRE DE LA VENTA',factura:'V01465',monto:25000,fecha:'2025-12-01',cuenta:'BBVA',tipo:'cobro'}],
 pagosclientes:[],notascredito:[],clientes:[{id:'c1',razon_social:N,rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626'}],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='capturar_pago_cliente'){ const c=DB.cobranza.find(x=>x.id===b.id_doc); c.cobrado+=b.monto; c.pendiente=c.total-c.cobrado; DB.ingresos.push({id:'i'+DB.ingresos.length+1,cliente:c.cliente,factura:c.numero,monto:b.monto,cuenta:b.cuenta,tipo:'cobro',comentarios:'Pago de documento '+c.numero+' · '+b.notas}); return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
const vis=()=>[...d.querySelectorAll('#modalCOV .covFila')].filter(tr=>tr.style.display!=='none').map(tr=>tr.querySelectorAll('td')[1].textContent);
setTimeout(async()=>{const r={};try{
 for (const t of ['pedidos','remisiones','facturas','cobranza','ingresos','clientes']) await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.cuentas=[{nombre:'BBVA'}]; window.confirmDialog=async()=>true");
 r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 await w.eval("nunCobrarEnOtraVenta('f3')"); await sleep(200);
 r.alAbrir=vis(); w.eval("nunCOVFiltrar('95,000')"); r.buscando=vis();
 r.cancRem=!!d.getElementById('covCancRem')&&d.getElementById('covCancRem').checked;
 const i=[...d.querySelectorAll('#modalCOV .covFila')].findIndex(tr=>tr.querySelectorAll('td')[1].textContent==='V01465');
 d.querySelector('#modalCOV input[name=covSel][value="'+i+'"]').checked=true;
 await w.eval("nunCobrarEnOtraVentaGuardar()"); await sleep(400);
 const C=DB.cobranza.find(c=>c.id==='bind_cob_465');
 r.guardado={venta:C.cobrado+'/'+C.pendiente,rem:DB.remisiones[0].estatus,nota:/Cobro en V01465/.test(DB.facturas[0].notas)};
 await w.eval("nunAbrirComplementoPago('f3')"); await sleep(200);
 r.rep={monto:d.getElementById('repMonto').value,timbrar:d.getElementById('repTimbrar').checked,cobro:/V01465/.test(d.getElementById('modalREP').textContent)};
 d.getElementById('repCuenta').value='BBVA'; await w.eval("nunConfirmarComplementoPago('f3')"); await sleep(400);
 r.final=C.cobrado+'/'+C.pendiente;
 r.fallas=[];
 if(r.alAbrir.join()!=='V01009'||r.buscando.join()!=='V01465'||!r.cancRem) r.fallas.push('lista');
 if(r.guardado.venta!=='25000/70000'||r.guardado.rem!=='cancelada'||!r.guardado.nota) r.fallas.push('guardado');
 if(r.rep.monto!=='46000'||r.rep.timbrar||!r.rep.cobro||r.final!=='71000/24000') r.fallas.push('pago');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
