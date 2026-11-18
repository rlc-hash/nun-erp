// App v2.1.33 (Rafa 18 nov: "Edgar quiere subir un pedido de Luis y que diga que Luis lo vendió") — en Cotizar, quien ve a todos (Edgar) tiene
// "¿Quién lo vendió?" (él por default); al elegir a Luis la cotización se manda con vendedor LUIS. Luis no ve ese selector. Datos inventados, sin red.
const ENV=[];
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
async function como(vend,todos){
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE DE EDGAR',vendedor:'EDGAR'},{id:'c2',razon_social:'CLIENTE DE LUIS',vendedor:'LUIS'},{id:'c3',razon_social:'CLIENTE DE YADAH',vendedor:'YADAH'}],
  productos:[{id:'pr1',sku:'RL009N',descripcion:'SET',stock_actual:10,stock_comprometido:0,precio:1000,activo:true}],cotizaciones:[],remisiones:[],facturas:[],ingresos:[],pagosverificar:[],notascredito:[],
  pedidos:[{id:'p1',folio:'P0001',fecha:new Date().toISOString().slice(0,10),cliente:'CLIENTE DE EDGAR',vendedor:'EDGAR',estatus:'confirmado',total:1000},{id:'p2',folio:'P0002',fecha:new Date().toISOString().slice(0,10),cliente:'CLIENTE DE YADAH',vendedor:'YADAH',estatus:'confirmado',total:50000}],
  cobranza:[]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); ENV.push(b); let x={ok:true};
    if(b.accion==='login') x={ok:true,usuario:{nombre:vend,rol:'vendedor',vendedor_asignado:vend},permisos:{agregar_pedidos:true,ver_todos_clientes:todos}};
    else if(b.accion==='erp_listar') x={ok:true,items:DB[b.tabla]||[]}; else if(b.accion==='listar_cuentas') x={ok:true,cuentas:[]}; else if(b.accion==='erp_crear') x={ok:true,item:{...b.item,folio:'C0099'}};
    return {json:async()=>JSON.parse(JSON.stringify(x))}; }; }});
 const w=dom.window,d=w.document; await sleep(400); d.getElementById('lgCod').value='x'; await w.eval('entrar()'); await sleep(300);
 const r={version:w.eval('VERSION')};
 w.eval("ir('cotizar')"); await sleep(30); r.selector=/¿Quién lo vendió\?/.test(d.querySelector('main').textContent);
 if(r.selector){ w.eval("S.cot.vend='LUIS';pintar()"); await sleep(20); r.aviso=/Se sube a nombre de LUIS/.test(d.querySelector('main').textContent); }
 w.eval("S.cot.cliente='CLIENTE DE LUIS'; S.cot.lineas=[{sku:'RL009N',desc:'SET',cantidad:1,precio:1000,disp:10,ps:1,modo:'pz'}]; pintar()"); await sleep(20);
 w.confirm=()=>true; await w.eval('subirCot()'); await sleep(50);
 const c=ENV.filter(b=>b.accion==='erp_crear'&&b.tabla==='cotizaciones').pop(); r.mandado=c&&c.item.vendedor;
 r.errs=errs.slice(0,3); return r;
}
(async()=>{const r={fallas:[]};try{
 r.edgar=await como('Edgar',true); r.luis=await como('Luis',false);
 if(!/^v2\.1\.(3[3-9]|[4-9]\d)/.test(r.edgar.version)) r.fallas.push('version');
 if(!r.edgar.selector||!r.edgar.aviso||r.edgar.mandado!=='LUIS') r.fallas.push('Edgar elige que lo vendió Luis');
 if(r.luis.selector||r.luis.mandado!=='LUIS') r.fallas.push('Luis no tiene selector y sube a su nombre');
 if(r.edgar.errs.length||r.luis.errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
