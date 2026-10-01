// v4.01 — Tablero del mes en Reportes: ventas (remisiones + facturas sin contar dos veces), cobrado (Ingresos vigentes),
// comparación contra el mes anterior, filtro por vendedor, top clientes/vendedores/cuentas y 12 meses. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const hoy=new Date(), mes=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0'), ant=(()=>{const d=new Date(hoy.getFullYear(),hoy.getMonth()-1,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');})();
const it=JSON.stringify([{sku:'A1',descripcion:'MALETA RL0083 NEGRO 20"',cantidad:3,precio_unitario:100,iva_pct:16}]);
const DB={
 remisiones:[{id:'r1',folio:'R0001',cliente:'CLIENTE A',vendedor:'EDGAR',estatus:'entregada',total:1000,fecha:mes+'-02',items_json:it},
  {id:'r2',folio:'R0002',cliente:'CLIENTE B',vendedor:'LUIS',estatus:'facturada',total:500,fecha:mes+'-05',items_json:'[]'},
  {id:'r3',folio:'R0003',cliente:'CLIENTE B',vendedor:'LUIS',estatus:'cancelada',total:9999,fecha:mes+'-05',items_json:'[]'},
  {id:'r4',folio:'R0004',cliente:'CLIENTE A',vendedor:'EDGAR',estatus:'entregada',total:800,fecha:ant+'-10',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0001',cliente:'CLIENTE B',vendedor:'LUIS',estatus:'timbrada',total:500,fecha:mes+'-06',pedido_origen:'REM R0002',items_json:'[]'},
  {id:'f2',folio:'FT0002',cliente:'CLIENTE C',vendedor:'EDGAR',estatus:'timbrada',total:2000,fecha:mes+'-07',items_json:'[]'},
  {id:'f3',folio:'FT0003',cliente:'CLIENTE C',vendedor:'EDGAR',estatus:'timbrada',total:300,fecha:mes+'-08',notas:'Cobro en PED 9 (id cob_x)',items_json:'[]'}],
 ingresos:[{id:'i1',cliente:'CLIENTE A',factura:'R0001',monto:600,cuenta:'BBVA',fecha:mes+'-03',tipo:'cobro'},{id:'i2',cliente:'CLIENTE C',factura:'FT0002',monto:700,cuenta:'Efectivo',fecha:mes+'-09',tipo:'cobro'},
  {id:'i3',cliente:'CLIENTE C',factura:'FT0002',monto:50,cuenta:'BBVA',fecha:mes+'-09',tipo:'CANCELADO'},{id:'i4',cliente:'CLIENTE A',factura:'R0004',monto:400,cuenta:'BBVA',fecha:ant+'-11',tipo:'cobro'}],
 cobranza:[{id:'c1',numero:'R0001',vendedor:'EDGAR',total:1000,cobrado:600,pendiente:400},{id:'c2',numero:'FT0002',vendedor:'EDGAR',total:2000,cobrado:700,pendiente:1300},{id:'c3',numero:'R0002',vendedor:'LUIS',total:500,cobrado:0,pendiente:500},{id:'c4',numero:'X',total:5,pendiente:5,estatus:'cancelado'}],
 productos:[],clientes:[{id:'cA',razon_social:'CLIENTE A'}],pedidos:[],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB)) if(t!=='usuarios') await w.eval(`cargarTabla('${t}')`);
 w.eval("navegar('reportes')"); await sleep(500);
 const T=d.getElementById('nunTablero'); const kp=[...T.querySelectorAll('.kpi')].map(k=>txt(k.querySelector('.kpi-value')));
 r.kpis=kp; r.comparacion=/▲ 338%/.test(txt(T)); r.secciones=['últimos 12 meses','Ventas por día','Ventas por vendedor','Top 10 clientes','Top 10 productos','Cobrado por cuenta'].every(x=>txt(T).includes(x));
 r.topClientes=[...T.querySelectorAll('.tabFila')].map(x=>x.dataset.tip).filter(x=>/^CLIENTE/.test(x));
 r.productos=/RL0083: 3 pzas/.test([...T.querySelectorAll('.tabFila')].map(x=>x.dataset.tip).join('|'));
 w.eval("_tab.vend='LUIS'; nunTableroPintar()"); r.luis=[...d.getElementById('nunTablero').querySelectorAll('.kpi')].map(k=>txt(k.querySelector('.kpi-value')));
 r.fallas=[];
 if(kp.join('|')!=='$3,500|$1,300|3|$2,200'||!r.comparacion||!r.secciones) r.fallas.push('kpis');
 if(r.topClientes.join('|')!=='CLIENTE C: $2,000|CLIENTE A: $1,000|CLIENTE B: $500'||!r.productos) r.fallas.push('tops');
 if(r.luis.join('|')!=='$500|$0|1|$500') r.fallas.push('vendedor');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
