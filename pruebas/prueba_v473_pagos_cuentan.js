// v4.73 / app v2.1.11 (10 nov 2026): los pagos repetidos ya se marcaron uno por uno (DUPLICADO_BIND / CANCELADO), así que ERP y CRM cuentan
// TODOS los pagos vivos. Antes una regla escondía los "ING-…" (Excel viejo) anteriores al corte de Bind y dejaba pagos buenos fuera.
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const ING=[{id:'bind_pag_1',fecha:'2026-09-20',cliente:'CLIENTE A',factura:'F1',tipo:'cobro',monto:1000},
 {id:'ING-CLIENTEA-F2',fecha:'2025-08-01',cliente:'CLIENTE A',factura:'F2',tipo:'PAGO',monto:500},
 {id:'ING-CLIENTEA-F3',fecha:'2025-08-02',cliente:'CLIENTE A',factura:'F3',tipo:'DUPLICADO_BIND',monto:700},
 {id:'ING-AJ',fecha:'2025-08-03',cliente:'CLIENTE A',factura:'AJ',tipo:'CANCELADO',monto:900}];
const COB=[{id:'c1',numero:'F1',cliente:'CLIENTE A',total:1000,cobrado:1000,pendiente:0},{id:'c2',numero:'F2',cliente:'CLIENTE A',total:500,cobrado:500,pendiente:0}];
(async()=>{const r={fallas:[]};try{
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'X',usuario:{codigo:'X',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ let b={}; try{b=JSON.parse(o&&o.body||'{}')}catch(e){} const x=b.accion==='erp_listar'?{ok:true,items:JSON.parse(JSON.stringify(b.tabla==='ingresos'?ING:b.tabla==='cobranza'?COB:[]))}:{ok:true};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window; await sleep(3000); await w.eval("cargarTabla('cobranza')"); await w.eval("cargarTabla('ingresos')");
 r.erpVivos=w.eval("(State.data.ingresos||[]).map(i=>i.id).sort().join()");
 const q=w.eval('nunCuadreIngresosCobranza()'); r.erpCuadre=[q.totCob,q.totIng,q.dif];
 if(r.erpVivos!=='ING-CLIENTEA-F2,bind_pag_1'||q.dif!==0) r.fallas.push('erp');
 r.version=(w.document.querySelector('.rwd-version')||{}).textContent; if(!/v4\.(7[3-9]|[89]\d)/.test(r.version||'')) r.fallas.push('version'); w.close();
 const HTML=fs.readFileSync(path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/,'');
 const d2=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.scrollTo=()=>{}; w.fetch=async(u,o)=>{ const b=JSON.parse(o.body); let x={ok:true};
    if(b.accion==='login') x={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(b.tabla==='ingresos'?ING:b.tabla==='cobranza'?COB:[]))}; return {json:async()=>x}; }; }});
 const w2=d2.window; await sleep(400); w2.document.getElementById('lgCod').value='x'; await w2.eval('entrar()'); await sleep(400);
 r.crmVivos=w2.eval("ingresosValidos().map(i=>i.id).sort().join()"); if(r.crmVivos!=='ING-CLIENTEA-F2,bind_pag_1') r.fallas.push('crm');
 r.crmVersion=w2.eval('VERSION'); if(!/^v2\.1\.(1[1-9]|[2-9]\d)/.test(r.crmVersion)) r.fallas.push('crmVersion');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
