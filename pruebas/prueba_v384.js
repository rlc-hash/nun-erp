// v3.84 — Cuadre por cliente: cobrado vs pagos reales en Ingresos, ajuste confirmado, vendedor para todos sus documentos. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE PRUEBA ALFA';
const DB={clientes:[{id:'cl1',razon_social:N,vendedor:''}],
 cobranza:[{id:'b1',numero:'V01100',cliente:N,vendedor:'YASMIN',total:95000,cobrado:95000,pendiente:0,fecha_entrega:'2025-11-21'},
  {id:'b2',numero:'V01101',cliente:N,vendedor:'EDGAR',total:81000,cobrado:0,pendiente:81000,fecha_entrega:'2025-12-05'},
  {id:'b3',numero:'V01102',cliente:N,vendedor:'YASMIN',total:25000,cobrado:25000,pendiente:0,fecha_entrega:'2025-12-05'}],
 ingresos:[{id:'i1',cliente:N,factura:'V01100',monto:25000,fecha:'2025-11-30',cuenta:'BBVA',tipo:'cobro'},{id:'i2',cliente:N,factura:'V01102',monto:25000,fecha:'2025-12-10',cuenta:'BBVA',tipo:'cobro'},
  {id:'i3',cliente:N,factura:'OTRA REF',monto:1000,fecha:'2025-12-11',cuenta:'Efectivo',tipo:'cobro'},{id:'i4',cliente:N,factura:'V01100',monto:5000,fecha:'2025-12-12',tipo:'CANCELADO_BIND'}],
 remisiones:[{id:'r1',folio:'100',cliente:N,vendedor:'YASMIN',estatus:'pendiente'}],pedidos:[{id:'p1',folio:'P0009',cliente:N,vendedor:'YASMIN',estatus:'cancelado'}],facturas:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['clientes','cobranza','ingresos','remisiones','pedidos','facturas']) await w.eval(`cargarTabla('${t}')`);
 r.servidor=(d.getElementById('nunVerSrv')||{}).textContent;
 w.eval("window.confirmDialog=async()=>true");
 w.eval("abrirDetalleCliente('cl1')"); await sleep(300);
 const txt=(d.getElementById('nunCuadreCliMount')||{}).textContent||''; r.cuadre={tab:!!d.getElementById('nunCuadreCliMount'),noCuadra:/no cuadra por \$69,000/.test(txt),demas:/Dice cobrado \$70,000\.00 de más/.test(txt),suelto:/OTRA REF/.test(txt),raros:/2 documento\(s\) con vendedor que no es vendedor/.test(txt)};
 await w.eval("nunCuadreAjustar('b1','cl1')"); await sleep(200);
 const b1=DB.cobranza.find(c=>c.id==='b1'); r.ajuste={cobrado:b1.cobrado,pendiente:b1.pendiente,nota:/Cuadre/.test(b1.descripcion||'')};
 d.getElementById('cuVend').value='EDGAR'; await w.eval("nunCuadreVendedorTodos('cl1')"); await sleep(300);
 r.vendedores={cob:DB.cobranza.map(c=>c.vendedor).join(),rem:DB.remisiones[0].vendedor,pedCancelado:DB.pedidos[0].vendedor,cliente:DB.clientes[0].vendedor};
 r.borro=enviados.some(b=>/eliminar/.test(b.accion||''));
 r.fallas=[]; if(r.servidor!=='servidor v0.9.10') r.fallas.push('servidor');
 if(!r.cuadre.tab||!r.cuadre.noCuadra||!r.cuadre.demas||!r.cuadre.suelto||!r.cuadre.raros) r.fallas.push('cuadre');
 if(r.ajuste.cobrado!==25000||r.ajuste.pendiente!==70000||!r.ajuste.nota) r.fallas.push('ajuste');
 if(r.vendedores.cob!=='EDGAR,EDGAR,EDGAR'||r.vendedores.rem!=='EDGAR'||r.vendedores.pedCancelado!=='YASMIN'||r.vendedores.cliente!=='EDGAR'||r.borro) r.fallas.push('vendedores');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},5000);
