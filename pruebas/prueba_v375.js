const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={facturas:[{id:'f1',folio:'FT0001',cliente:'CLIENTE UNO DE PRUEBA',subtotal:15948.26,iva:2551.72,total:18499.98,pedido_origen:'REM 322',estatus:'timbrada',uuid_sat:'11111111-2222-4333-8444-5555555555aa',metodo_pago:'PPD',forma_pago:'99',notas:'Factura de la remisión 322 · Facturama ID: L-e',items_json:JSON.stringify([{sku:'A',cantidad:1,precio_unitario:15948.26,iva_pct:16}])},
   {id:'f2',folio:'FT0002',cliente:'X',total:100,uuid_sat:'u2',metodo_pago:'PUE',items_json:'[]'}],
 remisiones:[{id:'bind_rem_322',folio:322,cliente:'CLIENTE UNO DE PRUEBA',total:18499.98,estatus:'facturada',items_json:'[]'}],
 cobranza:[{id:'bind_cob_322',numero:'V01322',cliente:'CLIENTE UNO DE PRUEBA',total:18499.98,pendiente:18499.98,cobrado:0}],
 clientes:[{id:'c1',razon_social:'CLIENTE UNO DE PRUEBA',rfc:'CACX7605101P8',cp:64000,regimen_fiscal:626,uso_cfdi:'G01'}],
 cuentas:[{nombre:'BBVA 1234'}],ingresos:[],pagosclientes:[],usuarios:[]};
const ll=[];let fallarTimbre=1;
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; ll.push(b); await new Promise(z=>setTimeout(z,60)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=DB[b.tabla].find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='facturama_timbrar'){ if(fallarTimbre){fallarTimbre--; return J({ok:false,error:'Facturama (400): {"Message":"El atributo \'Serie\' debe existir en la sucursal"}'});} return J({ok:true,uuid:'aaaa2222-0000-0000-0000-000000000000',id:'REP1',xml:'<x/>'}); }
   if(b.accion==='capturar_pago_cliente'){ const c=DB.cobranza.find(x=>x.id===b.id_doc); c.cobrado+=b.monto; c.pendiente=+(c.total-c.cobrado).toFixed(2); DB.ingresos.push({monto:b.monto,cuenta:b.cuenta}); return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['facturas','remisiones','cobranza','clientes','cuentas']) await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.empresa={rfc:'EKU9003173C9',cp:11000}");
 w.eval("abrirDoc('facturas','f1')"); await sleep(100); r.boton=/Pago \+ complemento/.test(d.body.innerHTML);
 w.eval("abrirDoc('facturas','f2')"); await sleep(100); r.botonPUE=d.body.innerHTML.includes("nunAbrirComplementoPago('f2')")?'MAL':(d.body.innerHTML.includes("nunPagoDesdeDoc('facturas','f2')")?'ok: Registrar pago':'?');
 await w.eval("nunAbrirComplementoPago('f1')"); await sleep(100);
 r.modal=d.querySelector('#modalREP h3').textContent+' | '+d.querySelector('#modalREP h3').nextElementSibling.textContent;
 await w.eval("nunConfirmarComplementoPago('f1')"); r.errVacio=d.getElementById('repError').textContent;
 d.getElementById('repForma').value='03'; d.getElementById('repCuenta').value='BBVA 1234'; d.getElementById('repOperacion').value='12345';
 // 1er intento: Facturama rechaza (serie CP no existe) → nada se registra
 await w.eval("nunConfirmarComplementoPago('f1')"); await sleep(100);
 r.intento1={err:d.getElementById('repError').textContent, cobrado:DB.cobranza[0].cobrado, ingresos:DB.ingresos.length};
 // 2o intento: parcial de 10,000
 d.getElementById('repMonto').value='10000';
 await w.eval("nunConfirmarComplementoPago('f1')"); await sleep(300);
 const cf=ll.filter(x=>x.accion==='facturama_timbrar').pop().cfdi; r.cfdi=JSON.stringify(cf);
 r.despues={cobrado:DB.cobranza[0].cobrado,pend:DB.cobranza[0].pendiente,ingresos:DB.ingresos,notas:DB.facturas[0].notas,xmlGuardado:ll.some(x=>x.accion==='cfdi_xml_guardar'&&x.docs[0].tipo==='P')};
 // Segundo complemento: parcialidad 2, saldo anterior 8,499.98, folio CP0002
 await w.eval("nunAbrirComplementoPago('f1')"); await sleep(100);
 r.modal2=d.querySelector('#modalREP h3').nextElementSibling.textContent+' | '+d.querySelector('#repTimbrar').parentElement.textContent.trim();
 d.getElementById('repForma').value='03'; d.getElementById('repCuenta').value='BBVA 1234';
 await w.eval("nunConfirmarComplementoPago('f1')"); await sleep(300);
 const cf2=ll.filter(x=>x.accion==='facturama_timbrar').pop().cfdi; r.rel2=JSON.stringify({folio:cf2.Folio,rel:cf2.Complemento.Payments[0].RelatedDocuments[0]});
 r.final={pend:DB.cobranza[0].pendiente,reps:w.eval("nunRepsDeFactura(State.data.facturas.find(f=>f.id==='f1')).map(x=>x.folio+' '+x.monto)")};
 w.eval("abrirDoc('facturas','f1')"); await sleep(100); r.botonesXml=(d.body.innerHTML.match(/📃 XML CP\d+/g)||[]);
}catch(e){r.error=String(e.stack).slice(0,500)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
