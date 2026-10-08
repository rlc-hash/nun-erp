// v4.19 — 🧩 CUADRAR POR CLIENTE: ligar con clics, revisado, duplicado, cancelar y venta directa (nada se borra).
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
  const P=(id,folio,total,cli)=>post({accion:'erp_crear',tabla:'pedidos',item:{id,folio,fecha:'2026-09-01',cliente:cli||'CLIENTE CQ',estatus:'confirmado',total,items_json:it}});
  await P('q1','1501',1000); await P('q2','1502',2000); await P('q3','1503',2000); await P('q4','1504',500); await P('q5','1505',800);
  await P('qz','1599',100,'Rafael Laniado Cattan');
  await post({accion:'erp_crear',tabla:'remisiones',item:{id:'rs1',folio:'401',fecha:'2026-09-02',cliente:'CLIENTE CQ',estatus:'entregada',total:1000,items_json:it}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'fs1',folio:'1601',fecha:'2026-09-03',cliente:'CLIENTE CQ',estatus:'timbrada',total:300,items_json:it}});
  await post({accion:'erp_crear',tabla:'remisiones',item:{id:'rbien',folio:'402',fecha:'2026-09-02',cliente:'CLIENTE CQ',estatus:'entregada',total:800,pedido_origen:'1505',items_json:it}});
  for(const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async()=>true; window.prompt=()=> '1502'");
  w.eval("navegar('pedidos')"); await sleep(400); r.boton=[...d.querySelectorAll('button')].some(b=>/Cuadrar por cliente/.test(b.textContent));
  await w.eval("nunCuadrarClientes()"); await sleep(200);
  const L=w.eval("window._nunCQ.L"); r.lista=L.map(c=>c.nombre+':'+c.pedidos.map(x=>x.p.folio).join('/')+'|'+c.sueltos.map(x=>x.d.folio).join('/'));
  // ligar R401 al 1501
  d.querySelector('#modalCQ input[name=cqPed][value="0"]').checked=true;
  const idxR=w.eval("window._nunCQ.L[0].sueltos.findIndex(x=>x.d.folio==='401')"); d.querySelector('#modalCQ .cqDoc[value="'+idxR+'"]').checked=true;
  await w.eval("nunCQLigar()"); await sleep(300);
  const db=async t=>(await post({accion:'erp_listar',tabla:t})).items;
  r.ligado=(await db('remisiones')).find(x=>x.id==='rs1').pedido_origen;
  // 1502 cuadra así; 1503 duplicado de 1502; 1504 cancelar; F1601 venta directa
  const pos=f=>w.eval(`window._nunCQ.L[0].pedidos.findIndex(x=>x.p.folio==='${f}')`);
  await w.eval(`nunCQRevisado(${pos('1502')})`); await sleep(300);
  await w.eval(`nunCQDuplicado(${pos('1503')})`); await sleep(300);
  await w.eval(`nunCQCancelar(${pos('1504')})`); await sleep(300);
  await w.eval(`nunCQDirecta(window._nunCQ.L[0].sueltos.findIndex(x=>x.d.folio==='1601'))`); await sleep(300);
  const ps=await db('pedidos'), f=(await db('facturas')).find(x=>x.id==='fs1');
  const g=id=>ps.find(x=>x.id===id);
  r.resultado={p1502:/\[revisado ✓ cuadra\]/.test(g('q2').notas||'')&&g('q2').estatus, p1503:g('q3').estatus+' '+/DUPLICADO del pedido 1502/.test(g('q3').notas||''), p1504:g('q4').estatus+' '+/nunca se surtió/.test(g('q4').notas||''), f1601:/\[venta directa/.test(f.notas||''), noSeBorro:ps.length};
  r.restante=w.eval("window._nunCQ.L.map(c=>c.pedidos.length+'/'+c.sueltos.length)");
  r.version=txt(d.querySelector('.rwd-version'));
  if(!r.boton) r.fallas.push('boton');
  if(r.lista.join()!=='CLIENTE CQ:1501/1502/1503/1504|401/1601') r.fallas.push('lista');
  if(r.ligado!=='1501') r.fallas.push('ligar');
  if(r.resultado.p1502!=='confirmado'||r.resultado.p1503!=='cancelado true'||r.resultado.p1504!=='cancelado true'||!r.resultado.f1601||r.resultado.noSeBorro!==6) r.fallas.push('acciones');
  if(r.restante.join()!=='') r.fallas.push('restante');
  if(!/v4\.(19|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
