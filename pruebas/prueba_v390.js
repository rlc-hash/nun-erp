// v3.90 — Cobranza muestra TODOS los pagos del documento (también los de Bind) con "Cancelar pago";
// columna "Situación" en pedidos (sin surtir / parcial / surtido → R/F) y remisiones (facturada en…, cancelada ¿se facturó en…?). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE PRUEBA OMEGA', it=(sku,c)=>({sku,descripcion:sku,cantidad:c,precio_unitario:100,iva_pct:16});
const DB={cobranza:[{id:'bind_cob_7',numero:'V0177',tipo:'Remisión',cliente:N,total:1000,cobrado:600,pendiente:400}],
 ingresos:[{id:'bind_pag_1',cliente:N,factura:'V0177',monto:400,fecha:'2026-03-01',cuenta:'BBVA',tipo:'cobro'},{id:'ing_2',cliente:N,factura:'V0177',monto:200,fecha:'2026-04-01',cuenta:'Efectivo',tipo:'cobro'},{id:'bind_pag_3',cliente:N,factura:'V0177',monto:50,fecha:'2026-02-01',tipo:'CANCELADO_BIND'}],
 pedidos:[{id:'p1',folio:'P0001',cliente:N,estatus:'confirmado',items_json:JSON.stringify([it('A',4)])},{id:'p2',folio:'P0002',cliente:N,estatus:'confirmado',items_json:JSON.stringify([it('B',2)])},{id:'p3',folio:'P0003',cliente:N,estatus:'confirmado',items_json:JSON.stringify([it('C',1)])},{id:'p4',folio:'P0004',cliente:N,estatus:'cancelado',items_json:'[]'}],
 remisiones:[{id:'r1',folio:'R0001',cliente:N,estatus:'entregada',pedido_origen:'P0001',total:232,fecha:'2026-09-01',items_json:JSON.stringify([it('A',2)])},
  {id:'r2',folio:'R0002',cliente:N,estatus:'entregada',pedido_origen:'P0002',total:232,fecha:'2026-09-02',items_json:JSON.stringify([it('B',2)])},
  {id:'r3',folio:'213',cliente:N,estatus:'cancelada',total:43200,fecha:'2026-05-01',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0001',cliente:N,estatus:'timbrada',pedido_origen:'R0002',total:232,fecha:'2026-09-03',items_json:'[]'},{id:'f2',folio:'1106',cliente:N,estatus:'timbrada',total:43200,fecha:'2026-06-01',items_json:'[]'}],
 pagosclientes:[],clientes:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['cobranza','ingresos','pedidos','remisiones','facturas']) await w.eval(`cargarTabla('${t}')`);
 w.eval("abrirDrawerCobranza('bind_cob_7')"); await sleep(300);
 const h=d.getElementById('histPagos'); r.pagos={tab:[...d.querySelectorAll('.drawer-tabs button, .drawer button, .drawer [data-tab]')].map(b=>b.textContent.trim()).find(t=>/^Pagos \(/.test(t)),items:h.querySelectorAll('.timeline-item').length,cancelar:h.querySelectorAll('button.btn-danger').length,cuadra:/cuadra/.test(h.textContent)&&!/no cuadra/.test(h.textContent),cancelado:/cancelado/.test(h.textContent)};
 w.eval("cerrarDrawer()");
 const sit=(t,id)=>w.eval(`nunSituacionHTML('${t}', State.data.${t}.find(x=>x.id==='${id}'))`).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').replace(/ ✓ Es facturada$/,'').trim(); // v3.91: botón para marcarla facturada
 r.pedidos=['p1','p2','p3','p4'].map(id=>sit('pedidos',id)); r.remisiones=['r1','r2','r3'].map(id=>sit('remisiones',id));
 w.eval("navegar('remisiones')"); await sleep(300); r.columna=[...d.querySelectorAll('th')].some(th=>th.textContent.trim()==='Situación');
 r.fallas=[]; if(r.pagos.tab!=='Pagos (2)'||r.pagos.items!==3||r.pagos.cancelar!==2||!r.pagos.cuadra||!r.pagos.cancelado) r.fallas.push('pagos');
 if(r.pedidos.join('|')!=='parcial 2/4 → R R0001|surtido → R R0002|sin surtir|cancelado') r.fallas.push('pedidos');
 if(r.remisiones.join('|')!=='sin facturar de P0001|facturada en FT0001 de P0002|cancelada ¿se facturó en 1106? (mismo total)'||!r.columna) r.fallas.push('remisiones');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
