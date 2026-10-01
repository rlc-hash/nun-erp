// v3.93 — Pago de una factura cuyo cobro no existía (factura "de remisión" cuya remisión no tenía renglón en Cobranza):
// se crea su renglón y el pago baja a Ingresos. Si el complemento ya se timbró pero el pago no se registró, se registra
// SOLO el pago (sin timbrar otro). Aviso cuando la factura está ligada a una remisión de otro monto. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA PRUEBA DOS';
const DB={
 facturas:[{id:'f3',folio:'FT0003',cliente:N,estatus:'timbrada',total:46000,subtotal:39655.17,iva:6344.83,fecha:'2026-09-30',uuid_sat:'aaaa0000-0000-4000-8000-000000000003',metodo_pago:'PPD',forma_pago:'99',pedido_origen:'REM REM-2026-0001',vendedor:'EDGAR',
   notas:'Factura de la remisión REM-2026-0001 · Facturama ID: FAMA3 · REP CP0003 uuid=cccc0000-0000-4000-8000-000000000003 monto=46000.00 fecha=2026-09-30 parc=1 sant=46000.00',
   items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:1,precio_unitario:39655.17,iva_pct:16,clave_sat:'53121502'}])},
  {id:'f4',folio:'FT0004',cliente:N,estatus:'timbrada',total:1160,subtotal:1000,iva:160,fecha:'2026-09-30',uuid_sat:'aaaa0000-0000-4000-8000-000000000004',metodo_pago:'PPD',forma_pago:'99',vendedor:'EDGAR',notas:'',
   items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:1,precio_unitario:1000,iva_pct:16,clave_sat:'53121502'}])}],
 remisiones:[{id:'rs1',folio:'REM-2026-0001',cliente:N,estatus:'entregada',total:5730,fecha:'2026-09-29',items_json:'[]'}],
 cobranza:[],ingresos:[],pagosclientes:[],pedidos:[],notascredito:[],
 clientes:[{id:'c1',razon_social:N,rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626',uso_cfdi:'G01'}],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='listar_cuentas') return J({ok:true,cuentas:[{nombre:'BBVA'},{nombre:'Efectivo'}]});
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='obtener_empresa') return J({ok:true,config:{rfc:'EKU9003173C9',cp:'11000',razon_social:'EMPRESA PRUEBA',regimen_fiscal:'601'}});
   if(b.accion==='facturama_timbrar') return J({ok:true,uuid:'dddd0000-0000-4000-8000-000000000004',id:'FAMA4',xml:''});
   if(b.accion==='capturar_pago_cliente'){ const c=DB.cobranza.find(x=>x.id===b.id_doc); if(!c) return J({ok:false,error:'no existe'}); c.cobrado=(+c.cobrado||0)+b.monto; c.pendiente=c.total-c.cobrado; DB.ingresos.push({id:'ing'+DB.ingresos.length,cliente:c.cliente,factura:c.numero,monto:b.monto,fecha:b.fecha,cuenta:b.cuenta}); return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['facturas','remisiones','cobranza','ingresos','clientes']) await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.empresa={rfc:'EKU9003173C9',cp:'11000',razon_social:'EMPRESA PRUEBA',regimen_fiscal:'601'}; State.data.cuentas=[{nombre:'BBVA'},{nombre:'Efectivo'}]");
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 // aviso en la factura
 w.eval("abrirDoc('facturas','f3')"); await sleep(300); r.aviso=/ligada a la remisión REM-2026-0001 de \$5,730/.test(d.querySelector('.drawer').textContent); w.eval("cerrarDrawer()");
 // 1) complemento ya timbrado, pago sin registrar
 await w.eval("nunAbrirComplementoPago('f3')"); await sleep(200);
 r.caso1={monto:d.getElementById('repMonto').value,timbrar:d.getElementById('repTimbrar').checked,cobranza:d.getElementById('repCobranza').checked,cobDisabled:d.getElementById('repCobranza').disabled,aviso:/no está registrado como pago/.test(d.getElementById('modalREP').textContent)};
 d.getElementById('repCuenta').value='BBVA';
 await w.eval("nunConfirmarComplementoPago('f3')"); await sleep(400);
 r.caso1.err=(d.getElementById('repError')||{}).textContent||'';
 r.caso1.timbro=enviados.some(b=>b.accion==='facturama_timbrar');
 r.caso1.cobro=DB.cobranza.map(c=>[c.id,c.numero,c.total,c.cobrado,c.pendiente,c.factura_origen].join('|'));
 r.caso1.ingresos=DB.ingresos.map(i=>[i.factura,i.monto,i.cuenta].join('|'));
 // 2) factura nueva sin cobro: timbra el complemento y registra el pago
 await w.eval("nunAbrirComplementoPago('f4')"); await sleep(200);
 r.caso2={timbrar:d.getElementById('repTimbrar').checked,monto:d.getElementById('repMonto').value};
 d.getElementById('repCuenta').value='Efectivo'; d.getElementById('repForma').value='01'; d.getElementById('repMonto').value='500';
 await w.eval("nunConfirmarComplementoPago('f4')"); await sleep(400);
 r.caso2.err=(d.getElementById('repError')||{}).textContent||'';
 r.caso2.timbro=enviados.filter(b=>b.accion==='facturama_timbrar').length;
 r.caso2.cobro=DB.cobranza.filter(c=>c.id==='cob_f4').map(c=>[c.numero,c.total,c.cobrado,c.pendiente].join('|'));
 r.caso2.ingreso=DB.ingresos.filter(i=>i.factura==='FT0004').map(i=>i.monto+'|'+i.cuenta);
 r.fallas=[];
 if(!r.aviso) r.fallas.push('aviso');
 if(r.caso1.monto!=='46000'||r.caso1.timbrar||!r.caso1.cobranza||r.caso1.cobDisabled||!r.caso1.aviso||r.caso1.err||r.caso1.timbro||r.caso1.cobro.join()!=='cob_f3|FT0003|46000|46000|0|f3'||r.caso1.ingresos.join()!=='FT0003|46000|BBVA') r.fallas.push('caso1');
 if(!r.caso2.timbrar||r.caso2.monto!=='1160'||r.caso2.err||r.caso2.timbro!==1||r.caso2.cobro.join()!=='FT0004|1160|500|660'||r.caso2.ingreso.join()!=='500|Efectivo') r.fallas.push('caso2');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
