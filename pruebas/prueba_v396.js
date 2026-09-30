// v3.96 — Dos remisiones con el mismo folio (REM-2026-0001): la factura se liga a la del mismo cliente y total; "Cobrar en otra venta"
// pone primero la venta del pedido; el pedido es la matriz (pagos de todas sus remisiones y facturas, con cancelar y cambiar monto);
// vendedores a corregir también sin vendedor, con propuesta del catálogo, de tu Excel o de los otros documentos del cliente. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA CINCO', T='PRUEBA OTRA';
const DB={
 pedidos:[{id:'bind_ord_1046',folio:'1046',cliente:N,estatus:'entregado',total:95000,fecha:'2025-11-21',vendedor:'',items_json:'[]'},
  {id:'p9',folio:'P0009',cliente:'CLIENTE MATRIZ',estatus:'entregado',total:3000,vendedor:'YASMIN',items_json:'[]'},
  {id:'p10',folio:'P0010',cliente:'CLIENTE EXCEL',estatus:'confirmado',total:100,vendedor:'',fecha:'2026-08-01',items_json:'[]'}],
 remisiones:[{id:'ra',folio:'REM-2026-0001',cliente:T,estatus:'entregada',total:5730,fecha:'2026-09-29',items_json:'[]'},
  {id:'rb',folio:'REM-2026-0001',cliente:N,estatus:'facturada',total:46000,pedido_origen:'1046',fecha:'2026-09-30',vendedor:'YASMIN',items_json:'[]'},
  {id:'rm',folio:'R0009',cliente:'CLIENTE MATRIZ',estatus:'entregada',total:1000,pedido_origen:'P0009',vendedor:'EDGAR',items_json:'[]'},
  {id:'rh',folio:'R0010',cliente:'CLIENTE HISTORIA',estatus:'entregada',total:10,vendedor:'YASMIN',items_json:'[]'},
  {id:'rh2',folio:'R0011',cliente:'CLIENTE HISTORIA',estatus:'entregada',total:10,vendedor:'LUIS',items_json:'[]'}],
 facturas:[{id:'f3',folio:'FT0003',cliente:N,estatus:'timbrada',total:46000,fecha:'2026-09-30',uuid_sat:'a3',metodo_pago:'PPD',pedido_origen:'REM REM-2026-0001',notas:'',items_json:'[]'},
  {id:'fm',folio:'FT0009',cliente:'CLIENTE MATRIZ',estatus:'timbrada',total:2000,pedido_origen:'P0009',fecha:'2026-09-30',items_json:'[]'}],
 cobranza:[{id:'bind_cob_465',numero:'V01465',cliente:'OTRO NOMBRE',total:95000,cobrado:95000,pendiente:0,fecha_entrega:'2025-11-21'},
  {id:'bind_cob_1',numero:'1176',cliente:N,total:35000,cobrado:35000,pendiente:0,fecha_entrega:'2026-09-24'},
  {id:'cob_rm',numero:'R0009',cliente:'CLIENTE MATRIZ',total:1000,cobrado:700,pendiente:300,factura_origen:'rm'},
  {id:'cob_fm',numero:'FT0009',cliente:'CLIENTE MATRIZ',total:2000,cobrado:500,pendiente:1500,factura_origen:'fm'}],
 ingresos:[{id:'i1',cliente:'OTRO NOMBRE',factura:'V01465',monto:25000,tipo:'cobro'},{id:'i2',cliente:N,factura:'1176',monto:35000,tipo:'cobro'},
  {id:'im1',cliente:'CLIENTE MATRIZ',factura:'R0009',monto:400,tipo:'cobro',fecha:'2026-09-20'},{id:'im2',cliente:'CLIENTE MATRIZ',factura:'R0009',monto:300,tipo:'cobro',fecha:'2026-09-21'},
  {id:'im3',cliente:'CLIENTE MATRIZ',factura:'FT0009',monto:500,tipo:'cobro',fecha:'2026-09-30'}],
 pagosclientes:[{timestamp:'2026-09-21T10:00:00Z',id_doc:'cob_rm',monto:300,ingreso_id:'im2'}],notascredito:[],
 clientes:[{id:'c1',razon_social:'CLIENTE MATRIZ',vendedor:'LUIS'}],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.localStorage.setItem('nun_cuadre_excel',JSON.stringify([{cliente:'Cliente Excel',fecha:'2026-01-01',vendedor:'ESTEBAN',pago_total:1,pago_faltante:0}]));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB)) if(t!=='usuarios') await w.eval(`cargarTabla('${t}')`);
 r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 // 1) remisión correcta
 r.remDeFactura=w.eval("nunRemDeFactura(State.data.facturas.find(f=>f.id==='f3')).id");
 const sit=id=>w.eval(`nunSituacionHTML('remisiones', State.data.remisiones.find(x=>x.id==='${id}'))`).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 r.situacion=[sit('ra'),sit('rb')];
 r.cadena=w.eval("nunRelDoc('facturas', State.data.facturas.find(f=>f.id==='f3')).remisiones.map(x=>x.id+':'+x.total).join()");
 // 2) Cobrar en otra venta: primero la del pedido
 await w.eval("nunCobrarEnOtraVenta('f3')"); await sleep(200);
 const filas=[...d.querySelectorAll('#modalCOV .covFila')].filter(tr=>tr.style.display!=='none');
 r.cov={primera:txt(filas[0].querySelectorAll('td')[1]),marcada:filas[0].querySelector('input').checked,visibles:filas.length,cancRem:/Cancelar la remisión REM-2026-0001 \(\$46,000/.test(txt(d.getElementById('modalCOV')))};
 d.getElementById('modalCOV').remove();
 // 3) pedido matriz
 w.eval("abrirDoc('pedidos','p9')"); await sleep(300);
 const dr=d.querySelector('.drawer'); const b=[...dr.querySelectorAll('button')].map(x=>x.textContent.trim());
 r.matriz={pagos:b.filter(t=>t==='Cancelar pago').length,cambiar:b.filter(t=>t==='Cambiar monto').length,resumen:/Saldo \$1,800.00/.test(txt(dr))&&/3 pago\(s\) \$1,200/.test(txt(dr))};
 w.eval("cerrarDrawer()");
 // 4) vendedores
 const L=w.eval("nunVendedoresACorregirCalcular().map(x=>(x.d.folio||x.d.numero)+':'+(x.v||'-')+'>'+(x.prop||'?')+'('+x.de+')').sort().join(' | ')"); r.vend=L;
 w.eval("navegar('pedidos')"); await sleep(300); r.botonPedidos=[...d.querySelectorAll('button')].some(x=>/Vendedores a corregir/.test(x.textContent));
 r.fallas=[];
 if(r.remDeFactura!=='rb'||!/^sin facturar/.test(r.situacion[0])||!/^facturada en FT0003/.test(r.situacion[1])||r.cadena!=='rb:46000') r.fallas.push('remision');
 if(!/^V01465/.test(r.cov.primera)||!r.cov.marcada||r.cov.visibles!==2||!r.cov.cancRem) r.fallas.push('cobrarEnOtra');
 if(r.matriz.pagos!==6||r.matriz.cambiar!==2||!r.matriz.resumen) // 3 pagos en Datos y los mismos en Relacionados
  r.fallas.push('matriz');
 if(!['P0009:YASMIN>LUIS(catálogo)','P0010:->ESTEBAN(tu Excel)','R0010:YASMIN>LUIS(otros documentos del cliente)','1046:->?()','REM-2026-0001:YASMIN>?()'].every(x=>r.vend.split(' | ').includes(x))||/R0011/.test(r.vend)||!r.botonPedidos) r.fallas.push('vendedores');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
