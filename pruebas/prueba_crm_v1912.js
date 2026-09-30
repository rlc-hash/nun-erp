// Prueba de la app de vendedores (crm.html) v1.9.12 — jsdom + backend simulado en memoria (sin red)
// Uso (desde la raíz del repo): node pruebas/prueba_crm_v1912.js   ·   NUN_CRM=otra/ruta/crm.html para otra copia
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_CRM||path.join(__dirname,'..','crm.html'),'utf8');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const XSS='<img src=x onerror="window.__xss=1">';

function nuevaDB(){ return {
  pedidos:[
    {id:'p1',folio:'P0001',fecha:'2026-09-29',cliente:'CLIENTE PRUEBA UNO',vendedor:'edgar',estatus:'confirmado',subtotal:71.4,iva:11.43,total:82.83,
     items_json:JSON.stringify([{sku:'A1',descripcion:'PIEZA A',cantidad:3,precio_unitario:0.35,descuento_pct:0,iva_pct:16},{sku:'B2',descripcion:'PIEZA B',cantidad:7,precio_unitario:10.05,descuento_pct:0,iva_pct:16}])},
    {id:'p2',folio:'P0002',fecha:'2026-09-29',cliente:'CLIENTE PRUEBA DOS',vendedor:'LUIS',estatus:'confirmado',sin_iva:true,subtotal:100,iva:0,total:100,
     items_json:JSON.stringify([{sku:'C3',descripcion:'PIEZA C',cantidad:4,precio_unitario:25,descuento_pct:0,iva_pct:0}])}],
  facturas:[],remisiones:[],
  cobranza:[
    {id:'c1',numero:'V01100',tipo:'Remisión',cliente:XSS,vendedor:'EDGAR',total:500,cobrado:100,pendiente:400,fecha_entrega:'2026-06-01T06:00:00.000Z'},
    {id:'c2',numero:'V01101',tipo:'Remisión',cliente:'CLIENTE PRUEBA DOS',vendedor:'LUIS',total:300,cobrado:0,pendiente:300,fecha_entrega:'2026-06-02T06:00:00.000Z'}],
  ingresos:[],gastos:[{id:'g1',fecha:'2026-09-01',concepto:'GASTO DE PRUEBA',monto:10,categoria:'Otros'}],clientes:[],
  productos:[{sku:'A1',descripcion:'PIEZA A',precio:0.35,stock_actual:10},{sku:'B2',descripcion:'PIEZA B',precio:10.05,stock_actual:10}],
  notascredito:[] }; }

