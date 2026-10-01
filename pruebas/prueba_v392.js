// v3.92 — Pedidos: los cancelados dicen "cancelado" y un pedido no es deuda (sin saldo si no tiene anticipo);
// cancelar un pago desde la misma remisión/factura; botón "Cancelar remisión"; cancelar nota de crédito timbrada ante el SAT;
// vendedores según tu Excel (catálogo = el más reciente; cada documento = el de su fecha). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='JUAN PEREZ LOPEZ';
const DB={
 pedidos:[{id:'p1',folio:'P0001',cliente:N,estatus:'cancelado',total:800000,items_json:'[]'},{id:'bind_ord_2',folio:'900',cliente:N,estatus:'confirmado',total:5000,items_json:'[]'}],
 remisiones:[{id:'r1',folio:'R0001',cliente:N,estatus:'entregada',total:1000,fecha:'2025-09-01',vendedor:'YASMIN',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0001',cliente:N,estatus:'timbrada',total:2000,fecha:'2026-05-01',vendedor:'ESTEBAN',uuid_sat:'aaaa',items_json:'[]'}],
 notascredito:[{id:'nc1',folio:'NC0001',cliente:N,estatus:'timbrada',total:100,uuid_sat:'bbbb',documento_origen:'FT0001',notas:'Facturama ID: FAMA-NC1 · NC descuento de FT0001',items_json:'[]'}],
 cobranza:[{id:'cob_r1',numero:'R0001',cliente:N,total:1000,cobrado:600,pendiente:400,factura_origen:'r1',vendedor:'YASMIN',fecha_entrega:'2025-09-01'}],
 ingresos:[{id:'ing1',cliente:N,factura:'R0001',monto:600,fecha:'2025-09-10',cuenta:'BBVA',tipo:'cobro'},{id:'ing2',cliente:N,factura:'R0001',monto:50,fecha:'2025-09-11',cuenta:'Efectivo',tipo:'CANCELADO'}],
 clientes:[{id:'c1',razon_social:N,vendedor:'LUIS'}],pagosclientes:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='facturama_cancelar') return J({ok:true});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB)) if(t!=='usuarios') await w.eval(`cargarTabla('${t}')`);
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 w.eval("window.confirmDialog=async()=>true; window.confirm=()=>true; window.prompt=(m,def)=>/Motivo de cancelaci/.test(m)?'02':'se capturó dos veces'");
 // 1) lista de pedidos
 w.eval("navegar('pedidos')"); await sleep(300);
 r.pedidos=[...d.querySelectorAll('#dtMountDoc_pedidos tbody tr')].map(tr=>{const td=[...tr.querySelectorAll('td')]; return td.slice(-4).map(txt).join('|');});
 r.porCobrar=txt([...d.querySelectorAll('.kpi')].find(k=>/Por cobrar/.test(k.textContent)).querySelector('.kpi-value'));
 // 2) pago desde la remisión
 w.eval("abrirDoc('remisiones','r1')"); await sleep(300);
 const btns=[...d.querySelectorAll('.drawer button')].map(b=>b.textContent.trim());
 r.remision={cancelarPago:btns.filter(t=>t==='Cancelar pago').length,cancelarDoc:btns.includes('🚫 Cancelar remisión'),cerrar:btns.includes('Cerrar'),eliminar:btns.includes('Eliminar'),resumen:/1 pago\(s\) \$600/.test(d.querySelector('.drawer').textContent)};
 await w.eval("nunCancelarIngreso('ing1')"); await sleep(300);
 r.pago={tipo:DB.ingresos[0].tipo,cobrado:DB.cobranza[0].cobrado,pendiente:DB.cobranza[0].pendiente};
 // 3) nota de crédito timbrada
 w.eval("abrirDoc('notascredito','nc1')"); await sleep(300);
 const bn=[...d.querySelectorAll('.drawer button')].map(b=>b.textContent.trim());
 r.nc={botonSAT:bn.includes('🚫 Cancelar nota ante SAT'),botonSimple:bn.some(t=>/^🚫 Cancelar nota de crédito/.test(t))};
 await w.eval("facturaCancelar('nc1','notascredito')"); await sleep(300);
 const fc=enviados.filter(b=>b.accion==='facturama_cancelar').pop(); r.nc.sat=fc&&fc.id+':'+fc.motivo; r.nc.estatus=DB.notascredito[0].estatus;
 // 4) vendedores según el Excel
 w.localStorage.setItem('nun_cuadre_excel',JSON.stringify([
  {id:'x1',hoja:'2025',fila:2,fecha:'2025-07-15',cliente:'Juan Perez Lopez',pago_total:700,pago_cobrado:700,pago_faltante:0,vendedor:'ESTEBAN',factura_raw:'',factura_tipo:'',factura_norm:''},
  {id:'x2',hoja:'2026',fila:2,fecha:'2026-03-01',cliente:'Juan Perez Lopez',pago_total:1000,pago_cobrado:1000,pago_faltante:0,vendedor:'EDGAR',factura_raw:'R - R0001',factura_tipo:'R',factura_norm:'R0001'}]));
 await w.eval("cargarTabla('cobranza')");
 await w.eval("cuadreVendedoresDeExcel()"); await sleep(300);
 r.vend=[...d.querySelectorAll('#modalCVE tbody tr')].map(tr=>[...tr.querySelectorAll('td')].slice(2).map(txt).filter((x,i)=>i!==2&&i!==5).join('|'));
 await w.eval("cuadreVendedoresGuardar()"); await sleep(300);
 r.vendGuardado=[DB.clientes[0].vendedor,DB.remisiones[0].vendedor,DB.facturas[0].vendedor,DB.cobranza[0].vendedor].join(',');
 r.fallas=[];
 if(!/^v(3\.(9[2-9]|\d{3,})|[4-9]\.\d+) · Sistema NUN$/.test(r.version)) r.fallas.push('version');
 if(r.pedidos.join(' / ')!=='$800,000|—|cancelado|cancelado / $5,000|—|de Bind (sin liga)|confirmado'||r.porCobrar!=='$0') r.fallas.push('pedidos');
 if(r.remision.cancelarPago!==2||!r.remision.cancelarDoc||!r.remision.cerrar||r.remision.eliminar||!r.remision.resumen) r.fallas.push('remision');
 if(r.pago.tipo!=='CANCELADO'||r.pago.cobrado!==0||r.pago.pendiente!==1000) r.fallas.push('pago');
 if(!r.nc.botonSAT||r.nc.botonSimple||r.nc.sat!=='FAMA-NC1:02'||r.nc.estatus!=='cancelada') r.fallas.push('nc');
 if(r.vend.join(' / ')!=='Catálogo||LUIS|EDGAR / Pedido|900|—|EDGAR / Remisión|R0001|YASMIN|ESTEBAN / Factura|FT0001|ESTEBAN|EDGAR / Cobro|R0001|YASMIN|ESTEBAN'||r.vendGuardado!=='EDGAR,ESTEBAN,EDGAR,ESTEBAN') r.fallas.push('vendedores');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
