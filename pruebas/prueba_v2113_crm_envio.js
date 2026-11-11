// App de vendedores v2.1.13: en Cotizar el vendedor pone por dónde se manda (🚚 envío: fletera/paquetería); sugiere las que ya se usaron,
// se sube con la cotización y se ve al abrirla.
// Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const SUB=[];
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR'}],cotizaciones:[{id:'q0',folio:'C0001',cliente:'CLIENTE UNO',estatus:'enviada',total:1,envio:'Paquetexpress',items_json:'[]'}],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cobranza:[],
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
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let r={ok:true}; if(b.accion==='erp_crear'&&b.tabla==='cotizaciones'){SUB.push(b.item); r={ok:true,item:Object.assign({},b.item,{folio:'C0002'})};}
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[]};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(1[3-9]|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 await w.eval("ir('cotizar')"); await sleep(50);
 const skus=()=>[...d.querySelectorAll('#ctProdRes .res > div b:first-child')].map(b=>b.textContent);
 r.sugiere=[...d.querySelectorAll('#ctEnvioLista option')].map(o=>o.value).join(); if(r.sugiere!=='Paquetexpress') r.fallas.push('sugerencias');
 d.querySelector('#ctProdRes .res > div').click(); await sleep(20);
 w.eval("S.cot.cliente='CLIENTE UNO'"); const inp=d.querySelector('input[list=ctEnvioLista]'); inp.value='Fletera Castores'; inp.dispatchEvent(new w.Event('input'));
 await w.eval('subirCot()'); await sleep(300);
 r.subida=SUB[0]&&SUB[0].envio; if(r.subida!=='Fletera Castores') r.fallas.push('subir');
 r.limpia=w.eval('S.cot.envio')===''; if(!r.limpia) r.fallas.push('limpiar');
 await w.eval("abrirDoc('cotizaciones','q0')"); await sleep(30); r.seVe=/Envío: Paquetexpress/.test(d.body.textContent); if(!r.seVe) r.fallas.push('ver');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
