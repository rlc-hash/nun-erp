// v4.50 — Costo de pieza suelta de un set (regla de Rafa): costo del set ÷ pulgadas del set × pulgadas de la pieza
// (SF004 y RL001 = set de 3, 60"; SF001–SF003 = set de 5, 112").
// ZSF00XY = set SF00X tamaño Y (1=18, 2=20, 3=22, 4=24, 5=28); maleta PP sin modelo = RL001; sin SKU se toma el código del inicio
// de la descripción. Documento con IVA usa el costo CON factura del producto (si lo tiene), igual que Márgenes reales.
// Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'DUENO-PRUEBA1',usuario:{codigo:'DUENO-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async()=>{ const t='{"ok":true,"items":[]}'; return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window;const sleep=t=>new Promise(z=>setTimeout(z,t));const r={fallas:[]};const ok=(c,m)=>{ if(!c) r.fallas.push(m); };
 await sleep(2500);
 try{
  const P=(d,s)=>w.nunCostoPiezaDeSet(d,s);
  const SF=w.eval('COSTOS_NUN.SF002'), RL=w.eval('COSTOS_NUN.RL001');
  r.piezas={zsf0025:P('ZSF0025 MALETA TELA AZUL 28 PULGADAS',''), zsf0042:P('ZSF0042 MALETA TELA AQUA 20 PULGADAS',''), pp22:P('MALETA PP 22 PULGADAS AZUL',''), conModelo:P('MALETA RL004 NEGRO','RL004N')};
  ok(r.piezas.zsf0025 && r.piezas.zsf0025.fam==='SF002' && r.piezas.zsf0025.pulg===28 && Math.abs(r.piezas.zsf0025.costo-SF/112*28)<0.01,'ZSF0025 = set SF002 ÷ 112 × 28');
  ok(r.piezas.zsf0042 && r.piezas.zsf0042.fam==='SF004' && r.piezas.zsf0042.pulg===20 && Math.abs(r.piezas.zsf0042.costo-w.eval('COSTOS_NUN.SF004')/60*20)<0.01,'ZSF0042 = SF004 (set de 3) ÷ 60 × 20');
  r.zsf0011=P('ZSF0011 MALETA TELA NEGRO 18 PULGADAS',''); ok(Math.abs(r.zsf0011.costo-291.54)<0.01,'ZSF0011 de 18" = $291.54 (como ya estaba en el sistema)');
  ok(r.piezas.pp22 && r.piezas.pp22.fam==='RL001' && Math.abs(r.piezas.pp22.costo-RL/60*22)<0.01,'maleta PP sin modelo = RL001 ÷ 60 × 22');
  ok(r.piezas.conModelo===null,'producto con modelo y sin pulgadas no usa la regla');
  const S=w.eval('State'); const it=(sku,desc,q,pu,iva)=>JSON.stringify([{sku,descripcion:desc,cantidad:q,precio_unitario:pu,iva_pct:iva}]);
  Object.assign(S.data,{productos:[{id:'p1',sku:'RL901N',descripcion:'MALETA RL901 NEGRO',costo:500,costo_factura:440}],
   remisiones:[{id:'r1',folio:'R0001',fecha:'2026-08-05',cliente:'A',estatus:'entregada',iva:0,total:1000,items_json:it('RL901N','MALETA RL901 NEGRO',1,1000,0)},
               {id:'r2',folio:'R0002',fecha:'2026-08-06',cliente:'A',estatus:'entregada',iva:0,total:3000,items_json:it('','ZSF0015 MALETA TELA NEGRO 28 PULGADAS',2,1500,0)}],
   facturas:[{id:'f1',folio:'FT0001',fecha:'2026-08-07',cliente:'B',estatus:'timbrada',iva:160,total:1160,items_json:it('RL901N','MALETA RL901 NEGRO',1,1000,16)}],
   pedidos:[],cobranza:[],notascredito:[],ingresos:[],gastos:[]});
  const {R,sinCosto}=w.nunEdrCalc(['2026-08']); const a=R['2026-08'];
  r.agosto={costo:a.costo,ventaSinCosto:a.ventaSinCosto,sinCosto:sinCosto.length};
  const esperado=500+440+2*(w.eval('COSTOS_NUN.SF001')/112*28);
  ok(Math.abs(a.costo-esperado)<0.05,'costo = 500 (remisión, sin factura) + 440 (factura, con factura) + 2 piezas ZSF0015');
  ok(a.ventaSinCosto===0 && sinCosto.length===0,'ya no quedan ventas sin costo');
  r.version=(w.document.querySelector('.rwd-version')||{}).textContent;
 }catch(e){ r.error=String(e&&e.stack||e).slice(0,600); }
 if(errs.length) r.erroresPagina=errs.slice(0,5);
 if(r.fallas.length) r.error='fallas: '+r.fallas.length;
 console.log(JSON.stringify(r,null,1)); process.exit(0);
})();
