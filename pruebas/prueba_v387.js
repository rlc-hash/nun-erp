// v3.87 — cuentas donde entra el dinero: administrarlas desde el pago (agregar/activar, nada se borra) y monto a centavos. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
let CUENTAS=[{nombre:'BBVA',tipo:'banco',activa:true,notas:''},{nombre:'Efectivo',tipo:'caja',activa:false,notas:''}];
const DB={cobranza:[{id:'c1',numero:'V01325',cliente:'CLIENTE PRUEBA',total:342518.0064,cobrado:0,pendiente:342518.0064}],pagosclientes:[],clientes:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='listar_cuentas') return J({ok:true,cuentas:CUENTAS});
   if(b.accion==='guardar_cuentas'){ CUENTAS=b.cuentas; return J({ok:true}); }
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 await w.eval("cargarTabla('cobranza')"); await w.eval("cargarCuentas()");
 w.eval("abrirDrawerCobranza('c1')"); await sleep(300);
 r.monto=d.getElementById('pcMonto').value; r.antes=[...d.getElementById('pcCuenta').options].map(o=>o.value).filter(Boolean);
 await w.eval("nunAdminCuentas()"); await sleep(100);
 w.eval("window._nunCtas[1].activa=true; window._nunCtas.push({nombre:'Depositos sin factura',tipo:'',activa:true,notas:''})");
 await w.eval("nunAdminCuentasGuardar()"); await sleep(200);
 r.despues=[...d.getElementById('pcCuenta').options].map(o=>o.value).filter(Boolean); r.guardadas=CUENTAS.length;
 r.fallas=[]; if(r.monto!=='342518.01') r.fallas.push('monto'); if(r.antes.join()!=='BBVA') r.fallas.push('antes');
 if(r.despues.join()!=='BBVA,Efectivo,Depositos sin factura'||r.guardadas!==3) r.fallas.push('cuentas');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
