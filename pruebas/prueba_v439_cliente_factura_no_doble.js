// v4.39 — Cliente de factura (MARKET de RAMIRO): su Facturado/Pendiente cuenta solo en la ficha de RAMIRO; en la suya sale '—' y "cuenta en RAMIRO".
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ra',razon_social:'RAMIRO PRUEBA'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ma',razon_social:'MARKET PRUEBA'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'k1',numero:'1106',cliente:'MARKET PRUEBA',tipo:'Factura',total:43200,cobrado:43200,pendiente:0}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'k2',numero:'R1',cliente:'RAMIRO PRUEBA',tipo:'Remisión',total:28600,cobrado:20000,pendiente:8600}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'k3',numero:'R2',cliente:'OTRO PRUEBA',tipo:'Remisión',total:5000,cobrado:0,pendiente:5000}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ot',razon_social:'OTRO PRUEBA'}});
  for(const t of ['clientes','cobranza','ingresos','pedidos','remisiones','facturas','notascredito']) await w.eval(`cargarTabla('${t}')`);
  const kpis=id=>{ w.eval(`cerrarDrawer();abrirDetalleCliente('${id}')`); return [...d.querySelectorAll('.drawer .kpi')].slice(0,2).map(txt); };
  r.ramiro=kpis('ra'); await sleep(100); r.market=kpis('ma'); await sleep(100); r.otro=kpis('ot');
  if(!/Facturado\$71,800/.test(r.ramiro[0])||!/Pendiente\$8,600/.test(r.ramiro[1])) r.fallas.push('principal');
  if(!/Facturado—\$43,200.*cuenta en RAMIRO PRUEBA/.test(r.market[0])||!/Pendiente—/.test(r.market[1])) r.fallas.push('miembro');
  if(!/Facturado\$5,000/.test(r.otro[0])||!/Pendiente\$5,000/.test(r.otro[1])) r.fallas.push('normal');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(39|[4-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
