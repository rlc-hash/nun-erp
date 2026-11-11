// v4.76 — en modo teléfono los renglones de productos (Editar cotización/pedido/factura) muestran Cantidad y Precio:
// las casillas para escribir ya no se esconden como "vacías". Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_modo','cel'); w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=JSON.stringify({ok:true,items:[],valores:{}}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
 await sleep(1500);
 const m=d.createElement('div'); m.innerHTML=`<table class="dt"><thead><tr><th>SKU</th><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Desc%</th><th>IVA%</th><th>IVA $</th><th>Total</th><th></th></tr></thead><tbody><tr>
  <td><input type="text" value="RL009PU"></td><td><input type="text" value="MALETA PP RL009 PÚRPURA SET 3 PZ"></td><td><input type="number" value="11"></td><td><input type="number" value="1650"></td>
  <td><input type="number" value="0"></td><td><select><option>16%</option><option selected>0%</option></select></td><td>$0.00</td><td>$18,150.00</td><td></td></tr></tbody></table>`;
 d.body.appendChild(m); w.eval('nunCelEtiquetar(document)');
 const td=[...m.querySelectorAll('tbody td')], vis=i=>!td[i].classList.contains('cel-vacio');
 const r={modoCel:d.body.classList.contains('modo-cel'),cantidad:vis(2)&&td[2].getAttribute('data-l')==='Cant.',precio:vis(3)&&td[3].getAttribute('data-l')==='Precio',sku:vis(0),vacioSigue:!vis(8),version:(d.querySelector('.rwd-version')||{}).textContent,errores:errs.slice(0,3)};
 const ok=r.modoCel&&r.cantidad&&r.precio&&r.sku&&r.vacioSigue;
 console.log(JSON.stringify(Object.assign(r,ok?{}:{error:'falla'}),null,1)); process.exit(0);
})().catch(e=>{console.log(JSON.stringify({error:String(e.stack).slice(0,500)}));process.exit(0);});