async function abrir(sesion){
  const DB=nuevaDB(), LOG=[], errs=[];
  const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/crm.html',
    beforeParse(w){
      w.localStorage.setItem('nun_session',JSON.stringify(sesion));
      w.localStorage.setItem('nun_cache_cobranza',JSON.stringify([{id:'cx',numero:'X1',cliente:'CANCELADO EN CACHE',estatus:'cancelado',total:1,pendiente:1},{id:'cy',numero:'X2',cliente:'VIVO EN CACHE',vendedor:'EDGAR',total:1,pendiente:1}]));
      w.alert=m=>{ LOG.push({alert:String(m)}); }; w.confirm=()=>true; w.prompt=(m,d)=>w.__prompt!==undefined?w.__prompt:d; w.open=()=>null;
      w.fetch=async(u,o)=>{
        await sleep(5);
        const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
        const q=String(u).split('?')[1];
        if(!o||!o.body){ const p=new URLSearchParams(q||''); LOG.push({get:p.get('tabla'),codigo:p.get('codigo')}); return J({ok:true,data:DB[p.get('tabla')]||[]}); }
        const b=JSON.parse(o.body); LOG.push(b);
        if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
        if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const t=(DB[b.tabla]=DB[b.tabla]||[]); const x=t.find(r=>r.id===it.id); if(x) Object.assign(x,it); else t.push(Object.assign({},it)); } return J({ok:true}); }
        if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(b.item); return J({ok:true,item:b.item}); }
        if(b.accion==='convertir_documento'){ // como el servidor real: documento SIN productos, folio propio y un cobro con ese folio
          const p=DB.pedidos.find(x=>x.id===b.id_origen); const n=DB[b.tabla_destino].length+1;
          const nd={id:'srv_'+b.tabla_destino+'_'+n,folio:'FAC-2026-000'+n,cliente:p.cliente,total:0,items_json:'[]',estatus:'borrador',fecha:'2026-09-29'};
          DB[b.tabla_destino].push(nd);
          DB.cobranza.push({id:'cob_srv_'+n+b.tabla_destino,numero:nd.folio,descripcion:'Doc '+nd.folio,factura_origen:nd.id,cliente:p.cliente,total:0,cobrado:0,pendiente:0});
          return J({ok:true,folio:nd.folio,item:{id:nd.id}}); }
        if(b.accion==='siguiente_folio') return J({ok:true,folio:'NC-TEST-1'});
        return J({ok:true,items:[],cuentas:[],vendedores:[],pagos:[]});
      };
      w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
    }});
  const w=dom.window; await sleep(2600);
  w.__toasts=[]; const _t=w.mostrarToast; w.mostrarToast=function(m,t){ w.__toasts.push(String(m)); try{ return _t.apply(this,arguments);}catch(e){} };
  return {w,d:w.document,DB,LOG,errs};
}
const permAdmin={ver_gastos:true,editar_gastos:true,ver_ingresos:true,editar_ingresos:true,ver_cobranza:true,editar_cobranza:true,agregar_pedidos:true,ver_dashboard:true,eliminar_documentos:true,gestionar_usuarios:true,cambiar_fecha_entrega:true,agregar_notas:true,ver_todos_clientes:true};
const permVend={ver_gastos:false,editar_gastos:false,ver_ingresos:false,editar_ingresos:false,ver_cobranza:true,editar_cobranza:true,agregar_pedidos:true,ver_dashboard:false,eliminar_documentos:'false',gestionar_usuarios:false,cambiar_fecha_entrega:false,agregar_notas:true,ver_todos_clientes:'false'};

