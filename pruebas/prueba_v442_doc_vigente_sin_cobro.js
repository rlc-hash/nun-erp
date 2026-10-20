// v4.42 — Documento VIGENTE sin cobro (o con su cobro cancelado) sale en "Falta cuadrar" de la ficha con botón ＋ Crear cobro / ↺ Reactivar cobro.
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'co',razon_social:'COMARCA PRUEBA'}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'bind_f7',folio:'7',fecha:'2025-08-13',cliente:'COMARCA PRUEBA',estatus:'timbrada',total:12800}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'bind_f24',folio:'24',fecha:'2025-10-16',cliente:'COMARCA PRUEBA',estatus:'timbrada',total:25600}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'bind_f9',folio:'9',fecha:'2025-10-16',cliente:'COMARCA PRUEBA',estatus:'cancelada',total:999}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'bind_cob_f24',numero:'A24',cliente:'COMARCA PRUEBA',tipo:'Factura',total:25600,cobrado:0,pendiente:0,estatus:'cancelado',factura_origen:'bind_f24'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'k1',numero:'A2',cliente:'COMARCA PRUEBA',tipo:'Factura',total:1000,cobrado:1000,pendiente:0,factura_origen:'x'}});
  for(const t of ['clientes','cobranza','ingresos','pedidos','remisiones','facturas','notascredito','cotizaciones']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  const caja=()=>txt(d.querySelector('.drawer .nunCuadrePendMount')); const kp=()=>[...d.querySelectorAll('.drawer .kpi')].slice(0,2).map(txt);
  w.eval("abrirDetalleCliente('co')"); await sleep(200);
  r.antes=caja(); r.kAntes=kp();
  if(!/F 7 .*no tiene cobro/.test(r.antes)||!/F 24 .*CANCELADO/.test(r.antes)||/F 9/.test(r.antes)) r.fallas.push('aviso');
  const btn=re=>[...d.querySelectorAll('.drawer .nunCuadrePendMount button')].find(b=>re.test(b.textContent));
  btn(/Crear cobro/).click(); await sleep(1200);
  btn(/Reactivar cobro/).click(); await sleep(1200);
  await w.eval("cargarTabla('cobranza')"); w.eval("abrirDetalleCliente('co')"); await sleep(200);
  r.despues=caja(); r.kDespues=kp();
  const C=JSON.parse(await servidor('post',JSON.stringify({codigo:COD,accion:'erp_listar',tabla:'cobranza'}))).items.filter(c=>c.cliente==='COMARCA PRUEBA');
  r.cobros=C.map(c=>c.numero+' '+c.total+' '+(c.estatus||'vivo')+' pend '+c.pendiente);
  if(/vigente pero/.test(r.despues)) r.fallas.push('sigue-aviso');
  if(!/Facturado\$39,400/.test(r.kDespues[0])||!/Pendiente\$38,400/.test(r.kDespues[1])) r.fallas.push('montos');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(4[2-9]|[5-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
