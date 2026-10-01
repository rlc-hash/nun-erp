// v3.91 — Cuadre de tu Excel de cobranza (dos hojas) contra la Cobranza del sistema: por folio, por cliente + monto, por cliente (debe y vendedor);
// remisiones canceladas que en realidad se facturaron → "facturada" con su factura anotada (su cobro no revive). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={
 cobranza:[{id:'bind_cob_500',numero:'V01500',cliente:'JUAN PEREZ LOPEZ',total:10000,cobrado:4000,pendiente:6000,fecha_entrega:'2026-03-02'},
  {id:'bind_cob_f1028',numero:'1028',cliente:'COMERCIAL ALFA SA DE CV',total:5000,cobrado:5000,pendiente:0},
  {id:'bind_cob_501',numero:'V01501',cliente:'JUAN PEREZ LOPEZ',total:3000,cobrado:0,pendiente:3000},
  {id:'bind_cob_502',numero:'V01502',cliente:'JUAN PEREZ LOPEZ',total:9999,cobrado:0,pendiente:0,estatus:'cancelado'},
  {id:'cob_r3',numero:'R0003',cliente:'MARIA GOMEZ',total:2000,cobrado:0,pendiente:2000,factura_origen:'r3'},
  {id:'bind_cob_300',numero:'V01300',cliente:'CLIENTE UNO',total:1160,cobrado:0,pendiente:0,estatus:'cancelado'},
  {id:'bind_cob_301',numero:'V01301',cliente:'CLIENTE UNO',total:2000,cobrado:0,pendiente:2000}],
 clientes:[{id:'c1',razon_social:'JUAN PEREZ LOPEZ',vendedor:'EDGAR'},{id:'c2',razon_social:'MARIA GOMEZ',vendedor:'LUIS'},{id:'c3',razon_social:'COMERCIAL ALFA SA DE CV',vendedor:'EDGAR'}],
 remisiones:[{id:'bind_rem_300',folio:'300',cliente:'CLIENTE UNO',estatus:'cancelada',total:1160,fecha:'2026-08-01',items_json:'[]',notas:'Cancelada en Bind'},
  {id:'bind_rem_301',folio:'301',cliente:'CLIENTE UNO',estatus:'cancelada',total:2000,fecha:'2026-08-02',items_json:'[]'},
  {id:'bind_rem_302',folio:'302',cliente:'CLIENTE UNO',estatus:'cancelada',total:1160,fecha:'2026-08-05',items_json:'[]'},
  {id:'bind_rem_303',folio:'303',cliente:'CLIENTE UNO',estatus:'cancelada',total:500,fecha:'2026-08-05',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0005',cliente:'CLIENTE UNO',estatus:'timbrada',total:1160,fecha:'2026-08-03',items_json:'[]'},
  {id:'f2',folio:'FT0006',cliente:'CLIENTE UNO',estatus:'timbrada',total:2000,fecha:'2026-08-04',items_json:'[]'},
  {id:'f3',folio:'FT0007',cliente:'CLIENTE UNO',estatus:'cancelada',total:500,fecha:'2026-08-06',items_json:'[]'}],
 pedidos:[],ingresos:[],pagosclientes:[],usuarios:[]};
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
// Excel inventado: como lo entrega el lector (una fila = objeto con los encabezados de la hoja)
const H25=(f,cli,tot,cob,fal,v)=>({'Columna 1':f,'FECHA DE ENTRGA':'31 de julio','Cliente ':cli,'PAGO TOTAL':tot,'PAGO HASTA EL MOMENTO':cob,'PAGO FALTANTE':fal,'Descripción':'','VENDEDOR':v});
const H26=(f,cli,tot,cob,fal,v,fol)=>({'Columna 1':f,'FECHA DE ENTRGA':f,'CLIENTE':cli,'PAGO TOTALjhgx':tot,'PAGO HASTA EL MOMENTO':cob,'PAGO FALTANTE':fal,'VENDEDOR':v,'Factura':fol});
const WB={SheetNames:['2025','2026','Otra'],Sheets:{
 '2025':[H25(new Date(2025,10,3),'Maria  Gomez',2000,'',2000,'Esteban'),H25('15/07/2025','Juan Perez Lopez',700,700,0,'ESTEBAN'),H25('','',0,'','','')],
 '2026':[H26(new Date(2026,2,1),'Juan Perez Lopez',10000,6000,4000,'EDGAR','R - V01500'),H26(new Date(2026,2,5),'Comercial Alfa',5000,5000,0,'EDGAR','F - 1028'),
  H26(new Date(2026,3,1),'Pedro Inventado',800,0,800,'LUIS','R - V01500'),H26(new Date(2026,3,2),'Rosa Nadie',300,0,300,'LUIS','P - 77')],
 'Otra':[H26(new Date(2026,3,2),'No Se Lee',999,0,999,'LUIS','')]}};
