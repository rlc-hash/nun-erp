// App v2.1.30 (auditoría 15 nov) — estado de cuenta de la app: una factura que está en 2 pedidos (pedido_origen "1171, 1338") contaba su saldo
// DOS veces (Efraín: $76,500 de más). Ahora cuenta en el pedido más viejo (como el sistema) y el otro dice "comparte factura". Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const C='CLIENTE DOBLE';
 const DB={clientes:[{id:'c1',razon_social:C,vendedor:'EDGAR'}],productos:[],cotizaciones:[],remisiones:[],ingresos:[],pagosverificar:[],notascredito:[],
  pedidos:[{id:'p1',folio:'1171',fecha:'2026-07-01',cliente:C,vendedor:'EDGAR',estatus:'facturado',total:300},{id:'p2',folio:'1338',fecha:'2026-09-01',cliente:C,vendedor:'EDGAR',estatus:'facturado',total:150}],
  facturas:[{id:'fa',folio:'1061',fecha:'2026-07-05',cliente:C,vendedor:'EDGAR',estatus:'timbrada',total:100,pedido_origen:'1171, 1338'},{id:'fb',folio:'1170',fecha:'2026-07-06',cliente:C,vendedor:'EDGAR',estatus:'timbrada',total:200,pedido_origen:'1171'},
   {id:'fc',folio:'1178',fecha:'2026-09-05',cliente:C,vendedor:'EDGAR',estatus:'timbrada',total:50,pedido_origen:'1338'}],
  cobranza:[{id:'k1',numero:'1061',tipo:'Factura',cliente:C,vendedor:'EDGAR',total:100,cobrado:0,pendiente:100,factura_origen:'fa',fecha_emision:'2026-07-05'},
   {id:'k2',numero:'1170',tipo:'Factura',cliente:C,vendedor:'EDGAR',total:200,cobrado:200,pendiente:0,factura_origen:'fb',fecha_emision:'2026-07-06'},
   {id:'k3',numero:'1178',tipo:'Factura',cliente:C,vendedor:'EDGAR',total:50,cobrado:0,pendiente:50,factura_origen:'fc',fecha_emision:'2026-09-05'}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let x={ok:true};
    if(b.accion==='login') x={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') x={ok:true,items:DB[b.tabla]||[]}; else if(b.accion==='listar_cuentas') x={ok:true,cuentas:[]};
    return {json:async()=>JSON.parse(JSON.stringify(x))}; }; }});
 const w=dom.window,d=w.document; await sleep(400); d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=w.eval('VERSION'); if(!/^v2\.1\.(?:3\d|[4-9]\d|[3-9]\d)/.test(r.version)) r.fallas.push('version');
 const D=JSON.parse(w.eval("JSON.stringify(datosEC('"+C+"'))"));
 r.filas=D.filas.map(f=>[f.folio,f.falta,f.docs]); r.falta=D.falta;
 if(D.falta!==150) r.fallas.push('saldo total = Cobranza (150), no 250');
 const f1=D.filas.find(f=>f.folio==='1171'), f2=D.filas.find(f=>f.folio==='1338');
 if(!f1||f1.falta!==100) r.fallas.push('la factura compartida cuenta en el pedido más viejo');
 if(!f2||f2.falta!==50||!/comparte factura: el saldo de 1061 va en 1171/.test(f2.docs)) r.fallas.push('el otro pedido lo dice y no la cuenta');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
