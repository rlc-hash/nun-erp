// v3.94 — "Cobrar en otra venta": una factura nueva que es de una venta vieja (ej. remisión de Bind que decía pagada $95,000 y solo
// tenía $25,000): el pago de la factura se aplica a esa venta, su cobro propio se cancela y lo cobrado se ajusta a lo que suman
// sus pagos. Si el complemento ya se timbró y el pago no se registró, se registra una sola vez. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA PRUEBA TRES';
const it=[{sku:'A1',descripcion:'MALETA',cantidad:1,precio_unitario:1000,iva_pct:16,clave_sat:'53121502'}];
const DB={
 facturas:[{id:'f3',folio:'FT0003',cliente:N,estatus:'timbrada',total:46000,fecha:'2026-09-30',uuid_sat:'aaaa3',metodo_pago:'PPD',pedido_origen:'REM REM-2026-0001',
   notas:'Facturama ID: FAMA3 · REP CP0003 uuid=cccc3 monto=46000.00 fecha=2026-09-30 parc=1 sant=46000.00',items_json:JSON.stringify(it)},
  {id:'f5',folio:'FT0005',cliente:N,estatus:'timbrada',total:10000,fecha:'2026-09-30',uuid_sat:'aaaa5',metodo_pago:'PPD',
   notas:'REP CP0005 uuid=cccc5 monto=10000.00 fecha=2026-09-30 parc=1 sant=10000.00',items_json:JSON.stringify(it)}],
 remisiones:[{id:'rs1',folio:'REM-2026-0001',cliente:N,estatus:'entregada',total:5730,fecha:'2026-09-29',items_json:'[]'}],
 cobranza:[{id:'bind_cob_95',numero:'V01500',cliente:N,total:95000,cobrado:95000,pendiente:0,fecha_entrega:'2025-11-19'},
  {id:'cob_f3',numero:'FT0003',cliente:N,total:46000,cobrado:46000,pendiente:0,factura_origen:'f3'},
  {id:'bind_cob_30',numero:'V01600',cliente:N,total:30000,cobrado:0,pendiente:30000,fecha_entrega:'2026-01-10'},
  {id:'otro',numero:'V01700',cliente:'OTRO CLIENTE',total:5,cobrado:0,pendiente:5}],
 ingresos:[{id:'i1',cliente:N,factura:'V01500',monto:25000,fecha:'2025-12-01',cuenta:'BBVA',tipo:'cobro'},
  {id:'i2',cliente:N,factura:'FT0003',monto:46000,fecha:'2026-09-30',cuenta:'BBVA',tipo:'cobro',comentarios:'Pago de Factura FT0003 · Pago factura FT0003 · con complemento'}],
 pagosclientes:[],pedidos:[],notascredito:[],clientes:[{id:'c1',razon_social:N,rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626'}],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['facturas','remisiones','cobranza','ingresos','clientes']) await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.cuentas=[{nombre:'BBVA'}]; window.confirmDialog=async()=>true");
 // 1) FT0003: su pago ya estaba en su propio cobro → se pasa a V01500, que se ajusta a lo que suman sus pagos
 w.eval("abrirDoc('facturas','f3')"); await sleep(300); r.boton=[...d.querySelectorAll('.drawer button')].some(b=>/Cobrar en otra venta/.test(b.textContent)); w.eval("cerrarDrawer()");
 await w.eval("nunCobrarEnOtraVenta('f3')"); await sleep(200);
 r.lista=[...d.querySelectorAll('#modalCOV tbody tr')].map(tr=>tr.querySelectorAll('td')[1].textContent);
 d.querySelector('#modalCOV input[name=covSel][value="'+r.lista.indexOf('V01500')+'"]').checked=true;
 await w.eval("nunCobrarEnOtraVentaGuardar()"); await sleep(400);
 const C=id=>DB.cobranza.find(c=>c.id===id);
 r.caso1={v500:[C('bind_cob_95').cobrado,C('bind_cob_95').pendiente].join('/'),propio:C('cob_f3').estatus,ingreso:DB.ingresos.find(i=>i.id==='i2').factura,nota:/Cobro en V01500 \(id bind_cob_95\)/.test(DB.facturas[0].notas),
  saldoFactura:w.eval("nunSaldoDoc(State.data.facturas.find(f=>f.id==='f3'),'facturas')")};
 await w.eval("nunAbrirComplementoPago('f3')"); await sleep(200);
 r.caso1.repAvisa=/no está registrado como pago/.test(d.getElementById('modalREP').textContent); r.caso1.repCobro=/V01500/.test(d.getElementById('modalREP').textContent); d.getElementById('modalREP').remove();
 // 2) FT0005: complemento timbrado y el pago aún no registrado → se liga a V01600 y el pago se registra una sola vez ahí
 await w.eval("nunCobrarEnOtraVenta('f5')"); await sleep(200);
 const l2=[...d.querySelectorAll('#modalCOV tbody tr')].map(tr=>tr.querySelectorAll('td')[1].textContent);
 d.querySelector('#modalCOV input[name=covSel][value="'+l2.indexOf('V01600')+'"]').checked=true;
 await w.eval("nunCobrarEnOtraVentaGuardar()"); await sleep(400);
 await w.eval("nunAbrirComplementoPago('f5')"); await sleep(200);
 r.caso2={monto:d.getElementById('repMonto').value,timbrar:d.getElementById('repTimbrar').checked,cobro:/V01600/.test(d.getElementById('modalREP').textContent),v600:[C('bind_cob_30').cobrado,C('bind_cob_30').pendiente].join('/')};
 r.fallas=[];
 if(!r.boton||r.lista.join()!=='V01600,V01500') r.fallas.push('lista');
 if(r.caso1.v500!=='71000/24000'||r.caso1.propio!=='cancelado'||r.caso1.ingreso!=='V01500'||!r.caso1.nota||r.caso1.saldoFactura!==0||r.caso1.repAvisa||!r.caso1.repCobro) r.fallas.push('caso1');
 if(r.caso2.monto!=='10000'||r.caso2.timbrar||!r.caso2.cobro||r.caso2.v600!=='0/30000') r.fallas.push('caso2');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
