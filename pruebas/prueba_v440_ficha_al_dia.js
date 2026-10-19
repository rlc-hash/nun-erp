// v4.40 — La ficha del cliente se pone al día sola: si el servidor cambió mientras la página estaba abierta, se repinta (misma pestaña).
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ri',razon_social:'RICARDO PRUEBA'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'q1',numero:'V01302',cliente:'RICARDO PRUEBA',tipo:'Remisión',total:11590,cobrado:0,pendiente:11590}});
  for(const t of ['clientes','cobranza','ingresos','pedidos','remisiones','facturas','notascredito','cotizaciones']) await w.eval(`cargarTabla('${t}')`);
  const kpis=()=>[...d.querySelectorAll('.drawer .kpi')].slice(0,2).map(txt);
  // el servidor cambia (como cuando Claude corrige un cobro) y la página NO se ha recargado
  await post({accion:'erp_upsert_batch',tabla:'cobranza',items:[{id:'q1',total:8090,pendiente:8090}]});
  w.eval("abrirDetalleCliente('ri')"); r.alAbrir=kpis(); w.eval("drawerCambiarTab('cobranza')");
  await sleep(2500); r.despues=kpis(); r.tab=txt(d.querySelector('.drawer-tabs button.active'));
  if(!/11,590/.test(r.alAbrir[0])) r.fallas.push('escenario');
  if(!/Facturado\$8,090/.test(r.despues[0])||!/Pendiente\$8,090/.test(r.despues[1])) r.fallas.push('no-se-actualizo');
  if(!/Cobranza/.test(r.tab)) r.fallas.push('cambio-de-pestana');
  // si está escribiendo en la ficha, no se le repinta
  await post({accion:'erp_upsert_batch',tabla:'cobranza',items:[{id:'q1',total:7000,pendiente:7000}]});
  w.eval("cerrarDrawer();State.data.cobranza.forEach(c=>{if(c.id==='q1'){c.total=8090;c.pendiente=8090}});abrirDetalleCliente('ri')");
  const inp=d.querySelector('#drawerBody input'); if(inp){ inp.value='X'; inp.dispatchEvent(new w.Event('input',{bubbles:true})); }
  await sleep(2500); r.escribiendo=kpis();
  if(!/8,090/.test(r.escribiendo[0])||!inp||inp.value!=='X') r.fallas.push('borro-lo-escrito');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(4\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
