// v4.04 / v1.9.16 — Google a veces responde una página de error (404 HTML) en vez de datos: en el ERP y en la app de vendedores las
// LECTURAS se reintentan solas y las escrituras NO se repiten (aviso claro, sin "Unexpected token <"). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const HTML='<!DOCTYPE html><html><body>Not Found</body></html>';
function abrir(archivo, sesionKey, sesion){ return new Promise(res=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,200)));
 const log=[]; let fallasPendientes=0;
 const dom=new JSDOM(fs.readFileSync(archivo,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/'+archivo,
  beforeParse(w){ if(sesionKey) w.localStorage.setItem(sesionKey,JSON.stringify(sesion));
   w.Response=w.Response||class{ constructor(b,o){ this._b=b; this.status=(o&&o.status)||200; this.ok=this.status<300; } clone(){ return new w.Response(this._b,{status:this.status}); } async text(){ return this._b; } async json(){ return JSON.parse(this._b); } };
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; log.push(b.accion||'GET'); await new Promise(z=>setTimeout(z,5));
     if(fallasPendientes>0){ fallasPendientes--; return new w.Response(HTML,{status:404}); }
     return new w.Response(JSON.stringify(b.accion==='erp_listar'?{ok:true,items:[{id:'x1'}]}:{ok:true,items:[]}),{status:200}); };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
  }});
 setTimeout(()=>res({w:dom.window,log,falla:n=>{fallasPendientes=n;},errs,dom}),3000); }); }
(async()=>{ const r={};
 try{
  // ERP
  const E=await abrir('index.html','nun_sesion_v2',{codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1});
  E.w.eval("window.setTimeout0=setTimeout"); 
  let n0=E.log.length; E.falla(2); const lec=await E.w.eval("api({accion:'erp_listar',tabla:'remisiones'})"); r.erpLectura={ok:lec.ok,items:(lec.items||[]).length,intentos:E.log.length-n0};
  n0=E.log.length; E.falla(1); let msg=''; try{ await E.w.eval("api({accion:'capturar_pago_cliente',id_doc:'c1',monto:10})"); }catch(e){ msg=e.message; } r.erpEscritura={intentos:E.log.length-n0,msg};
  E.dom.window.close();
  // App de vendedores
  const C=await abrir('crm.html');
  n0=C.log.length; C.falla(1); const t1=await C.w.eval("fetch('https://script.google.com/macros/s/XYZ/exec',{method:'POST',body:JSON.stringify({accion:'erp_listar',tabla:'pedidos'})}).then(x=>x.json())"); r.crmLectura={ok:t1.ok,intentos:C.log.length-n0};
  n0=C.log.length; C.falla(1); const t2=await C.w.eval("fetch('https://script.google.com/macros/s/XYZ/exec',{method:'POST',body:JSON.stringify({accion:'erp_crear',tabla:'pedidos',item:{}})}).then(x=>x.json())"); r.crmEscritura={ok:t2.ok,intentos:C.log.length-n0,msg:t2.error};
  r.crmVersion=(C.w.document.body.innerHTML.match(/v1\.9\.\d+/)||[''])[0];
  r.erpVersion=(E.w.document.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)||[''])[0];
  C.dom.window.close();
 }catch(e){ r.error=String(e.stack).slice(0,500); }
 r.fallas=[];
 if(!r.erpLectura||!r.erpLectura.ok||r.erpLectura.items!==1||r.erpLectura.intentos!==3) r.fallas.push('erpLectura');
 if(!r.erpEscritura||r.erpEscritura.intentos!==1||!/no confirmó.*si sí se guardó/.test(r.erpEscritura.msg)) r.fallas.push('erpEscritura');
 if(!r.crmLectura||!r.crmLectura.ok||r.crmLectura.intentos!==2) r.fallas.push('crmLectura');
 if(!r.crmEscritura||r.crmEscritura.ok!==false||r.crmEscritura.intentos!==1||!/no confirmó/.test(r.crmEscritura.msg||'')) r.fallas.push('crmEscritura');
 if(!/^v1\.9\.(1[6-9]|[2-9]\d)$/.test(r.crmVersion)) r.fallas.push('crmVersion');
 console.log(JSON.stringify(r,null,1)); process.exit(0);
})();
