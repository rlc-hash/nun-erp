// v4.38 — Pestaña Pagos de la ficha: cada pago dice Activo / Cancelado / Duplicado y el dueño lo puede cancelar desde ahí.
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
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';

 await sleep(3000); const r={fallas:[]};
 try{
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'gm',razon_social:'GISELA PRUEBA'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cb1',numero:'V01268',cliente:'GISELA PRUEBA',tipo:'Remisión',total:7500,cobrado:7500,pendiente:0}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cb2',numero:'V01298',cliente:'GISELA PRUEBA',tipo:'Remisión',total:1000,cobrado:420,pendiente:580}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i1',fecha:'2026-05-15',cliente:'GISELA PRUEBA',factura:'V01268',cuenta:'Caja Chica',tipo:'cobro',monto:7500}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i2',fecha:'2026-07-15',cliente:'GISELA PRUEBA',factura:'V01268',cuenta:'Caja Chica',tipo:'CANCELADO_BIND',monto:7500}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i3',fecha:'2026-05-15',cliente:'GISELA PRUEBA',factura:'V01298',cuenta:'Caja Chica',tipo:'cobro',monto:420}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i4',fecha:'2026-01-01',cliente:'GISELA PRUEBA',factura:'X1',cuenta:'BBVA',tipo:'DUPLICADO_BIND',monto:100}});
  for(const t of ['clientes','cobranza','ingresos','pedidos','remisiones','facturas','notascredito']) await w.eval(`cargarTabla('${t}')`);
  w.eval("abrirDetalleCliente('gm')"); await sleep(500);
  r.tab=txt([...d.querySelectorAll('.drawer-tabs button')].find(b=>b.dataset.tab==='pagos'));
  w.eval("drawerCambiarTab('pagos')"); await sleep(100);
  const filas=()=>[...d.querySelectorAll('#nunPagosCliMount tbody tr')].map(tr=>({t:txt(tr),btn:!!tr.querySelector('button')}));
  r.antes=filas(); r.encabezado=txt(d.querySelector('#nunPagosCliMount > div'));
  if(r.antes.length!==4) r.fallas.push('no-muestra-cancelados');
  if(r.antes.filter(f=>/Activo/.test(f.t)).length!==2||!r.antes.some(f=>/Cancelado/.test(f.t))||!r.antes.some(f=>/Duplicado/.test(f.t))) r.fallas.push('estatus');
  if(r.antes.some(f=>f.btn!==/Activo/.test(f.t))) r.fallas.push('boton-solo-activos');
  if(!/2 pago\(s\) activos · total \$7,920\.00 · 2 cancelado/.test(r.encabezado)) r.fallas.push('encabezado');
  if(!/Pagos \(2\)/.test(r.tab)) r.fallas.push('pestana');
  w.prompt=()=>'prueba de cancelar'; w.confirmDialog=async()=>true;
  const tr=[...d.querySelectorAll('#nunPagosCliMount tbody tr')].find(tr=>/V01298/.test(tr.textContent)&&tr.querySelector('button'));
  tr.querySelector('button').click(); await sleep(2500);
  r.despues=filas(); r.sigueFicha=/GISELA PRUEBA/.test(txt(d.getElementById('drawerTitle')));
  const ing=JSON.parse(await servidor('post',JSON.stringify({codigo:COD,accion:'erp_listar',tabla:'ingresos'}))).items.find(i=>i.id==='i3');
  const cob=JSON.parse(await servidor('post',JSON.stringify({codigo:COD,accion:'erp_listar',tabla:'cobranza'}))).items.find(i=>i.id==='cb2');
  r.ing={tipo:ing.tipo}; r.cob={cobrado:cob.cobrado,pendiente:cob.pendiente};
  if(!/CANCELADO/.test(ing.tipo)) r.fallas.push('no-cancelo');
  if(+cob.cobrado!==0||+cob.pendiente!==1000) r.fallas.push('saldo');
  if(!r.sigueFicha||r.despues.filter(f=>/Activo/.test(f.t)).length!==1) r.fallas.push('repintar');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(3[8-9])/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
