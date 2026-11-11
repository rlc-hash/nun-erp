// v4.81 (Rafa 11 nov: "olvídalo, por pieza está mejor"): con NUN_CARRY_CAJA = false el PDF muestra el carry on POR PIEZA aunque el renglón traiga pz_caja.
// v4.78 / app v2.1.14 (Rafa 11 nov) — carry on por CAJA en el documento: el renglón se guarda en piezas (inventario y apartado en piezas)
// con pz_caja: 6; el PDF (ERP y app) lo muestra como N cajas × precio de la caja, "caja de 6 pz (pieza $550.00)", con el mismo total.
// Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1';
 const its=[{sku:'RL010CON',descripcion:'CARRY ON PP RL010CO NEGRO',cantidad:18,precio_unitario:550,iva_pct:0,pz_caja:6},
  {sku:'RL009COR',descripcion:'CARRY ON PP RL009CO ROSA · 33 sets de 6 pz',cantidad:6,precio_unitario:510,iva_pct:0,pz_caja:6},
  {sku:'RL009CON',descripcion:'CARRY ON PP RL009CO NEGRO',cantidad:4,precio_unitario:550,iva_pct:0,pz_caja:6},
  {sku:'RL009N',descripcion:'MALETA PP RL009 NEGRO SET 3 PZ',cantidad:2,precio_unitario:1650,iva_pct:0,unidad:'juego'}];
 const cot={id:'q1',folio:'C0004',fecha:'2026-11-09',cliente:'CLIENTE X',vendedor:'LUIS',estatus:'enviada',sin_iva:true,subtotal:17670,iva:0,total:17670,items_json:JSON.stringify(its)};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async()=>{ const t=JSON.stringify({ok:true,items:[],valores:{}}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(1500);
 const L=w.eval('(x)=>nunLineaCaja(x)');
 r.caja=L(its[0]); if(!(r.caja.cant===18&&r.caja.unidad==='pieza'&&r.caja.pu===550&&r.caja.desc==='CARRY ON PP RL010CO NEGRO')) r.fallas.push('por pieza');
 r.sinSets=L(its[1]).desc; if(L(its[1]).cant!==6||L(its[1]).pu!==510) r.fallas.push('pieza a 510');
 r.noCompleta=L(its[2]); if(!(r.noCompleta.cant===4&&r.noCompleta.pu===550&&r.noCompleta.unidad==='pieza')) r.fallas.push('incompleta queda en piezas');
 r.set3=L(its[3]); if(!(r.set3.cant===2&&r.set3.unidad==='juego')) r.fallas.push('set de 3 igual');
 // PDF completo
 let html=''; w.eval(`State.data.cotizaciones=[${JSON.stringify(cot)}]; State.data.clientes=[{id:'c',razon_social:'CLIENTE X'}];`);
 w.URL.createObjectURL=b=>{ html=b; return 'blob:x'; }; w.open=()=>({print(){}});
 w.eval("imprimirDocumento('cotizaciones','q1')"); html=await html.text();
 const td=new JSDOM(html).window.document; const filas=[...td.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(x=>x.textContent.trim()));
 r.fila=filas[0]; if(!(filas[0][2]==='18'&&filas[0][3]==='pieza'&&filas[0][4]==='$550.00'&&filas[0][6]==='$9,900.00')) r.fallas.push('pdf renglón');
 r.total=/\$17,670\.00/.test(html); if(!r.total) r.fallas.push('total');
 // nun-pdf.js (app de vendedores) trae la misma función
 r.app=/function nunLineaCaja\(it\)/.test(fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')); if(!r.app) r.fallas.push('nun-pdf.js');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
