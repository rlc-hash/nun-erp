// v4.10 — Auditoría de ligas pedido → remisión/factura (caso pedido 1109: tenía facturas de otros clientes) y candado al ligar
// a un pedido de otro cliente. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const it=(sku,c)=>({sku,descripcion:'MALETA '+sku,cantidad:c,precio_unitario:1000,iva_pct:0});
const DB={clientes:[],
 pedidos:[{id:'p1',folio:'1109',cliente:'JOSE LUIS HERNANDEZ MELO',estatus:'facturado',fecha:'2026-01-13',total:4000,items_json:JSON.stringify([it('SF006N',4)])},
  {id:'p2',folio:'1336',cliente:'CINTHYA KALID ALARCON HERNANDEZ',estatus:'confirmado',fecha:'2026-04-01',total:3000,items_json:JSON.stringify([it('SF007G',3)])},
  {id:'p3',folio:'1200',cliente:'Comercializadora Bustamante, S.A. de C.V.',estatus:'confirmado',fecha:'2026-04-01',total:2000,items_json:JSON.stringify([it('RL001N',2)])}],
 remisiones:[{id:'r91',folio:'91',cliente:'JOSE LUIS HERNANDEZ MELO',pedido_origen:'1109',estatus:'pendiente',total:4000,items_json:JSON.stringify([it('SF006N',4)])},
  {id:'r5',folio:'R0005',cliente:'COMERCIALIZADORA BUSTAMANTE SA DE CV',pedido_origen:'1200',estatus:'entregada',total:3000,items_json:JSON.stringify([it('RL001N',2),it('RL001A',1)])}],
 facturas:[{id:'f1078',folio:'1078',cliente:'CINTHYA KALID ALARCON HERNANDEZ',pedido_origen:'1109',estatus:'timbrada',total:3000,items_json:JSON.stringify([it('SF006N',3)])},
  {id:'fx',folio:'1065',cliente:'OTRO CLIENTE',pedido_origen:'1109',estatus:'cancelada',total:1,items_json:'[]'}],
 cobranza:[],ingresos:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.12'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const x of b.items){ const y=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===x.id); const vac=x._vaciar||[]; if(y){ for(const k of Object.keys(x)){ if(k==='_vaciar') continue; if(x[k]!==''&&x[k]!=null) y[k]=x[k]; } vac.forEach(k=>y[k]=''); } else DB[b.tabla].push(x);} return J({ok:true}); } // igual que el servidor: '' se ignora salvo _vaciar
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={fallas:[]};try{
 for (const t of ['pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
 r.version=txt(d.querySelector('.rwd-version'));
 r.mismo={ nombreCorto:w.eval("nunMismoCliente('Comercializadora Bustamante, S.A. de C.V.','COMERCIALIZADORA BUSTAMANTE SA DE CV')"), acentos:w.eval("nunMismoCliente('RICARDO RAUL OCAÑAS GOMEZ','Ricardo Raul Ocanas')"),
   distinto:w.eval("nunMismoCliente('JOSE LUIS HERNANDEZ MELO','CINTHYA KALID ALARCON HERNANDEZ')"), familia:w.eval("nunMismoCliente('NATALIA HERRERA CUAUTLE','FELIX CUAUTLE TECUAUTZIN')") };
 const A=w.eval("nunAuditoriaPedidosCalc()");
 r.calc={otro:A.otroCliente.map(x=>x.p.folio+'<'+x.d.folio), demas:A.demas.map(x=>x.p.folio), productos:A.productos.map(x=>x.d.folio+':'+x.fuera.join('/'))};
 // botón en Pedidos y ventana
 w.eval("navegar('pedidos')"); await sleep(600);
 r.boton=[...d.querySelectorAll('button')].some(b=>/Auditoría de ligas/.test(b.textContent));
 await w.eval("nunAuditoriaPedidos()"); await sleep(200);
 const m=txt(d.getElementById('modalAUD')); r.ventana={otro:/1109.*1078.*CINTHYA/.test(m), surtidoDeMas:/2\. Salió más de lo que se pidió 1/.test(m), productos:/RL001A/.test(m)};
 // aviso rojo en el pedido
 d.getElementById('modalAUD').remove(); w.eval("abrirDoc('pedidos','p1')"); await sleep(300);
 r.avisoPedido=/Ligado a documento\(s\) de OTRO cliente: 1078 \(CINTHYA/.test(txt(d.querySelector('.drawer')));
 // quitar liga: la factura se queda, solo pierde el pedido y queda nota
 w.eval("window.confirmDialog=async()=>true"); try{ w.eval("cerrarDrawer()"); }catch(e){}
 await w.eval("nunAuditoriaPedidos()"); await sleep(100); await w.eval("nunQuitarLiga(0)"); await sleep(300);
 const f=DB.facturas.find(x=>x.id==='f1078'); r.quitar={pedido:f.pedido_origen, nota:/Se quitó la liga con el pedido 1109 \(JOSE LUIS HERNANDEZ MELO, otro cliente\)/.test(f.notas||''), sigue:DB.facturas.length, estatus:f.estatus};
 r.despues=w.eval("nunAuditoriaPedidosCalc()").otroCliente.length;
 // candado: ligar a pedido de otro cliente pregunta; si dice que no, no se guarda
 let pregunta=''; w.eval("window.confirmDialog=async(o)=>{ window._preg=o.title+' '+o.message; return false; }");
 let err=''; try{ await w.eval("api({accion:'erp_upsert_batch',tabla:'facturas',items:[{id:'f1078',pedido_origen:'1109'}]})"); }catch(e){ err=e.message; }
 r.candado={pregunto:/OTRO cliente/.test(w._preg||'')&&/1109 es de JOSE LUIS/.test(w._preg||''), bloqueo:/otro cliente/.test(err), noGuardo:DB.facturas.find(x=>x.id==='f1078').pedido_origen===''};
 w.eval("window._preg=''"); await w.eval("api({accion:'erp_upsert_batch',tabla:'facturas',items:[{id:'f1078',pedido_origen:'1336'}]})");
 r.candado.mismoClienteSinPreguntar=!w._preg && DB.facturas.find(x=>x.id==='f1078').pedido_origen==='1336';
 if(!/v4\.(1\d|[2-9]\d)/.test(r.version)) r.fallas.push('version');
 if(!r.mismo.nombreCorto||!r.mismo.acentos||r.mismo.distinto||r.mismo.familia) r.fallas.push('mismoCliente');
 if(r.calc.otro.join()!=='1109<1078'||r.calc.demas.join()!=='1200'||r.calc.productos.join()!=='R0005:RL001A') r.fallas.push('calculo');
 if(!r.boton||!r.ventana.otro||!r.ventana.surtidoDeMas||!r.ventana.productos) r.fallas.push('ventana');
 if(!r.avisoPedido) r.fallas.push('avisoPedido');
 if(r.quitar.pedido!==''||!r.quitar.nota||r.quitar.sigue!==2||r.quitar.estatus!=='timbrada'||r.despues!==0) r.fallas.push('quitarLiga');
 if(!r.candado.pregunto||!r.candado.bloqueo||!r.candado.noGuardo||!r.candado.mismoClienteSinPreguntar) r.fallas.push('candado');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},4000);