setTimeout(async()=>{const r={};try{
 for (const t of ['cobranza','clientes','remisiones','facturas']) await w.eval(`cargarTabla('${t}')`);
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 // 1) leer las dos primeras hojas (la tercera no)
 w.XLSX={utils:{sheet_to_json:(sh)=>sh}}; w._xlsxWB=WB;
 await w.eval("procesarSheetCuadre()"); await sleep(400);
 const filas=JSON.parse(w.localStorage.getItem('nun_cuadre_excel'));
 r.excel={filas:filas.length,hojas:[...new Set(filas.map(f=>f.hoja))].join(','),fecha0:filas[0].fecha,cobrado:filas.find(f=>f.factura_raw==='R - V01500').pago_cobrado,folios:filas.map(f=>f.factura_tipo+':'+f.factura_norm).join(' ')};
 const C=w.eval("cuadreCalcular()");
 const est=C.resultados.map(x=>(x.excel?x.excel.cliente:x.bind.numero)+'='+x.estado+(x.via?'/'+x.via:'')); r.docs=est;
 r.porque={juan:C.resultados.find(x=>x.excel&&x.excel.factura_raw==='R - V01500'&&x.bind).porque,pedro:C.resultados.find(x=>x.excel&&x.excel.cliente==='Pedro Inventado').porque,
  rosa:C.resultados.find(x=>x.excel&&x.excel.cliente==='Rosa Nadie').porque,v501:C.resultados.find(x=>x.bind&&x.bind.numero==='V01501').porque};
 const P=w.eval("cuadrePorCliente()");
 const pj=P.find(o=>o.nombreSis==='JUAN PEREZ LOPEZ'), pm=P.find(o=>o.nombreSis==='MARIA GOMEZ');
 r.clientes={juan:[pj.xlPend,pj.sisPend,pj.dif,pj.vendXl,pj.vendSis,pj.cambiosVend].join('|'),maria:[pm.xlPend,pm.sisPend,pm.vendXl,pm.vendSis,pm.porque].join('|'),alfa:P.find(o=>o.nombreSis==='COMERCIAL ALFA SA DE CV').estado};
 w.eval("navegar('cuadre')"); await sleep(400);
 r.pantalla={titulo:d.querySelector('.page-title h1').textContent,filasTabla:d.querySelectorAll('#cuadreMount tbody tr').length,texto:/Vendedor: Excel ESTEBAN \/ sistema LUIS/.test(d.getElementById('cuadreMount').textContent)};
 w.eval("cuadreFiltro('diferencias')"); r.pantalla.docsProblema=d.querySelectorAll('#cuadreMount tbody tr').length;
 // 2) remisiones canceladas que se facturaron
 const sit=id=>w.eval(`nunSituacionHTML('remisiones', State.data.remisiones.find(x=>x.id==='${id}'))`).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 r.antes=['bind_rem_300','bind_rem_301','bind_rem_303'].map(sit);
 w.eval("window.confirmDialog=async()=>true");
 await w.eval("nunRemMarcarFacturadas()"); await sleep(300);
 r.modal=[...d.querySelectorAll('#modalRCF tbody tr')].map(t=>[...t.querySelectorAll('td')].slice(1).map(td=>td.textContent.trim()).filter((x,i)=>i===0||i===4).join('→'));
 await w.eval("nunRemMarcarFacturadasGuardar()"); await sleep(300);
 const R=id=>DB.remisiones.find(x=>x.id===id);
 r.guardado={r300:R('bind_rem_300').estatus+' | '+R('bind_rem_300').notas.replace(/\d{4}-\d{2}-\d{2}/,'HOY'),r301:R('bind_rem_301').estatus,r302:R('bind_rem_302').estatus,r303:R('bind_rem_303').estatus,
  cobro301:DB.cobranza.find(c=>c.id==='bind_cob_301').estatus,cobro300:DB.cobranza.find(c=>c.id==='bind_cob_300').estatus};
 r.despues=['bind_rem_300','bind_rem_302'].map(sit);
 r.otraVez=w.eval("nunRemCanceladasCandidatas().length");
 r.fallas=[];
 if(!/^v(3\.(9[1-9]|\d{3,})|[4-9]\.\d+) · Sistema NUN$/.test(r.version)) r.fallas.push('version');
 if(r.excel.filas!==6||r.excel.hojas!=='2025,2026'||r.excel.fecha0!=='2025-11-03'||r.excel.cobrado!==6000||r.excel.folios!==': : R:V01500 F:1028 R:V01500 P:') r.fallas.push('excel');
 if(r.docs.join(' ')!=='Maria  Gomez=OK/cliente+monto Juan Perez Lopez=SOLO_EXCEL Juan Perez Lopez=DIF_COBRADO/folio Comercial Alfa=OK/folio Pedro Inventado=SOLO_EXCEL Rosa Nadie=SOLO_EXCEL V01501=SOLO_BIND V01301=SOLO_BIND') r.fallas.push('docs');
 if(!/2,000.*más cobrado/.test(r.porque.juan)||!/folio repetido/.test(r.porque.pedro)||!/pedido/.test(r.porque.rosa)||!/Debe .*3,000.* no está en tu Excel/.test(r.porque.v501)) r.fallas.push('porque');
 if(r.clientes.juan!=='4000|9000|-5000|EDGAR|EDGAR|ESTEBAN desde 15 jul 25 → EDGAR desde 01 mar 26'||!/^2000\|2000\|ESTEBAN\|LUIS\|Vendedor: Excel ESTEBAN \/ sistema LUIS$/.test(r.clientes.maria)||r.clientes.alfa!=='OK') r.fallas.push('clientes');
 if(r.pantalla.titulo!=='Cuadre Excel vs Sistema'||!r.pantalla.texto||r.pantalla.docsProblema!==6) r.fallas.push('pantalla');
 if(!/^cancelada ¿se facturó en FT0005\? \(mismo total\) ✓ Es facturada$/.test(r.antes[0])||!/FT0006/.test(r.antes[1])||!/sin factura igual/.test(r.antes[2])) r.fallas.push('antes');
 if(r.modal.join(' ')!=='300→FT0005 301→FT0006') r.fallas.push('modal');
 if(r.guardado.r300!=='facturada | Cancelada en Bind · Facturada en FT0005 (id f1) · estaba cancelada, se corrigió HOY'||r.guardado.r301!=='facturada'||r.guardado.r302!=='cancelada'||r.guardado.r303!=='cancelada'||r.guardado.cobro301!=='cancelado'||r.guardado.cobro300!=='cancelado') r.fallas.push('guardado');
 if(r.despues[0]!=='facturada en FT0005'||r.despues[1]!=='cancelada sin factura igual'||r.otraVez!==0) r.fallas.push('despues');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
