// v4.26 — cliente de factura (Dionicio → Carlos Iván) con un clic desde la ficha o Cuadrar, y buscador de cliente en Cuadrar por cliente.
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cd',razon_social:'DIONICIO PRUEBA LIRA'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cc',razon_social:'CARLOS PRUEBA TOVAR'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p1',folio:'1163',fecha:'2026-02-24',cliente:'DIONICIO PRUEBA LIRA',estatus:'facturado',total:1000,items_json:it}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'f1',folio:'1077',fecha:'2026-04-14',cliente:'CARLOS PRUEBA TOVAR',estatus:'timbrada',total:1000,pedido_origen:'1163',items_json:it}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p2',folio:'1200',fecha:'2026-02-24',cliente:'ZOILA BUSCADA PEREZ',estatus:'confirmado',total:500,items_json:it}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  // buscador en Cuadrar por cliente
  await w.eval("nunCuadrarClientes()"); await sleep(200);
  r.buscador=!!d.getElementById('cqBuscar'); r.lista=d.querySelectorAll('#cqBuscarLista option').length;
  w.eval("nunCQBuscar('zoila')"); r.visibles=[...d.querySelectorAll('#cqCliente option')].filter(o=>!o.hidden).map(o=>txt(o).split(' · ')[0]);
  w.eval("nunCQBuscar('ZOILA BUSCADA PEREZ')"); await sleep(300); r.abierto=w.eval("window._nunCQ.L[window._nunCQ.sel].nombre");
  w.eval("nunCQBuscar('dionicio prueba lira')"); await sleep(300);
  r.botonCQ=[...d.querySelectorAll('#modalCQ button')].some(b=>/CARLOS PRUEBA TOVAR es cliente de factura de DIONICIO PRUEBA LIRA/.test(b.textContent));
  d.getElementById('modalCQ').remove();
  // ficha de Carlos: falta cuadrar + botón de relación
  w.eval("abrirDetalleCliente('cc')"); await sleep(800);
  r.antes=txt(d.querySelector('.nunCuadrePendMount'));
  await w.eval("nunRelacionSiFicha('DIONICIO PRUEBA LIRA','CARLOS PRUEBA TOVAR','cc')"); await sleep(1000);
  r.despues=txt(d.querySelector('.nunCuadrePendMount'));
  w.eval("cerrarDrawer();abrirDetalleCliente('cd')"); await sleep(800);
  r.dionicio=txt(d.querySelector('.nunCuadrePendMount'));
  r.cuadreDionicio=w.eval("nunCuadreCalc().filter(c=>/DIONICIO|CARLOS/.test(c.nombre)).length");
  r.version=txt(d.querySelector('.rwd-version'));
  if(!r.buscador||r.lista<2) r.fallas.push('buscador');
  if(r.visibles.join()!=='ZOILA BUSCADA PEREZ') r.fallas.push('filtrar');
  if(r.abierto!=='ZOILA BUSCADA PEREZ') r.fallas.push('abrir');
  if(!r.botonCQ) r.fallas.push('boton-cuadrar');
  if(!/F 1077.*OTRO cliente: DIONICIO/.test(r.antes)||!/Sí, CARLOS PRUEBA TOVAR es cliente de factura de DIONICIO/.test(r.antes)) r.fallas.push('antes');
  if(!/Cliente de factura de DIONICIO PRUEBA LIRA/.test(r.despues)||!/Todo cuadrado/.test(r.despues)) r.fallas.push('despues');
  if(!/También se le factura a nombre de: CARLOS PRUEBA TOVAR/.test(r.dionicio)) r.fallas.push('dionicio');
  if(r.cuadreDionicio!==0) r.fallas.push('cuadrar-sigue');
  if(!/v4\.(2[6-9]|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
