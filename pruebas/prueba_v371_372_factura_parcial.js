const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const skus=['RL0083P','RL0083RD','RL0083N','RL0083L','RL0083A','RL0083R','RL0083GO','RL0083M','RL0083BE'];
const remItems=skus.map(s=>({sku:s,descripcion:s+' Sets de Maleta PP',cantidad:3,precio_unitario:1650,iva_pct:16}));
const DB={remisiones:[{id:'bind_rem_321',folio:321,cliente:'CLIENTE UNO DE PRUEBA',total:44550,subtotal:44550,iva:0,estatus:'pendiente',vendedor:'EDGAR',items_json:JSON.stringify(remItems)}],
 facturas:[{id:'f_old',folio:1178,cliente:'X',total:1}],cobranza:[{id:'cob_x',numero:321,total:44550}],clientes:[],productos:[],pedidos:[],usuarios:[],movinventario:[]};
const llamadas=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; llamadas.push(b); await new Promise(z=>setTimeout(z,60)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_crear'){ DB[b.tabla].push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=DB[b.tabla].find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   return J({ok:true,items:[],data:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window; const d=w.document; const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{ const r={};
 try{
  for (const t of ['remisiones','facturas']) await w.eval(`cargarTabla('${t}')`);
  // El botón del detalle de remisión llama a la ventana nueva
  r.botonViejoRedirige = /nunFacturarRemision\('\$\{id\}'\)/.test(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'));
  await w.eval("convertirDocConItems('remisiones','bind_rem_321','facturas')"); await sleep(50);
  r.abre=!!d.getElementById('modalFactRem');
  // Nada marcado → error
  await w.eval("nunFacturarRemisionCrear()"); r.errVacio=d.getElementById('frError').textContent;
  // Marcar 4 productos, uno con 2 piezas; sin elegir IVA → error
  const sel=[...d.querySelectorAll('.frSel')]; [0,1,2,3].forEach(i=>sel[i].checked=true); d.querySelector('.frCant[data-i="3"]').value='2';
  w.eval("nunFacturarRemisionTotal()");
  await w.eval("nunFacturarRemisionCrear()"); r.errIva=d.getElementById('frError').textContent;
  d.getElementById('frIva').value='mas'; w.eval("nunFacturarRemisionTotal()"); r.totalMas=d.getElementById('frTotales').textContent;
  d.getElementById('frIva').value='incluye'; w.eval("nunFacturarRemisionTotal()"); r.totalIncluye=d.getElementById('frTotales').textContent;
  d.getElementById('frIva').value='mas';
  // cantidad mayor a la remisión → error
  d.querySelector('.frCant[data-i="0"]').value='5'; await w.eval("nunFacturarRemisionCrear()"); r.errMax=d.getElementById('frError').textContent; d.querySelector('.frCant[data-i="0"]').value='3';
  await Promise.all([w.eval("nunFacturarRemisionCrear()"),w.eval("nunFacturarRemisionCrear()")]); await sleep(200);
  const nuevas=DB.facturas.filter(f=>f.id!=='f_old');
  r.facturasCreadas=nuevas.map(f=>({folio:f.folio,total:f.total,sub:f.subtotal,iva:f.iva,origen:f.pedido_origen,notas:f.notas,vend:f.vendedor,est:f.estatus,lineas:JSON.parse(f.items_json).map(l=>l.sku+'x'+l.cantidad)}));
  r.cobranzaNoCambia=DB.cobranza.length; r.movInv=llamadas.filter(x=>/mov_inventario|convertir_documento/.test(x.accion)).length;
  // Segunda vez: muestra lo ya facturado y solo deja lo que falta
  await w.eval("nunFacturarRemision('bind_rem_321')"); await sleep(50);
  r.segunda={titulo:d.querySelector('#modalFactRem h3').nextElementSibling.textContent, max0:d.querySelector('.frCant[data-i="0"]').max, dis0:d.querySelector('.frSel[data-i="0"]').disabled, max3:d.querySelector('.frCant[data-i="3"]').max, max8:d.querySelector('.frCant[data-i="8"]').max};
  // Resto con IVA incluido
  d.querySelectorAll('.frSel:not(:disabled)').forEach(c=>c.checked=true); d.getElementById('frIva').value='incluye';
  await w.eval("nunFacturarRemisionCrear()"); await sleep(200);
  const f2=DB.facturas.filter(f=>f.id!=='f_old')[1]; r.factura2=f2&&{folio:f2.folio,total:f2.total,sub:f2.subtotal,iva:f2.iva,notas:f2.notas,n:JSON.parse(f2.items_json).length,pu:JSON.parse(f2.items_json)[0].precio_unitario};
  // Alta a cobranza: una factura de remisión no se agrega
  r.altaCob=await w.eval("nunAltaCobranza('facturas',{id:'zz',folio:'FT0009',pedido_origen:'REM 321',total:5})");
  r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 }catch(e){ r.error=String(e.stack||e).slice(0,600);}
 r.errs=errs.slice(0,5); console.log(JSON.stringify(r,null,1)); w.close(); },4000);
