// v3.82 — reportes de Yazmín (pedido P0002): código con letra de color (RL0083GA) se puede escribir completo,
// mismo código se suma en un renglón, remisión ya no queda en borrador, un admin puede cambiar/anular un pago. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={productos:[{id:'pr1',sku:'RL0083G',descripcion:'MALETA BASE',precio:100},{id:'pr2',sku:'RL0083GA',descripcion:'MALETA GA',precio:110},{id:'pr3',sku:'RL0083P',descripcion:'MALETA P',precio:120}],
 pedidos:[{id:'p2',folio:'P0002',cliente:'CLIENTE UNO',estatus:'confirmado',total:139.2,items_json:JSON.stringify([{sku:'RL0083P',descripcion:'MALETA P',cantidad:1,precio_unitario:120,iva_pct:16}])}],
 remisiones:[],facturas:[],clientes:[{id:'cl1',razon_social:'CLIENTE UNO'}],
 cobranza:[{id:'cob1',numero:'R0009',cliente:'CLIENTE UNO',total:1000,cobrado:500,pendiente:500}],
 pagosclientes:[{timestamp:'2026-09-30T10:00:00.000Z',id_doc:'cob1',cliente:'CLIENTE UNO',monto:500,fecha:'2026-09-30',cuenta:'BBVA',usuario:'Yazmin',ingreso_id:'i1'}],ingresos:[{id:'i1',cliente:'CLIENTE UNO',factura:'R0009',monto:500,fecha:'2026-09-30',cuenta:'BBVA',tipo:'cobro'}],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'YAZ-PRUEBA7',usuario:{codigo:'YAZ-PRUEBA7',nombre:'Yazmin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='convertir_documento'){ const p=DB.pedidos.find(x=>x.id===b.id_origen); p.estatus='en_produccion'; const n={id:'rem_s1',folio:'REM-2026-0001',cliente:p.cliente,total:p.total,items_json:p.items_json,estatus:'borrador',pedido_origen:p.folio}; DB.remisiones.push(n); return J({ok:true,folio:n.folio,item:{id:n.id}}); }
   if(b.accion==='editar_pago_manual'){ const pg=DB.pagosclientes.find(x=>x.timestamp===b.timestamp); const c=DB.cobranza.find(x=>x.id===pg.id_doc); const d=b.nuevo_monto-pg.monto; c.cobrado+=d; c.pendiente=c.total-c.cobrado; pg.monto=b.nuevo_monto; return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB).filter(t=>t!=='usuarios')) await w.eval(`cargarTabla('${t}')`);
 w.eval("window.confirmDialog=async()=>true; window.confirm=()=>true");
 // 1) escribir RL0083GA letra por letra: al llegar a RL0083G NO se redibuja y deja seguir
 w.eval("navegar('pedidos')"); await sleep(200); w.eval("abrirDoc('pedidos')"); await sleep(300);
 w.eval("docAgregarItem()"); let inp=d.querySelector('#docItemsMount input[data-ac]'); const mismo=inp;
 for (const ch of 'RL0083GA') { inp.value+=ch; inp.dispatchEvent(new w.Event('input')); }
 inp.dispatchEvent(new w.Event('change'));
 r.escribir={mismaCasilla:d.querySelector('#docItemsMount input[data-ac]')===mismo,sku:w.eval("docItems[0].sku"),desc:w.eval("docItems[0].descripcion"),precio:w.eval("docItems[0].precio_unitario")};
 // 2) mismo código 3 veces = un renglón con 3 piezas
 for (let k=0;k<3;k++){ w.eval("docAgregarItem()"); const n=w.eval("docItems.length")-1; const el=d.querySelectorAll('#docItemsMount input[data-ac]')[n]; el.value='RL0083P'; el.dispatchEvent(new w.Event('input')); el.dispatchEvent(new w.Event('change')); }
 r.sumar=w.eval("docItems.map(i=>i.sku+'x'+i.cantidad)");
 w.eval("cerrarDrawer()"); await sleep(100);
 // 3) pedido → remisión: la remisión queda "entregada" y el pedido "entregado"
 await w.eval("convertirDocConItems('pedidos','p2','remisiones')"); await sleep(400);
 r.remision={estatus:DB.remisiones[0].estatus,folio:DB.remisiones[0].folio,pedido:DB.pedidos[0].estatus};
 // 4) administradora cambia un pago parcial de 500 a 450 y ve los botones
 w.eval("abrirDrawerCobranza('cob1')"); await sleep(300);
 r.botones=[...d.querySelectorAll('.drawer button')].map(b=>b.textContent.trim()).filter(t=>/Cambiar monto|Cancelar pago/.test(t));
 w.prompt=()=>'450'; await w.eval("nunCambiarMontoPago('2026-09-30T10:00:00.000Z','cob1',500)"); await sleep(200);
 r.pago={monto:DB.pagosclientes[0].monto,cobrado:DB.cobranza[0].cobrado,pendiente:DB.cobranza[0].pendiente};
 w.prompt=()=>'5000'; const antes=enviados.length; await w.eval("nunCambiarMontoPago('2026-09-30T10:00:00.000Z','cob1',450)"); r.pagoDeMas=enviados.slice(antes).some(b=>b.accion==='editar_pago_manual');
 r.fallas=[]; if(!r.escribir.mismaCasilla||r.escribir.sku!=='RL0083GA'||r.escribir.desc!=='MALETA GA'||r.escribir.precio!==110) r.fallas.push('escribir');
 if(r.sumar.join()!=='RL0083GAx1,RL0083Px3') r.fallas.push('sumar');
 if(r.remision.estatus!=='entregada'||r.remision.folio!=='R0001'||r.remision.pedido!=='entregado') r.fallas.push('remision');
 if(r.botones.length<2||r.pago.monto!==450||r.pago.cobrado!==450||r.pago.pendiente!==550||r.pagoDeMas) r.fallas.push('pagos');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
