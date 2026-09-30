const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={remisiones:[{id:'bind_rem_322',folio:322,cliente:'RICARDO',total:18499.98,estatus:'facturada',items_json:'[]'},{id:'rem_n',folio:'R0001',cliente:'X',total:8090,estatus:'borrador',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0001',cliente:'RICARDO',total:18499.98,pedido_origen:'REM 322',estatus:'timbrada',uuid_sat:'u',items_json:'[]'},{id:'f2',folio:'FT0002',cliente:'Y',total:100,items_json:'[]'}],
 cobranza:[{id:'bind_cob_322',numero:'V01322',cliente:'RICARDO',total:18499.98,pendiente:18499.98,cobrado:0},{id:'cob_rem_n',numero:'R0001',cliente:'X',total:8090,pendiente:8090,cobrado:0,factura_origen:'rem_n'}],usuarios:[],cuentas:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,30)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]}); return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
 w.eval("abrirDoc('facturas','f1')"); await sleep(100); r.boton=/Registrar pago/.test(d.body.innerHTML);
 const casos=[['facturas','f2'],['facturas','f1'],['remisiones','bind_rem_322'],['remisiones','rem_n']]; w.eval("window._ts=[];const _t0=toast;toast=function(m,o){window._ts.push(m);return _t0(m,o)}");
 r.casos=[];for(const [t,id] of casos){ await w.eval(`nunPagoDesdeDoc('${t}','${id}')`); await sleep(500); r.casos.push(id+': '+(d.getElementById('pcMonto')?'abre cobro, saldo '+ (d.body.innerHTML.match(/Saldo pendiente<\/div>\s*<div[^>]*>([^<]*)/)||[])[1] : 'sin cobro')); try{w.eval('cerrarDrawer()')}catch(e){} await sleep(100);}
}catch(e){r.error=String(e.stack).slice(0,400)} r.toasts=w.eval('window._ts');r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3000);
