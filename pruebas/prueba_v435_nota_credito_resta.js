// v4.35 — la NOTA DE CRÉDITO resta de lo vendido: en el pedido (neto), en la ficha del cliente (Facturado) y en el tablero del mes. El saldo no cambia (ya lo descontaba Cobranza).
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
  const it=JSON.stringify([{sku:'RL005N',cantidad:73,precio_unitario:1350}]);
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'hu',razon_social:'HUGO PRUEBA SOLORZANO'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_ord_h',folio:'1249',fecha:'2026-05-21',cliente:'HUGO PRUEBA SOLORZANO',vendedor:'EDGAR',estatus:'entregado',total:98550,items_json:it,_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'remisiones',item:{id:'bind_rem_h',folio:'218',fecha:'2026-05-21',cliente:'HUGO PRUEBA SOLORZANO',vendedor:'EDGAR',estatus:'pendiente',total:98550,pedido_origen:'1249',items_json:it,_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'bind_cob_h',numero:'V01218',cliente:'HUGO PRUEBA SOLORZANO',tipo:'Remisión',vendedor:'EDGAR',total:98550,cobrado:98025,pendiente:0,fecha_emision:'2026-05-21',factura_origen:'bind_rem_h'}});
  await post({accion:'erp_crear',tabla:'notascredito',item:{id:'bind_nc_h',folio:'1021',fecha:'2026-05-25',cliente:'',contraparte:'HUGO PRUEBA SOLORZANO',documento_origen:'V01218',total:525,estatus:'timbrada'}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza','notascredito','ingresos']) await w.eval(`cargarTabla('${t}')`);
  r.situacion=w.eval("(()=>{const x=document.createElement('div');x.innerHTML=nunSituacionHTML('pedidos',State.data.pedidos.find(p=>p.id==='bind_ord_h'));return x.textContent})()");
  w.eval("navegar('pedidos')"); await sleep(300); w.eval("abrirDoc('pedidos','bind_ord_h')"); await sleep(1200);
  r.panel=txt(d.getElementById('nunPanelMount'));
  w.eval("cerrarDrawer();abrirDetalleCliente('hu')"); await sleep(800);
  r.resumen=txt(d.querySelector('.drawer-pane[data-pane="resumen"]')).slice(0,300);
  const T=w.eval("(()=>{const c=nunTableroCalc('2026-05-01','2026-05-31','');return c.totV+'|'+c.n})()"); r.tablero=T;
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/nota de crédito −\$525\.00 → neto \$98,025\.00/.test(r.situacion)) r.fallas.push('situacion');
  if(!/neto \$98,025\.00/.test(r.panel)) r.fallas.push('panel');
  if(!/Facturado\s*\$98,025/.test(r.resumen)||!/restadas 1 nota\(s\) de crédito por \$525\.00/.test(r.resumen)) r.fallas.push('ficha');
  if(r.tablero!=='98025|1') r.fallas.push('tablero');
  if(!/v4\.(3[5-9]|[4-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
