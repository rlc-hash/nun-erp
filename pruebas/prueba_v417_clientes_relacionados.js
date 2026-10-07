// v4.17 — CLIENTES RELACIONADOS: el pedido es de CARLOS y la factura sale a nombre de CINTHYA (o Público en General); las ligas,
// el candado y la auditoría lo aceptan. Base: v4.14 — FLUJO NUEVO DE VENTA probado contra el servidor de verdad (backend/Codigo.gs corriendo en el emulador de Supabase):
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'c2',razon_social:'CARLOS ALARCON VELEZ'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'c3',razon_social:'CINTHYA KALID ALARCON HERNANDEZ',rfc:'XAXX010101000'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'c4',razon_social:'Público en General',rfc:'XAXX010101000'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'pc',folio:'P0050',fecha:'2026-10-07',cliente:'CARLOS ALARCON VELEZ',estatus:'confirmado',total:2000,items_json:JSON.stringify([{sku:'X1',descripcion:'MALETA X1',cantidad:2,precio_unitario:1000,iva_pct:0}])}});
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'fv',folio:'1088',fecha:'2026-09-01',cliente:'CINTHYA KALID ALARCON HERNANDEZ',estatus:'timbrada',total:999,items_json:'[]'}});
  for(const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
  w.eval("window.confirmDialog=async(o)=>{ window.__preg=(o&&o.title)||''; return true; }");
  // 1) relación desde la ventana 👥
  await w.eval("nunRelacionesModal()"); await sleep(100);
  d.getElementById('relNuevo').value='CARLOS ALARCON VELEZ'; await w.eval("nunRelNuevoGrupo()"); await sleep(100);
  d.getElementById('relAdd0').value='CINTHYA KALID ALARCON HERNANDEZ'; await w.eval("nunRelAgregarDe(0)"); await sleep(100);
  const kv=(await post({accion:'kv_leer'})).valores; r.guardado=JSON.parse(kv.nun_relaciones_clientes||'[]');
  // 2) factura del pedido de Carlos a nombre de Cinthya
  await w.eval("nunDesdePedidos('pc','facturas')"); await sleep(300);
  r.opciones=[...d.querySelectorAll('#dpFacturarA option')].map(o=>o.value);
  const sel=d.getElementById('dpIva'); sel.value='sin'; sel.dispatchEvent(new w.Event('change'));
  d.getElementById('dpFacturarA').value='CINTHYA KALID ALARCON HERNANDEZ';
  w.__preg=''; await w.eval("nunDesdePedidosCrear('facturas')"); await sleep(600);
  const fac=(await post({accion:'erp_listar',tabla:'facturas'})).items.find(f=>String(f.pedido_origen)==='P0050');
  r.factura=fac&&{cliente:fac.cliente,pedido:fac.pedido_origen,nota:/Facturada a nombre de CINTHYA.*pedido de CARLOS/.test(fac.notas||''),vendedorPregunto:w.__preg};
  // 3) auditoría y candado ya no lo marcan como otro cliente; ligar ofrece la factura 1088 de Cinthya
  await w.eval("Promise.all(['facturas','pedidos'].map(t=>cargarTabla(t)))");
  r.auditoria=w.eval("nunAuditoriaPedidosCalc()").otroCliente.length;
  r.candidatos=w.eval("nunLigarCandidatos(State.data.pedidos.find(p=>p.id==='pc')).map(x=>x.d.folio)");
  w.__preg=''; await w.eval("api({accion:'erp_upsert_batch',tabla:'facturas',items:[{id:'fv',pedido_origen:'P0050'}]})"); r.candadoPregunto=w.__preg;
  // 4) a un cliente NO relacionado sí pregunta
  await post({accion:'erp_crear',tabla:'facturas',item:{id:'fz',folio:'777',cliente:'OTRO SEÑOR',estatus:'timbrada',total:1,items_json:'[]'}}); await w.eval("cargarTabla('facturas')");
  w.__preg=''; await w.eval("api({accion:'erp_upsert_batch',tabla:'facturas',items:[{id:'fz',pedido_origen:'P0050'}]})"); r.candadoOtro=w.__preg;
  r.version=txt(d.querySelector('.rwd-version'));
  if(!(r.guardado[0]&&r.guardado[0].principal==='CARLOS ALARCON VELEZ'&&r.guardado[0].facturar_a.join()==='CINTHYA KALID ALARCON HERNANDEZ')) r.fallas.push('guardar');
  if(r.opciones.join('|')!=='CARLOS ALARCON VELEZ|CINTHYA KALID ALARCON HERNANDEZ|Público en General|__otro') r.fallas.push('opciones');
  if(!r.factura||r.factura.cliente!=='CINTHYA KALID ALARCON HERNANDEZ'||!r.factura.nota) r.fallas.push('factura');
  if(r.auditoria!==0||!r.candidatos.includes('1088')||r.candadoPregunto||!/OTRO cliente/.test(r.candadoOtro)) r.fallas.push('ligas');
  if(!/v4\.(1[7-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
