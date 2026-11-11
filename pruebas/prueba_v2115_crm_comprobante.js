// App de vendedores v2.1.15: al reportar un pago el vendedor puede subir la foto del comprobante; se sube DESPUÉS del pago, ligada a él
// (pv_id), y si falla el pago queda y se puede reintentar sin duplicar. Servidor simulado, datos inventados, sin red.
// Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const SUB=[]; let FALLA_FOTO=1;
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR'}],cotizaciones:[{id:'q0',folio:'C0001',cliente:'CLIENTE UNO',estatus:'enviada',total:1,envio:'Paquetexpress',items_json:'[]'}],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cobranza:[{id:'k1',cliente:'CLIENTE UNO',tipo:'Remisión',numero:'R0001',total:1000,pendiente:1000,cobrado:0,vendedor:'EDGAR'}],
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
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let r={ok:true}; if(b.accion==='erp_crear'&&b.tabla==='pagosverificar'){SUB.push(['pv',b.item]); r={ok:true,item:b.item};} if(b.accion==='archivo_subir'){SUB.push(['foto',b]); r=FALLA_FOTO-->0?{ok:false,error:'sin señal'}:{ok:true,id:b.id};}
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[]};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(1[3-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 await w.eval("ir('cotizar')"); await sleep(50);
 const skus=()=>[...d.querySelectorAll('#ctProdRes .res > div b:first-child')].map(b=>b.textContent);
 await w.eval("abrirPago('k1')"); await sleep(30);
 r.campo=!!d.getElementById('pgFoto'); if(!r.campo) r.fallas.push('campo de foto');
 const f=new w.File(['%PDF-1.4 comprobante'],'transferencia.pdf',{type:'application/pdf'});
 Object.defineProperty(d.getElementById('pgFoto'),'files',{value:[f]});
 d.getElementById('pgMonto').value='400';
 await w.eval("guardarPago('k1')"); await sleep(300);
 r.primerIntento={pv:SUB.filter(x=>x[0]==='pv').length,boton:d.getElementById('pgBtn')&&d.getElementById('pgBtn').textContent}; if(!(r.primerIntento.pv===1&&/otra vez/.test(r.primerIntento.boton))) r.fallas.push('si falla la foto el pago queda y deja reintentar');
 await w.eval("guardarPago('k1')"); await sleep(300);
 const pvs=SUB.filter(x=>x[0]==='pv'), fotos=SUB.filter(x=>x[0]==='foto');
 r.mismoPago=pvs.length===2&&pvs[0][1].id===pvs[1][1].id&&pvs[0][1].con_comprobante===true; if(!r.mismoPago) r.fallas.push('reintento = mismo pago');
 r.foto=fotos[1]&&{pv:fotos[1][1].pv_id===pvs[0][1].id,id:fotos[1][1].id,mime:fotos[1][1].mime,nombre:fotos[1][1].nombre}; if(!(r.foto&&r.foto.pv&&r.foto.mime==='application/pdf'&&r.foto.id==='cmp_'+pvs[0][1].id)) r.fallas.push('foto ligada');
 r.cerro=!d.getElementById('hoja'); if(!r.cerro) r.fallas.push('cierra al terminar');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
