const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={remisiones:[{id:'bind_rem_302',folio:302,cliente:'RICARDO',fecha:'2026-09-07T06:00:00.000Z',total:11590,estatus:'pendiente',items_json:'[]'},{id:'r2',folio:'R0001',cliente:'OTRO',fecha:'2026-09-29',total:5,items_json:'[]'}],cobranza:[{id:'bind_cob_302',numero:'V01302',total:11590,pendiente:11590}],ingresos:[{id:'i1',fecha:'2026-09-07T06:00:00.000Z',cliente:'X',monto:1}],usuarios:[]};
const sent=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/#/remisiones',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion!=='erp_listar')sent.push(b); await new Promise(z=>setTimeout(z,20)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='listar_cuentas') return J({ok:true,cuentas:[{nombre:'BBVA',activa:true},{nombre:'BBVA',activa:true},{nombre:'Efectivo',activa:true}]});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['remisiones','cobranza']) await w.eval(`cargarTabla('${t}')`); await w.eval('cargarCuentas()');
 r.cuentas=w.eval("State.data.cuentas.map(c=>c.nombre)");
 w.eval("abrirDoc('remisiones','bind_rem_302')"); await sleep(100); r.fechaForm=d.getElementById('dFecha').value;
 w.eval("cerrarDrawer()"); await sleep(50);
 w.eval("navegar('remisiones')"); await sleep(300);
 let renders=0; const orig=w.eval('renderCurrent'); w.eval("window._rc=0; const _r=renderCurrent; renderCurrent=function(){window._rc++; return _r.apply(this,arguments)}");
 w.eval("dtSearch('dt_remisiones','OTRO')"); await sleep(300);
 r.busqueda={renderCompleto:w.eval('window._rc'), filas:d.querySelectorAll('#dtMountDoc_remisiones tbody tr').length, texto:(d.querySelector('#dtMountDoc_remisiones tbody')||{}).textContent.slice(0,60)};
 const h=w.eval("buildFormHTML(SCHEMAS.ingresos||Object.values(SCHEMAS).find(s=>s.fields.some(f=>f.type==='date')),{fecha:'2026-09-07T06:00:00.000Z'})"); r.fechaGenerica=(h.match(/type="date"[^>]*value="([^"]*)"/)||h.match(/value="([^"]*)"[^>]*type="date"/)||[])[1];
}catch(e){r.error=String(e.stack).slice(0,400)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3000);
