// App de vendedores v2.1.8: en Cotizar sale la lista del inventario (solo con existencias, sin piezas INDIVIDUALES Z…) y se agrega con un toque.
// Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR'}],cotizaciones:[],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cobranza:[],
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
 r.version=(d.querySelector('.ver')||{}).textContent; if(r.version!=='v2.1.8') r.fallas.push('version');
 await w.eval("ir('cotizar')"); await sleep(50);
 const skus=()=>[...d.querySelectorAll('#ctProdRes .res > div b:first-child')].map(b=>b.textContent);
 r.lista=skus(); // sin Z…, sin INDIVIDUAL, sin existencias negativas/apartadas, sin inactivos
 if(r.lista.join()!=='RL005B,YH008N') r.fallas.push('lista');
 d.querySelector('#ctProdRes .res > div').click(); await sleep(20); d.querySelector('#ctProdRes .res > div').click(); await sleep(20);
 r.lineas=w.eval('JSON.stringify(S.cot.lineas.map(l=>[l.sku,l.cantidad,l.disp]))'); if(r.lineas!=='[["RL005B",2,4]]') r.fallas.push('agregar');
 r.marca=/✓ 2/.test(d.getElementById('ctProdRes').textContent); if(!r.marca) r.fallas.push('marca');
 d.getElementById('ctProd').value='mochila'; d.getElementById('ctProd').dispatchEvent(new w.Event('input')); r.busca=skus(); if(r.busca.join()!=='YH008N') r.fallas.push('buscar');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
