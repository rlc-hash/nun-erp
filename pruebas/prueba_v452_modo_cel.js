// v4.52 — Botón 📱/💻 arriba: modo TELÉFONO (listas en tarjetas con el título de cada dato, barra de botones abajo) y modo COMPU.
// Se recuerda en localStorage nun_modo. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const items={pedidos:[{id:'p1',folio:'P0001',fecha:'2026-10-20',cliente:'CLIENTE PRUEBA',vendedor:'EDGAR',estatus:'confirmado',total:1160,items_json:'[]'}],clientes:[{id:'c1',razon_social:'CLIENTE PRUEBA'}]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_modo','cel'); w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:items[b.tabla]||[]}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  r.cel=d.body.classList.contains('modo-cel'); r.boton=txt(d.getElementById('nunModoBtn'));
  r.barra=[...d.querySelectorAll('#nunBarraCel button')].map(b=>txt(b));
  if(!r.cel||r.boton!=='📱'||r.barra.length!==5) r.fallas.push('modo-cel');
  w.eval("nunBarraIr('pedidos')"); await sleep(1500);
  const td=d.querySelector('table.dt tbody tr td:nth-child(2)'); r.etiqueta=td&&td.getAttribute('data-l');
  r.activo=txt(d.querySelector('#nunBarraCel button.activo'));
  if(!r.etiqueta||!/Pedidos/.test(r.activo)) r.fallas.push('tarjetas');
  // v4.59 — tarjeta de cliente: el nombre es el título (no el RFC)
  w.eval("nunBarraIr('clientes')"); await sleep(1500);
  r.titCliente=txt(d.querySelector('table.dt tbody tr td.cel-tit'));
  if(r.titCliente!=='CLIENTE PRUEBA') r.fallas.push('titulo-cliente');
  w.eval("nunCambiarModo()"); await sleep(300);
  r.compu=!d.body.classList.contains('modo-cel')&&w.localStorage.getItem('nun_modo')==='compu'&&txt(d.getElementById('nunModoBtn'))==='💻';
  if(!r.compu) r.fallas.push('compu');
  w.eval("nunCambiarModo()"); await sleep(300);
  if(!d.body.classList.contains('modo-cel')) r.fallas.push('regresa');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(59|[6-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
