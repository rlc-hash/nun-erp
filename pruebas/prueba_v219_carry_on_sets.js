// v2.1.16 (Rafa 11 nov: "por pieza está mejor"): con CARRY_CAJA = false el carry on se ve, se cotiza y se guarda POR PIEZA.
// App de vendedores v2.1.9 (Rafa 9 nov): los carry on (RL0xxCO) se ven y se cotizan por SET de 6 piezas (el inventario sigue en piezas);
// el vendedor puede partir el set en piezas en la cotización; la cotización arranca SIN IVA. Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR'}],cotizaciones:[],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cobranza:[],
  productos:[{id:'1',sku:'RL009CON',descripcion:'CARRY ON PP RL009CO NEGRO',categoria:'CARRY ON',precio:550,precio_factura:474.14,stock_actual:234,stock_comprometido:48,activo:true},
   {id:'2',sku:'RL009N',descripcion:'MALETA PP RL009 NEGRO SET 3 PZ',categoria:'SET 3 PZ',unidad:'juego',precio:1650,precio_factura:1422.41,stock_actual:20,stock_comprometido:13,activo:true}]};
 const env=[];const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); env.push(b); let r={ok:true};
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[]};
    else if(b.accion==='erp_crear'){ r={ok:true,item:Object.assign({},b.item,{folio:'C0099'})}; DB[b.tabla].push(r.item); }
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():''; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(9|\d\d)/.test(r.version)) r.fallas.push('version');
 // Inventario: 234-48 = 186 pz = 31 sets, lista $3,300 el set
 await w.eval("ir('catalogo')"); r.inv=txt(d.getElementById('main')); if(!/RL009CON.*186 pzs.*lista \$550/.test(r.inv)||!/RL009N.*7 sets/.test(r.inv)) r.fallas.push('inventario');
 // Cotizar: sin IVA de entrada; lista en sets
 await w.eval("ir('cotizar')"); r.sinIva=w.eval('S.cot.conIva===false'); if(!r.sinIva) r.fallas.push('sinIva');
 r.lista=txt(d.getElementById('ctProdRes')); if(!/RL009CON 186 disponibles · lista \$550/.test(r.lista)) r.fallas.push('lista');
 await w.eval("S.cot.cliente='CLIENTE UNO'; agregarProd('RL009CON'); agregarProd('RL009CON'); agregarProd('RL009N')"); await sleep(20);
 r.linea=w.eval("JSON.stringify(S.cot.lineas.map(l=>[l.sku,l.modo,l.cantidad,l.precio]))"); if(r.linea!=='[["RL009CON","pz",2,550],["RL009N","pz",1,1650]]') r.fallas.push('linea');
 r.tot=txt(d.getElementById('ctTot')); if(!/Total\$2,750\.00/.test(r.tot)) r.fallas.push('total');
 // v2.1.15: el carry on va SIEMPRE por caja (sin botón de Piezas)
 r.sinPiezas=!/Piezas/.test(txt(d.getElementById('main')))&&/Por caja de 6 pz · pieza \$550/.test(txt(d.getElementById('main'))); r.sinPiezas=!/Piezas|Por caja/.test(txt(d.getElementById('main'))); if(!r.sinPiezas) r.fallas.push('sin botones de caja');
 // partir en piezas y regresar (la función queda, sin botón)
 await w.eval("modoLinea(0,'pz')"); r.pz=w.eval("JSON.stringify([S.cot.lineas[0].cantidad,S.cot.lineas[0].precio])"); if(r.pz!=='[2,550]') r.fallas.push('aPiezas');
 await w.eval("S.cot.lineas[0].cantidad=15; modoLinea(0,'set')"); r.set=w.eval("JSON.stringify([S.cot.lineas[0].cantidad,S.cot.lineas[0].precio])"); if(r.set!=='[15,550]') r.fallas.push('piezas se quedan');
 // se guarda en piezas para el inventario
 await w.eval('subirCot()'); await sleep(300);
 const c=env.find(b=>b.accion==='erp_crear'&&b.tabla==='cotizaciones'); const its=c&&JSON.parse(c.item.items_json);
 r.guardado=its&&its.map(i=>[i.sku,i.cantidad,i.precio_unitario,i.descripcion,i.iva_pct]); r.total=c&&c.item.total;
 if(!its||its[0].cantidad!==15||its[0].precio_unitario!==550||its[0].descripcion!=='CARRY ON PP RL009CO NEGRO'||its[0].iva_pct!==0||its[0].pz_caja!==undefined||its[1].cantidad!==1||c.item.total!==9900||!c.item.sin_iva) r.fallas.push('guardado');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
