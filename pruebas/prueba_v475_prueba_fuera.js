// v4.75 / app v2.1.12 (Rafa 10 nov): el cliente de PRUEBA (RAFAEL LANIADO CATTAN) no cuenta en comisiones del ERP ni en cobrado / te deben /
// comisión del CRM. Sus documentos y pagos se quedan como están (Yazmín practica ahí).
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const hoy=new Date(), mes=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0');
const COB=[{id:'c1',numero:'F1',cliente:'CLIENTE A',vendedor:'EDGAR',total:1000,cobrado:1000,pendiente:0,fecha_emision:mes+'-02'},
 {id:'c2',numero:'R0001',cliente:'Rafael Laniado Cattan',vendedor:'EDGAR',total:5000,cobrado:3000,pendiente:2000,fecha_emision:mes+'-02'}];
const ING=[{id:'i1',fecha:mes+'-03',cliente:'CLIENTE A',factura:'F1',tipo:'cobro',monto:1000},{id:'i2',fecha:mes+'-03',cliente:'Rafael Laniado Cattan',factura:'R0001',tipo:'cobro',monto:3000,cuenta:'BBVA'}];
const CLI=[{id:'k1',razon_social:'CLIENTE A',vendedor:'EDGAR'},{id:'k2',razon_social:'Rafael Laniado Cattan',vendedor:'EDGAR'}];
const datos=t=>JSON.parse(JSON.stringify(t==='cobranza'?COB:t==='ingresos'?ING:t==='clientes'?CLI:[]));
(async()=>{const r={fallas:[]};try{
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'X',usuario:{codigo:'X',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ let b={}; try{b=JSON.parse(o&&o.body||'{}')}catch(e){} const x=b.accion==='erp_listar'?{ok:true,items:datos(b.tabla)}:{ok:true};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window; await sleep(3000); for(const t of ['cobranza','ingresos','clientes']) await w.eval(`cargarTabla('${t}')`);
 for(const base of ['doc','pago']){ w.eval(`_comBase='${base}'`); const c=w.eval(`calcularComisiones('todos')`); r['edgar_'+base]=c.EDGAR&&c.EDGAR.cobrado; if(!c.EDGAR||c.EDGAR.cobrado!==1000) r.fallas.push('erp_'+base); }
 r.version=(w.document.querySelector('.rwd-version')||{}).textContent; if(!/v4\.(7[5-9]|[89]\d)/.test(r.version||'')) r.fallas.push('version'); w.close();
 const HTML=fs.readFileSync(path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/,'');
 const d2=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.scrollTo=()=>{}; w.fetch=async(u,o)=>{ const b=JSON.parse(o.body); let x={ok:true};
    if(b.accion==='login') x={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') x={ok:true,items:datos(b.tabla)}; return {json:async()=>x}; }; }});
 const w2=d2.window; await sleep(400); w2.document.getElementById('lgCod').value='x'; await w2.eval('entrar()'); await sleep(500);
 const t=w2.document.getElementById('main').textContent.replace(/\s+/g,' ');
 r.crmInicio=t.slice(0,200);
 if(!/Cobrado en [a-z]+ ›\$1,000/i.test(t)||!/Te deben ›\$0/i.test(t)) r.fallas.push('crm');
 r.crmVersion=w2.eval('VERSION'); if(!/^v2\.1\.(1[2-9]|[2-9]\d)/.test(r.crmVersion)) r.fallas.push('crmVersion');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
