// v3.86 — Pedidos → remisión/factura en partes y juntando pedidos del mismo cliente. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE PRUEBA GAMA', it=(sku,c,pu)=>({sku,descripcion:'PIEZA '+sku,cantidad:c,precio_unitario:pu,iva_pct:16});
const DB={clientes:[{id:'cl1',razon_social:N,credito_dias:30}],
 pedidos:[{id:'p1',folio:'P0001',cliente:N,estatus:'confirmado',vendedor:'EDGAR',fecha:'2026-09-01',total:0,items_json:JSON.stringify([it('A',5,100),it('B',2,50)])},
  {id:'p2',folio:'P0002',cliente:N,estatus:'confirmado',vendedor:'EDGAR',fecha:'2026-09-05',total:0,items_json:JSON.stringify([it('C',3,200)])},
  {id:'p3',folio:'P0003',cliente:'OTRO CLIENTE',estatus:'confirmado',items_json:JSON.stringify([it('Z',1,1)])}],
 remisiones:[{id:'r1',folio:'R0001',cliente:N,pedido_origen:'P0001',estatus:'entregada',total:232,items_json:JSON.stringify([it('A',2,100)])}],
 facturas:[],cobranza:[],ingresos:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(Object.assign({},b.item)); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const x of b.items){ const y=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===x.id); if(y) Object.assign(y,x); else DB[b.tabla].push(x);} return J({ok:true}); }
   if(b.accion==='pedido_liberar') return J({ok:true,liberados:1});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
const pon=(p,l,v)=>{ const el=d.querySelector(`#modalDP .dpCant[data-p="${p}"][data-l="${l}"]`); el.value=String(v); el.dispatchEvent(new w.Event('input')); };
setTimeout(async()=>{const r={};try{
 for (const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
 // 1) remisión: 3 de A (lo que falta) del P0001 + 1 de C del P0002 (juntar pedidos)
 await w.eval("nunDesdePedidos('p1','remisiones')"); await sleep(200);
 const md=d.getElementById('modalDP'); r.ventana={pedidos:[...md.querySelectorAll('b')].map(b=>b.textContent).filter(t=>/^Pedido/.test(t)),maxA:md.querySelector('.dpCant[data-p="0"][data-l="0"]').max,defB:md.querySelector('.dpCant[data-p="0"][data-l="1"]').value,defC:md.querySelector('.dpCant[data-p="1"][data-l="0"]').value};
 pon(0,1,0); pon(1,0,1);
 pon(0,0,9); await w.eval("nunDesdePedidosCrear()"); r.demasiado=(d.getElementById('dpError')||{}).textContent; pon(0,0,3);
 await w.eval("nunDesdePedidosCrear()"); await sleep(400);
 const r2=DB.remisiones.find(x=>x.id!=='r1'); r.remision={folio:r2.folio,origen:r2.pedido_origen,estatus:r2.estatus,total:r2.total,lineas:JSON.parse(r2.items_json).map(l=>l.sku+'x'+l.cantidad+'@'+l.pedido).join()};
 r.pedidosTrasRem=DB.pedidos.map(p=>p.estatus).join();
 // 2) factura del resto de P0001 (B x2) → P0001 completo = facturado
 await w.eval("nunDesdePedidos('p1','facturas')"); await sleep(200);
 r.facturaVentana={maxA:d.querySelector('#modalDP .dpCant[data-p="0"][data-l="0"]').max,defB:d.querySelector('#modalDP .dpCant[data-p="0"][data-l="1"]').value,iva:d.getElementById('dpIva').value};
 pon(1,0,0); await w.eval("nunDesdePedidosCrear()"); await sleep(400);
 const f=DB.facturas[0]; r.factura={folio:f.folio,total:f.total,estatus:f.estatus,lineas:JSON.parse(f.items_json).map(l=>l.sku+'x'+l.cantidad).join()};
 r.pedidos=DB.pedidos.map(p=>p.folio+':'+p.estatus).join();
 r.cobranza=DB.cobranza.map(c=>c.numero+':'+c.total).join();
 r.usoConvertir=enviados.some(b=>b.accion==='convertir_documento');
 r.fallas=[]; if(r.ventana.pedidos.length!==2||r.ventana.maxA!=='3'||r.ventana.defB!=='2'||r.ventana.defC!=='0') r.fallas.push('ventana');
 if(!/máximo 3/.test(r.demasiado||'')) r.fallas.push('limite');
 if(r.remision.folio!=='R0002'||r.remision.origen!=='P0001, P0002'||r.remision.estatus!=='entregada'||r.remision.total!==580||r.remision.lineas!=='Ax3@P0001,Cx1@P0002') r.fallas.push('remision');
 if(r.pedidosTrasRem!=='confirmado,confirmado,confirmado') r.fallas.push('pedidosParcial');
 if(r.facturaVentana.maxA!=='0'||r.facturaVentana.defB!=='2'||r.facturaVentana.iva!=='mas') r.fallas.push('facturaVentana');
 if(r.factura.folio!=='FT0001'||r.factura.total!==116||r.factura.estatus!=='borrador'||r.factura.lineas!=='Bx2') r.fallas.push('factura');
 if(r.pedidos!=='P0001:facturado,P0002:confirmado,P0003:confirmado') r.fallas.push('pedidosEstatus');
 if(r.cobranza!=='R0002:580,FT0001:116'||r.usoConvertir) r.fallas.push('cobranza');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},4000);
