// v4.20 — Clientes → Documentos con filtros (pedido/remisión/factura) + folio repetido de Bind (el pedido vivo gana sobre el cancelado).
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cd',razon_social:'CLIENTE DOCS'}});
  const P=(id,folio,est,total)=>post({accion:'erp_crear',tabla:'pedidos',item:{id,folio,fecha:'2026-09-01',cliente:'CLIENTE DOCS',estatus:est,total,items_json:it}});
  await P('d1','1161','cancelado',1000); await P('d2','1161','facturado',1000); await P('d3','1170','confirmado',500);
  await post({accion:'erp_crear',tabla:'remisiones',item:{id:'dr1',folio:'410',fecha:'2026-09-02',cliente:'CLIENTE DOCS',estatus:'entregada',total:500,pedido_origen:'1170',items_json:it}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'df1',folio:'1073',fecha:'2026-09-03',cliente:'CLIENTE DOCS',estatus:'timbrada',total:1000,pedido_origen:'1161',items_json:it}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'df2',folio:'1080',fecha:'2026-09-04',cliente:'CLIENTE DOCS',estatus:'timbrada',total:200,items_json:it}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  // Cuadrar por cliente: el 1161 vivo ya tiene su factura → no sale como pendiente; solo la F1080 suelta
  const L=w.eval("nunCuadreCalc()"); const c=L.find(x=>x.nombre==='CLIENTE DOCS');
  r.cuadre=c?c.pedidos.map(x=>x.p.id).join('/')+'|'+c.sueltos.map(x=>x.d.folio).join('/'):'(nada)';
  // Documentos del cliente
  w.eval("abrirDetalleCliente('cd')"); await sleep(800);
  const filas=()=>[...d.querySelectorAll('#nunDocsCliMount tbody tr')].map(tr=>txt(tr.children[0])+' '+txt(tr.children[1]));
  r.chips=[...d.querySelectorAll('#nunDocsCliMount button.btn')].filter(b=>!/Ver/.test(b.textContent)).map(b=>txt(b));
  r.todos=filas();
  w.eval("window._nunDocsCliFiltro='pedidos';nunDocsClienteRepintar()"); r.pedidos=filas();
  w.eval("window._nunDocsCliFiltro='remisiones';nunDocsClienteRepintar()"); r.remisiones=filas();
  w.eval("window._nunDocsCliFiltro='facturas';nunDocsClienteRepintar()"); r.facturas=filas();
  w.eval("window._nunDocsCliFiltro='pedidos';window._nunDocsCliSinCanc=false;nunDocsClienteRepintar()"); r.pedidosConCanc=filas();
  r.ligaF1080=txt([...d.querySelectorAll('#nunDocsCliMount tbody tr')].find(tr=>/1080/.test(tr.textContent))||null);
  w.eval("window._nunDocsCliFiltro='facturas';nunDocsClienteRepintar()");
  r.ligaF1080=txt([...d.querySelectorAll('#nunDocsCliMount tbody tr')].find(tr=>/1080/.test(tr.textContent)));
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/^\|1080$/.test(r.cuadre)) r.fallas.push('cuadre-1161');
  if(r.chips.length<6) r.fallas.push('chips');
  if(r.todos.length!==5) r.fallas.push('todos');
  if(r.pedidos.length!==2||!r.pedidos.every(x=>/^Pedido/.test(x))) r.fallas.push('filtro-pedidos');
  if(r.remisiones.join()!=='Remisión 410') r.fallas.push('filtro-remisiones');
  if(r.facturas.length!==2||!r.facturas.every(x=>/^Factura/.test(x))) r.fallas.push('filtro-facturas');
  if(r.pedidosConCanc.length!==3) r.fallas.push('ver-cancelados');
  if(!/sin pedido/.test(r.ligaF1080)) r.fallas.push('liga');
  if(!/v4\.(2\d|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
