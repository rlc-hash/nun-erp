// v4.28 — factura SUELTA a nombre de otro: 🤝 "la compró otro cliente" → queda como cliente de factura y en Cuadrar se liga al pedido del que compró.
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ce',razon_social:'CECILIA PRUEBA NAVA'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'lu',razon_social:'LUIS PRUEBA NAVA'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p1',folio:'1282',fecha:'2026-07-14',cliente:'CECILIA PRUEBA NAVA',estatus:'confirmado',total:1000,items_json:it}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f1',folio:'1166',fecha:'2026-08-31',cliente:'LUIS PRUEBA NAVA',estatus:'timbrada',total:1000,items_json:it}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  w.eval("abrirDetalleCliente('lu')"); await sleep(800);
  const b=[...d.querySelectorAll('.nunCuadrePendMount button')].find(x=>/compró otro cliente/.test(x.textContent)); r.botonFicha=!!b;
  b.click(); await sleep(100);
  d.getElementById('rdsNombre').value='Cecilia Prueba Nava'; d.getElementById('rdsOk').click(); await sleep(1500);
  r.rel=w.eval("JSON.stringify(nunRelaciones())");
  r.cq=w.eval("window._nunCQ && window._nunCQ.L[window._nunCQ.sel] && (window._nunCQ.L[window._nunCQ.sel].nombre+':'+window._nunCQ.L[window._nunCQ.sel].pedidos.map(x=>x.p.folio)+'|'+window._nunCQ.L[window._nunCQ.sel].sueltos.map(x=>x.d.folio))");
  r.botonCQ=[...d.querySelectorAll('#modalCQ button')].some(x=>/La compró otro cliente/.test(x.textContent));
  d.querySelector('#modalCQ input[name=cqPed][value="0"]').checked=true; d.querySelector('#modalCQ .cqDoc[value="0"]').checked=true;
  await w.eval("nunCQLigar()"); await sleep(500);
  const f=(await post({accion:'erp_listar',tabla:'facturas'})).items.find(x=>x.id==='f1'), p=(await post({accion:'erp_listar',tabla:'pedidos'})).items.find(x=>x.id==='p1');
  r.ligado=f.pedido_origen+' '+p.estatus;
  r.version=txt(d.querySelector('.rwd-version'));
  if(!r.botonFicha) r.fallas.push('boton-ficha');
  if(!/CECILIA PRUEBA NAVA.*LUIS PRUEBA NAVA/.test(r.rel)) r.fallas.push('relacion');
  if(r.cq!=='CECILIA PRUEBA NAVA:1282|1166') r.fallas.push('cuadrar');
  if(!r.botonCQ) r.fallas.push('boton-cq');
  if(r.ligado!=='1282 facturado') r.fallas.push('ligar');
  if(!/v4\.(2[8-9]|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
