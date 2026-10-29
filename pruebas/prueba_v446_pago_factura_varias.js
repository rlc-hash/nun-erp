// v4.46 — Factura de VARIAS remisiones (FT0014 = R0022 + REM 317 + R0023): 💵 Registrar pago reparte el pago en el cobro de cada remisión
// (antes: "No encontré el renglón de Cobranza"), y el saldo de la factura baja con esos pagos.
// Base v4.44 — Ficha del cliente: tabla "Pedidos (como tu Excel)" con Total · Pagado · Falta por pedido; factura en 2 pedidos = "comparte factura";
// cobro manual con "[pedido X]" cuenta en ese pedido.
// Base v4.42 — Documento VIGENTE sin cobro (o con su cobro cancelado) sale en "Falta cuadrar" de la ficha con botón ＋ Crear cobro / ↺ Reactivar cobro.
// (Caso real: Comarca A7 y A24 se pasaron de cancelada a timbrada y su cobro no se arregló.)
// Base v4.39 — Cliente de factura (MARKET de RAMIRO): su Facturado/Pendiente cuenta solo en la ficha de RAMIRO; en la suya sale '—' y "cuenta en RAMIRO".
// Base v4.38 — Pestaña Pagos de la ficha: cada pago dice Activo / Cancelado / Duplicado y el dueño lo puede cancelar desde ahí.
// v4.37 — 🔎 Ver en la ficha del cliente abre el resumen ahí mismo (sin salir).
// Base v4.36 — pedido con TODAS sus piezas surtidas pero sus documentos suman menos que el pedido: avisa "faltan $X" (antes decía saldo $0).
// Base: v4.14 — FLUJO NUEVO DE VENTA probado contra el servidor de verdad (backend/Codigo.gs corriendo en el emulador de Supabase):
// cotización (aparta) → ✅ Confirmar → pedido (venta: descuenta inventario, 1 cobro) → 🧾 factura sin otro cobro → tablero y saldo.
// Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
(async()=>{
 const E=await import(path.join(__dirname,'..','supabase','functions','nun','emulador.js'));
 const fn=E.compilar(fs.readFileSync(path.join(__dirname,'..','backend','Codigo.gs'),'utf8'));
 const DB=new Map(); let PROPS={en_supabase:'1'}; const COD='DUENO-PRUEBA1';
 const servidor=async(tipo,payload)=>{ const r=await E.atender({fn,existentes:[...DB.keys()],props:PROPS,cargar:async ns=>new Map(ns.map(n=>[n,JSON.parse(JSON.stringify(DB.get(n)||[]))])),
   sesion:c=>String(c||'').toUpperCase()===COD,admin:c=>String(c||'').toUpperCase()===COD,tipo,payload});
   for(const s of r.sucias) DB.set(s.nombre,JSON.parse(JSON.stringify(s.filas))); if(r.props) PROPS=r.props; return r.texto; };
 const post=async b=>JSON.parse(await servidor('post',JSON.stringify(Object.assign({codigo:COD},b))));
 await post({accion:'inicializar'});
 await post({accion:'erp_crear',tabla:'productos',item:{id:'pr1',sku:'RL004M',descripcion:'MALETA RL004 MORADO',stock_actual:10,stock_comprometido:0}});
 await post({accion:'erp_crear',tabla:'clientes',item:{id:'c1',razon_social:'CLIENTE PRUEBA',credito_dias:15}});
 const cot=await post({accion:'erp_crear',tabla:'cotizaciones',item:{id:'cot1',folio:'',fecha:'2026-10-07',cliente:'CLIENTE PRUEBA',vendedor:'EDGAR',estatus:'enviada',subtotal:3000,iva:480,total:3480,
   items_json:JSON.stringify([{sku:'RL004M',descripcion:'MALETA RL004 MORADO',cantidad:2,precio_unitario:1500,iva_pct:16}])}});
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_relaciones_clientes',JSON.stringify([{principal:'RAMIRO PRUEBA',facturar_a:['MARKET PRUEBA']}])); w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';

 await sleep(3000); const r={fallas:[]};
 try{
  const C='CINTIA PRUEBA', RB='REBE PRUEBA';
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ci',razon_social:C}});
  const rem=async(id,fol,tot,fecha)=>{ await post({accion:'erp_crear',tabla:'remisiones',item:{id,folio:fol,fecha,cliente:C,estatus:'entregada',total:tot,_sin_inventario:true}}); await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_'+id,numero:fol.startsWith('R')?fol:'V01'+fol,cliente:C,tipo:'Remisión',total:tot,cobrado:0,pendiente:tot,factura_origen:id}}); };
  await rem('r22','R0022',24000,'2025-11-21'); await rem('bind_rem_317','317',25000,'2025-12-05'); await rem('r23','R0023',22295,'2026-05-06');
  const it=(sku,c,p,ped)=>({sku,cantidad:c,precio_unitario:p,iva_pct:16,pedido:ped});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f14',folio:'FT0014',fecha:'2026-10-23',cliente:RB,estatus:'timbrada',metodo_pago:'PUE',total:70000,pedido_origen:'R0022, REM 317, R0023',
    items_json:JSON.stringify([it('A',14,24000/14/1.16,'1046 (R0022)'),it('B',16,1562.5/1.16,'1060 (R 317)'),it('C',15,1400/1.16,'1224 (R0023)')])}});
  for(const t of ['clientes','cobranza','ingresos','pedidos','remisiones','facturas','notascredito','cotizaciones']) await w.eval(`cargarTabla('${t}')`);
  r.reparto=w.eval("nunFacturaVariasRem(State.data.facturas.find(f=>f.id==='f14')).map(x=>x.fol+':'+x.asig)");
  if(r.reparto.join()!=='R0022:24000,317:25000,R0023:21000') r.fallas.push('reparto');
  r.saldoAntes=w.eval("nunSaldoDoc(State.data.facturas.find(f=>f.id==='f14'),'facturas')");
  w.eval("window.confirmDialog=async()=>true");
  await w.eval("nunPagoDesdeDoc('facturas','f14')"); await sleep(800);
  r.modal=!!d.getElementById('modalPFV');
  // v4.61 — PUE: fecha = la de la factura y cuenta BBVA ya puestas
  r.pueFecha=d.getElementById('pfvFecha').value; r.pueCuenta=d.getElementById('pfvCuenta').value;
  if(r.pueFecha!=='2026-10-23'||!/BBVA/.test(r.pueCuenta)) r.fallas.push('pue-default');
  d.getElementById('pfvFecha').value='2026-10-20'; const sel=d.getElementById('pfvCuenta'); sel.value=[...sel.options].map(o=>o.value).find(v=>/BBVA/.test(v))||sel.options[1].value;
  await w.eval("nunPagoFacturaVariasGuardar()"); await sleep(2500);
  const L=async t=>JSON.parse(await servidor('post',JSON.stringify({codigo:COD,accion:'erp_listar',tabla:t}))).items;
  const cobs=(await L('cobranza')).filter(c=>c.cliente===C); r.cobros=cobs.map(c=>c.numero+' '+c.cobrado+'/'+c.pendiente);
  const ings=(await L('ingresos')).filter(i=>/Pago de la factura FT0014/.test(i.comentarios||'')); r.ings=ings.map(i=>i.factura+' '+i.monto+' '+i.fecha+' '+i.cuenta);
  await w.eval("cargarTabla('ingresos')"); r.saldoDespues=w.eval("nunSaldoDoc(State.data.facturas.find(f=>f.id==='f14'),'facturas')");
  if(!r.modal) r.fallas.push('sin-modal');
  if(r.cobros.sort().join()!=='R0022 24000/0,R0023 21000/1295,V01317 25000/0') r.fallas.push('cobros');
  if(ings.length!==3||ings.some(i=>String(i.fecha).slice(0,10)!=='2026-10-20')) r.fallas.push('ingresos');
  if(+r.saldoAntes!==70000||+r.saldoDespues!==0) r.fallas.push('saldo');
  // v4.61 — en la lista de Facturas dice "timbrada" (y "pagada" cuando ya no debe)
  await w.eval("cargarTabla('cobranza')"); w.eval("navegar('facturas')"); await sleep(800);
  r.estatusLista=txt([...d.querySelectorAll('table.dt tbody tr')].find(tr=>/FT0014/.test(tr.textContent))?.lastElementChild);
  if(!/timbrada/.test(r.estatusLista||'')||!/pagada/.test(r.estatusLista||'')) r.fallas.push('lista-timbrada');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(6[1-9]|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
