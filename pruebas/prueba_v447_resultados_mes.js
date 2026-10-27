// v4.47 — Estado de Resultados gerencial mes por mes: ventas sin IVA (las mismas del tablero, sin contar dos veces),
// notas de crédito restan, costo = piezas × costo del producto, gastos por categoría sin comisiones/préstamos/mercancía,
// impuestos de Gastos aparte, naviera e impuestos capturados por Rafa (kv nun_edr_manual) y "Lo que falta" por mes.
// v4.50: la naviera ya no sale como faltante (va dentro del costeo de cada producto).
// Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const kv=[];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'DUENO-PRUEBA1',usuario:{codigo:'DUENO-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ let b={}; try{ b=JSON.parse(o&&o.body||'{}'); }catch(e){} if(b.accion==='kv_guardar') kv.push(b.pares);
     const t=JSON.stringify(b.accion==='erp_listar'?{ok:true,items:[]}:{ok:true}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window;const sleep=t=>new Promise(z=>setTimeout(z,t));const r={fallas:[]};const ok=(c,m)=>{ if(!c) r.fallas.push(m); };
 await sleep(2500);
 try{
  const S=w.eval('State'); const it=(sku,q,pu,iva)=>JSON.stringify([{sku,descripcion:'MALETA '+sku,cantidad:q,precio_unitario:pu,iva_pct:iva}]);
  Object.assign(S.data,{
   productos:[{id:'p1',sku:'RL901N',descripcion:'MALETA RL901 NEGRO',costo:500},{id:'p2',sku:'RL902N',descripcion:'MALETA RL902 NEGRO',costo:0}],
   remisiones:[{id:'r1',folio:'R0001',fecha:'2026-08-05',cliente:'CLIENTE A',vendedor:'LUIS',estatus:'entregada',subtotal:10000,iva:0,total:10000,items_json:it('RL901N',10,1000,0)},
               {id:'r2',folio:'R0002',fecha:'2026-08-06',cliente:'CLIENTE A',vendedor:'LUIS',estatus:'cancelada',subtotal:99999,iva:0,total:99999,items_json:it('RL901N',99,1000,0)}],
   facturas:[{id:'f1',folio:'FT0001',fecha:'2026-08-10',cliente:'CLIENTE B',vendedor:'LUIS',estatus:'timbrada',subtotal:2000,iva:320,total:2320,items_json:it('RL902N',2,1000,16)},
             {id:'f2',folio:'FT0002',fecha:'2026-08-11',cliente:'CLIENTE A',pedido_origen:'R0001',estatus:'timbrada',subtotal:10000,iva:1600,total:11600,items_json:it('RL901N',10,1000,16)}],
   pedidos:[{id:'pd1',folio:'P0001',fecha:'2026-09-02',cliente:'CLIENTE C',vendedor:'EDGAR',estatus:'confirmado',subtotal:5000,iva:800,total:5800,items_json:it('RL901N',5,1000,16)}],
   cobranza:[{id:'cob_pd1',numero:'P0001',tipo:'Pedido',factura_origen:'pd1',cliente:'CLIENTE C',vendedor:'EDGAR',estatus:'pendiente',total:5800,cobrado:0,pendiente:5800,fecha_emision:'2026-09-02'}],
   notascredito:[{id:'n1',folio:'NC0001',fecha:'2026-08-20',cliente:'CLIENTE B',documento_origen:'FT0001',estatus:'timbrada',subtotal:500,iva:80,total:580}],
   ingresos:[{id:'i1',fecha:'2026-08-15',factura:'R0001',cuenta:'BBVA',tipo:'PAGO',monto:4000},{id:'i2',fecha:'2026-08-16',factura:'R0001',cuenta:'BBVA',tipo:'DUPLICADO_BIND',monto:4000}],
   gastos:[{id:'g1',fecha:'2026-08-03',categoria:'Renta almacén',monto:3000},{id:'g2',fecha:'2026-08-04',categoria:'Comisiones a vendedores',monto:999},
           {id:'g3',fecha:'2026-08-05',categoria:'Préstamos a empleados',monto:777},{id:'g4',fecha:'2026-08-06',categoria:'Impuestos y SAT',monto:400},
           {id:'g5',fecha:'2026-08-07',categoria:'Mercancía',monto:555},{id:'g6',fecha:'2026-08-08',categoria:'Nómina y sueldos',monto:1500}]
  });
  w.localStorage.setItem('nun_edr_manual',JSON.stringify({desde:'',meses:{'2026-08':{naviera:1200}}}));
  const {R,sinCosto}=w.nunEdrCalc(['2026-08','2026-09']); const a=R['2026-08'], s=R['2026-09'];
  r.agosto={ventas:a.ventas,nc:a.nc,costo:a.costo,naviera:a.navieraN,utilBruta:a.utilBruta,gastos:a.gastos,impuestos:a.impuestosN,cobrado:a.cobrado,faltan:a.faltan};
  r.septiembre={ventas:s.ventas,costo:s.costo,faltan:s.faltan};
  ok(a.ventas===12000,'ventas ago = 10000 (remisión sin IVA) + 2000 (factura sin IVA); la factura de la remisión y la cancelada no suman');
  ok(a.nc===500,'nota de crédito sin IVA = 500');
  ok(a.costo===5000,'costo ago = 10 × 500 (RL902 no tiene costo)');
  ok(a.ventaSinCosto===2000 && sinCosto.length===1,'RL902 sale como vendido sin costo');
  ok(a.navieraN===1200 && a.utilBruta===12000-500-5000-1200,'utilidad bruta = ventas netas − costo − naviera');
  ok(JSON.stringify(a.gastos)===JSON.stringify({'Renta almacén':3000,'Nómina y sueldos':1500}),'gastos sin comisiones, préstamos, mercancía ni impuestos');
  ok(a.impuestosN===400 && !a.faltan.includes('impuestos'),'impuestos de Gastos cuentan y ya no falta impuestos');
  ok(a.cobrado===4000,'cobrado sin duplicados de Bind');
  ok(a.faltan.some(f=>/venta sin costo/.test(f)) && !a.faltan.includes('naviera'),'faltantes de agosto');
  ok(s.ventas===5000 && s.costo===2500,'pedido-venta de sep cuenta (5000 sin IVA, costo 2500)');
  ok(!s.faltan.includes('naviera') && s.faltan.includes('impuestos') && s.faltan.includes('no hay gastos capturados'),'sep: falta impuestos y gastos (desde v4.50 la naviera va en el costeo y ya no se pide)');
  ok(Math.abs(a.utilNeta-(a.utilBruta-a.gastosOp-a.impuestosN))<0.01,'utilidad neta cuadra');
  // pantalla
  w.eval("_edr={desde:'2026-08',hasta:'2026-09'}");
  const html=w.renderResultadosMes(); const d=w.document.createElement('div'); d.innerHTML=html; const t=d.textContent.replace(/\s+/g,' ');
  ok(/Estado de Resultados por mes/.test(t) && /UTILIDAD NETA/.test(t) && /Lo que falta/.test(t),'la pantalla muestra el estado y lo que falta');
  ok(/RL902N/.test(t),'la pantalla lista el producto sin costo');
  // captura de naviera de septiembre → se guarda compartido
  await w.nunEdrCapturar('2026-09','naviera','3000'); await sleep(50);
  const g=JSON.parse(w.localStorage.getItem('nun_edr_manual')); r.guardado=g;
  ok(g.meses['2026-09'].naviera===3000 && g.meses['2026-08'].naviera===1200,'naviera de sep guardada sin borrar la de ago');
  ok(kv.some(p=>p.nun_edr_manual && JSON.parse(p.nun_edr_manual).meses['2026-09'].naviera===3000),'se manda al servidor (kv_guardar)');
  ok(w.MODULOS && w.MODULOS.resultados_mes || w.eval("typeof MODULOS!=='undefined' && !!MODULOS.resultados_mes"),'módulo registrado en el menú');
  r.version=(w.document.querySelector('.rwd-version')||{}).textContent;
 }catch(e){ r.error=String(e&&e.stack||e).slice(0,600); }
 if(errs.length) r.erroresPagina=errs.slice(0,5);
 if(r.fallas.length) r.error='fallas: '+r.fallas.length;
 console.log(JSON.stringify(r,null,1)); process.exit(0);
})();
