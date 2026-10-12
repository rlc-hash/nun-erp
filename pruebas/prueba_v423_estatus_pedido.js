// v4.23 — estatus del pedido al día (confirmado → facturado si ya tiene su factura), centavos de Bind = pagado, complemento de Bind en la factura.
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
  const it=n=>JSON.stringify([{sku:'X1',cantidad:n,precio_unitario:1000}]);
  const P=(id,folio,est,n)=>post({accion:'erp_crear',tabla:'pedidos',item:{id,folio,fecha:'2026-05-01',cliente:'CLIENTE E',estatus:est,total:1000*n,items_json:it(n)}});
  await P('a1','1234','cancelado',2); await P('a2','1234','confirmado',2);   // folio repetido, el vivo con factura → facturado
  await P('b1','1300','confirmado',3);                                       // parcial → no se toca
  await P('c1','1400','entregado',1);                                        // entregado con factura → facturado
  await P('d1','1500','borrador',1);                                         // borrador → no se toca
  await P('e1','1600','confirmado',1);                                       // solo remisión → entregado
  const F=(id,folio,po,n,t)=>post({accion:'erp_crear',tabla:t||'facturas',item:{id,folio,fecha:'2026-05-02',cliente:'CLIENTE E',estatus:t?'entregada':'timbrada',total:1000*n,pedido_origen:po,items_json:it(n),
     notas:id==='f1'?'Importada desde Bind · REP BIND-145 uuid=8B7DBC6C-BAB4-4362-80FB-B0C4C624AE0D monto=2000.00 fecha=2026-05-14 parc=1 sant=2000.00':''}});
  await F('f1','1126','1234',2); await F('f2','1127','1300',1); await F('f3','1128','1400',1); await F('f4','1129','1500',1); await F('r1','300','1600',1,'remisiones');
  await F('f5','FT0003','',1); await post({accion:'erp_upsert_batch',tabla:'facturas',items:[{id:'f5',notas:'REP CP0003 uuid=e54bd8ad-9f38-479a-aade-cea61a084964 monto=1000.00 fecha=2026-09-30 parc=1'}]});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'k1',numero:'1096',cliente:'CLIENTE E',tipo:'Factura',total:12000.00048,cobrado:12000,pendiente:0.00048,fecha_entrega:'2026-05-14',credito:0}});
  for(const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  r.calc=w.eval("nunPedidosAlDiaCalc().map(x=>x.p.id+'→'+x.nuevo).sort().join()");
  r.n=await w.eval("nunPedidosAlDia()");
  const ps=(await post({accion:'erp_listar',tabla:'pedidos'})).items, g=id=>ps.find(x=>x.id===id);
  r.est=['a1','a2','b1','c1','d1','e1'].map(id=>id+':'+g(id).estatus).join();
  r.nota=/Estatus confirmado → facturado \(ya tiene F 1126\)/.test(g('a2').notas||'');
  r.otraVez=w.eval("nunPedidosAlDiaCalc().length");
  const k=w.eval("State.data.cobranza.find(c=>c.id==='k1')"); r.cobro={pend:k.pendiente,dias:k.dias_vencido};
  r.reps=w.eval("nunRepsDeFactura(State.data.facturas.find(x=>x.id==='f1')).map(x=>x.folio+' '+x.monto+' '+x.sant).join()");
  r.sigCP=w.eval("nunSiguienteFolioREP()");
  r.version=txt(d.querySelector('.rwd-version'));
  if(r.calc!=='a2→facturado,c1→facturado,e1→entregado') r.fallas.push('calc');
  if(r.est!=='a1:cancelado,a2:facturado,b1:confirmado,c1:facturado,d1:borrador,e1:entregado') r.fallas.push('estatus');
  if(!r.nota) r.fallas.push('nota');
  if(r.otraVez!==0) r.fallas.push('repite');
  if(r.cobro.pend!==0||r.cobro.dias!==0) r.fallas.push('centavos');
  if(r.reps!=='BIND-145 2000 2000') r.fallas.push('rep-bind');
  if(r.sigCP!=='CP0004') r.fallas.push('folio-cp');
  if(!/v4\.(2[3-9]|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
