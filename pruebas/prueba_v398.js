// v3.98 — La factura sale de un pedido de Bind que NO tiene renglón en Cobranza (solo pasó el pedido): "Cobrar en otra venta"
// ofrece crear la venta del pedido, la liga y luego el pago de la factura se registra una sola vez ahí (sin timbrar otro). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA SEIS';
const DB={
 pedidos:[{id:'bind_ord_1046',folio:'1046',cliente:N,estatus:'entregado',total:95000,fecha:'2025-11-21',vendedor:'EDGAR',items_json:'[]'}],
 remisiones:[{id:'rb',folio:'REM-2026-0001',cliente:N,estatus:'facturada',total:46000,pedido_origen:'1046',fecha:'2026-09-30',items_json:'[]'}],
 facturas:[{id:'f3',folio:'FT0003',cliente:N,estatus:'timbrada',total:46000,fecha:'2026-09-30',uuid_sat:'a3',metodo_pago:'PPD',pedido_origen:'REM REM-2026-0001',
   notas:'REP CP0003 uuid=c3 monto=46000.00 fecha=2026-09-30 parc=1 sant=46000.00',items_json:'[]'}],
 cobranza:[{id:'bind_cob_1',numero:'1176',cliente:N,total:35000,cobrado:35000,pendiente:0}],
 ingresos:[{id:'i2',cliente:N,factura:'1176',monto:35000,tipo:'cobro'}],pagosclientes:[],notascredito:[],clientes:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_crear'){ DB[b.tabla].push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it);} return J({ok:true}); }
   if(b.accion==='capturar_pago_cliente'){ const c=DB.cobranza.find(x=>x.id===b.id_doc); c.cobrado+=b.monto; c.pendiente=c.total-c.cobrado; DB.ingresos.push({id:'in',cliente:c.cliente,factura:c.numero,monto:b.monto,cuenta:b.cuenta,tipo:'cobro',comentarios:'Pago de Pedido '+c.numero+' · '+b.notas}); return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB)) if(t!=='usuarios') await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.cuentas=[{nombre:'BBVA'}]; window.confirmDialog=async()=>true");
 r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 await w.eval("nunCobrarEnOtraVenta('f3')"); await sleep(200);
 const f0=[...d.querySelectorAll('#modalCOV .covFila')][0]; r.primera=txt(f0.querySelectorAll('td')[1]); r.marcada=f0.querySelector('input').checked;
 await w.eval("nunCobrarEnOtraVentaGuardar()"); await sleep(400);
 const c=DB.cobranza.find(x=>x.id==='cob_bind_ord_1046'); r.venta=c&&[c.numero,c.total,c.cobrado,c.pendiente,c.vendedor].join('|'); r.nota=/Cobro en PED 1046 \(id cob_bind_ord_1046\)/.test(DB.facturas[0].notas);
 await w.eval("nunAbrirComplementoPago('f3')"); await sleep(200);
 r.rep={monto:d.getElementById('repMonto').value,timbrar:d.getElementById('repTimbrar').checked};
 d.getElementById('repCuenta').value='BBVA'; await w.eval("nunConfirmarComplementoPago('f3')"); await sleep(400);
 r.final=[c.cobrado,c.pendiente].join('/'); r.ingreso=DB.ingresos.filter(i=>i.factura==='PED 1046').map(i=>i.monto).join();
 await w.eval("cargarTabla('cobranza'); cargarTabla('ingresos')"); await sleep(200);
 w.eval("abrirDoc('pedidos','bind_ord_1046')"); await sleep(300); r.pedido=/Saldo \$49,000.00/.test(txt(d.querySelector('.drawer')))&&/1 pago\(s\) \$46,000/.test(txt(d.querySelector('.drawer')));
 r.fallas=[];
 if(!/^PED 1046 crear la venta del pedido/.test(r.primera)||!r.marcada) r.fallas.push('lista');
 if(r.venta!=='PED 1046|95000|0|95000|EDGAR'||!r.nota) r.fallas.push('venta');
 if(r.rep.monto!=='46000'||r.rep.timbrar||r.final!=='46000/49000'||r.ingreso!=='46000'||!r.pedido) r.fallas.push('pago');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
