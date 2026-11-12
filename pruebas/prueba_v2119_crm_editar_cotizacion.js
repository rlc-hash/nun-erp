// App de vendedores v2.1.19 (Rafa 12 nov: "que Edgar pueda editar la cotización antes de que se confirme"; subió dos del mismo cliente):
// ✏️ Editar cotización (solo la suya y solo por confirmar) la carga en Cotizar con sus productos; al guardar corrige LA MISMA (erp_upsert_batch,
// mismo id/folio, sin estatus/folio/fecha). Lo que ya apartaba cuenta como disponible. Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const UPS=[],CRE=[];
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR'}],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cobranza:[],
  cotizaciones:[{id:'q1',folio:'C0020',fecha:'2026-11-12',cliente:'CLIENTE UNO',vendedor:'EDGAR',estatus:'enviada',subtotal:2000,iva:0,total:2000,sin_iva:true,envio:'Castores',
    items_json:JSON.stringify([{sku:'RL005B',descripcion:'MALETA RL005 BEIGE',cantidad:2,precio_unitario:1000,iva_pct:0}]),notas:'urgente · SIN IVA · Cotización desde la app de vendedores'},
   {id:'q2',folio:'C0021',fecha:'2026-11-12',cliente:'CLIENTE UNO',vendedor:'LUIS',estatus:'enviada',total:1,items_json:'[]'},
   {id:'q3',folio:'C0019',fecha:'2026-11-12',cliente:'CLIENTE UNO',vendedor:'EDGAR',estatus:'convertida',total:1,items_json:'[]'}],
  productos:[{id:'1',sku:'RL005B',descripcion:'MALETA RL005 BEIGE',precio:1000,stock_actual:5,stock_comprometido:2,activo:true},
   {id:'5',sku:'YH008N',descripcion:'MOCHILA YH008 NEGRO',precio:300,stock_actual:235,stock_comprometido:0,activo:true}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let r={ok:true};
    if(b.accion==='erp_crear') CRE.push(b);
    if(b.accion==='erp_upsert_batch'){ UPS.push(b); b.items.forEach(it=>{ const q=DB.cotizaciones.find(x=>x.id===it.id); Object.assign(q,it); }); }
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[]};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(19|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 const boton=id=>{ w.eval(`abrirDoc('cotizaciones','${id}')`); return !!d.querySelector('button[onclick^="editarCot(\'' + id + '\'"]'); };
 r.botonSuya=boton('q1'); w.eval('cerrarHoja()'); r.botonDeOtro=boton('q2'); w.eval('cerrarHoja()'); r.botonConfirmada=boton('q3'); w.eval('cerrarHoja()');
 if(!r.botonSuya||r.botonDeOtro||r.botonConfirmada) r.fallas.push('botón solo en la suya por confirmar');
 w.eval("editarCot('q1')"); await sleep(30);
 r.titulo=(d.querySelector('h2')||{}).textContent; if(!/Editar cotización C0020/.test(r.titulo)) r.fallas.push('titulo');
 r.cargada=w.eval('JSON.stringify({c:S.cot.cliente,n:S.cot.lineas.length,cant:S.cot.lineas[0].cantidad,p:S.cot.lineas[0].precio,disp:S.cot.lineas[0].disp,iva:S.cot.conIva,envio:S.cot.envio,notas:S.cot.notas})');
 const c=JSON.parse(r.cargada); if(c.c!=='CLIENTE UNO'||c.n!==1||c.cant!==2||c.p!==1000||c.disp!==5||c.iva||c.envio!=='Castores'||c.notas!=='urgente') r.fallas.push('cargar');
 r.botonGuardar=(d.getElementById('ctBtn')||{}).textContent; if(r.botonGuardar!=='Guardar cambios') r.fallas.push('botón guardar');
 // cambia cantidad 2 → 4 y agrega mochila
 w.eval("S.cot.lineas[0].cantidad=4"); w.eval("agregarProd('YH008N')"); await sleep(20);
 await w.eval('subirCot()'); await sleep(300);
 const u=UPS[0]&&UPS[0].items[0]; r.enviado=u;
 if(!u||u.id!=='q1'||'folio' in u||'estatus' in u||'fecha' in u||'vendedor' in u) r.fallas.push('manda solo lo editable');
 const its=u?JSON.parse(u.items_json):[]; if(its.length!==2||its[0].cantidad!==4||+u.total!==4300||u.envio!=='Castores'||!/^urgente · SIN IVA/.test(u.notas)) r.fallas.push('datos corregidos');
 r.noCreoOtra=CRE.filter(x=>x.tabla==='cotizaciones').length===0; if(!r.noCreoOtra) r.fallas.push('creó otra');
 r.limpia=!w.eval('S.cot.editId'); if(!r.limpia) r.fallas.push('limpiar');
 r.abierta=/C0020/.test(d.body.textContent); if(!r.abierta) r.fallas.push('abre la corregida');
 // salir sin guardar
 w.eval("editarCot('q1')"); w.eval('salirEdicion()'); r.salir=!w.eval('S.cot.editId')&&/Nueva cotización/.test((d.querySelector('h2')||{}).textContent); if(!r.salir) r.fallas.push('salir');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
