// App de vendedores v2.0 (ventas/index.html; v2.1 se cambió de vendedores.html a /ventas/): entrar, Inicio con lo suyo, cotizar (sube cotización con IVA bien calculado y sin
// folio: lo pone el servidor), registrar pago = queda "por verificar" (no toca Cobranza), Luis no ve "Todos", Edgar sí.
// Servidor simulado (el filtro real del servidor se prueba en prueba_servidor_vendedores.js). Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
async function abrir(cod, usuario, permisos){
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'LUIS',telefono:'5512345678'}],productos:[{id:'p1',sku:'RL001',descripcion:'Maleta',precio:1000,precio_factura:900,stock_actual:5,stock_comprometido:1}],
  cotizaciones:[],pedidos:[{id:'pe1',folio:'P0001',fecha:'2026-11-01',cliente:'CLIENTE UNO',vendedor:'LUIS',estatus:'confirmado',total:2320,items_json:'[]'}],facturas:[],remisiones:[],
  cobranza:[{id:'cob_pe1',numero:'P0001',tipo:'Pedido',cliente:'CLIENTE UNO',vendedor:'LUIS',total:2320,cobrado:0,pendiente:2320,factura_origen:'pe1',fecha_emision:'2026-11-01'}],ingresos:[],pagosverificar:[]};
 const env=[];const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{}; w.__abiertas=[]; w.open=(u)=>{ const v={u,html:'',document:{write:x=>{v.html+=x},close(){}},print(){}}; w.__abiertas.push(v); return v; };
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); env.push(b); let r={ok:true};
    if(b.accion==='login') r=b.codigo===cod?{ok:true,usuario,permisos}:{ok:false,error:'Código inválido'};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[{nombre:'BBVA',activa:true}]};
    else if(b.accion==='erp_crear'){ const it={...b.item}; if(b.tabla==='cotizaciones'){ it.folio='C0001'; it.vendedor=usuario.vendedor_asignado.toUpperCase(); it.estatus='enviada'; } if(b.tabla==='pagosverificar') it.estatus='por_verificar'; DB[b.tabla].push(it); r={ok:true,item:it}; }
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 await sleep(400); return {w:dom.window,d:dom.window.document,DB,env,errs};
}
(async()=>{const r={fallas:[]};try{
 const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 // --- Luis ---
 const L=await abrir('LUIS-X',{nombre:'Luis',rol:'vendedor',vendedor_asignado:'Luis'},{agregar_pedidos:true,ver_todos_clientes:false});
 L.d.getElementById('lgCod').value='luis-x'; await L.w.eval('entrar()'); await sleep(300);
 r.version=txt(L.d.querySelector('.ver')); r.inicio=txt(L.d.getElementById('main')).slice(0,160);
 r.luisSinTodos=!/Todos/.test(r.inicio.slice(0,30));
 if(!/Te deben[ ›]*\$2,320/i.test(r.inicio)||!r.luisSinTodos) r.fallas.push('inicio');
 // cotizar
 await L.w.eval("ir('cotizar')"); r.sinIvaDefault=L.w.eval('S.cot.conIva===false'); if(!r.sinIvaDefault) r.fallas.push('sinIvaDefault'); // v2.1.9 sin IVA predeterminado
 await L.w.eval("S.cot.conIva=true; S.cot.cliente='CLIENTE UNO'; agregarProd('RL001'); S.cot.lineas[0].cantidad=3; S.cot.lineas[0].precio=1234.57; pintar()");
 r.totCot=txt(L.d.getElementById('ctTot'));
 await L.w.eval('subirCot()'); await sleep(300);
 const cot=L.env.find(b=>b.accion==='erp_crear'&&b.tabla==='cotizaciones');
 r.cot=cot&&{folio:cot.item.folio,subtotal:cot.item.subtotal,iva:cot.item.iva,total:cot.item.total,cliente:cot.item.cliente};
 // 3 × 1234.57 = 3703.71 · IVA 592.59 · total 4296.30 (redondeo por renglón, como el SAT)
 if(!cot||cot.item.folio!==''||cot.item.subtotal!==3703.71||cot.item.iva!==592.59||cot.item.total!==4296.3) r.fallas.push('cotizacion');
 r.precioLista=JSON.parse(cot.item.items_json)[0].precio_unitario; // con factura toma precio_factura (900) antes de cambiarlo
 // pago: queda por verificar, no toca Cobranza
 await L.w.eval("abrirPago('cob_pe1')"); L.d.getElementById('pgMonto').value='500'; await L.w.eval("guardarPago('cob_pe1')"); await sleep(300);
 const pv=L.env.find(b=>b.accion==='erp_crear'&&b.tabla==='pagosverificar');
 r.pago=pv&&{monto:pv.item.monto,cobro:pv.item.cobro_id,cuenta:pv.item.cuenta,documento:pv.item.documento};
 r.tocoCobranza=L.env.some(b=>b.accion==='capturar_pago_cliente'||(b.tabla==='cobranza'&&b.accion!=='erp_listar'));
 if(!pv||pv.item.monto!==500||pv.item.cobro_id!=='cob_pe1'||r.tocoCobranza) r.fallas.push('pago');
 // monto mayor a lo que debe: no se manda
 const antes=L.env.length; await L.w.eval("abrirPago('cob_pe1')"); L.d.getElementById('pgMonto').value='99999'; await L.w.eval("guardarPago('cob_pe1')"); await sleep(100);
 r.montoMayor=!L.env.slice(antes).some(b=>b.accion==='erp_crear'); if(!r.montoMayor) r.fallas.push('montoMayor');
 await L.w.eval("cerrarHoja();ir('inicio')"); r.inicioDespues=/Pagos por verificar \(1\)/.test(txt(L.d.getElementById('main'))); if(!r.inicioDespues) r.fallas.push('porVerificar');
 // v2.0.1 — Cobranza, Pagos y comisión, Facturas (lo que tenía la app anterior)
 await L.w.eval("ir('cobranza')"); r.cobranza=txt(L.d.getElementById('main')).slice(0,140); if(!/Cobranza.*Con saldo.*CLIENTE UNO.*Pedido P0001.*\$2,320/.test(r.cobranza)) r.fallas.push('cobranza');
 await L.w.eval("ir('pagos')"); r.pagos=/Pagos y comisión/.test(txt(L.d.getElementById('main'))); if(!r.pagos) r.fallas.push('pagos');
 await L.w.eval("S.filtroPed='fac';ir('pedidos')"); r.facturasChip=/Facturas/.test(txt(L.d.getElementById('main'))); if(!r.facturasChip) r.fallas.push('facturas');
 // v2.0.2 — PDF igual al del ERP (nun-pdf.js)
 await L.w.eval("S.d.empresa={razon_social:'EMPRESA PRUEBA'}; URL.createObjectURL=undefined; pdfDoc('pedidos','pe1')"); await sleep(100);
 const pdf=(L.w.__abiertas.slice(-1)[0]||{}).html||'';
 r.pdf={pedido:/PEDIDO/.test(pdf)&&/P0001/.test(pdf), letras:/M\.N\./.test(pdf), empresa:/EMPRESA PRUEBA/.test(pdf), cliente:/CLIENTE UNO/.test(pdf)};
 if(Object.values(r.pdf).some(v=>!v)) r.fallas.push('pdf');
 // v2.1 — app aparte del ERP: su propia carpeta, alcance e ícono blanco; la liga vieja manda a /ventas/
 const MV=JSON.parse(fs.readFileSync(path.join(__dirname,'..','ventas','manifest.webmanifest'),'utf8')), ME=JSON.parse(fs.readFileSync(path.join(__dirname,'..','manifest.webmanifest'),'utf8'));
 r.app={scope:MV.scope,id:MV.id,erpScope:ME.scope,blanco:MV.theme_color, vieja:/location\.replace\('ventas\//.test(fs.readFileSync(path.join(__dirname,'..','vendedores.html'),'utf8')), icono:fs.existsSync(path.join(__dirname,'..','ventas','icons','icon-512.png'))};
 if(MV.scope!=='./'||MV.start_url!=='./'||!/F5F5F5/i.test(MV.theme_color)||!r.app.vieja||!r.app.icono) r.fallas.push('app-aparte');
 r.nunCodigoEnTexto=/LUIS-X/.test(L.d.body.innerHTML);
 // v2.1.1 — botón Salir: borra la sesión del teléfono y regresa a la pantalla de entrar
 const salirBtn=[...L.d.querySelectorAll('.top button')].find(b=>/Salir/.test(b.textContent)); if(salirBtn) salirBtn.click(); await sleep(50);
 r.salir={boton:!!salirBtn, login:!!L.d.getElementById('lgCod'), sesion:L.w.localStorage.getItem('nunv_sesion')};
 if(!r.salir.boton||!r.salir.login||r.salir.sesion) r.fallas.push('salir'); if(r.nunCodigoEnTexto) r.fallas.push('codigo-visible');
 // --- Edgar ve "Lo mío / Todos"; Esteban (solo consulta) no puede cotizar ---
 const E=await abrir('EDGAR-X',{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},{agregar_pedidos:true,ver_todos_clientes:true});
 E.d.getElementById('lgCod').value='EDGAR-X'; await E.w.eval('entrar()'); await sleep(300);
 r.edgarTodos=/Lo mío\s*Todos/.test(txt(E.d.getElementById('main'))); if(!r.edgarTodos) r.fallas.push('edgar');
 const S2=await abrir('ESTEBAN-X',{nombre:'Esteban',rol:'vendedor',vendedor_asignado:'Esteban'},{solo_consulta:true});
 S2.d.getElementById('lgCod').value='ESTEBAN-X'; await S2.w.eval('entrar()'); await sleep(300); await S2.w.eval("ir('cotizar')");
 r.estebanNoCotiza=/todavía no puede subir cotizaciones/.test(txt(S2.d.getElementById('main'))); if(!r.estebanNoCotiza) r.fallas.push('esteban');
 // código malo
 const M=await abrir('X',{},{}); M.d.getElementById('lgCod').value='MALO'; await M.w.eval('entrar()'); await sleep(200); r.malo=txt(M.d.getElementById('lgErr')); if(r.malo!=='Código inválido') r.fallas.push('login');
 if(!/v2\.\d+\.\d+/.test(r.version)) r.fallas.push('version');
 r.errs=[...L.errs,...E.errs].slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,700)}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
