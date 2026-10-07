// v4.12 / app v1.9.19 — si la página abierta es vieja, sale un aviso para recargar (compara con la página publicada). Sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
function probar(archivo, ver, subir){
  return new Promise(res=>{
    const html=fs.readFileSync(archivo,'utf8'); const nueva=html.split(ver).join(subir);
    const vc=new VirtualConsole(); const errs=[]; vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,200)));
    let servir=html;
    const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/'+archivo,
      beforeParse(w){ w.fetch=async(u,o)=>{ if(String(u).includes('?_v=')) return {ok:true,text:async()=>servir}; return {ok:true,json:async()=>({ok:true,items:[]}),clone(){return this;},text:async()=>'{}'}; };
        w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
    const w=dom.window;
    setTimeout(async()=>{ const r={};
      try { await w.nunRevisarVersion(); r.mismaVersion=!w.document.getElementById('nunAvisoVersion');
        servir=nueva; await w.nunRevisarVersion(); const a=w.document.getElementById('nunAvisoVersion'); r.aviso=a?a.textContent.replace(/\s+/g,' ').slice(0,80):''; }
      catch(e){ r.error=String(e.stack).slice(0,300); }
      r.errs=errs.slice(0,2); w.close(); res(r); },3000);
  });
}
(async()=>{ const r={fallas:[]};
  const v=fs.readFileSync('index.html','utf8').match(/rwd-version">v4\.(\d+) · Sistema/)[1]; r.subida='v4.'+(+v+1); // la versión que haya
  r.erp=await probar('index.html','v4.'+v+' · Sistema','v4.'+(+v+1)+' · Sistema');
  const va=fs.readFileSync('crm.html','utf8').match(/letter-spacing:0\.05em">v1\.9\.(\d+)<\/span>/)[1]; r.subidaApp='v1.9.'+(+va+1);
  r.app=await probar('crm.html','v1.9.'+va+'</span>','v1.9.'+(+va+1)+'</span>');
  if(!r.erp.mismaVersion||r.erp.aviso.indexOf('versión nueva del sistema ('+r.subida+')')<0) r.fallas.push('erp');
  if(!r.app.mismaVersion||r.app.aviso.indexOf('versión nueva del sistema ('+r.subidaApp+')')<0) r.fallas.push('app');
  console.log(JSON.stringify(r,null,1)); })();
