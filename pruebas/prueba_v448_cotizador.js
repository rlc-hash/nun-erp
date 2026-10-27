// v4.48 — Cotizador de importación y márgenes: costo puesto por pieza (mercancía USD×TC + flete + pedimento + maniobras),
// precio por margen (÷ 0.6 = 40%), guardar compartido (kv nun_costeos), pasar costo a Productos y márgenes reales de lo vendido.
// Corre contra backend/Codigo.gs en el emulador de Supabase. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
(async()=>{
 const E=await import(path.join(__dirname,'..','supabase','functions','nun','emulador.js'));
 const fn=E.compilar(fs.readFileSync(path.join(__dirname,'..','backend','Codigo.gs'),'utf8'));
 const DB=new Map(); let PROPS={en_supabase:'1'}; const COD='RAFA-PRUEBA1';
 const servidor=async(tipo,payload)=>{ const r=await E.atender({fn,existentes:[...DB.keys()],props:PROPS,cargar:async ns=>new Map(ns.map(n=>[n,JSON.parse(JSON.stringify(DB.get(n)||[]))])),
   sesion:c=>String(c||'').toUpperCase()===COD,admin:c=>String(c||'').toUpperCase()===COD,tipo,payload});
   for(const s of r.sucias) DB.set(s.nombre,JSON.parse(JSON.stringify(s.filas))); if(r.props) PROPS=r.props; return r.texto; };
 const post=async b=>JSON.parse(await servidor('post',JSON.stringify(Object.assign({codigo:COD},b))));
 await post({accion:'inicializar'});
 await post({accion:'erp_crear',tabla:'productos',item:{id:'p1',sku:'RL009A',descripcion:'MALETA RL009 AZUL',costo:300,precio:500,stock_actual:0}});
 await post({accion:'erp_crear',tabla:'productos',item:{id:'p2',sku:'RL009N',descripcion:'MALETA RL009 NEGRO',costo:300,precio:500,stock_actual:0}});
 await post({accion:'erp_crear',tabla:'productos',item:{id:'p3',sku:'MOCH1',descripcion:'MOCHILA PRUEBA',costo:100,precio:200,stock_actual:0}});
 await post({accion:'erp_crear',tabla:'clientes',item:{id:'c1',razon_social:'CLIENTE PRUEBA'}});
 const it=(sku,c,p)=>({sku,descripcion:sku,cantidad:c,precio_unitario:p,iva_pct:16});
 const hoy=new Date().toISOString().slice(0,10);
 await post({accion:'erp_crear',tabla:'remisiones',item:{id:'r1',folio:'R0001',fecha:hoy,cliente:'CLIENTE PRUEBA',estatus:'entregada',subtotal:6000,iva:960,total:6960,_sin_inventario:true,
   items_json:JSON.stringify([it('RL009A',10,500),it('MOCH1',5,200)])}});
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  // 1) Su renglón del Excel: Carry On 2400 pzas × 8.7 USD × 18 + pedimento 160,000 + maniobras 80,000 + flete 124,000 = 739,840 → ÷0.6 ÷2400 = 513.78
  const c1={tc:18,margen:40,reparto:'valor',pedimento_real:'160000',gastos:{flete_mar:'124000',maniobras:'80000'},lineas:[{sku:'RL009',pzas:'2400',usd:'8.7'}]};
  const k1=JSON.parse(w.eval(`JSON.stringify(nunCosteoCalc(${JSON.stringify(c1)}))`));
  r.excel={costo:Math.round(k1.T.costo*100)/100,precio:Math.round(k1.filas[0].precio*100)/100};
  if(r.excel.costo!==739840||r.excel.precio!==513.78) r.fallas.push('excel');
  // 2) Arancel sobre valor en aduana (mercancía + flete marítimo), reparto por valor, IVA aparte y no es costo
  const c2={tc:20,margen:50,reparto:'valor',gastos:{flete_mar:'1000',flete_ter:'500'},lineas:[{sku:'A',pzas:'100',usd:'3',arancel:'10'},{sku:'B',pzas:'100',usd:'1',arancel:'0',margen:'30',precio_real:'40'}]};
  const k2=JSON.parse(w.eval(`JSON.stringify(nunCosteoCalc(${JSON.stringify(c2)}))`));
  // A: valor 6000, flete 750, arancel 675, terrestre 375 → 7800 / 100 = 78 → precio 156 · B: 2000+250+0+125 = 2375 → 23.75 → ÷0.7 = 33.93; real 40 → 40.6%
  r.c2=k2.filas.map(f=>[Math.round(f.costoU*100)/100,Math.round(f.precio*100)/100,f.margenReal==null?null:Math.round(f.margenReal*10)/10]);
  r.iva=Math.round(k2.T.iva*100)/100; // (6750+675+2250)*0.16 = 1548
  if(JSON.stringify(r.c2)!=='[[78,156,null],[23.75,33.93,40.6]]'||r.iva!==1548) r.fallas.push('calculo');
  const k3=JSON.parse(w.eval(`JSON.stringify(nunCosteoCalc(${JSON.stringify(Object.assign({},c2,{ivaCosto:true}))}))`));
  if(Math.round(k3.T.costo)!==Math.round(k2.T.costo+1548)) r.fallas.push('iva-costo');
  // 3) Pantalla: navegar, capturar, guardar compartido
  await w.eval("navegar('cotizador')"); await sleep(1500);
  r.titulo=txt(d.querySelector('.page-title h1'));
  if(r.titulo!=='Cotizador y márgenes') r.fallas.push('pantalla');
  w.eval("nunCotSet('nombre','Contenedor prueba')"); w.eval("nunCotSet('tc','18')"); w.eval("nunCotGasto('flete_mar','124000')"); w.eval("nunCotGasto('maniobras','80000')"); w.eval("nunCotSet('pedimento_real','160000')");
  w.eval("nunCotLinea(0,'sku','RL009')"); w.eval("nunCotLinea(0,'pzas','2400')"); w.eval("nunCotLinea(0,'usd','8.7')"); await sleep(300);
  r.kpi=txt(d.querySelector('#cotMount .kpi-grid'));
  if(!/739,840/.test(r.kpi)) r.fallas.push('kpi');
  await w.eval("nunCotGuardar()"); await sleep(800);
  const kv=await post({accion:'kv_leer'}); const guard=JSON.parse((kv.valores||{}).nun_costeos||'[]');
  r.guardados=guard.map(c=>c.nombre);
  if(guard.length!==1||guard[0].nombre!=='Contenedor prueba') r.fallas.push('kv');
  // 4) Pasar costo a Productos: RL009 no existe exacto → RL009A y RL009N (colores); solo costo
  w.eval("window.confirm=()=>false; window.confirmDialog=async()=>true");
  await w.eval("nunCotAplicarProductos()"); await sleep(1500);
  const prods=(await post({accion:'erp_listar',tabla:'productos'})).items; r.prods=prods.map(p=>p.sku+' '+p.costo+'/'+p.precio);
  if(!prods.filter(p=>/RL009/.test(p.sku)).every(p=>Math.abs(p.costo-308.27)<0.01&&+p.precio===500)||+prods.find(p=>p.sku==='MOCH1').costo!==100) r.fallas.push('productos');
  // 5) Márgenes reales: R0001 = 10 RL009A a 500 (costo 308.27) + 5 MOCH1 a 200 (costo 100)
  await w.eval("Promise.all(['remisiones','facturas','pedidos','productos','notascredito','cobranza'].map(t=>cargarTabla(t)))");
  const m=JSON.parse(w.eval("JSON.stringify(nunCotMargenesCalc(90))"));
  r.margen={venta:m.venta,costo:Math.round(m.costo*100)/100,margen:Math.round(m.margen*10)/10};
  if(m.venta!==6000||Math.round(m.costo*100)/100!==3582.7||r.margen.margen!==40.3) r.fallas.push('margenes');
  w.eval("nunCotTab('margenes')"); await sleep(300); r.tablaMargenes=d.querySelectorAll('#cotMount table.dt tbody tr').length;
  w.eval("nunCotTab('calc')"); w.eval("_cotEstado().calcCosto='300';_cotEstado().calcPrecio='500';renderCurrent()"); await sleep(200);
  r.calc=txt(d.querySelector('#cotMount .card')).slice(0,120);
  if(!/margen 40\.0%/.test(r.calc)) r.fallas.push('calc');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(4[8-9]|[5-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
