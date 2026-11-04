// v4.69 — Capturar pago con la lista de cuentas vacía (no llegaron al abrir el sistema): se piden otra vez y el selector se llena solo.
// Y al tocar el logo (actualizar) las cuentas vienen solo activas y sin repetir.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1'; let fallarCuentas=true;
 const T={cobranza:[{id:'k1',numero:'V01325',cliente:'CLIENTE A',tipo:'Remisión',total:1000,cobrado:0,pendiente:1000}],
  cuentas:[{nombre:'BBVA',activa:true},{nombre:'BBVA',activa:false},{nombre:'Efectivo Transferencia',activa:true},{nombre:'Mercado Pago',activa:true}]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{};
    const res=b.accion==='listar_cuentas'?(fallarCuentas?{ok:false,error:'tarde'}:{ok:true,cuentas:T.cuentas}):b.accion==='erp_listar'?{ok:true,items:T[b.tabla]||[]}:{ok:true,valores:{}};
    const t=JSON.stringify(res); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
 await sleep(3000); const r={fallas:[]};
 try{
  await w.eval("cargarTabla('cobranza')"); await w.eval("State.data.cuentas=[]");
  fallarCuentas=false; await w.eval("abrirDrawerCobranza('k1')"); await sleep(600);
  const sel=d.getElementById('pcCuenta'); r.opciones=sel?[...sel.options].map(o=>o.value).filter(Boolean):null;
  if(!r.opciones||r.opciones.join(',')!=='BBVA,Efectivo Transferencia,Mercado Pago') r.fallas.push('se-llena-sola');
  r.version=d.querySelector('.rwd-version').textContent; if(!/v4\.(69|[7-9]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();
})();
