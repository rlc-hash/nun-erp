// v3.99 — Complemento de pago de HOY: la hora va con la hora actual (antes 12:00 → Facturama lo rechazaba en la mañana:
// "La fecha del pago no debe ser una fecha futura"); fechas pasadas siguen a las 12:00; no se acepta fecha futura. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE SIETE';
const DB={facturas:[{id:'f5',folio:'FT0005',cliente:N,estatus:'timbrada',total:1650,subtotal:1422.41,iva:227.59,fecha:'2026-09-30',uuid_sat:'aaaa5',metodo_pago:'PPD',notas:'',items_json:JSON.stringify([{sku:'A',descripcion:'A',cantidad:1,precio_unitario:1422.41,iva_pct:16,clave_sat:'53121502'}])}],
 cobranza:[{id:'cob_f5',numero:'FT0005',cliente:N,total:1650,cobrado:0,pendiente:1650,factura_origen:'f5'}],remisiones:[],ingresos:[],pagosclientes:[],
 clientes:[{id:'c1',razon_social:N,rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626'}],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it);} return J({ok:true}); }
   if(b.accion==='facturama_timbrar') return J({ok:true,uuid:'bbbb0000-0000-4000-8000-000000000005',id:'FAMA5',xml:''});
   if(b.accion==='capturar_pago_cliente') return J({ok:true});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['facturas','cobranza','remisiones','ingresos','clientes']) await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.empresa={rfc:'EKU9003173C9',cp:'11000',razon_social:'EMPRESA PRUEBA',regimen_fiscal:'601'}; State.data.cuentas=[{nombre:'BBVA'}]");
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 const hoy=w.eval("nunHoy()"), ahora=new Date();
 r.pasado=w.eval("nunFechaPagoCfdi('2026-09-15')");
 const h=w.eval("nunFechaPagoCfdi(nunHoy())"); r.hoyFecha=h.substring(0,10)===hoy; r.hoyNoFuturo=new Date(h)<=ahora;
 r.futuro=w.eval("nunFechaPagoCfdi('2099-01-01')").substring(0,10)===hoy;
 // en la ventana: fecha futura se rechaza; hoy se timbra con hora actual
 await w.eval("nunAbrirComplementoPago('f5')"); await sleep(200);
 d.getElementById('repForma').value='03'; d.getElementById('repCuenta').value='BBVA'; d.getElementById('repFecha').value='2099-01-01';
 await w.eval("nunConfirmarComplementoPago('f5')"); r.errFuturo=d.getElementById('repError').textContent;
 d.getElementById('repFecha').value=hoy; await w.eval("nunConfirmarComplementoPago('f5')"); await sleep(300);
 const t=enviados.filter(b=>b.accion==='facturama_timbrar').pop(); r.cfdiFecha=t&&t.cfdi.Complemento.Payments[0].Date;
 r.fallas=[];
 if(r.pasado!=='2026-09-15T12:00:00'||!r.hoyFecha||!r.hoyNoFuturo||!r.futuro) r.fallas.push('fecha');
 if(!/no puede ser futura/.test(r.errFuturo)||!r.cfdiFecha||r.cfdiFecha.substring(0,10)!==hoy||new Date(r.cfdiFecha)>ahora) r.fallas.push('ventana');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
