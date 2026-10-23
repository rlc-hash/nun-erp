// v4.45 — pedido DUPLICADO sale "duplicado: no cuenta" (no "sin surtir").
// v4.44 — Ficha del cliente: tabla "Pedidos (como tu Excel)" con Total · Pagado · Falta por pedido; factura en 2 pedidos = "comparte factura";
// cobro manual con "[pedido X]" cuenta en ese pedido.
// Base v4.42 — Documento VIGENTE sin cobro (o con su cobro cancelado) sale en "Falta cuadrar" de la ficha con botón ＋ Crear cobro / ↺ Reactivar cobro.
// (Caso real: Comarca A7 y A24 se pasaron de cancelada a timbrada y su cobro no se arregló.)
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
  const C='CINTIA PRUEBA', L=a=>JSON.stringify(a.map(([s,c,p])=>({sku:s,cantidad:c,precio_unitario:p})));
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ci',razon_social:C}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_p13',folio:'1113',fecha:'2026-01-15',cliente:C,estatus:'facturado',total:62000,items_json:L([['A',40,1550]]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_p94',folio:'1194',fecha:'2026-03-27',cliente:C,estatus:'facturado',total:54000,items_json:L([['B',20,2700]]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'bind_p24',folio:'1224',fecha:'2026-05-06',cliente:C,estatus:'entregado',total:180900,items_json:L([['C',100,1809]]),_sin_inventario:true}});
  const fac=async(id,fol,tot,po)=>{ await post({accion:'erp_crear',tabla:'facturas',item:{id,folio:fol,fecha:'2026-04-01',cliente:C,estatus:'timbrada',total:tot,pedido_origen:po}}); await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_'+id,numero:fol,cliente:C,tipo:'Factura',total:tot,cobrado:tot,pendiente:0,factura_origen:id}}); };
  await fac('f52','1052',30000,'1113'); await fac('f78','1078',30000,'1113'); await fac('f88','1088',30000,'1194, 1113'); await fac('f00','1100',26000,'1194'); await fac('f12','1112',159105,'1224');
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'man1',numero:'PED-CA-V01193',cliente:C,tipo:'Remisión',total:22295,cobrado:0,pendiente:22295,factura_origen:'alta_manual',descripcion:'saldo [pedido 1224]'}});
  for(const t of ['clientes','cobranza','ingresos','pedidos','remisiones','facturas','notascredito','cotizaciones']) await w.eval(`cargarTabla('${t}')`);
  r.calc=w.eval(`nunPedidosExcelCalc({razon_social:'${C}'}).map(x=>x.p.folio+' '+x.total+' '+x.pagado+' '+x.falta+' '+x.docs.map(d=>d.L+d.folio+(d.comparte.length?'('+d.comparte+')':'')).join(','))`);
  const exp=['1113 62000 62000 0 F1052,F1078,F1088(1194)','1194 54000 54000 0 F1088(1113),F1100','1224 180900 158605 22295 F1112'];
  r.calc.forEach((x,i)=>{ const want=exp[i]; const norm=s=>s.split(' ').map((p,j)=>j===4?p.split(',').sort().join(','):p).join(' '); if(norm(x)!==norm(want)) r.fallas.push('fila-'+i); });
  w.eval("abrirDetalleCliente('ci')"); await sleep(300);
  r.tabla=txt(d.querySelector('.drawer details'));
  if(!/Pedidos \(como tu Excel\)/.test(r.tabla)||!/comparte factura con 1194/.test(r.tabla)||!/Total\$296,900\.00\$274,605\.00\$22,295\.00/.test(r.tabla.replace(/\s/g,''))) r.fallas.push('tabla');
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'ped_dup',folio:'P0052',fecha:'2025-09-29',cliente:C,estatus:'duplicado',total:25000,items_json:L([['A',1,25000]])}});
  await w.eval("cargarTabla('pedidos')"); w.eval("_nunSitIdx=null");
  r.dup=w.eval("(()=>{const x=document.createElement('div');x.innerHTML=nunSituacionHTML('pedidos',State.data.pedidos.find(p=>p.id==='ped_dup'));return x.textContent})()");
  if(!/^duplicado/.test(r.dup)) r.fallas.push('duplicado');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(4[5-9]|[5-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
