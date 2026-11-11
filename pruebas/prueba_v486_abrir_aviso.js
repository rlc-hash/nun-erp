// v4.86 (Rafa: "la notificación me lleva al sistema; que me lleve directo") — al tocar el aviso el ERP abre ESE documento:
// liga ?ir=cotizaciones&id=… al abrir la app, y mensaje del service worker con la app ya abierta (cobro, factura por folio, pago por verificar).
// Si la lista todavía no llega, espera y lo abre cuando llega. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1'; let LENTO=0;
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE X'}],cotizaciones:[{id:'q1',folio:'C0016',fecha:'2026-11-11',cliente:'CLIENTE X',estatus:'enviada',total:3300,items_json:'[]'}],
  pedidos:[{id:'p1',folio:'P0051',fecha:'2026-11-11',cliente:'CLIENTE X',estatus:'confirmado',total:3300,items_json:'[]'}],facturas:[{id:'f1',folio:'FT0001',fecha:'2026-11-11',cliente:'CLIENTE X',estatus:'timbrada',total:500,items_json:'[]'}],
  cobranza:[{id:'k1',cliente:'CLIENTE X',tipo:'Pedido',numero:'P0051',total:3300,cobrado:0,pendiente:3300,estatus:'pendiente',factura_origen:'p1',fecha_entrega:'2026-11-11'}],
  pagosverificar:[{id:'pv1',cobro_id:'k1',cliente:'CLIENTE X',monto:40,estatus:'por_verificar',vendedor:'EDGAR',fecha:'2026-11-11'}],remisiones:[],ingresos:[]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/?ir=cotizaciones&id=q1',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar'){ if(LENTO&&b.tabla==='facturas') await sleep(LENTO); x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))}; }
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; const titulo=()=>((d.getElementById('drawerTitle')||{}).textContent||'')+' '+((d.getElementById('drawerSub')||{}).textContent||'');
 // 1) se abre la app desde el aviso (liga con ?ir=…&id=…)
 for(let i=0;i<15&&!/C0016/.test(titulo());i++) await sleep(500);
 r.alAbrir=titulo().replace(/\s+/g,' ').trim(); if(!/C0016/.test(r.alAbrir)) r.fallas.push('al abrir: cotización');
 r.ligaLimpia=!/ir=/.test(w.location.search); if(!r.ligaLimpia) r.fallas.push('liga limpia');
 w.eval('cerrarDrawer()');
 // 2) con la app abierta: el service worker manda el mensaje
 w.eval("nunIrA('cobranza',{id:'k1'})"); await sleep(1500); r.cobro=titulo().replace(/\s+/g,' ').trim(); if(!/P0051/.test(r.cobro)||!/CLIENTE X/.test(r.cobro)) r.fallas.push('cobro'); w.eval('cerrarDrawer()');
 w.eval("nunIrA('pedidos',{id:'p1'})"); await sleep(1500); r.pedido=titulo().replace(/\s+/g,' ').trim(); if(!/P0051/.test(r.pedido)) r.fallas.push('pedido'); w.eval('cerrarDrawer()');
 w.eval("nunIrA('cobranza',{pv:'pv1'})"); await sleep(1500); r.pv=!!d.getElementById('modalPV'); if(!r.pv) r.fallas.push('pago por verificar'); d.getElementById('modalPV')&&d.getElementById('modalPV').remove();
 // 3) factura por folio que todavía no está en pantalla (la lista llega tarde)
 w.eval("State.data.facturas=[]"); DB.facturas.push({id:'f2',folio:'FT0002',fecha:'2026-11-11',cliente:'CLIENTE X',estatus:'timbrada',total:900,items_json:'[]'}); LENTO=1500;
 w.eval("nunIrA('facturas',{folio:'ft0002'})"); for(let i=0;i<16&&!/FT0002/.test(titulo());i++) await sleep(500);
 r.facturaTarde=titulo().replace(/\s+/g,' ').trim(); if(!/FT0002/.test(r.facturaTarde)) r.fallas.push('factura que llega tarde');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