(async()=>{ const r={}; try{
  // ---------- ADMIN (dueño) ----------
  const A=await abrir({codigo:'RAFA-XYZ123',usuario:{codigo:'RAFA-XYZ123',nombre:'Rafa',rol:'admin'},permisos:permAdmin,device_id:'d1'});
  const {w,d,DB,LOG}=A;
  r.version=(d.body.innerHTML.match(/v1\.9\.\d+/)||[''])[0];
  r.versionVieja=[...d.querySelectorAll('span')].some(s=>s.textContent.trim()==='v1.9.11');
  r.dueno={ 'RAFA-XYZ123':w.eval("nunEsRafaMaster('RAFA-XYZ123')"), 'rafa-abc (minúsculas)':w.eval("esDuenoCodigo(' rafa-abc ')"), 'EDGAR-1':w.eval("esDuenoCodigo('EDGAR-1')"),
    'RAFA2026 (sin guion)':w.eval("esDuenoCodigo('RAFA2026')"), 'YADAH-Q1 socio':w.eval("nunSocioDeCodigo('YADAH-Q1')"), 'MASTER-NUN-Z socio':w.eval("nunSocioDeCodigo('MASTER-NUN-Z')"),
    'sesión ve gastos':w.eval("nunEsDuenoGastos()") };
  const t=w.eval("nunCalcDoc([{cantidad:3,precio_unitario:0.35,iva_pct:16},{cantidad:7,precio_unitario:10.05,iva_pct:16}])");
  r.ivaPorRenglon={subtotal:t.subtotal,iva:t.iva,total:t.total,ok:t.iva===11.43&&t.total===82.83};
  r.hoyLocal=w.eval("nunHoyLocal(new Date(2026,8,30,23,30))");
  // XSS en cobranza
  w.eval("cambiarTab('cobranza')"); await sleep(300);
  r.xss={imgs:d.querySelectorAll('#tbodyCobranza img, #cardsCobranza img').length, disparo:!!w.__xss, textoVisible:d.getElementById('tbodyCobranza').textContent.includes('<img')};
  // admin: total menor a lo cobrado se rechaza
  w.eval("abrirEditorCobranza('c1')"); r.adminVeEditar=d.getElementById('tabBtnEditar').style.display!=='none';
  d.getElementById('edTotal').value='50'; const nAntes=LOG.length;
  const b=d.createElement('button'); b.setAttribute('onclick','guardarEdicionDoc()'); d.body.appendChild(b); b.click(); await sleep(100);
  r.totalMenorCobrado={rechazado:!LOG.slice(nAntes).some(x=>x.accion==='actualizar_pedido'), alerta:(LOG.slice(nAntes).find(x=>x.alert)||{}).alert};
  d.getElementById('edTotal').value='600'; b.click(); await sleep(150);
  const act=LOG.find(x=>x.accion==='actualizar_pedido'); r.editarTotal={pendiente:act&&act.cambios.pendiente, codigo:act&&act.codigo};
  // cancelar cobranza (no borrar)
  w.eval("abrirEditorCobranza('c2')"); w.__prompt='prueba de cancelación'; const n0=LOG.length;
  await w.eval("eliminarPedido()"); await sleep(100);
  const envs=LOG.slice(n0).filter(x=>x.accion);
  const up=envs.find(x=>x.accion==='erp_upsert_batch'&&x.tabla==='cobranza');
  r.cancelarCobranza={acciones:envs.map(x=>x.accion), estatus:up&&up.items[0].estatus, pendiente:up&&up.items[0].pendiente, sinEliminar:!LOG.some(x=>x.accion==='eliminar'), sigueEnBase:DB.cobranza.some(c=>c.id==='c2'&&c.estatus==='cancelado')};
  // conversión pedido → factura (copia productos, folio NUN, renombra cobro)
  await w.eval("erpConvertirPedido('p1','P0001','facturas')"); await sleep(100);
  const f=DB.facturas[0]; const cf=DB.cobranza.find(c=>c.factura_origen===f.id);
  r.conversion={folio:f.folio,items:JSON.parse(f.items_json||'[]').length,subtotal:f.subtotal,iva:f.iva,total:f.total,pedido_origen:f.pedido_origen,vendedor:f.vendedor,
    cobro:cf&&[cf.numero,cf.descripcion,cf.total,cf.pendiente,cf.vendedor], toast:w.__toasts.slice(-1)[0]};
  // conversión de pedido SIN IVA → remisión
  await w.eval("erpConvertirPedido('p2','P0002','remisiones')"); await sleep(100);
  const rm=DB.remisiones[0]; const cr=DB.cobranza.find(c=>c.factura_origen===rm.id);
  r.conversionSinIva={folio:rm.folio,sin_iva:rm.sin_iva,subtotal:rm.subtotal,iva:rm.iva,total:rm.total,cobro:cr&&[cr.numero,cr.total,cr.pendiente], toast:w.__toasts.slice(-1)[0]};
  // pedido: precio negativo rechazado; pedido bueno con IVA por renglón
  await w.eval("erpAbrirNuevoPedido()"); await sleep(50);
  d.getElementById('erpPedCliente').value='CLIENTE PRUEBA UNO';
  w.eval("erpLineaCambio(0,'sku','A1'); erpLineaCambio(0,'cantidad','3'); erpLineaCambio(0,'precio','-5')");
  const n1=LOG.length; await w.eval("erpGuardarPedido()"); await sleep(50);
  r.precioNegativo={rechazado:!LOG.slice(n1).some(x=>x.accion==='erp_crear'), aviso:w.__toasts.slice(-1)[0]};
  w.eval("erpLineaCambio(0,'precio','0.35'); erpAgregarLinea(); erpLineaCambio(1,'sku','B2'); erpLineaCambio(1,'cantidad','7'); erpLineaCambio(1,'precio','10.05')");
  r.totalesPantalla=d.getElementById('erpPedTotales').textContent.replace(/\s+/g,' ').trim();
  await w.eval("erpGuardarPedido()"); await sleep(50);
  const np=DB.pedidos.find(p=>/^crm_ped_/.test(p.id)); r.pedidoNuevo=np&&{folio:np.folio,subtotal:np.subtotal,iva:np.iva,total:np.total,fecha:np.fecha};
  // NC parcial de factura sin IVA: IVA 0, un solo concepto, con cliente
  DB.facturas.push({id:'fsin',folio:'FT0099',cliente:'CLIENTE PRUEBA DOS',total:100,subtotal:100,iva:0,sin_iva:true,items_json:DB.pedidos[1].items_json});
  await w.eval("renderERPTab('erp_pedidos', true)"); await sleep(50); w.__prompt=undefined; w.prompt=(m,dd)=>/Monto/.test(m)?'40':dd;
  await w.eval("erpGenerarNC('facturas','fsin')"); await sleep(50);
  const nc=DB.notascredito[0]; r.notaCredito=nc&&{cliente:nc.cliente,subtotal:nc.subtotal,iva:nc.iva,total:nc.total,renglones:JSON.parse(nc.items_json).length,serie:(LOG.find(x=>x.accion==='siguiente_folio')||{}).serie};
  // gasto: se marca cancelado, no se borra
  d.getElementById('confirmModalAccion').dataset.id='g1'; const n4=LOG.length; await w.eval("ejecutarEliminacion()"); await sleep(50);
  r.cancelarGasto={acciones:LOG.slice(n4).filter(x=>x.accion).map(x=>x.accion), estatus:(DB.gastos.find(x=>x.id==='g1')||{}).estatus, fueraDeVista:!w.eval("gastos.some(g=>g.id==='g1')")};
  // GET con código
  r.getConCodigo=LOG.filter(x=>x.get).every(x=>x.codigo==='RAFA-XYZ123');
  // espejo apagado
  const n2=LOG.length; await w.eval("erpEspejoSync(true)"); r.espejoApagado=LOG.length===n2;
  // Mis Comisiones: botón del modal rpc apunta a la función que lee rpc*
  r.misComisiones={panesConMismoId:d.querySelectorAll('#pane-miscomisiones').length, mcPeriodoRepetido:d.querySelectorAll('#mcPeriodo').length,
    botonRpc:(d.querySelector('#modalRegistrarPagoCom .modal-actions .btn.solid')||{}).getAttribute?.('onclick'), rapidaExiste:w.eval("typeof guardarPagoComisionRapido")==='function'};
  w.eval("cambiarTab('miscomisiones')"); await sleep(200);
  w.eval("abrirRegistrarPagoComision()"); d.getElementById('rpcMonto').value='10'; d.getElementById('rpcMetodo').value='BBVA';
  const n3=LOG.length; d.querySelector('#modalRegistrarPagoCom .modal-actions .btn.solid').click(); await sleep(100);
  const g=LOG.slice(n3).find(x=>x.accion==='crear'&&x.tabla==='gastos'); r.registrarPago=g?{concepto:g.item.concepto,monto:g.item.monto,receptor:g.item.receptor}:'no se envió';
  r.erroresAdmin=A.errs.slice(0,5);
  w.close();

  // ---------- VENDEDOR (permisos en texto 'false') ----------
  const V=await abrir({codigo:'ESTEBAN-77',usuario:{codigo:'ESTEBAN-77',nombre:'Esteban',rol:'vendedor',vendedor_asignado:'EDGAR'},permisos:Object.assign({},permVend,{vendedor_asignado:'EDGAR'}),device_id:'d2'});
  r.vendedor={esAdmin:V.w.eval("nunEsAdmin()"),
    cobranzaVisible:V.w.eval("cobranzaVisible().map(c=>c.id).join(',')"), vendedorActual:V.w.eval("obtenerVendedorActual()"), veGastos:V.w.eval("nunEsDuenoGastos()")};
  V.w.eval("abrirEditorCobranza('c1')"); r.vendedor.veEditar=V.d.getElementById('tabBtnEditar').style.display!=='none';
  const nv=V.LOG.length; await V.w.eval("guardarEdicionDoc()"); await sleep(50);
  r.vendedor.guardarEdicionDoc={rechazado:!V.LOG.slice(nv).some(x=>x.accion==='actualizar_pedido'), alerta:(V.LOG.slice(nv).find(x=>x.alert)||{}).alert};
  V.w.eval("cambiarTab('micomision')"); await sleep(200);
  r.vendedor.miComision=(V.d.getElementById('heroMiComision')||{}).textContent.replace(/\s+/g,' ').trim().slice(0,200);
  r.erroresVendedor=V.errs.slice(0,5);
  V.w.close();

  // ---------- VENDEDOR SIN vendedor_asignado ----------
  const N=await abrir({codigo:'NUEVO-1',usuario:{codigo:'NUEVO-1',nombre:'',rol:'vendedor'},permisos:Object.assign({},permVend,{ver_todos_clientes:'0'}),device_id:'d3'});
  r.sinAsignar={cobranzaVisible:N.w.eval("cobranzaVisible().length"), filas:N.d.querySelectorAll('#tbodyCobranza tr:not(:has(.empty))').length};
  r.erroresSinAsignar=N.errs.slice(0,5);
  N.w.close();

  // ---------- Resumen ----------
  const fallas=[];
  if(r.version!=='v1.9.12'||r.versionVieja) fallas.push('versión');
  if(!(r.dueno['RAFA-XYZ123']&&r.dueno['rafa-abc (minúsculas)']&&!r.dueno['EDGAR-1']&&!r.dueno['RAFA2026 (sin guion)']&&r.dueno['YADAH-Q1 socio']==='YADAH'&&r.dueno['MASTER-NUN-Z socio']==='RAFA')) fallas.push('dueño por prefijo');
  if(!r.ivaPorRenglon.ok) fallas.push('IVA por renglón');
  if(r.xss.imgs||r.xss.disparo||!r.xss.textoVisible) fallas.push('XSS');
  if(!r.totalMenorCobrado.rechazado||r.editarTotal.pendiente!==500) fallas.push('editar total');
  if(r.cancelarCobranza.estatus!=='cancelado'||!r.cancelarCobranza.sinEliminar||!r.cancelarCobranza.sigueEnBase) fallas.push('cancelar cobranza');
  if(r.conversion.folio!=='FT0001'||r.conversion.items!==2||r.conversion.total!==82.83||!r.conversion.cobro||r.conversion.cobro[0]!=='FT0001'||r.conversion.cobro[2]!==82.83||r.conversion.cobro[3]!==82.83||r.conversion.cobro[4]!=='EDGAR') fallas.push('conversión');
  if(r.conversionSinIva.iva!==0||r.conversionSinIva.total!==100||r.conversionSinIva.sin_iva!==true||!r.conversionSinIva.cobro||r.conversionSinIva.cobro[0]!=='R0001') fallas.push('conversión sin IVA');
  if(!r.precioNegativo.rechazado) fallas.push('precio negativo');
  if(!r.pedidoNuevo||r.pedidoNuevo.total!==82.83||r.pedidoNuevo.iva!==11.43) fallas.push('pedido nuevo');
  if(!r.notaCredito||r.notaCredito.iva!==0||r.notaCredito.total!==40||r.notaCredito.renglones!==1||!r.notaCredito.cliente) fallas.push('nota de crédito');
  if(r.cancelarGasto.estatus!=='cancelado'||!r.cancelarGasto.fueraDeVista||r.cancelarGasto.acciones.includes('eliminar')) fallas.push('cancelar gasto');
  if(!r.getConCodigo||!r.espejoApagado) fallas.push('código en GET / espejo');
  if(r.misComisiones.panesConMismoId!==1||r.misComisiones.mcPeriodoRepetido!==1||typeof r.registrarPago!=='object') fallas.push('mis comisiones');
  if(r.vendedor.esAdmin||r.vendedor.veEditar||!r.vendedor.guardarEdicionDoc.rechazado||r.vendedor.cobranzaVisible!=='c1,cy'&&r.vendedor.cobranzaVisible!=='cy,c1'&&r.vendedor.cobranzaVisible!=='c1') fallas.push('vendedor');
  if(r.vendedor.vendedorActual!=='EDGAR') fallas.push('vendedor actual');
  if(r.sinAsignar.cobranzaVisible!==0) fallas.push('vendedor sin asignar');
  if(r.erroresAdmin.length||r.erroresVendedor.length||r.erroresSinAsignar.length) fallas.push('errores de arranque');
  r.fallas=fallas;
  if(fallas.length) r.error='Fallan: '+fallas.join(', ');
}catch(e){ r.error=String(e.stack).slice(0,800); }
console.log(JSON.stringify(r,null,1)); process.exit(0); })();
