// App v2.1.32 (Rafa 18 nov: "quiero que Edgar pueda ver a todos los clientes") — el vendedor que tiene "ver a todos" (Edgar) ve TODOS los clientes
// en Clientes y en los buscadores (Cotizar, Registrar pago) aunque esté en "Lo mío"; su Inicio (vendido/cobrado/comisión) sigue siendo solo lo suyo.
// El que no tiene el permiso (Luis) sigue viendo solo los suyos. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
async function como(vend,todos){
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE DE EDGAR',vendedor:'EDGAR'},{id:'c2',razon_social:'CLIENTE DE LUIS',vendedor:'LUIS'},{id:'c3',razon_social:'CLIENTE DE YADAH',vendedor:'YADAH'}],
  productos:[],cotizaciones:[],remisiones:[],facturas:[],ingresos:[],pagosverificar:[],notascredito:[],
  pedidos:[{id:'p1',folio:'P0001',fecha:new Date().toISOString().slice(0,10),cliente:'CLIENTE DE EDGAR',vendedor:'EDGAR',estatus:'confirmado',total:1000},{id:'p2',folio:'P0002',fecha:new Date().toISOString().slice(0,10),cliente:'CLIENTE DE YADAH',vendedor:'YADAH',estatus:'confirmado',total:50000}],
  cobranza:[]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let x={ok:true};
    if(b.accion==='login') x={ok:true,usuario:{nombre:vend,rol:'vendedor',vendedor_asignado:vend},permisos:{agregar_pedidos:true,ver_todos_clientes:todos}};
    else if(b.accion==='erp_listar') x={ok:true,items:DB[b.tabla]||[]}; else if(b.accion==='listar_cuentas') x={ok:true,cuentas:[]};
    return {json:async()=>JSON.parse(JSON.stringify(x))}; }; }});
 const w=dom.window,d=w.document; await sleep(400); d.getElementById('lgCod').value='x'; await w.eval('entrar()'); await sleep(300);
 const r={version:w.eval('VERSION'),soloMios:w.eval('S.soloMios')};
 w.eval("ir('clientes')"); await sleep(30); const t=d.querySelector('main').textContent; r.clientes=['EDGAR','LUIS','YADAH'].filter(n=>t.includes('CLIENTE DE '+n)); r.titulo=(d.querySelector('main h2')||{}).textContent;
 r.buscador=w.eval("misClientes().map(c=>c.razon_social).join()");
 w.eval("ir('inicio')"); await sleep(30); r.inicio=d.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,200);
 r.errs=errs.slice(0,3); return r;
}
(async()=>{const r={fallas:[]};try{
 r.edgar=await como('Edgar',true); r.luis=await como('Luis',false);
 if(!/^v2\.1\.(3[2-9]|[4-9]\d)/.test(r.edgar.version)) r.fallas.push('version');
 if(r.edgar.clientes.join()!=='EDGAR,LUIS,YADAH'||!/^Clientes \(3\)/.test(r.edgar.titulo)||!r.edgar.soloMios) r.fallas.push('Edgar ve todos los clientes (estando en "Lo mío")');
 if(r.edgar.buscador.split(',').length!==3) r.fallas.push('buscadores de Edgar con todos');
 if(/50,000|50000/.test(r.edgar.inicio)) r.fallas.push('el Inicio de Edgar sigue siendo solo lo suyo');
 if(r.luis.clientes.join()!=='LUIS'||!/^Mis clientes \(1\)/.test(r.luis.titulo)) r.fallas.push('Luis sigue viendo solo los suyos');
 if(r.edgar.errs.length||r.luis.errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
