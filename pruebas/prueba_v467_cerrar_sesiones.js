// v4.67 — Usuarios: columna "Sesiones" (en cuántos dispositivos) con 🚪 Cerrar sesión, y 🚪 Cerrar sesión de todos (menos tú).
// Libera cada dispositivo (liberar_dispositivo) y pide al servidor que cierre sus sesiones (cerrar_sesiones). Códigos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const US=[{codigo:COD,nombre:'Rafa',rol:'admin',activo:true,dispositivos:[{id:'r1'}]},
  {codigo:'EDGAR-XX1',nombre:'Edgar',rol:'vendedor',vendedor_asignado:'EDGAR',activo:true,max_dispositivos:5,dispositivos:[{id:'e1',nombre:'Mac'},{id:'e2',nombre:'Tel'}]},
  {codigo:'LUIS-XX2',nombre:'Luis',rol:'vendedor',vendedor_asignado:'LUIS',activo:true,dispositivos:[{id:'l1'}]},
  {codigo:'VIEJO-XX3',nombre:'Viejo',rol:'vendedor',activo:false,dispositivos:[]}];
 const llamadas=[];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(/liberar|cerrar/.test(b.accion||'')) llamadas.push(b);
    if(b.accion==='liberar_dispositivo'){ const x=US.find(z=>z.codigo===b.codigo_usuario); x.dispositivos=x.dispositivos.filter(d=>d.id!==b.device_id); }
    const t=JSON.stringify(b.accion==='listar_usuarios'?{ok:true,usuarios:US}:b.accion==='cerrar_sesiones'?{ok:true,cerradas:b.codigos.length}:b.accion==='erp_listar'?{ok:true,items:[]}:{ok:true,valores:{}});
    return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  w.eval("confirmDialog = async () => true");
  await w.eval("cargarUsuarios()"); await w.eval("navegar('usuarios')"); await sleep(800);
  r.tabla=txt(d.getElementById('usrMount')).slice(0,400);
  if(!/2 de 5/.test(r.tabla)||!/tú/.test(r.tabla)||!/Cerrar sesión/.test(r.tabla)) r.fallas.push('columna');
  await w.eval("nunCerrarSesionesDe(['EDGAR-XX1'])"); await sleep(300);
  r.edgar=llamadas.map(b=>b.accion+':'+(b.device_id||(b.codigos||[]).join('+'))).join(' ');
  if(r.edgar!=='liberar_dispositivo:e1 liberar_dispositivo:e2 cerrar_sesiones:EDGAR-XX1') r.fallas.push('edgar');
  llamadas.length=0;
  await w.eval("nunCerrarSesionesTodos()"); await sleep(300);
  const cs=llamadas.find(b=>b.accion==='cerrar_sesiones'); r.todos=cs&&cs.codigos;
  if(!cs||cs.codigos.includes(COD)||cs.codigos.includes('VIEJO-XX3')||!cs.codigos.includes('LUIS-XX2')) r.fallas.push('todos');
  r.version=txt(d.querySelector('.rwd-version')); if(!/v4\.(6[7-9]|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
