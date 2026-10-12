// v4.24 — mismo cliente = nombre completo (ya no se mezclan Carlos Alberto González Medrano / Hugo Carlos Solórzano González / Christian González Medrano).
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ca',razon_social:'CARLOS ALBERTO GONZALEZ MEDRANO'}});
  const P=(id,folio,cli)=>post({accion:'erp_crear',tabla:'pedidos',item:{id,folio,fecha:'2026-05-01',cliente:cli,estatus:'confirmado',total:1000,items_json:it}});
  await P('p1','1301','CARLOS ALBERTO  GONZALEZ MEDRANO'); await P('p2','1302','Carlos Alberto González Medrano');
  await P('p3','1303','HUGO CARLOS SOLORZANO GONZALEZ'); await P('p4','1304','CHRISTIAN GONZALEZ MEDRANO'); await P('p5','1305','CARLOS ALBERTO GONZALES MEDRANO');
  for(const t of ['clientes','pedidos','remisiones','facturas']) await w.eval(`cargarTabla('${t}')`);
  const M=(a,b)=>w.eval(`nunMismoCliente(${JSON.stringify(a)},${JSON.stringify(b)})`);
  r.reglas={
    hugo:M('CARLOS ALBERTO GONZALEZ MEDRANO','HUGO CARLOS SOLORZANO GONZALEZ'), christian:M('CARLOS ALBERTO GONZALEZ MEDRANO','CHRISTIAN GONZALEZ MEDRANO'),
    acentos:M('Carlos Alberto González Medrano','CARLOS ALBERTO  GONZALEZ MEDRANO'), sa:M('BOLSAS Y REGALOS MONTERO S.A. DE C.V.','Bolsas y Regalos Montero'),
    letra:M('HILARION MANUEL LOPEZ BUSTAMANTE','HILARON MANUEL LOPEZ BUSTAMANTE'), cortado:M('GLORIA PATRICIA ROMERO ALVARADO','GLORIA PATRICIA ROMERO ALVAR'),
    incompleto:M('HUGO SOLORZANO','HUGO CARLOS SOLORZANO GONZALEZ'), vacio:M('','X') };
  w.eval("abrirDetalleCliente('ca')"); await sleep(800); w.eval("window._nunDocsCliFiltro='pedidos';window._nunDocsCliSinCanc=true;nunDocsClienteRepintar()");
  r.pedidos=[...d.querySelectorAll('#nunDocsCliMount tbody tr')].map(tr=>txt(tr.children[1])).sort().join();
  r.aviso=txt(d.querySelector('#nunDocsCliMount div[style*="fff7e6"]'));
  r.version=txt(d.querySelector('.rwd-version'));
  const R=r.reglas;
  if(R.hugo||R.christian||R.incompleto) r.fallas.push('mezcla-clientes');
  if(!R.acentos||!R.sa||!R.letra||!R.cortado||!R.vacio) r.fallas.push('mismo-cliente');
  if(r.pedidos!=='1301,1302') r.fallas.push('ficha');
  if(!/GONZALES MEDRANO.*1305/.test(r.aviso)||/1303|1304/.test(r.aviso)) r.fallas.push('aviso-letra');
  if(!/v4\.(2[4-9]|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
