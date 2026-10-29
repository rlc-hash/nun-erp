// v4.53 — Adquisición de mercancía: solicitud de factura de compra con lo facturado del mes (reglas del prompt de Rafa):
// 80% del promedio ponderado por modelo redondeado; si queda a ±10% del precio de referencia se usa el de referencia; ML/Amazon aparte
// con su venta × 0.80; claves SAT por familia; avisos (modelo nuevo, diferencia con referencia, Público en General, canceladas, proveedor).
// Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', it=(sku,descripcion,cantidad,pu)=>({sku,descripcion,cantidad,precio_unitario:pu,iva_pct:16});
 const F=[
  {id:'f1',folio:'FT0101',fecha:'2026-10-05',cliente:'CLIENTE A',estatus:'timbrada',subtotal:0,items_json:JSON.stringify([it('RL001N','MALETA PP RL001 NEGRO',10,1350),it('SF003R','MALETA TELA SF003 ROJO',2,1500)])},
  {id:'f2',folio:'FT0102',fecha:'2026-10-08',cliente:'Público en General',estatus:'timbrada',notas:'Amazon ML, Sep',items_json:JSON.stringify([it('YH002N','MOCHILA YH002 NEGRO',2,290)])},
  {id:'f3',folio:'FT0103',fecha:'2026-10-09',cliente:'CLIENTE B',estatus:'cancelada',items_json:'[]'},
  {id:'f4',folio:'FT0099',fecha:'2026-09-30',cliente:'CLIENTE C',estatus:'timbrada',items_json:JSON.stringify([it('ZSF006N22','MALETA NYLON NEGRO 22',4,500),it('ZSF006G22','MALETA NYLON GRIS 22',1,450),it('YHO12R','MOCHILA',1,300)])}];
 const P=[{id:'p1',sku:'RL001N',descripcion:'MALETA PP RL001 NEGRO',costo:900,costo_factura:800}];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:{facturas:F,productos:P}[b.tabla]||[]}:{ok:true,valores:{},mensaje:'ok'}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  await w.eval("Promise.all([cargarTabla('facturas'),cargarTabla('productos')])");
  r.modelos=['RL0083GA','ZSF006A18','YHO12R','YH002N','SF006R'].map(s=>{const m=w.eval(`nunAdqModelo('${s}')`);return s+'→'+m.modelo+(m.z?' Z'+m.med:'')+(m.typo?' typo':'');});
  if(r.modelos.join()!=='RL0083GA→RL008,ZSF006A18→SF006 Z18,YHO12R→YH012 typo,YH002N→YH002,SF006R→SF006') r.fallas.push('modelo');
  w.eval("Object.assign(_adqEstado(),{mes:'2026-10',fecha:'2026-10-30',extra:['f4']})");
  const R=JSON.parse(w.eval("JSON.stringify((R=>({n:R.normal.map(p=>[p.q,p.desc,p.clave,p.pu]),m:R.ml.map(p=>[p.q,p.desc,p.clave,p.pu]),tn:R.totN,a:R.avisos.map(a=>a.t)}))(nunAdqCalc(_adqEstado())))"));
  r.R=R;
  // RL001: 1350×0.8=1080 → ref 1100 (±10%) · SF003: 1500×0.8=1200 nuevo · ZSF006-22: 500×0.8=400 nuevo, clave 53121503 · YH012 typo
  const busca=d=>R.n.find(p=>p[1].includes(d));
  if(!busca('RL001')||busca('RL001')[3]!==1100||busca('RL001')[2]!=='53121502') r.fallas.push('referencia');
  if(!busca('SF003')||busca('SF003')[3]!==1478) r.fallas.push('nuevo');
  if(!busca('22 PULGADAS')||busca('22 PULGADAS')[2]!=='53121503'||R.n.filter(p=>/22 PULGADAS/.test(p[1])).some(p=>p[3]!==360)) r.fallas.push('individual'); // v4.57 80% del más bajo (450) para todos los colores
  if(R.m.length!==0||!busca('MOCHILA YH002 NEGRO')||busca('MOCHILA YH002 NEGRO')[3]!==110) r.fallas.push('ml'); // v4.55 ML va junto
  ['nuevo','typo','canceladas'].forEach(t=>{ if(!R.a.includes(t)) r.fallas.push('aviso-'+t); });
  if(R.tn.sub!==+(R.n.reduce((s,p)=>s+p[0]*p[3],0)).toFixed(2)||R.tn.iva!==+(R.tn.sub*0.16).toFixed(2)) r.fallas.push('totales');
  // v4.54: carry on = 53121503 · referencia siempre (YH = 110)
  r.carry=w.eval("nunAdqClaveSat(nunAdqModelo('RL009CON'),'MALETA CARRY ON RL009','RL009CON')");
  if(r.carry!=='53121503'||!busca('MOCHILA YH012')||busca('MOCHILA YH012')[3]!==110) r.fallas.push('v454');
  // costo real
  const C=JSON.parse(w.eval("JSON.stringify(nunAdqCalc(Object.assign({},_adqEstado(),{metodo:'costo'})).normal.find(p=>/RL001/.test(p.desc)))"));
  if(C.pu!==800) r.fallas.push('costo');
  w.eval("navegar('adquisicion')"); await sleep(800); r.titulo=txt(d.querySelector('.page-title h1'));
  if(r.titulo!=='Adquisición de mercancía') r.fallas.push('pantalla');
  r.ultimoHabil=w.eval("[nunAdqUltimoHabil('2026-10'),nunAdqUltimoHabil('2026-11'),nunAdqUltimoHabil('2026-08')]");
  if(r.ultimoHabil.join()!=='2026-10-30,2026-11-30,2026-08-31') r.fallas.push('fecha');
  // v4.56 — sugerencias del final del mes anterior y lo agregado se queda guardado por mes
  w.eval("Object.assign(_adqEstado(),{mes:'2026-10',extra:[],fuera:[]})"); w.eval("renderCurrent()"); await sleep(300);
  r.sugeridas=[...d.querySelectorAll('#appMain button')].map(b=>txt(b)).filter(t=>/^＋ FT/.test(t));
  if(!r.sugeridas.some(t=>/FT0099/.test(t))) r.fallas.push('sugeridas');
  w.eval("nunAdqAgregar('f4')"); await sleep(400);
  const kv=JSON.parse(w.localStorage.getItem('nun_adquisicion')||'{}'); r.guardado=kv.meses&&kv.meses['2026-10'];
  if(!r.guardado||r.guardado.extra.join()!=='f4') r.fallas.push('guardar-mes');
  w.eval("nunAdqSet('mes','2026-09')"); w.eval("nunAdqSet('mes','2026-10')"); await sleep(200);
  if(w.eval("_adqEstado().extra.join()")!=='f4') r.fallas.push('recordar');
  // v4.57 — guardar fija el precio del modelo nuevo; cancelar una solicitud no la borra
  w.eval("window.confirmDialog=async()=>true");
  await w.eval("nunAdqGuardar()"); await sleep(300);
  const cfg=JSON.parse(w.localStorage.getItem('nun_adquisicion')||'{}'); r.refNueva=cfg.precios&&cfg.precios['ZSF006-22'];
  if(r.refNueva!==360) r.fallas.push('ref-nueva');
  await w.eval("nunAdqCancelarHist(0)"); await sleep(300);
  const cfg2=JSON.parse(w.localStorage.getItem('nun_adquisicion')||'{}'); r.hist=cfg2.historial.map(h=>h.estatus);
  if(r.hist.join()!=='cancelada') r.fallas.push('cancelar');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(5[7-9]|[6-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
