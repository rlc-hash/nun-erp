// v3.83 — Unificar catálogo: el vendedor de la lista de la app (ClientesCatalogo) pasa a Clientes, primero en revisión. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={clientes:[{id:'c1',razon_social:'JUAN PEREZ LOPEZ',vendedor:''},{id:'c2',razon_social:'MARIA GARCIA RUIZ',vendedor:'LUIS'},{id:'c3',razon_social:'PEDRO SOTO DIAZ',vendedor:'EDGAR'},{id:'c4',razon_social:'ANA LUNA',vendedor:''}],
 clientescat:[{id:'k1',nombre:'Juan Pérez López',vendedor:'EDGAR'},{id:'k2',nombre:'Maria Garcia',vendedor:'EDGAR',notas:'Vendedor antes: LUIS hasta 2026-04-30'},{id:'k3',nombre:'PEDRO SOTO DIAZ',vendedor:'EDGAR'},{id:'k4',nombre:'Cliente Nuevo Catalogo',vendedor:'ESTEBAN'}],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='erp_crear'){ const it=Object.assign({id:'nuevo_'+DB[b.tabla].length},b.item); DB[b.tabla].push(it); return J({ok:true,item:it}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 await w.eval("cargarTabla('clientes')"); w.eval("navegar('clientes')"); await sleep(300);
 r.boton=!![...d.querySelectorAll('button')].find(b=>b.textContent.includes('Unificar catálogo'));
 await w.eval("nunUnificarCatalogo()"); await sleep(200);
 r.tipos=w.eval("window._nunUC.filas.map(f=>f.cat.id+':'+f.tipo+(f.cli?'>'+f.cli.id:''))");
 r.sinVendedor=w.eval("window._nunUC.sinVendedor.map(c=>c.id)");
 r.marcadasDefault=[...d.querySelectorAll('#modalUC .ucChk:checked')].length;
 [...d.querySelectorAll('#modalUC .ucChk')].forEach(x=>x.checked=true);
 w.eval("window.confirmDialog=async()=>true"); await w.eval("nunUnificarGuardar()"); await sleep(200);
 const up=enviados.filter(b=>b.accion==='erp_upsert_batch').flatMap(b=>b.items);
 r.guardado={campos:[...new Set(up.flatMap(i=>Object.keys(i)))].sort().join(','),c1:DB.clientes.find(c=>c.id==='c1').vendedor,c2:DB.clientes.find(c=>c.id==='c2').vendedor,c2notas:DB.clientes.find(c=>c.id==='c2').notas,
   alta:DB.clientes.filter(c=>/^nuevo_/.test(c.id)).map(c=>c.razon_social+'/'+c.vendedor),borro:enviados.some(b=>/eliminar/.test(b.accion||''))};
 r.fallas=[]; if(!r.boton) r.fallas.push('boton');
 if(r.tipos.join()!=='k1:llenar>c1,k2:distinto>c2,k3:cuadra>c3,k4:sin_cliente') r.fallas.push('tipos');
 if(r.sinVendedor.join()!=='c4'||r.marcadasDefault!==1) r.fallas.push('revision');
 if(r.guardado.campos!=='id,notas,vendedor'||r.guardado.c1!=='EDGAR'||r.guardado.c2!=='EDGAR'||!/Vendedor antes: LUIS/.test(r.guardado.c2notas||'')||r.guardado.alta.join()!=='Cliente Nuevo Catalogo/ESTEBAN'||r.guardado.borro) r.fallas.push('guardar');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
