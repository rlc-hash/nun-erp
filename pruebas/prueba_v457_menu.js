// v4.57 — Menú: ⭐ Favoritos (Clientes, Productos, Pedidos, Facturas, Remisiones, Cobranza) y 🕘 Recientes arriba; sección Contabilidad
// (Estados Financieros, Resultados por mes, Cotizador, Adquisición); Cuadre Excel e Importar CFDI en Herramientas; botones de Bind escondidos.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=JSON.stringify({ok:true,items:[],valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  const orden=[...d.querySelectorAll('.app-sidenav > .nav-section, .app-sidenav > .nav-btn')].map(e=>e.classList.contains('nav-section')?'#'+txt(e):e.dataset.mod+(e.classList.contains('nav-fav')?'*':''));
  const sec=n=>{const i=orden.indexOf('#'+n); const out=[]; for(let j=i+1;j<orden.length&&!orden[j].startsWith('#');j++) out.push(orden[j]); return out;};
  r.favoritos=sec('⭐ Favoritos'); r.contabilidad=sec('Contabilidad'); r.herramientas=sec('Herramientas'); r.ventas=sec('Ventas');
  if(r.favoritos.join()!=='clientes*,productos*,pedidos*,facturas*,remisiones*,cobranza*') r.fallas.push('favoritos');
  if(r.contabilidad.join()!=='estados_fin,resultados_mes,cotizador,adquisicion') r.fallas.push('contabilidad');
  if(r.herramientas.join()!=='cuadre,import_cfdi') r.fallas.push('herramientas');
  if(r.ventas.some(m=>/cuadre|import_cfdi|cotizador|adquisicion/.test(m))) r.fallas.push('ventas');
  r.favVisible=d.getElementById('navFavSec').style.display!=='none'; if(!r.favVisible) r.fallas.push('fav-titulo');
  // recientes
  w.eval("navegar('comisiones')"); await sleep(300); w.eval("navegar('gastos')"); await sleep(300);
  r.recientes=[...d.querySelectorAll('#navRecSec ~ .nav-fav')].filter(b=>{let p=b.previousElementSibling; while(p&&!p.classList.contains('nav-section')) p=p.previousElementSibling; return p&&p.id==='navRecSec';}).map(b=>b.dataset.mod);
  if(r.recientes[0]!=='gastos'||!r.recientes.includes('comisiones')) r.fallas.push('recientes');
  r.activoFav=!!d.querySelector('.nav-fav.active')===false; // gastos no está en favoritos pero sí en recientes → activo
  if(!d.querySelector('.nav-fav.active[data-mod="gastos"]')) r.fallas.push('activo');
  // Bind escondido
  r.cssBind=[...d.querySelectorAll('style')].some(s=>s.textContent.includes('button[onclick*="Bind"]'));
  if(!r.cssBind) r.fallas.push('bind');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(5[7-9]|[6-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
