// v3.97 — "Ligar remisiones" desde un pedido: un pedido grande de Bind que se surtió en varias remisiones que no quedaron ligadas.
// Se marcan, quedan con pedido_origen = folio del pedido (lo que decían antes se anota) y el pedido muestra en qué va y sus pagos. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTA GRANDE', it=(c)=>JSON.stringify([{sku:'A',descripcion:'A',cantidad:c,precio_unitario:100,iva_pct:16}]);
const DB={
 pedidos:[{id:'bind_ord_900',folio:'900',cliente:N,estatus:'entregado',total:1000,fecha:'2026-07-01',items_json:it(10)},{id:'bind_ord_901',folio:'901',cliente:N,estatus:'entregado',total:50,items_json:'[]'}],
 remisiones:[{id:'r1',folio:'1201',cliente:N,estatus:'entregada',total:600,fecha:'2026-07-05',pedido_origen:'',items_json:it(6)},
  {id:'r2',folio:'1202',cliente:N,estatus:'entregada',total:400,fecha:'2026-07-20',pedido_origen:'OC-CLIENTE',items_json:it(4)},
  {id:'r3',folio:'1203',cliente:N,estatus:'entregada',total:50,fecha:'2026-07-21',pedido_origen:'901',items_json:'[]'},
  {id:'r4',folio:'1204',cliente:N,estatus:'cancelada',total:70,items_json:'[]'},{id:'r5',folio:'1205',cliente:'OTRO',estatus:'entregada',total:70,items_json:'[]'}],
 facturas:[],cobranza:[{id:'bind_cob_1201',numero:'V011201',cliente:N,total:600,cobrado:600,pendiente:0,factura_origen:'r1'},{id:'bind_cob_1202',numero:'V011202',cliente:N,total:400,cobrado:100,pendiente:300,factura_origen:'r2'}],
 ingresos:[{id:'i1',cliente:N,factura:'V011201',monto:600,tipo:'cobro'},{id:'i2',cliente:N,factura:'V011202',monto:100,tipo:'cobro'}],pagosclientes:[],notascredito:[],clientes:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB)) if(t!=='usuarios') await w.eval(`cargarTabla('${t}')`);
 w.eval("window.confirmDialog=async()=>true");
 r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 const sit=()=>w.eval("nunSituacionHTML('pedidos', State.data.pedidos.find(x=>x.id==='bind_ord_900'))").replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 r.antes=sit();
 w.eval("abrirDoc('pedidos','bind_ord_900')"); await sleep(300); r.boton=[...d.querySelectorAll('.drawer button')].some(b=>/Ligar remisiones/.test(b.textContent)); w.eval("cerrarDrawer()");
 await w.eval("nunLigarAPedido('bind_ord_900')"); await sleep(200);
 const filas=[...d.querySelectorAll('#modalLAP tbody tr')]; r.lista=filas.map(tr=>txt(tr.querySelectorAll('td')[2])+':'+txt(tr.querySelectorAll('td')[5]));
 filas.forEach(tr=>{ const f=txt(tr.querySelectorAll('td')[2]); if(f==='1201'||f==='1202') { const c=tr.querySelector('input'); c.checked=true; c.dispatchEvent(new w.Event('change')); } });
 r.suma=txt(d.getElementById('lapSuma'));
 await w.eval("nunLigarAPedidoGuardar()"); await sleep(400);
 r.guardado=DB.remisiones.slice(0,3).map(x=>x.folio+'>'+x.pedido_origen).join(' '); r.nota=/antes decía OC-CLIENTE/.test(DB.remisiones[1].notas||'');
 r.despues=sit();
 w.eval("abrirDoc('pedidos','bind_ord_900')"); await sleep(300); r.pagos=[...d.querySelectorAll('.drawer button')].filter(b=>b.textContent.trim()==='Cancelar pago').length; r.saldo=/Saldo \$300.00/.test(txt(d.querySelector('.drawer')));
 r.fallas=[];
 if(r.antes!=='de Bind (sin liga)'||!r.boton) r.fallas.push('antes');
 if(r.lista.join(' ')!=='1201:— 1202:OC-CLIENTE 1203:901'||!/2 por \$1,000.00 ✓ igual al pedido/.test(r.suma)) r.fallas.push('lista');
 if(r.guardado!=='1201>900 1202>900 1203>901'||!r.nota) r.fallas.push('guardado');
 if(!/^surtido → R 1201, R 1202/.test(r.despues)||r.pagos!==4||!r.saldo) r.fallas.push('despues');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
