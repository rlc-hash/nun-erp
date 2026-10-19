// v4.31 — pedido del flujo nuevo que quedó "confirmado" SIN cobro (página vieja) → sale ✅ Confirmar pedido y se vuelve venta; y si a un borrador le cambian el estatus a confirmado a mano, también.
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
  const it=JSON.stringify([{sku:'RL004M',descripcion:'MALETA RL004 MORADO',cantidad:2,precio_unitario:1000,iva_pct:16}]);
  const db=async t=>(await post({accion:'erp_listar',tabla:t})).items;
  const stock=async()=>{const p=(await db('productos')).find(x=>x.id==='pr1');return (+p.stock_actual)+'/'+(+p.stock_comprometido||0);};
  // como lo dejó la página vieja: erp_crear confirmado (aparta 2) y sin cobro
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'pv',folio:'',fecha:'2026-10-08',cliente:'DULCE PRUEBA',vendedor:'EDGAR',estatus:'confirmado',subtotal:2000,iva:320,total:2320,items_json:it}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'pb',folio:'',fecha:'2026-10-12',cliente:'DULCE PRUEBA',vendedor:'EDGAR',estatus:'borrador',subtotal:2000,iva:320,total:2320,items_json:it}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_ord_v',folio:'999',fecha:'2025-08-01',cliente:'DULCE PRUEBA',estatus:'confirmado',total:100,items_json:it,_sin_inventario:true}});
  r.stock0=await stock();
  for(const t of ['pedidos','remisiones','facturas','cobranza','productos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true");
  r.porConfirmar=w.eval("['pv','pb','bind_ord_v'].map(id=>id+':'+nunPedidoPorConfirmar(State.data.pedidos.find(x=>x.id===id))+'/'+nunPedidoViejoRemisionable(State.data.pedidos.find(x=>x.id===id))).join()");
  w.eval("navegar('pedidos')"); await sleep(300); w.eval("abrirDoc('pedidos','pv')"); await sleep(600);
  r.boton=[...d.querySelectorAll('button')].some(b=>/Confirmar pedido/.test(b.textContent)); r.botonRem=[...d.querySelectorAll('button')].some(b=>/Hacer remisión/.test(b.textContent));
  await w.eval("nunActivarPedido('pv')"); await sleep(800);
  const cob=await db('cobranza');
  r.cobroPv=cob.filter(c=>c.factura_origen==='pv').map(c=>c.id+' '+c.tipo+' '+c.total).join();
  r.stock1=await stock();
  // borrador → confirmado a mano en el formulario
  await w.eval("cargarTabla('pedidos')"); w.eval("abrirDoc('pedidos','pb')"); await sleep(600);
  const sel=d.getElementById('dEstatus'); r.selEstatus=!!sel;
  if(sel){ r.opciones=[...sel.options].map(o=>o.value).join(); sel.value='confirmado'; sel.dispatchEvent(new w.Event('change')); }
  const pc=d.getElementById('dComisionPct'); if(pc) pc.value='6';
  await w.eval("guardarDoc('pedidos','pb')"); await sleep(1200);
  const cob2=await db('cobranza');
  r.estPb=(await db('pedidos')).find(x=>x.id==='pb').estatus; r.toasts=[...d.querySelectorAll('.toast')].map(x=>x.textContent).slice(-3); r.cobroPb=cob2.filter(c=>c.factura_origen==='pb').map(c=>c.tipo+' '+c.total).join();
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.porConfirmar!=='pv:true/false,pb:true/false,bind_ord_v:false/true') r.fallas.push('quien');
  if(!r.boton||r.botonRem) r.fallas.push('botones');
  if(r.cobroPv!=='cob_pv Pedido 2320') r.fallas.push('venta');
  if(r.stock0!=='10/6'||r.stock1!=='8/4') r.fallas.push('inventario');
  if(!r.selEstatus||r.cobroPb!=='Pedido 2320') r.fallas.push('borrador-a-mano');
  if(!/v4\.(3[1-9]|[4-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
