// v3.80 — auditoría: dinero (sin IVA, descuentos, IVA incluido, NC, REP mixto), cancelaciones sin borrar, facturas timbradas protegidas,
// dueños por prefijo de código, texto escapado, atraso recalculado y reporte CASA con vendedor. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const hace=d=>{const x=new Date();x.setDate(x.getDate()-d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
const it16={sku:'A1',descripcion:'MALETA',cantidad:10,precio_unitario:100,descuento_pct:10,iva_pct:16,clave_sat:'53121502'};
const DB={
 facturas:[
  {id:'f_si',folio:'FT0001',cliente:'CLIENTE UNO',total:1000,subtotal:1000,iva:0,sin_iva:true,items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:10,precio_unitario:100,iva_pct:16,clave_sat:'53121502'}]),estatus:'borrador',metodo_pago:'PUE',forma_pago:'03',uso_cfdi:'G01'},
  {id:'f_desc',folio:'FT0002',cliente:'CLIENTE UNO',total:1044,subtotal:900,iva:144,items_json:JSON.stringify([it16]),estatus:'borrador',metodo_pago:'PUE',forma_pago:'03',uso_cfdi:'G01'},
  {id:'f_mix',folio:'FT0003',cliente:'CLIENTE UNO',total:1580,subtotal:1500,iva:80,uuid_sat:'aaaa0000-0000-4000-8000-000000000001',metodo_pago:'PPD',forma_pago:'99',estatus:'timbrada',notas:'Facturama ID: FMIX1',
   items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:5,precio_unitario:100,iva_pct:16},{sku:'B1',descripcion:'LIBRO',cantidad:10,precio_unitario:100,iva_pct:0}])},
  {id:'f_nc',folio:'FT0004',cliente:'CLIENTE DOS',total:1160,subtotal:1000,iva:160,items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:10,precio_unitario:100,iva_pct:16}]),estatus:'timbrada',uuid_sat:'aaaa0000-0000-4000-8000-000000000002',notas:'Facturama ID: FNC1'},
  {id:'f_p1',folio:'FT0005',cliente:'CLIENTE TRES',total:1160,subtotal:1000,iva:160,pedido_origen:'R0009',estatus:'timbrada',uuid_sat:'aaaa0000-0000-4000-8000-000000000003',items_json:'[]'},
  {id:'f_p2',folio:'FT0006',cliente:'CLIENTE TRES',total:1160,subtotal:1000,iva:160,pedido_origen:'R0009',estatus:'timbrada',uuid_sat:'aaaa0000-0000-4000-8000-000000000004',items_json:'[]'},
  {id:'f_can',folio:'FT0007',cliente:'CLIENTE DOS',total:500,subtotal:431.03,iva:68.97,estatus:'borrador',items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:1,precio_unitario:431.03,iva_pct:16}])}],
 remisiones:[{id:'r9',folio:'R0009',cliente:'CLIENTE TRES',total:2320,estatus:'facturada',items_json:'[]'},
  {id:'r10',folio:'R0010',cliente:'CLIENTE DOS',total:300,estatus:'entregada',items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:3,precio_unitario:100,iva_pct:0}])}],
 pedidos:[{id:'p1',folio:'P0001',cliente:'CLIENTE DOS',total:1000,sin_iva:true,estatus:'confirmado',vendedor:'EDGAR',items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:10,precio_unitario:100,iva_pct:16}])}],
 notascredito:[{id:'nc1',folio:'NC0001',cliente:'CLIENTE DOS',documento_origen:'FT0004',total:200,estatus:'aplicada'},{id:'nc2',folio:'NC0002',cliente:'CLIENTE DOS',documento_origen:'FT0004',total:999,estatus:'cancelada'}],
 cobranza:[{id:'cob_f_nc',numero:'FT0004',cliente:'CLIENTE DOS',total:1160,cobrado:0,pendiente:1160,factura_origen:'f_nc',fecha_entrega:hace(3)},
  {id:'cob_r9',numero:'R0009',cliente:'CLIENTE TRES',total:2320,cobrado:1820,pendiente:500,factura_origen:'r9',fecha_entrega:hace(10)},
  {id:'cob_f_can',numero:'FT0007',cliente:'CLIENTE DOS',total:500,cobrado:0,pendiente:500,factura_origen:'f_can',fecha_entrega:hace(1)},
  {id:'cob_r10',numero:'R0010',cliente:'CLIENTE DOS',total:300,cobrado:0,pendiente:300,factura_origen:'r10',fecha_entrega:hace(40),credito:'30',dias_vencido:0,sin_entregar:'FALSE'},
  {id:'cob_casa',numero:'R0011',cliente:'<img src=x onerror="window.__xss=1">',total:700,cobrado:700,pendiente:0,vendedor:'CASA',fecha_entrega:hace(5)}],
 clientes:[{id:'cl1',razon_social:'CLIENTE UNO',rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626',uso_cfdi:'G01'},{id:'cl2',razon_social:'CLIENTE DOS',rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626'},{id:'cl3',razon_social:'<b>RAZON</b>',activo:true}],
 clientescat:[{nombre:'<img src=x onerror="window.__xss=1">',vendedor:'EDGAR'}],
 ingresos:[],productos:[],usuarios:[],pagosclientes:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='obtener_empresa') return J({ok:true,config:{rfc:'EKU9003173C9',cp:'11000',razon_social:'EMPRESA PRUEBA',regimen_fiscal:'601'}});
   if(b.accion==='facturama_cancelar') return J({ok:true});
   if(b.accion==='convertir_documento'){ const p=DB.pedidos.find(x=>x.id===b.id_origen); const n={id:'rem_srv1',folio:'REM-2026-0001',cliente:p.cliente,total:0,items_json:'[]',estatus:'borrador'}; DB.remisiones.push(n); return J({ok:true,folio:n.folio,item:{id:n.id}}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB).filter(t=>t!=='usuarios'&&t!=='clientescat')) await w.eval(`cargarTabla('${t}')`);
 await w.eval("cargarTabla('empresa')").catch(()=>{});
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 // 1) dueños por prefijo (sin códigos escritos en el archivo)
 r.duenos={rafaNuevo:w.eval("nunEsDuenoGastos()"),literalesEnArchivo:/RAFA-2026|YADAH-2026|MASTER-NUN-ERP-2026/.test(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'))};
 w.eval("State.sesion.codigo='EDGAR-1'"); r.duenos.edgar=w.eval("nunEsDuenoGastos()"); w.eval("State.sesion.codigo='RAFA-'"); r.duenos.soloPrefijo=w.eval("nunEsDuenoGastos()"); w.eval("State.sesion.codigo='RAFA-PRUEBA9'");
 // 2) sin IVA no se deja timbrar; descuentos van a Facturama; total tiene que cuadrar
 const F=id=>w.eval(`State.data.facturas.find(f=>f.id==='${id}')`);
 r.sinIva=w.eval("facturaValidarTimbrado(State.data.facturas.find(f=>f.id==='f_si'))").filter(x=>/Sin IVA/.test(x)).length;
 const cf=w.eval("facturaACfdiFacturama(State.data.facturas.find(f=>f.id==='f_desc'))");
 const i0=(cf.Items||[])[0]||{}; r.cfdiDescuento={UnitPrice:i0.UnitPrice,Subtotal:i0.Subtotal,Discount:i0.Discount,Base:i0.Taxes&&i0.Taxes[0].Base,Iva:i0.Taxes&&i0.Taxes[0].Total,Total:i0.Total};
 r.totalNoCuadra=w.eval("facturaValidarTimbrado(Object.assign({},State.data.facturas.find(f=>f.id==='f_desc'),{total:1100}))").some(x=>/no coincide/.test(x));
 // 3) precio con IVA incluido: 1000 piezas a $100 = $100,000 exactos
 r.ivaIncluido=w.eval("nunCalcDoc([{cantidad:1000,precio_unitario:+(100/1.16).toFixed(6),iva_pct:16}]).total");
 // 4) complemento de pago con 16% y 0%
 const rep=w.eval("nunCfdiComplementoPago(State.data.facturas.find(f=>f.id==='f_mix'),{monto:1580,fecha:'2026-09-30',forma:'03',parcialidad:1,saldoAnterior:1580,folioRep:'CP0009'})");
 r.repMixto=rep.Complemento.Payments[0].RelatedDocuments[0].Taxes.map(t=>t.Rate+':'+t.Base+'/'+t.Total);
 // 5) nota de crédito baja el saldo (la cancelada no cuenta)
 r.saldoConNC=w.eval("nunSaldoDoc(State.data.facturas.find(f=>f.id==='f_nc'),'facturas')");
 // 6) dos facturas de una misma remisión: el saldo se cuenta una vez
 r.saldoGrupo=w.eval("nunSaldoGrupo(State.data.facturas.filter(f=>['f_p1','f_p2'].includes(f.id)),'facturas')");
 // 7) atraso recalculado hoy (entregada hace 40 días con 30 de crédito) y "FALSE" de Sheets ya no es "por entregar"
 const c10=w.eval("State.data.cobranza.find(c=>c.id==='cob_r10')"); r.atraso={dias:c10.dias_vencido,sinEntregar:c10.sin_entregar};
 // 8) texto de la base escapado en tablas
 w.eval("navegar('cobranza')"); await sleep(300); w.eval("navegar('clientes')"); await sleep(300);
 r.xss={img:!!d.querySelector('#appMain img[src="x"]'),ejecutado:!!w.__xss,negritas:!![...d.querySelectorAll('#appMain b')].find(b=>b.textContent==='RAZON')};
 // 9) cancelar = marcar (nunca erp_eliminar) y su cobro también se cancela
 w.eval("window.confirmDialog=async()=>true; window.confirm=()=>true; window.prompt=()=>'02'");
 await w.eval("eliminarDoc('facturas','f_can')"); await sleep(200);
 r.cancelar={estatus:DB.facturas.find(f=>f.id==='f_can').estatus,cobro:DB.cobranza.find(c=>c.id==='cob_f_can').estatus+'/'+DB.cobranza.find(c=>c.id==='cob_f_can').pendiente};
 await w.eval("facturaCancelar('f_nc')"); await sleep(200);
 const fnc=DB.facturas.find(f=>f.id==='f_nc'); r.cancelarSAT={estatus:fnc.estatus,conservaId:/Facturama ID: FNC1/.test(fnc.notas),cobro:DB.cobranza.find(c=>c.id==='cob_f_nc').estatus};
 await w.eval("eliminarGenerico('clientes','cl3')"); await sleep(200);
 r.cliente={existe:!!DB.clientes.find(c=>c.id==='cl3'),activo:DB.clientes.find(c=>c.id==='cl3').activo};
 r.eliminarEnviado=enviados.some(b=>/eliminar/.test(b.accion||''));
 // 10) factura timbrada: al guardar no se pierden Facturama ID ni complementos, ni cambian totales
 await w.eval("cargarTabla('facturas')");
 w.eval("abrirDoc('facturas','f_mix')"); await sleep(300);
 d.getElementById('dNotas').value='nota nueva sin nada'; if(d.getElementById('dTotal')) d.getElementById('dTotal').value='1';
 await w.eval("guardarDoc('facturas','f_mix')"); await sleep(300);
 const fm=DB.facturas.find(f=>f.id==='f_mix'); r.timbrada={total:fm.total,notas:fm.notas};
 // 11) pedido sin IVA → remisión sin IVA
 await w.eval("convertirDocConItems('pedidos','p1','remisiones')"); await sleep(400);
 const rn=DB.remisiones.find(x=>x.id==='rem_srv1'); r.conversionSinIva={total:rn.total,iva:rn.iva,sin_iva:rn.sin_iva,folio:rn.folio};
 // 12) reporte CASA con vendedor
 await w.eval("_catClientes = State.data.clientescat || []; cargarCatalogoVendedores()"); await w.eval("nunReporteCasaOtroVendedor()"); await sleep(200);
 const mc=d.getElementById('modalCasaVend'); r.casa=mc?[...mc.querySelectorAll('tbody tr')].map(tr=>tr.textContent.replace(/\s+/g,' ').trim().slice(0,80)):null;
 r.xss.ejecutadoFinal=!!w.__xss;
 // 13) fecha de hoy es la de México
 r.hoy=w.eval("nunHoy(new Date(2026,8,30,23,30))");
 const esperado={sinIva:1,totalNoCuadra:true,ivaIncluido:100000,saldoConNC:960,saldoGrupo:500,cancelarEst:'cancelada',hoy:'2026-09-30'};
 r.fallas=[]; if(r.sinIva!==1) r.fallas.push('sinIva'); if(r.cfdiDescuento.Discount!=='100.00'||r.cfdiDescuento.Subtotal!=='1000.00') r.fallas.push('descuento');
 if(!r.totalNoCuadra) r.fallas.push('totalNoCuadra'); if(r.ivaIncluido!==100000) r.fallas.push('ivaIncluido'); if(r.saldoConNC!==960) r.fallas.push('nc');
 if(r.saldoGrupo!==500) r.fallas.push('grupo'); if(r.cancelar.estatus!=='cancelada'||!/^cancelado\/0$/.test(r.cancelar.cobro)) r.fallas.push('cancelar');
 if(r.cancelarSAT.estatus!=='cancelada'||!r.cancelarSAT.conservaId) r.fallas.push('cancelarSAT'); if(r.eliminarEnviado) r.fallas.push('seBorro');
 if(!r.cliente.existe||r.cliente.activo!==false) r.fallas.push('cliente'); if(r.timbrada.total!==1580||!/Facturama ID: FMIX1/.test(r.timbrada.notas)) r.fallas.push('timbrada');
 if(r.conversionSinIva.total!==1000) r.fallas.push('conversionSinIva'); if(r.xss.img||r.xss.ejecutado||r.xss.ejecutadoFinal||r.xss.negritas) r.fallas.push('xss');
 if(!r.duenos.rafaNuevo||r.duenos.edgar||r.duenos.soloPrefijo||r.duenos.literalesEnArchivo) r.fallas.push('duenos'); if(r.hoy!=='2026-09-30') r.fallas.push('hoy');
 if(r.atraso.dias<9||r.atraso.dias>11||r.atraso.sinEntregar!==false) r.fallas.push('atraso'); if(!r.casa||r.casa.length!==1) r.fallas.push('casa');
 if(r.repMixto.length!==2) r.fallas.push('repMixto');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
