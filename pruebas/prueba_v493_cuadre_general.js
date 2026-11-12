// v4.93 (Rafa 12 nov: "cuadra todo… facturado contra remisiones") — Cuadre general: (1) factura hecha a PÚBLICO EN GENERAL ligada al pedido de un cliente
// cuenta en ese pedido; (2) Vendido vs Cobranza con la lista de pedidos que no cuadran y cobros sin pedido; (3) los que se compensan entre pedidos del mismo
// cliente (factura compartida) van aparte; (4) reparto Facturado / Solo remisión / Pedido sin documento = Cobranza. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const P=(id,folio,cli,total,est)=>({id,folio,fecha:'2026-10-01',cliente:cli,estatus:est||'entregado',total,items_json:'[]'});
 const K=(id,num,tipo,cli,total,cobrado,fo)=>({id,numero:num,tipo,cliente:cli,total,cobrado,pendiente:total-cobrado,estatus:'',factura_origen:fo});
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO'},{id:'c2',razon_social:'CLIENTE DOS'},{id:'c3',razon_social:'Público en General'}],
  pedidos:[P('p1','900','CLIENTE UNO',5000),P('p2','901','CLIENTE UNO',3000),P('p3','902','CLIENTE DOS',1000),P('p4','903','CLIENTE DOS',2000),P('p5','904','CLIENTE DOS',700),
   P('p6','P0010','CLIENTE UNO',4000,'confirmado'),P('p7','905','CLIENTE DOS',999,'duplicado')],
  remisiones:[{id:'r1',folio:'R0001',cliente:'CLIENTE UNO',estatus:'entregada',total:5000,pedido_origen:'900'},{id:'r2',folio:'R0002',cliente:'CLIENTE DOS',estatus:'entregada',total:700,pedido_origen:'904'}],
  facturas:[{id:'f1',folio:'1079',cliente:'Público en General',estatus:'timbrada',total:3000,pedido_origen:'901'},          // a Público, del pedido 901 de CLIENTE UNO
   {id:'f2',folio:'FT0002',cliente:'CLIENTE DOS',estatus:'timbrada',total:1500,pedido_origen:'902, 903'},                  // compartida: 902 de más, 903 de menos
   {id:'f3',folio:'FT0003',cliente:'CLIENTE DOS',estatus:'timbrada',total:1500,pedido_origen:'903'},
   {id:'f4',folio:'FT0004',cliente:'CLIENTE DOS',estatus:'timbrada',total:700,pedido_origen:'R0002'}],                     // factura de la remisión R0002 → facturado
  cobranza:[K('k1','R0001','Remisión','CLIENTE UNO',5000,1000,'r1'),K('k2','1079','Factura','Público en General',3000,3000,'f1'),K('k3','FT0002','Factura','CLIENTE DOS',1500,0,'f2'),
   K('k4','FT0003','Factura','CLIENTE DOS',1500,500,'f3'),K('k5','R0002','Remisión','CLIENTE DOS',700,0,'r2'),K('cob_p6','P0010','Pedido','CLIENTE UNO',4000,0,'p6'),
   K('k7','V0177','Remisión','CLIENTE DOS',250,0,'rx')],                                                                     // cobro sin pedido
  ingresos:[]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/#/pedidos',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; for(let i=0;i<30&&!((w.State&&w.State.data.cobranza||[]).length&&(w.State.data.facturas||[]).length);i++) await sleep(300); await sleep(800);
 const G=JSON.parse(w.eval(`JSON.stringify((G=>({vendido:G.vendido,cob:G.cobTotal,g:G.g,cuadran:G.cuadranPed,n:G.nPed,difs:G.difs.map(x=>[x.p.folio,x.dif,x.compensa]),sueltos:G.sueltos.map(c=>c.numero)}))(nunCuadreGeneral()))`)); r.G=G;
 if(G.vendido!==15700||G.cob!==15950) r.fallas.push('vendido/cobranza');
 if(G.n!==6||G.cuadran!==4) r.fallas.push('cuántos cuadran (900, 901 con factura a Público, 904, P0010)');
 if(JSON.stringify(G.difs.map(x=>x[0]).sort())!=='["902","903"]'||!G.difs.every(x=>x[2])) r.fallas.push('902/903 se compensan');
 if(JSON.stringify(G.sueltos)!=='["V0177"]') r.fallas.push('cobro sin pedido');
 if(JSON.stringify(G.g)!==JSON.stringify({facturado:[6700,3200],remision:[5250,4250],pedido:[4000,4000]})) r.fallas.push('reparto facturado / remisión / pedido');
 w.eval("navegar('pedidos')"); await sleep(300);
 r.kpi=[...d.querySelectorAll('.kpi')][1].textContent.replace(/\s+/g,' ').trim(); if(!/Facturado \$6,700 · 📦 Solo remisión \$5,250 · 📝 Sin documento \$4,000/.test(r.kpi)) r.fallas.push('tarjeta vendido');
 w.eval('nunCuadreGeneralAbrir()'); const m=d.getElementById('modalCG'); r.modal=m&&m.textContent.replace(/\s+/g,' ').slice(0,400);
 if(!m||!/Diferencia/.test(m.textContent)||!/se compensan/.test(m.textContent)||!/V0177/.test(m.textContent)) r.fallas.push('ventana del cuadre');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
