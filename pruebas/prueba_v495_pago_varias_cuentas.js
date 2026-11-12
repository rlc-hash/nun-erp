// v4.95 (Rafa 12 nov: "me depositó 45,292 que equivalen a las dos cuentas") — ERP: 💵 Un pago a varias cuentas. Se reparte solo empezando por la MÁS
// VIEJA, se puede cambiar a mano, pide confirmación y registra capturar_pago_cliente en cada cobro. Si falla a la mitad, lo ya registrado no se repite.
// Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const DB={clientes:[{id:'c1',razon_social:'COMERCIALIZADORA EJEMPLO'}],
  cobranza:[{id:'k2',cliente:'COMERCIALIZADORA EJEMPLO',tipo:'Remisión',numero:'V01325',total:9492.01,cobrado:0,pendiente:9492.01,fecha_emision:'2026-09-28'},
   {id:'k1',cliente:'COMERCIALIZADORA EJEMPLO',tipo:'Pedido',numero:'PED 1308',total:45800,cobrado:10000,pendiente:35800,fecha_emision:'2026-08-13'},
   {id:'k3',cliente:'OTRO CLIENTE',tipo:'Factura',numero:'FT0001',total:500,cobrado:0,pendiente:500,fecha_emision:'2026-01-01'}],ingresos:[],pedidos:[],remisiones:[],facturas:[]};
 const PAGOS=[]; let FALLA=null;
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/#/cobranza',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; let x={ok:true,items:[],valores:{}};
     if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     if(b.accion==='listar_cuentas') x={ok:true,cuentas:[{nombre:'BBVA',activa:true},{nombre:'Efectivo',activa:true}]};
     if(b.accion==='capturar_pago_cliente'){ if(FALLA===b.id_doc){ x={ok:false,error:'servidor ocupado'}; } else { PAGOS.push({id:b.id_doc,monto:b.monto,fecha:b.fecha,cuenta:b.cuenta,notas:b.notas}); const c=DB.cobranza.find(c=>c.id===b.id_doc); c.cobrado+=b.monto; c.pendiente=Math.round((c.pendiente-b.monto)*100)/100; } }
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; for(let i=0;i<30&&!((w.State&&w.State.data.cobranza||[]).length&&(w.State.data.cuentas||[]).length);i++) await sleep(300); await sleep(500);
 const confirmar=async()=>{ for(let i=0;i<20&&!/Sí, registrar/.test((d.getElementById('confirmOk')||{}).textContent||'');i++) await sleep(50); r.msg=(d.getElementById('confirmMsg')||{}).textContent; d.getElementById('confirmOk').click(); };
 w.eval('navegar("cobranza")'); await sleep(200);
 r.boton=!![...d.querySelectorAll('button')].find(b=>/Un pago a varias cuentas/.test(b.textContent)); if(!r.boton) r.fallas.push('botón en Cobranza');
 // 1) buscar el cliente y repartir 45,292 (1 centavo menos): la más vieja (PED 1308, ago) completa y el resto a V01325
 w.eval('nunPagoVariosAbrir()'); w.eval("nunPV2Buscar('ejemplo')"); d.querySelector('#pv2Res div').click(); await sleep(50);
 r.orden=w.eval('_nunPV2.L.map(c=>c.numero).join(",")'); if(r.orden!=='PED 1308,V01325') r.fallas.push('orden: la más vieja primero (y solo ese cliente)');
 const monto=d.getElementById('pv2Monto'); monto.value='45292'; monto.dispatchEvent(new w.Event('input'));
 r.reparto=[0,1].map(i=>d.getElementById('pv2M'+i).value); if(r.reparto.join()!=='35800,9492') r.fallas.push('reparto automático');
 r.suma=d.getElementById('pv2Suma').textContent; if(!/Se reparte completo/.test(r.suma)) r.fallas.push('suma');
 // a mano: si no cuadra no deja
 d.getElementById('pv2M1').value='9000'; d.getElementById('pv2M1').dispatchEvent(new w.Event('input'));
 d.getElementById('pv2Cuenta').value='BBVA'; d.getElementById('pv2Fecha').value='2026-11-12';
 await w.eval('nunPV2Guardar()'); r.noCuadra=PAGOS.length===0; if(!r.noCuadra) r.fallas.push('no debe registrar si no cuadra');
 d.getElementById('pv2M1').value='9492'; d.getElementById('pv2M1').dispatchEvent(new w.Event('input'));
 // 2) falla a la mitad: el 1o queda, el 2o no; al reintentar solo va el 2o
 FALLA='k2'; const g=w.eval('nunPV2Guardar()'); await confirmar(); await g; await sleep(100);
 r.trasFalla=PAGOS.map(p=>p.id+':'+p.monto).join(); if(r.trasFalla!=='k1:35800') r.fallas.push('falla a la mitad');
 FALLA=null; const m2=d.getElementById('pv2Monto'); m2.value='9492'; m2.dispatchEvent(new w.Event('input'));
 d.getElementById('pv2Cuenta').value='BBVA'; d.getElementById('pv2Fecha').value='2026-11-12';
 r.filas2=w.eval('_nunPV2.L.map(c=>c.numero).join(",")');
 const g2=w.eval('nunPV2Guardar()'); await confirmar(); await g2; await sleep(150);
 r.pagos=PAGOS.map(p=>p.id+':'+p.monto+':'+p.cuenta+':'+p.fecha); if(JSON.stringify(PAGOS.map(p=>p.id+':'+p.monto))!=='["k1:35800","k2:9492"]') r.fallas.push('sin duplicar');
 r.notas=PAGOS[0]&&PAGOS[0].notas; if(!/Un pago de \$45,292\.00 repartido en 2 cuentas \(1 de 2\)/.test(r.notas||'')) r.fallas.push('notas');
 r.cerrado=!d.getElementById('modalPV2'); if(!r.cerrado) r.fallas.push('cerrar al terminar');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
