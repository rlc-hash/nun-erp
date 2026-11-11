// v4.88 (Rafa 11 nov) — (1) el % de comisión sale solo según el vendedor (EDGAR 6, LUIS 5…) aunque la cotización de la app venga sin %;
// (2) "✅ Confirmar → Pedido" en el editor primero GUARDA lo corregido (cantidad/precio) y luego confirma. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const ENV=[]; const DB={clientes:[{id:'c1',razon_social:'CLIENTE X',vendedor:'EDGAR'}],cotizaciones:[{id:'q1',folio:'C0016',fecha:'2026-11-11',cliente:'CLIENTE X',vendedor:'EDGAR',comision_pct:'',estatus:'enviada',total:21600,items_json:JSON.stringify([{sku:'RL009CON',descripcion:'CARRY ON',cantidad:36,precio_unitario:600,iva_pct:0}])},
   {id:'q2',folio:'C0017',fecha:'2026-11-11',cliente:'CLIENTE X',vendedor:'LUIS',estatus:'enviada',total:1,items_json:'[]'}],productos:[{id:'p1',sku:'RL009CON',descripcion:'CARRY ON',precio:550}]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion&&!/^(erp_listar|kv_leer|listar_|obtener_|archivo_)/.test(b.accion)) ENV.push(b);
     let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     if(b.accion==='confirmar_cotizacion') x={ok:true,pedido:{id:'ped1',folio:'P0060',cliente:'CLIENTE X',total:3600},cobro:{id:'cob_ped1',cliente:'CLIENTE X',numero:'P0060',total:3600,pendiente:3600}};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(2500);
 for(const t of ['clientes','cotizaciones','productos']) await w.eval(`cargarTabla('${t}')`);
 w.confirmDialog=async()=>true; w.eval('confirmDialog=async()=>true');
 w.eval("abrirDoc('cotizaciones','q2')"); await sleep(300); r.luis=d.getElementById('dComisionPct').value; if(r.luis!=='5') r.fallas.push('LUIS 5%'); w.eval('cerrarDrawer()');
 w.eval("abrirDoc('cotizaciones','q1')"); await sleep(300); r.edgar=d.getElementById('dComisionPct').value; if(r.edgar!=='6') r.fallas.push('EDGAR 6%');
 // corrige 36 → 6 (sin tocar Guardar) y toca Confirmar → Pedido
 w.eval("docCambiarItem(0,'cantidad','6')");
 const btn=[...d.querySelectorAll('button')].find(b=>/Confirmar → Pedido/.test(b.textContent)); r.boton=!!btn; if(!btn) r.fallas.push('botón'); else btn.click();
 await sleep(1500);
 const g=ENV.findIndex(x=>x.accion==='erp_upsert_batch'&&x.tabla==='cotizaciones'), c=ENV.findIndex(x=>x.accion==='confirmar_cotizacion');
 r.orden=ENV.map(x=>x.accion+(x.tabla?':'+x.tabla:'')).filter(x=>/cotizacion|confirmar/.test(x));
 const it=g>=0?ENV[g].items[0]:{}; r.guardado={cantidad:JSON.parse(it.items_json||'[]').map(i=>i.cantidad).join(),total:it.total,pct:it.comision_pct};
 if(!(g>=0&&c>g)) r.fallas.push('guarda ANTES de confirmar'); if(!(r.guardado.cantidad==='6'&&r.guardado.total===3600&&r.guardado.pct===6)) r.fallas.push('guardó lo corregido con %');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
