// v3.82 — ficha del cliente sin ligas a Bind (PDF/XML/nota de crédito propios), folio que asigna el servidor
// y pedido cancelado libera el inventario apartado. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={clientes:[{id:'cl1',razon_social:'CLIENTE UNO',credito_dias:90}],
 remisiones:[{id:'bind_rem_1',folio:'84',cliente:'CLIENTE UNO',total:500,estatus:'pendiente',fecha:'2026-03-23',notas:'Importada desde Bind'}],
 facturas:[{id:'f1',folio:'FT0001',cliente:'CLIENTE UNO',total:1160,estatus:'timbrada',uuid_sat:'aaaa0000-0000-4000-8000-000000000001',fecha:'2026-09-29'}],
 pedidos:[{id:'p1',folio:'P0001',cliente:'CLIENTE UNO',total:1160,estatus:'confirmado',fecha:'2026-09-29',items_json:JSON.stringify([{sku:'A1',cantidad:1,precio_unitario:1000,iva_pct:16}])}],
 notascredito:[],cobranza:[],ingresos:[],productos:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='erp_crear'){ const it=Object.assign({},b.item); if(b.tabla==='pedidos'&&it.folio==='P0002'){ it.folio='P0003'; } (DB[b.tabla]=DB[b.tabla]||[]).push(it); return J({ok:true,item:it,folio_cambiado:it.folio!==b.item.folio}); }
   if(b.accion==='pedido_liberar') return J({ok:true,liberados:1});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['clientes','remisiones','facturas','pedidos','notascredito','cobranza']) await w.eval(`cargarTabla('${t}')`);
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 w.eval("abrirDetalleCliente('cl1')"); await sleep(300);
 const html=[...d.querySelectorAll('.drawer')].map(x=>x.innerHTML).join(''); r.ficha={ligasBind:(html.match(/bind\.com\.mx/g)||[]).length,botonesPDF:[...d.querySelectorAll('button')].filter(b=>b.textContent.includes('📄 PDF')).length,
   botonNC:[...d.querySelectorAll('button')].some(b=>b.textContent.includes('Nota de crédito')),botonXML:[...d.querySelectorAll('button')].some(b=>b.textContent.includes('📋 XML'))};
 w.eval("cerrarDrawer(); window.confirmDialog=async()=>true");
 // nota de crédito desde la ficha: abre la nota ya ligada a la factura
 w.eval("nunNuevaNCDeFactura('f1')"); await sleep(600);
 r.nc={origen:(d.getElementById('dDocOrigen')||{}).value,cliente:(d.getElementById('dCliente')||{}).value};
 w.eval("cerrarDrawer()"); await sleep(100);
 // folio: el servidor devuelve otro (P0002 ya lo tenía alguien) → el sistema usa el del servidor
 w.eval("navegar('pedidos')"); await sleep(200); w.eval("abrirDoc('pedidos')"); await sleep(300);
 d.getElementById('dCliente').value='CLIENTE UNO'; w.eval("docItems=[{sku:'A1',descripcion:'MALETA',cantidad:1,precio_unitario:100,iva_pct:16}]");
 await w.eval("guardarDoc('pedidos','')"); await sleep(400);
 r.folio=DB.pedidos.map(p=>p.folio);
 // cancelar pedido → libera apartado
 const antes=enviados.length; await w.eval("eliminarDoc('pedidos','p1')"); await sleep(300);
 r.cancelar={estatus:DB.pedidos.find(p=>p.id==='p1').estatus,libero:enviados.slice(antes).some(b=>b.accion==='pedido_liberar'&&b.id==='p1'),borro:enviados.some(b=>/eliminar/.test(b.accion||''))};
 r.fallas=[]; if(r.ficha.ligasBind||r.ficha.botonesPDF<3||!r.ficha.botonNC||!r.ficha.botonXML) r.fallas.push('ficha');
 if(r.nc.origen!=='FT0001'||r.nc.cliente!=='CLIENTE UNO') r.fallas.push('nc');
 if(r.folio.join()!=='P0001,P0003') r.fallas.push('folio');
 if(r.cancelar.estatus!=='cancelado'||!r.cancelar.libero||r.cancelar.borro) r.fallas.push('cancelar');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
