// App de vendedores v2.1.17: Estado de cuenta del cliente (botón en su hoja) con el MISMO formato del ERP (nunECHTMLDe de nun-pdf.js):
// pedidos con lo que falta (sus cobros y los de sus remisiones/facturas), documentos sueltos con saldo e historial de pagos.
// Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR',telefono:'5512345678'}],cotizaciones:[],pagosverificar:[],
  pedidos:[{id:'p1',folio:'P0010',fecha:'2026-10-01',cliente:'CLIENTE UNO',estatus:'confirmado',total:10000,items_json:'[]'},{id:'p2',folio:'1308',fecha:'2026-08-13',cliente:'CLIENTE UNO',estatus:'entregado',total:5000,items_json:'[]'},{id:'p3',folio:'P0099',fecha:'2026-10-02',cliente:'OTRO',estatus:'confirmado',total:1,items_json:'[]'}],
  remisiones:[],facturas:[{id:'f1',folio:'FT0018',fecha:'2026-11-05',cliente:'CLIENTE UNO',estatus:'timbrada',total:2000,pedido_origen:'1308'}],
  cobranza:[{id:'cob_p1',cliente:'CLIENTE UNO',tipo:'Pedido',numero:'P0010',total:10000,cobrado:4000,pendiente:6000,factura_origen:'p1',estatus:'pendiente',fecha_emision:'2026-10-01'},{id:'cob_f1',cliente:'CLIENTE UNO',tipo:'Factura',numero:'FT0018',total:2000,cobrado:2000,pendiente:0,factura_origen:'f1',estatus:'pendiente'},{id:'cob_p2',cliente:'CLIENTE UNO',tipo:'Pedido',numero:'PED 1308',total:3000,cobrado:0,pendiente:3000,factura_origen:'p2',estatus:'pendiente'},{id:'k9',cliente:'CLIENTE UNO',tipo:'Remisión',numero:'V01300',total:1500,cobrado:500,pendiente:1000,factura_origen:'r9',estatus:'pendiente',fecha_emision:'2026-09-01'}],
  ingresos:[{id:'i1',fecha:'2026-10-05',cliente:'CLIENTE UNO',monto:4000,factura:'P0010',cuenta:'BBVA',tipo:'cobro'},{id:'i2',fecha:'2026-11-05',cliente:'CLIENTE UNO',monto:2000,factura:'FT0018',cuenta:'BBVA',tipo:'cobro'},{id:'i3',fecha:'2026-09-02',cliente:'CLIENTE UNO',monto:500,factura:'V01300',cuenta:'Efectivo',tipo:'cobro'},{id:'i4',fecha:'2026-09-03',cliente:'CLIENTE UNO',monto:999,factura:'X',cuenta:'BBVA',tipo:'DUPLICADO_BIND'}],
  productos:[{id:'1',sku:'RL005B',descripcion:'MALETA RL005 BEIGE',precio:1000,stock_actual:5,stock_comprometido:1,activo:true},
   {id:'2',sku:'ZRL005B24',descripcion:'MALETA INDIVIDUAL RL005 BEIGE 24 PULGADAS',precio:400,stock_actual:9,activo:true},
   {id:'3',sku:'RL004X',descripcion:'MALETA INDIVIDUAL PP RL004 X',precio:400,stock_actual:9,activo:true},
   {id:'4',sku:'SF004A',descripcion:'MALETA TELA SF004 AQUA',precio:900,stock_actual:-20,activo:true},
   {id:'5',sku:'YH008N',descripcion:'MOCHILA YH008 NEGRO',precio:300,stock_actual:235,stock_comprometido:0,activo:true},
   {id:'6',sku:'YH001R',descripcion:'MOCHILA YH001 ROJO',precio:300,stock_actual:3,stock_comprometido:3,activo:true},
   {id:'7',sku:'YH009V',descripcion:'MOCHILA YH009 VERDE',precio:300,stock_actual:5,activo:false}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let r={ok:true};
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[]};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(1[7-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 await w.eval("abrirCliente('CLIENTE UNO')"); await sleep(30);
 r.boton=/📄 Estado de cuenta/.test(d.getElementById('hojaC').textContent); if(!r.boton) r.fallas.push('botón en el cliente');
 const D=JSON.parse(w.eval("JSON.stringify(datosEC('CLIENTE UNO'))"));
 r.filas=D.filas.map(f=>[f.folio||f.docs,f.total,f.pagado,f.falta]); r.tot=[D.total,D.pagado,D.falta,D.pagos.length];
 if(JSON.stringify(r.tot)!=='[16500,6500,10000,3]') r.fallas.push('totales');
 if(!D.filas.some(f=>f.folio==='1308'&&f.total===5000&&f.falta===3000&&/FT0018/.test(f.docs))) r.fallas.push('pedido parcial con su factura');
 const h=w.eval("nunECHTMLDe(datosEC('CLIENTE UNO'))"), t=h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 r.pdf={formato:/Estado de cuenta/.test(t)&&/Fecha de corte/.test(t)&&/Detalle de pedidos/.test(t), saldo:/\$10,000\.00/.test(t), pagos:/Historial de pagos/.test(t)&&/Total pagos \(3\) \$6,500\.00/.test(t), logo:/<svg/.test(h), sinOtro:!/P0099/.test(t)};
 if(Object.values(r.pdf).some(v=>!v)) r.fallas.push('pdf');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
