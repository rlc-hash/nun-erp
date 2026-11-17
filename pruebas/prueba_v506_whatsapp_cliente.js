// v5.06 — WhatsApp de cada cliente en su ficha (formulario) y MODO PRUEBA (solo sale al cliente de prueba RAFAEL LANIADO CATTAN). Antes: v5.05 — 📲 WHATSAPP COBRANZA: aviso de pago al registrar un pago (con complemento si lo lleva; varios pagos juntos = 1 mensaje;
// cliente de factura → al principal; sin WhatsApp = queda guardado y se libera al poner el número), estado de cuenta semanal solo a
// principales que deben (no se repite en la semana), cancelar sin borrar, ajustes en kv. Servidor de verdad (Codigo.gs en el emulador), sin red.
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
 const P='CLIENTE PRINCIPAL WA', S='CLIENTE DE FACTURA WA', N='CLIENTE SIN SALDO WA';
 await post({accion:'kv_guardar',pares:{nun_relaciones_clientes:JSON.stringify([{principal:P,facturar_a:[S]}])}});
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.localStorage.setItem('nun_relaciones_clientes',JSON.stringify([{principal:P,facturar_a:[S]}]));
   w.URL.createObjectURL=b=>{ w.__blob=b; return 'blob:x'; }; w.open=()=>({document:{open(){},write(){},close(){}},print(){},closed:false});
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]}; const F=(c,n)=>{ if(!c) r.fallas.push(n); };
 const wa=async()=>(await post({accion:'erp_listar',tabla:'whatsapp'})).items||[];
 try{
  w._nunWAEspera=60; w.confirmDialog=async()=>true;
  const T='RAFAEL LANIADO CATTAN';
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cp',razon_social:P,contacto:'Juan',whatsapp_pausa:''}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ct',razon_social:T,telefono:'5500000001'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_a',numero:'P0301',cliente:P,tipo:'Pedido',total:5000,cobrado:0,pendiente:5000,factura_origen:'pa',fecha_emision:'2026-11-01'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_t',numero:'P0302',cliente:T,tipo:'Pedido',total:1000,cobrado:0,pendiente:1000,factura_origen:'pt',fecha_emision:'2026-11-01'}});
  await w.eval("Promise.all(['clientes','cobranza'].map(t=>cargarTabla(t)))"); await sleep(200);
  const cli=async id=>(await post({accion:'erp_listar',tabla:'clientes'})).items.find(c=>c.id===id);
  // 1) ficha del cliente: campo WhatsApp; número malo NO se guarda; bueno se guarda como 52 + 10; editar otra cosa no lo borra
  await w.eval("abrirDetalleCliente('cp')"); await sleep(400);
  const f=d.getElementById('f_whatsapp'); F(!!f&&f.placeholder==='+52 55 1234 5678','campoEnFicha');
  f.value='123'; await w.eval("guardarGenerico('clientes','cp')"); await sleep(400);
  F(!(await cli('cp')).whatsapp,'maloNoSeGuarda');
  await w.eval("abrirDetalleCliente('cp')"); await sleep(300);
  d.getElementById('f_whatsapp').value='+52 1 55 1111 2222'; await w.eval("guardarGenerico('clientes','cp')"); await sleep(500);
  r.guardado=(await cli('cp')).whatsapp; F(String(r.guardado)==='525511112222','bienGuardado');
  await w.eval("abrirDetalleCliente('cp')"); await sleep(300);
  r.seVe=d.getElementById('f_whatsapp').value; F(r.seVe==='+52 55 1111 2222','seVeBonito');
  d.getElementById('f_contacto').value='Juanito'; await w.eval("guardarGenerico('clientes','cp')"); await sleep(500);
  const c2=await cli('cp'); F(String(c2.whatsapp)==='525511112222'&&c2.contacto==='Juanito','editarNoBorra');
  // lista de clientes con columna WhatsApp
  await w.eval("cerrarDrawer();navegar('clientes')"); await sleep(500); F(/\+52 55 1111 2222/.test(txt(d.querySelector('.dt'))),'columnaLista');
  // 2) modo prueba (con WhatsApp ya conectado): el pago de un cliente normal se RETIENE; el del cliente de prueba sí va
  await w.eval("cargarTabla('clientes')"); await sleep(200);
  await w.eval("nunWAGuardarTel('ct','55 0000 0002')"); await sleep(400);
  await w.eval("nunWAGuardarConfig(Object.assign(nunWAConfig(),{conectado:true}))"); await sleep(200);
  F(w.nunWAConfig().modo_prueba===true,'modoPruebaDeEntrada');
  const pagar=(id,m)=>w.eval(`api({accion:'capturar_pago_cliente',id_doc:'${id}',monto:${m},fecha:'2026-11-17',cuenta:'BBVA',notas:'',usuario:'Rafa',codigo_usuario:'${COD}'})`);
  await pagar('cob_a',1000); await pagar('cob_t',500); await sleep(1500);
  const M=(await post({accion:'erp_listar',tabla:'whatsapp'})).items; r.est=M.map(m=>[m.cliente,m.estatus]);
  F(M.find(m=>m.cliente===P).estatus==='retenido_prueba','normalRetenido');
  F(M.find(m=>m.cliente===T).estatus==='por_aprobar','pruebaSiVa');
  await w.eval("navegar('whatsapp')"); await sleep(400); r.aviso=txt(d.querySelector('.card')).slice(0,160);
  F(/Modo prueba.*RAFAEL LANIADO CATTAN.*\+52 55 0000 0002/.test(txt(d.body)),'avisoModoPrueba');
  // sin modo prueba ya sale para todos (queda por aprobar)
  await w.eval("nunWAGuardarConfig(Object.assign(nunWAConfig(),{modo_prueba:false}))"); await pagar('cob_a',1000); await sleep(1500);
  const M2=(await post({accion:'erp_listar',tabla:'whatsapp'})).items.filter(m=>m.cliente===P); F(M2.some(m=>m.estatus==='por_aprobar'),'sinModoPrueba');
  r.version=txt(d.querySelector('.rwd-version')); F(/v5\.(0[6-9]|[1-9]\d)/.test(r.version),'version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores'); console.log(JSON.stringify(r,null,1)); w.close(); process.exit(0);
})();
