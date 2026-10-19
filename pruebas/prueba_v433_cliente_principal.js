// v4.33 — cliente de factura: todo cuenta para el cliente principal (ficha, pagos, reportes) y al receptor ya no se le marca "otro cliente".
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
  const it=JSON.stringify([{sku:'X1',cantidad:1,precio_unitario:1000}]);
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'na',razon_social:'NATALIA PRUEBA CUAUTLE'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'fe',razon_social:'FELIX PRUEBA TECUAUTZIN'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_p',folio:'1134',fecha:'2026-01-29',cliente:'NATALIA PRUEBA CUAUTLE',estatus:'facturado',total:3000,items_json:it,_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f1',folio:'1055',fecha:'2026-02-26',cliente:'FELIX PRUEBA TECUAUTZIN',estatus:'timbrada',total:1000,pedido_origen:'1134',items_json:it}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'c1',numero:'1055',cliente:'FELIX PRUEBA TECUAUTZIN',tipo:'Factura',total:1000,cobrado:400,pendiente:600,factura_origen:'f1'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'c2',numero:'9',cliente:'NATALIA PRUEBA CUAUTLE',tipo:'Factura',total:500,cobrado:0,pendiente:500,factura_origen:'x'}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i1',fecha:'2026-03-01',cliente:'FELIX PRUEBA TECUAUTZIN',factura:'1055',monto:400,cuenta:'BBVA',tipo:'cobro'}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza','ingresos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  await w.eval("nunRelacionAgregar('NATALIA PRUEBA CUAUTLE','FELIX PRUEBA TECUAUTZIN')");
  r.principal=w.eval("nunClientePrincipal('FELIX PRUEBA TECUAUTZIN')+'|'+nunClientePrincipal('NATALIA PRUEBA CUAUTLE')+'|'+nunClientePrincipal('Público en General')");
  w.eval("abrirDetalleCliente('fe')"); await sleep(800);
  r.felix=txt(d.querySelector('.nunCuadrePendMount'));
  w.eval("cerrarDrawer();abrirDetalleCliente('na')"); await sleep(800);
  r.natResumen=txt(d.querySelector('.drawer-pane[data-pane="resumen"]')).slice(0,400);
  r.natPagos=w.eval("nunPagosDeCliente(State.data.clientes.find(c=>c.id==='na')).length");
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.principal!=='NATALIA PRUEBA CUAUTLE|NATALIA PRUEBA CUAUTLE|Público en General') r.fallas.push('principal');
  if(/OTRO cliente/.test(r.felix)||!/Cliente de factura de NATALIA/.test(r.felix)) r.fallas.push('receptor-sin-error');
  if(!/Pendiente\s*\$1,100|1,100/.test(r.natResumen)||!/incluyen lo facturado a nombre de: FELIX PRUEBA TECUAUTZIN/.test(r.natResumen)) r.fallas.push('resumen-principal');
  if(r.natPagos!==1) r.fallas.push('pagos-principal');
  if(!/v4\.(3[3-9]|[4-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
