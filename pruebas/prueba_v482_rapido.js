// v4.82 (Rafa 11 nov: "se tarda") — con el servidor LENTO (cada lista tarda 3 s): confirmar una cotización pone al día la lista al momento
// (deja de decir "por confirmar", aparece el pedido y su cobro), el Estado de cuenta abre al instante y Cuadrar por cliente no espera
// las listas que ya están. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1'; let LENTO=0; const CALLS=[];
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE X'}],cotizaciones:[{id:'q1',folio:'C0016',fecha:'2026-11-11',cliente:'CLIENTE X',estatus:'enviada',total:3300,items_json:'[{"sku":"RL009N","cantidad":2,"precio_unitario":1650}]'}],
  pedidos:[{id:'p0',folio:'P0050',fecha:'2026-11-01',cliente:'CLIENTE X',estatus:'confirmado',total:1000,items_json:'[]'}],remisiones:[],facturas:[],
  cobranza:[{id:'cob_p0',cliente:'CLIENTE X',tipo:'Pedido',numero:'P0050',total:1000,cobrado:0,pendiente:1000,estatus:'pendiente',factura_origen:'p0',fecha_entrega:'2026-11-01'}],ingresos:[],productos:[]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; CALLS.push(b.accion); let x={ok:true,items:[],valores:{}};
     if(b.accion==='erp_listar'){ if(LENTO) await sleep(LENTO); x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))}; }
     if(b.accion==='confirmar_cotizacion'){ DB.cotizaciones[0].estatus='convertida'; DB.pedidos.push({id:'ped_n1',folio:'P0051',fecha:'2026-11-11',cliente:'CLIENTE X',total:3300,cotizacion_origen:'C0016',estatus:'confirmado',items_json:'[]'}); DB.cobranza.push({id:'cob_ped_n1',cliente:'CLIENTE X',tipo:'Pedido',numero:'P0051',total:3300,cobrado:0,pendiente:3300,estatus:'pendiente',factura_origen:'ped_n1',fecha_entrega:'2026-11-11'}); }
     if(b.accion==='confirmar_cotizacion') x={ok:true,pedido:{id:'ped_n1',folio:'P0051',cliente:'CLIENTE X',total:3300,cotizacion_origen:'C0016',estatus:'borrador',items_json:'[]'},cobro:{id:'cob_ped_n1',cliente:'CLIENTE X',tipo:'Pedido',numero:'P0051',total:3300,cobrado:0,pendiente:3300,estatus:'pendiente',factura_origen:'ped_n1'}};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(2500);
 for(const t of ['clientes','cotizaciones','pedidos','cobranza','remisiones','facturas','ingresos']) await w.eval(`cargarTabla('${t}')`);
 LENTO=3000; w.confirmDialog=async()=>true; w.eval('confirmDialog=async()=>true');
 // 1) confirmar
 let t0=Date.now(); await w.eval("nunConfirmarCotizacion('q1')"); r.tConfirmar=Date.now()-t0;
 r.cot=w.eval("State.data.cotizaciones.find(x=>x.id==='q1').estatus"); r.pedido=w.eval("JSON.stringify((State.data.pedidos.find(x=>x.id==='ped_n1')||{}).estatus)"); r.cobro=w.eval("!!State.data.cobranza.find(x=>x.id==='cob_ped_n1')");
 if(!(r.tConfirmar<1500&&r.cot==='convertida'&&r.pedido==='"confirmado"'&&r.cobro)) r.fallas.push('confirmar al momento');
 // 2) estado de cuenta
 t0=Date.now(); await w.eval("nunEstadoCuentaAbrir('c1')"); r.tEstado=Date.now()-t0; r.ecTexto=(d.getElementById('ecCuerpo')||{}).textContent||'';
 if(!(r.tEstado<800&&/P0051/.test(r.ecTexto))) r.fallas.push('estado de cuenta al momento');
 d.getElementById('modalEC').remove();
 // 3) cuadrar por cliente
 t0=Date.now(); await w.eval("nunCuadrarClientes()"); r.tCuadrar=Date.now()-t0; if(!(r.tCuadrar<800&&d.getElementById('modalCQ'))) r.fallas.push('cuadrar sin esperar');
 await sleep(3500); // las listas se ponen al día en el fondo
 r.refresco=CALLS.filter(x=>x==='erp_listar').length; r.cotDespues=w.eval("State.data.cotizaciones.find(x=>x.id==='q1').estatus"); if(r.cotDespues!=='convertida') r.fallas.push('tras bajar del servidor sigue confirmada');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
