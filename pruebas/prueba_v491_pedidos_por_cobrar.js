// v4.91 (Rafa 12 nov: "en Pedidos aparece por cobrar 1.2 y deben más") — la pantalla Pedidos ahora cuenta, cliente por cliente, lo que FALTA de
// sus pedidos (también lo que está en sus remisiones/facturas, no solo el cobro propio del pedido nuevo), sin cancelados ni duplicados,
// y dice si cuadra con Cobranza. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO'},{id:'c2',razon_social:'CLIENTE DOS'}],
  pedidos:[{id:'p1',folio:'P0001',fecha:'2026-11-01',cliente:'CLIENTE UNO',estatus:'confirmado',total:1000,items_json:'[]'},       // cobro propio, debe 1000
   {id:'bind_ord_9',folio:'900',fecha:'2026-10-01',cliente:'CLIENTE UNO',estatus:'entregado',total:5000,items_json:'[]'},          // su saldo está en la remisión: debe 3000
   {id:'p3',folio:'P0003',fecha:'2026-11-02',cliente:'CLIENTE DOS',estatus:'duplicado',total:7000,items_json:'[]'},                 // duplicado: no cuenta
   {id:'p4',folio:'P0004',fecha:'2026-11-02',cliente:'CLIENTE DOS',estatus:'cancelado',total:9000,items_json:'[]'}],
  remisiones:[{id:'r1',folio:'R0001',fecha:'2026-10-02',cliente:'CLIENTE UNO',estatus:'entregada',total:5000,pedido_origen:'900',items_json:'[]'}],
  facturas:[],
  cobranza:[{id:'cob_p1',cliente:'CLIENTE UNO',tipo:'Pedido',numero:'P0001',total:1000,cobrado:0,pendiente:1000,estatus:'pendiente',factura_origen:'p1'},
   {id:'k2',cliente:'CLIENTE UNO',tipo:'Remisión',numero:'R0001',total:5000,cobrado:2000,pendiente:3000,estatus:'parcial',factura_origen:'r1'},
   {id:'k3',cliente:'CLIENTE DOS',tipo:'Factura',numero:'FT0099',total:500,cobrado:0,pendiente:500,estatus:'pendiente',factura_origen:'fx'}],
  ingresos:[]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/#/pedidos',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; for(let i=0;i<30&&!((w.State&&w.State.data.cobranza||[]).length&&(w.State.data.remisiones||[]).length);i++) await sleep(300); await sleep(800);
 w.eval("navegar('pedidos')"); await sleep(300);
 r.sub=(d.querySelector('.page-title .sub')||{}).textContent; r.kpis=[...d.querySelectorAll('.kpi')].slice(0,4).map(k=>k.textContent.replace(/\s+/g,' ').trim());
 const pc=JSON.parse(w.eval('JSON.stringify((({falta,sueltosTotal,cobranza})=>({falta,sueltosTotal,cobranza}))(nunPedidosPorCobrar()))')); r.pc=pc;
 if(pc.falta!==4000) r.fallas.push('falta de pedidos = 1000 + 3000');
 if(pc.sueltosTotal!==500||pc.cobranza!==4500) r.fallas.push('sin pedido y Cobranza');
 if(!/^2 pedidos vigentes \(2 cancelados o duplicados no cuentan\) · \$6,000 vendido · \$4,000 por cobrar/.test(r.sub||'')) r.fallas.push('renglón de arriba');
 if(!/cuadra con Cobranza/.test(r.kpis[2]||'')||!/Porentregar1/.test((r.kpis[3]||'').replace(/\s/g,''))) r.fallas.push('tarjetas');
 if(r.kpis.some(k=>/Timbradas/.test(k))) r.fallas.push('ya no debe decir Timbradas');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
