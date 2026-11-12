// App v2.1.24 (Rafa 12 nov) — (1) la foto del pago sube también siendo de OFICINA (manda el cobro; antes "Falta el archivo o el cobro");
// (2) aviso "⏳ N pagos en espera de confirmación" (solo oficina): ver comprobante, ✅ Confirmar = capturar_pago_cliente + verificado; ✕ Rechazar. Sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const LL=[]; const DB={clientes:[{id:'c1',razon_social:'CLIENTE PV'}],pedidos:[],remisiones:[],ingresos:[],facturas:[],cotizaciones:[],productos:[],
  cobranza:[{id:'k1',cliente:'CLIENTE PV',tipo:'Pedido',numero:'P0001',total:1000,cobrado:0,pendiente:1000,fecha_emision:'2026-11-01'},{id:'k2',cliente:'CLIENTE PV',tipo:'Pedido',numero:'P0002',total:500,cobrado:0,pendiente:500,fecha_emision:'2026-11-02'}],
  pagosverificar:[{id:'pv1',cobro_id:'k1',cliente:'CLIENTE PV',documento:'Pedido P0001',monto:1000,fecha:'2026-11-12',estatus:'por_verificar',vendedor:'EDGAR',cuenta:'BBVA',forma:'Transferencia'},
   {id:'pv2',cobro_id:'k2',cliente:'CLIENTE PV',documento:'Pedido P0002',monto:500,fecha:'2026-11-12',estatus:'por_verificar',vendedor:'EDGAR'}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.prompt=()=>'No llegó'; w.scrollTo=()=>{}; w.open=()=>null;
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); LL.push(b); let r={ok:true};
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Rafa',rol:'admin'},permisos:{}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[{nombre:'BBVA',activa:true},{nombre:'Efectivo Transferencia',activa:true}]};
    else if(b.accion==='archivo_listar') r={ok:true,items:b.cobro_id==='k1'?[{id:'cmp_pv1',ref:'Reportado por EDGAR · pv:pv1',cancelado:false}]:[]};
    else if(b.accion==='archivo_subir') r=b.cobro_id?{ok:true}:{ok:false,error:'Falta el archivo o el cobro'};
    else if(b.accion==='capturar_pago_cliente'){ const c=DB.cobranza.find(c=>c.id===b.id_doc); c.cobrado+=b.monto; c.pendiente-=b.monto; }
    else if(b.accion==='erp_upsert_batch') b.items.forEach(it=>Object.assign(DB[b.tabla].find(x=>x.id===it.id),it));
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='rafa-x'; await w.eval('entrar()'); await sleep(500);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(2[4-9])/.test(r.version)) r.fallas.push('version');
 r.aviso=(d.querySelector('.aviso')||{}).textContent||''; if(!/2 pagos en espera de confirmación/.test(r.aviso)) r.fallas.push('aviso en Inicio');
 w.eval("ir('cobranza')"); await sleep(30); if(!d.querySelector('[onclick="abrirEspera()"]')) r.fallas.push('aviso en Cobranza');
 w.eval('abrirEspera()'); await sleep(100);
 r.comp=d.getElementById('esC_pv1').textContent; if(!/Ver comprobante/.test(r.comp)) r.fallas.push('ver comprobante');
 r.sin=d.getElementById('esC_pv2').textContent; if(!/Sin comprobante/.test(r.sin)) r.fallas.push('avisa sin comprobante');
 w.eval('prepararFoto=async f=>({nombre:f.name,mime:f.type,datos:"eA=="})');
 const e=await w.eval("subirComprobante('pv2', new File(['x'],'c.jpg',{type:'image/jpeg'}))"); r.subir=e; const sub=LL.filter(x=>x.accion==='archivo_subir').pop();
 if(e!==''||sub.cobro_id!=='k2'||!/pv:pv2/.test(sub.ref)) r.fallas.push('subir comprobante desde la oficina');
 await w.eval("confirmarPV('pv1')"); await sleep(150);
 const cap=LL.find(x=>x.accion==='capturar_pago_cliente'); r.cap=cap&&{id:cap.id_doc,monto:cap.monto,cuenta:cap.cuenta}; if(!cap||cap.id_doc!=='k1'||cap.monto!==1000||cap.cuenta!=='BBVA') r.fallas.push('confirmar registra el pago');
 if(DB.pagosverificar[0].estatus!=='verificado') r.fallas.push('queda verificado');
 await w.eval("rechazarPV('pv2')"); await sleep(100); if(DB.pagosverificar[1].estatus!=='rechazado'||DB.pagosverificar[1].motivo!=='No llegó') r.fallas.push('rechazar');
 w.eval("ir('inicio')"); await sleep(30); r.dbg=w.eval('JSON.stringify({n:enEspera().length,est:(S.d.pagosverificar||[]).map(p=>p.estatus),hoja:!!document.getElementById("hoja"),tab:S.tab})'); r.sinAviso=!d.querySelector('[onclick="abrirEspera()"]'); if(!r.sinAviso) r.fallas.push('el aviso se quita');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
