// v4.02 — Descuento / nota de crédito en una remisión (interna, sin SAT), en $ o %, hecha por quien edita ventas (rol cobranza):
// se crea la nota NR0001 ligada a la remisión, el saldo baja en Cobranza y no se resta dos veces. Factura timbrada: botón 💳 Nota de crédito. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA NUEVE';
const DB={remisiones:[{id:'bind_rem_244',folio:'244',cliente:N,estatus:'pendiente',total:12600,fecha:'2026-07-08',vendedor:'EDGAR',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0001',cliente:N,estatus:'timbrada',uuid_sat:'u1',total:1160,items_json:'[]'}],
 cobranza:[{id:'bind_cob_244',numero:'V01244',cliente:N,total:12600,cobrado:5430,pendiente:7170,descripcion:''}],
 notascredito:[{id:'bind_nc_1',folio:'1016',documento_origen:'V01999',total:190,estatus:'timbrada'}],ingresos:[],pagosclientes:[],pedidos:[],clientes:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'COBR-PRUEBA1',usuario:{codigo:'COBR-PRUEBA1',nombre:'Yazmin',rol:'cobranza'},permisos:{ver_operacion:true,editar_operacion:true,ver_catalogos:true},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_crear'){ DB[b.tabla].push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of ['remisiones','facturas','cobranza','notascredito']) await w.eval(`cargarTabla('${t}')`);
 w.eval("window.confirmDialog=async()=>true");
 const btns=(t,id)=>{ w.eval(`abrirDoc('${t}','${id}')`); const b=[...d.querySelectorAll('.drawer button')].map(x=>x.textContent.trim()); w.eval("cerrarDrawer()"); return b; };
 r.botones={remision:btns('remisiones','bind_rem_244').includes('💸 Descuento / nota de crédito'),factura:btns('facturas','f1').includes('💳 Nota de crédito')};
 await w.eval("nunDescuentoRemision('bind_rem_244')"); await sleep(200);
 d.getElementById('drPct').value='10'; w.eval("nunDRCalc('pct')"); r.monto=d.getElementById('drMonto').value; r.resumen=txt(d.getElementById('drResumen'));
 await w.eval("nunDescuentoRemisionGuardar()"); r.sinMotivo=d.getElementById('drError').textContent;
 d.getElementById('drMotivo').value='Descuento acordado'; await w.eval("nunDescuentoRemisionGuardar()"); await sleep(400);
 const nc=DB.notascredito.find(n=>n.folio==='NR0001'); r.nc=nc&&[nc.documento_origen,nc.total,nc.estatus,/\[aplicada en Cobranza V01244\]/.test(nc.notas)].join('|');
 r.cobro=[DB.cobranza[0].total,DB.cobranza[0].cobrado,DB.cobranza[0].pendiente].join('/');
 r.saldoDoc=w.eval("nunSaldoDoc(State.data.remisiones[0],'remisiones')");
 r.timbro=enviados.some(b=>b.accion==='facturama_timbrar');
 r.fallas=[];
 if(!r.botones.remision||!r.botones.factura) r.fallas.push('botones');
 if(r.monto!=='1260'||!/saldo \$7,170.00 → \$5,910.00/.test(r.resumen)||!/motivo/.test(r.sinMotivo)) r.fallas.push('ventana');
 if(r.nc!=='V01244|1260|aplicada|true'||r.cobro!=='11340/5430/5910'||r.saldoDoc!==5910||r.timbro) r.fallas.push('aplicada');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
