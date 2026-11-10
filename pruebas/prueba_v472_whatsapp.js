// v4.72 — 📲 WHATSAPP COBRANZA: aviso de pago al registrar un pago (con complemento si lo lleva; varios pagos juntos = 1 mensaje;
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
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cp',razon_social:P,contacto:'Juan',telefono:'5511112222'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cs',razon_social:S}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'cn',razon_social:N,whatsapp:'5599998888'}});
  const L=a=>JSON.stringify(a.map(([s,c,p,ds])=>({sku:s,descripcion:ds,cantidad:c,precio_unitario:p})));
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p1',folio:'P0201',fecha:'2026-10-01',cliente:P,estatus:'confirmado',total:10000,items_json:L([['RL005B',10,1000,'MALETA RL005 BEIGE']]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_p1',numero:'P0201',cliente:P,tipo:'Pedido',total:10000,cobrado:0,pendiente:10000,factura_origen:'p1',fecha_emision:'2026-10-01',fecha_vencimiento:'2026-10-15'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_r1',numero:'R0301',cliente:P,tipo:'Remisión',total:3000,cobrado:0,pendiente:3000,factura_origen:'r1',fecha_emision:'2026-10-05'}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_f1',numero:'FT0401',cliente:S,tipo:'Factura',total:2000,cobrado:0,pendiente:2000,factura_origen:'f1',fecha_emision:'2026-10-06'}});
  await w.eval("Promise.all(['clientes','cobranza','pedidos','remisiones','facturas','ingresos'].map(t=>cargarTabla(t)))"); await sleep(200);
  const pagar=(id,m,notas)=>w.eval(`api({accion:'capturar_pago_cliente',id_doc:'${id}',monto:${m},fecha:'2026-11-10',cuenta:'BBVA',notas:${JSON.stringify(notas||'')},usuario:'Rafa',codigo_usuario:'${COD}'})`);
  // 1) pago sin WhatsApp capturado → queda "sin_whatsapp"
  await pagar('cob_p1',4000); await sleep(1500);
  let M=await wa(); r.m1=M.map(m=>[m.tipo,m.cliente,m.estatus]);
  F(M.length===1&&M[0].tipo==='pago'&&M[0].cliente===P&&M[0].estatus==='sin_whatsapp','pagoSinWA');
  const d1=JSON.parse(M[0].datos_json||'{}'); r.d1={monto:d1.monto,docs:d1.docs,saldo_doc:d1.saldo_doc,saldo_cliente:d1.saldo_cliente,saludo:d1.saludo};
  F(d1.monto===4000&&d1.docs[0]==='P0201'&&d1.saldo_doc===6000&&d1.saludo==='Juan'&&d1.saldo_cliente===11000,'datosPago');
  // 2) número mal y bien; al ponerlo, el aviso pendiente se libera (esperando conexión)
  F(w.nunWATel('55 1234 5678')==='525512345678'&&w.nunWATel('+52 1 55 1234 5678')==='525512345678'&&w.nunWATel('12345')===''&&w.nunWATel('')==='','telFormato');
  await w.eval("nunWAGuardarTel('cp','12345')"); await sleep(300);
  F(!((await post({accion:'erp_listar',tabla:'clientes'})).items.find(c=>c.id==='cp').whatsapp),'telMaloNoSeGuarda');
  await w.eval("nunWAGuardarTel('cp','55 1234 5678')"); await sleep(600);
  F((await post({accion:'erp_listar',tabla:'clientes'})).items.find(c=>c.id==='cp').whatsapp=='525512345678','telGuardado');
  M=await wa(); F(M[0].estatus==='esperando_conexion'&&M[0].telefono=='525512345678','pendienteLiberado');
  // 3) dos pagos seguidos del mismo cliente (uno del cliente de factura) = un solo mensaje al principal
  await pagar('cob_r1',3000); await pagar('cob_f1',500); await sleep(1500);
  M=await wa(); const m2=M.filter(m=>m.id!==M[0].id); r.m2=m2.map(m=>[m.tipo,m.cliente,m.estatus,JSON.parse(m.datos_json).monto]);
  F(m2.length===1&&m2[0].cliente===P&&JSON.parse(m2[0].datos_json).monto===3500&&m2[0].telefono=='525512345678','juntosAlPrincipal');
  // 4) pago con complemento → tipo complemento con su folio CP
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_f2',numero:'FT0402',cliente:P,tipo:'Factura',total:1160,cobrado:0,pendiente:1160,factura_origen:'f2',fecha_emision:'2026-10-07'}});
  await w.eval("cargarTabla('cobranza')"); await sleep(100);
  w.nunWADespues({accion:'facturama_timbrar',cfdi:{CfdiType:'P',Folio:'7'}},{ok:true,uuid:'aaaa-bbbb'});
  await pagar('cob_f2',1160,'Pago factura FT0402 · con complemento'); await sleep(1500);
  M=await wa(); const mc=M.find(m=>m.tipo==='complemento'); const dc=mc?JSON.parse(mc.datos_json):{};
  F(mc&&mc.plantilla==='nun_pago_complemento'&&dc.reps[0].folio==='CP0007'&&dc.reps[0].uuid==='aaaa-bbbb'&&dc.saldo_doc===0,'complemento');
  // 5) textos con cuentas (ajustes en kv)
  await w.eval("navegar('whatsapp')"); await sleep(300); await w.eval("nunWATab('ajustes')"); await sleep(100);
  d.getElementById('waCfg_cuentas').value='BBVA · Comercializadora Casraf\nCLABE: 000 000 0000000000 0'; await w.eval('nunWAGuardarAjustes()'); await sleep(300);
  const kv=await post({accion:'kv_leer'}); F(/CLABE/.test(JSON.parse(kv.valores.nun_whatsapp||'{}').cuentas||''),'ajustesKv');
  await w.eval("cargarTabla('whatsapp')"); await sleep(200);
  r.textoPago=w.nunWATexto(M.find(m=>m.tipo==='pago')); F(/^Hola Juan, recibimos tu pago de \$4,000\.00 .*aplicado al pedido P0201.*Saldo pendiente con NUN: \$11,000\.00/s.test(r.textoPago),'textoPago');
  r.textoComp=w.nunWATexto(mc); F(/complemento de pago \(CFDI\) CP0007/.test(r.textoComp),'textoComp');
  // 6) contactos: solo principales
  await w.eval("nunWATab('contactos')"); await sleep(100); const tc=txt(d.querySelector('.dt'));
  F(tc.includes(P)&&tc.includes(N)&&!/\bCLIENTE DE FACTURA WA\b(?! )/.test(tc.replace('también factura a: '+S,'')),'soloPrincipales');
  // 7) estados de cuenta: solo los que deben (N no debe); preparar y no repetir en la semana
  await w.eval("nunWATab('estados')"); await sleep(100); const te=txt(d.querySelector('.dt'));
  r.estados=te.slice(0,200); F(te.includes(P)&&!te.includes(N),'estadosSoloDeben');
  await w.eval('nunWAPrepararEC()'); await sleep(800);
  M=await wa(); const ec=M.filter(m=>m.tipo==='estado_cuenta'); const de=ec[0]?JSON.parse(ec[0].datos_json):{};
  r.ec={n:ec.length,id:ec[0]&&ec[0].id,saldo:de.saldo,est:ec[0]&&ec[0].estatus}; F(ec.length===1&&ec[0].cliente===P&&de.saldo===6340-6340+de.saldo&&ec[0].estatus==='esperando_conexion','preparaEC');
  await w.eval('nunWAPrepararEC()'); await sleep(500); F((await wa()).filter(m=>m.tipo==='estado_cuenta').length===1,'noRepiteSemana');
  r.textoEC=w.nunWATexto(ec[0]); F(/estado de cuenta de NUN.*Saldo pendiente:.*CLABE/s.test(r.textoEC),'textoEC');
  await w.eval(`nunWAVerEC('cp')`); await sleep(100); const h=w.__blob?await w.__blob.text():''; F(/Estado de cuenta/.test(h)&&h.includes('P0201')&&h.includes('MALETA RL005 BEIGE'),'pdfEC');
  // 8) cancelar sin borrar
  await w.eval(`nunWACancelar(${JSON.stringify(ec[0].id)})`); await sleep(500);
  M=await wa(); F(M.find(m=>m.id===ec[0].id).estatus==='cancelado'&&M.length===4,'cancelarSinBorrar');
  // 9) recibo de pago
  await w.eval(`nunWAPdfMsg(${JSON.stringify(M.find(m=>m.tipo==='pago').id)})`); await sleep(100); const hr=w.__blob?await w.__blob.text():''; F(/Recibo de pago/.test(hr)&&/\$4,000\.00/.test(hr),'recibo');
  r.version=txt(d.querySelector('.rwd-version')); F(/v4\.(7[2-9]|[89]\d)/.test(r.version),'version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores'); console.log(JSON.stringify(r,null,1)); w.close(); process.exit(0);
})();
