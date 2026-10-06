// v4.06 — Desde el pedido: precio editable y "ajustar al monto que pagó" (la factura queda exacta); lo pendiente del pedido se
// compensa y queda anotado. Remisión: se crea activa y las de borrador tienen "Activar remisión". Facturas de Bind sin % de IVA en
// renglones: al abrir se toma el IVA de sus totales. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA DOCE', it=(sku,c)=>({sku,descripcion:'SET '+sku,cantidad:c,precio_unitario:1650,iva_pct:16});
const DB={clientes:[{id:'c1',razon_social:N,rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626'}],
 pedidos:[{id:'p1',folio:'1332',cliente:N,estatus:'confirmado',vendedor:'EDGAR',fecha:'2026-09-17',total:8250,items_json:JSON.stringify([it('GA',1),it('RD',2),it('N',2)])}],
 remisiones:[{id:'rb',folio:'R0005',cliente:'OTRA',estatus:'borrador',total:100,fecha:'2026-10-02',items_json:'[]'}],
 facturas:[{id:'bind_f1103',folio:'1103',cliente:'OTRA',estatus:'timbrada',uuid_sat:'u',subtotal:12500,iva:2000,total:14500,items_json:JSON.stringify([{sku:'X',descripcion:'X',cantidad:10,precio_unitario:1250}])},
  {id:'bind_f1017',folio:'1017',cliente:'OTRA',estatus:'timbrada',uuid_sat:'u2',subtotal:16655.17,iva:1698.83,total:18354,items_json:JSON.stringify([{sku:'Y',descripcion:'Y',cantidad:1,precio_unitario:16655.17}])}],
 cobranza:[],ingresos:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.12'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(Object.assign({},b.item)); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const x of b.items){ const y=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===x.id); if(y) Object.assign(y,x); else DB[b.tabla].push(x);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
 w.eval("window.confirmDialog=async()=>true");
 // 1) factura de 1 pieza de cada color, el cliente pagó 5,500
 await w.eval("nunDesdePedidos('p1')"); await sleep(200);
 const cant=[...d.querySelectorAll('#modalDP .dpCant')]; cant.forEach(c=>{ c.value='1'; c.dispatchEvent(new w.Event('input')); });
 r.antes=txt(d.getElementById('dpTotales')).match(/como factura .*?= \$[\d,\.]+/)[0];
 d.getElementById('dpMonto').value='5500'; w.eval("nunDesdePedidosAjustarMonto()");
 r.precios=[...d.querySelectorAll('#modalDP .dpPrecio')].map(x=>x.value); r.despues=txt(d.getElementById('dpTotales')).match(/= \$[\d,\.]+/)[0]; r.errAjuste=d.getElementById('dpError').textContent;
 await w.eval("nunDesdePedidosCrear('facturas')"); await sleep(500);
 const f=DB.facturas.find(x=>x.cliente===N); r.factura=f&&{total:f.total,subtotal:f.subtotal,limpio:!/_puOrig|_p"/.test(f.items_json)};
 const p=DB.pedidos[0]; const pits=JSON.parse(p.items_json); r.pedido={precios:pits.map(i=>i.precio_unitario),ajustes:pits.map(i=>+(i.ajuste_pu||0)),nota:(p.notas||'').replace(/\d{4}-\d{2}-\d{2}/,'HOY')};
 // pendiente: 1 RD + 1 N; base original pendiente 3,300; delta = 4,741.38-4,950 = -208.62 → pendiente +208.62
 r.pendienteNuevo=Math.round((pits[1].precio_unitario+pits[1].ajuste_pu+pits[2].precio_unitario+pits[2].ajuste_pu)*100)/100;
 await w.eval("cargarTabla('facturas')"); await w.eval("nunDesdePedidos('p1')"); await sleep(200);
 r.yaSalio=[...d.querySelectorAll('#modalDP tbody tr')].map(tr=>tr.querySelectorAll('td')[2].textContent.replace(/\s+/g,' ').trim()).join(' | '); r.precioPend=[...d.querySelectorAll('#modalDP .dpPrecio')].map(x=>x.value).join(); d.getElementById('modalDP').remove();
 w.eval("abrirDoc('pedidos','p1')"); await sleep(300); const dr=d.querySelector('.drawer').textContent.replace(/\s+/g,' '); r.panelPedido=/Qué ya salió de este pedido/.test(dr)&&/faltan 1/.test(dr)&&/1 en F FT0001/.test(dr); r.totalPedido=w.eval("nunCalcDoc(docItems,false).total"); w.eval("cerrarDrawer()");
 // 2) remisión en borrador → Activar
 w.eval("abrirDoc('remisiones','rb')"); await sleep(200); r.botonActivar=[...d.querySelectorAll('.drawer button')].some(b=>/Activar remisión/.test(b.textContent)); w.eval("cerrarDrawer()");
 await w.eval("nunActivarRemision('rb')"); await sleep(200); r.activada=DB.remisiones.find(x=>x.id==='rb').estatus;
 w.eval("abrirDoc('remisiones')"); await sleep(200); r.nuevaDefault=d.getElementById('dEstatus').value; w.eval("cerrarDrawer()");
 // 3) factura 1103 de Bind: IVA de sus totales
 w.eval("abrirDoc('facturas','bind_f1103')"); await sleep(300); r.iva1103=w.eval("docItems.map(i=>i.iva_pct).join()"); r.mixto=w.eval("window._nunIvaMixto"); w.eval("cerrarDrawer()");
 w.eval("abrirDoc('facturas','bind_f1017')"); await sleep(300); r.aviso1017=/productos con y sin IVA.*18,354/.test(txt(d.querySelector('.drawer'))); w.eval("cerrarDrawer()");
 r.fallas=[];
 if(r.yaSalio!=='1F FT0001 | 1F FT0001 | 1F FT0001'||r.precioPend!=='1650,1754.31,1754.31'||!r.panelPedido) r.fallas.push('yaSalio');
 if(r.pedido.precios.join()!=='1650,1650,1650'||r.pedido.ajustes[0]!==0||Math.abs(r.pedido.ajustes[1]-104.31)>0.01) r.fallas.push('preciosPedido');
 if(r.antes!=='como factura $4,950.00 + IVA $792.00 = $5,742.00'||r.despues!=='= $5,500.00'||r.errAjuste) r.fallas.push('ajuste');
 if(!r.factura||r.factura.total!==5500||!r.factura.limpio) r.fallas.push('factura');
 if(Math.abs(r.pendienteNuevo-(3300+208.62))>0.02||!/Precio ajustado en factura FT0001: −\$208\.6\d a precio del pedido .* lo pendiente del pedido se compensó \+\$208\.6\d/.test(r.pedido.nota)) r.fallas.push('compensacion');
 if(!r.botonActivar||r.activada!=='entregada'||r.nuevaDefault!=='entregada') r.fallas.push('remision');
 if(r.iva1103!=='16'||r.mixto!==null||!r.aviso1017) r.fallas.push('ivaBind');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},4000);
