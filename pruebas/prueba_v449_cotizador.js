// v4.49 — Cotizador como el Excel de Rafa: un renglón por producto (MOQ, costo China USD, arancel aprox., flete/maniobras/pedimento/otros
// en USD o MXN), DOS precios (sin factura: IVA de importación es costo; con factura: se aparta y se cobra 16% al final), calcula mientras
// escribes sin redibujar, guarda compartido (kv nun_costeos), pasa costo/precio con y sin factura a Productos (servidor v0.9.17 agrega
// las columnas), márgenes reales (documento con IVA usa costo con factura) y calculadora con y sin factura.
// Base v4.48 — primer cotizador.
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
 await post({accion:'erp_crear',tabla:'remisiones',item:{id:'r1',folio:'R0001',fecha:hoy,cliente:'CLIENTE PRUEBA',estatus:'entregada',subtotal:6000,iva:0,total:6000,_sin_inventario:true,
   items_json:JSON.stringify([it('RL009A',10,500),it('MOCH1',5,200)])}});
 await post({accion:'erp_crear',tabla:'facturas',item:{id:'f1',folio:'FT0001',fecha:hoy,cliente:'CLIENTE PRUEBA',estatus:'timbrada',subtotal:6000,iva:960,total:6960,
   items_json:JSON.stringify([it('RL009A',10,600)])}});
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_costeos',JSON.stringify([{id:'viejo',nombre:'De la v4.48',fecha:'2026-10-27',tc:18,margen:40,reparto:'valor',pedimento_real:'160000',gastos:{flete_mar:'124000',maniobras:'80000'},lineas:[{sku:'RL009',pzas:'2400',usd:'8.7'}],estatus:'activo'}])); w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  const R2=x=>Math.round(x*100)/100;
  // 1) Renglón "Maleta" de su Excel: 8.7 USD × 2400, arancel 1.25, IVA 1.16, flete 7300 USD, maniobras 7000 USD, TC 17.5, ÷0.6
  const f1={moq:'2400',usd:'8.7',arancel:'1.25',tc:'17.5',flete:{monto:'7300',moneda:'USD'},maniobras:{monto:'7000',moneda:'USD'},pedimento:{monto:'',moneda:'MXN'},otros:{monto:'',moneda:'MXN'},margen:'40'};
  const a=JSON.parse(w.eval(`JSON.stringify(nunCotCalcFila(${JSON.stringify(f1)},{}))`));
  r.excel={sin:R2(a.pSin),conIva:R2(a.pFacIva)};
  if(r.excel.sin!==531.57||r.excel.conIva!==569.53) r.fallas.push('excel');
  // 2) Con pedimento real: IVA que se aparta = 16% del valor China en pesos; con factura = pedimento − ese IVA
  const f2={moq:'2400',usd:'8.7',arancel:'1.25',flete:{monto:'124000',moneda:'MXN'},maniobras:{monto:'80000',moneda:'MXN'},pedimento:{monto:'160000',moneda:'MXN'},otros:{monto:'',moneda:'MXN'}};
  const b=JSON.parse(w.eval(`JSON.stringify(nunCotCalcFila(${JSON.stringify(f2)},{tc:'18',margen:'40'}))`));
  r.ped={almacen:R2(b.almacen),cuSin:R2(b.cuSin),pSin:R2(b.pSin),cuFac:R2(b.cuFac),pFacIva:R2(b.pFacIva)};
  if(r.ped.almacen!==739840||r.ped.pSin!==513.78||r.ped.cuFac!==283.21||r.ped.pFacIva!==547.54) r.fallas.push('pedimento');
  // 3) Costeo guardado en la v4.48 se abre en el formato nuevo
  const mig=JSON.parse(w.eval("JSON.stringify(nunCosteoMigrar(JSON.parse(localStorage.getItem('nun_costeos'))[0]))"));
  r.migrado=mig.filas&&mig.filas.length===1&&mig.filas[0].pedimento.monto==='160000'&&R2(JSON.parse(w.eval(`JSON.stringify(nunCosteoCalc(${JSON.stringify(mig)}).T)`)).almacen)===739840;
  if(!r.migrado) r.fallas.push('migrar');
  // 4) Pantalla: escribir en la tarjeta calcula sin redibujar (no se pierde el cursor)
  w.localStorage.removeItem('nun_costeos'); w.localStorage.removeItem('nun_costeo_borrador');
  await w.eval("navegar('cotizador')"); await sleep(1500);
  r.titulo=txt(d.querySelector('.page-title h1'));
  if(r.titulo!=='Cotizador y márgenes') r.fallas.push('pantalla');
  const escribe=(id,v)=>{const e=d.getElementById(id); e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true})); return e;};
  const el0=escribe('cot_moq0','2400'); escribe('cot_usd0','8.7'); escribe('cot_arancel0','1.25'); escribe('cot_tc0','17.5');
  const card=()=>d.getElementById('cotRes0').closest('.cot-card');
  const monIn=k=>[...card().querySelectorAll('.cot-mon')].find(x=>x.querySelector('input').getAttribute('oninput').includes(`'${k}'`));
  const setMon=(k,v,mon)=>{const m=monIn(k); const i=m.querySelector('input'), s=m.querySelector('select'); s.value=mon; s.dispatchEvent(new w.Event('change',{bubbles:true})); i.value=v; i.dispatchEvent(new w.Event('input',{bubbles:true}));};
  setMon('flete','7300','USD'); setMon('maniobras','7000','USD');
  r.mismoInput=d.getElementById('cot_moq0')===el0;
  r.res0=txt(d.getElementById('cotRes0'));
  if(!r.mismoInput||!/531\.57/.test(r.res0)||!/569\.53/.test(r.res0)) r.fallas.push('en-vivo');
  w.eval("nunCotAgregarFila()"); await sleep(200);
  r.tarjetas=d.querySelectorAll('#cotMount .cot-card').length; // encabezado + 2
  if(r.tarjetas!==3) r.fallas.push('agregar');
  w.eval("nunCotQuitarFila(1)"); await sleep(200);
  escribe('cot_sku0','RL009');
  w.eval("nunCotSet('nombre','Contenedor prueba')");
  await w.eval("nunCotGuardar()"); await sleep(800);
  const kv=await post({accion:'kv_leer'}); const guard=JSON.parse((kv.valores||{}).nun_costeos||'[]');
  r.guardados=guard.map(c=>c.nombre+' '+(c.filas||[]).length);
  if(guard.length!==1||guard[0].nombre!=='Contenedor prueba'||guard[0].v!==2) r.fallas.push('kv');
  // 5) Pasar a Productos: RL009 → RL009A y RL009N; costo/precio sin factura y con factura (columnas nuevas del servidor)
  w.eval("window.confirmDialog=async()=>true");
  await w.eval("nunCotAplicarProductos()"); await sleep(1500);
  const prods=(await post({accion:'erp_listar',tabla:'productos'})).items; r.prods=prods.map(p=>p.sku+' '+p.costo+'/'+p.precio+' fac '+p.costo_factura+'/'+p.precio_factura);
  const rl=prods.filter(p=>/RL009/.test(p.sku));
  if(rl.length!==2||!rl.every(p=>+p.precio===531.57&&+p.precio_factura===490.97&&+p.costo===318.94&&+p.costo_factura===294.58)||+prods.find(p=>p.sku==='MOCH1').costo!==100) r.fallas.push('productos');
  // 6) Márgenes reales: remisión sin IVA usa costo (318.94); factura con IVA usa costo con factura (294.58)
  await w.eval("Promise.all(['remisiones','facturas','pedidos','productos','notascredito','cobranza'].map(t=>cargarTabla(t)))");
  const m=JSON.parse(w.eval("JSON.stringify(nunCotMargenesCalc(90))"));
  r.margen={venta:m.venta,costo:R2(m.costo),margen:Math.round(m.margen*10)/10};
  // venta 5000+1000+6000=12000; costo 10×318.94 + 5×100 + 10×294.58 = 6635.2
  if(m.venta!==12000||R2(m.costo)!==6635.2) r.fallas.push('margenes');
  w.eval("nunCotTab('margenes')"); await sleep(300); r.tablaMargenes=d.querySelectorAll('#cotMount table tbody tr').length;
  // 7) Calculadora: costo 300, vendo en 500 → sin factura (costo 348) 30.4%; con factura 40.0%; 40% → 580 / 500 + IVA = 580
  w.eval("nunCotTab('calc')"); await sleep(200);
  const ci=[...d.querySelectorAll('#cotMount input')]; ci[0].value='300'; ci[0].dispatchEvent(new w.Event('input')); ci[1].value='500'; ci[1].dispatchEvent(new w.Event('input'));
  r.calc=txt(d.getElementById('cotCalcRes')).slice(0,260);
  if(!/30\.4%/.test(r.calc)||!/40\.0%/.test(r.calc)||!/\$580\.00/.test(r.calc)) r.fallas.push('calc');
  r.version=txt(d.querySelector('.rwd-version'));
  if(!/v4\.(49|[5-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
