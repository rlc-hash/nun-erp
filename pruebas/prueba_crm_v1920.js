// App de vendedores v1.9.20 — el vendedor sube COTIZACIONES y ve en qué van (por confirmar / confirmada → pedido). Ya no hay
// botón para convertir a remisión o factura (eso lo hacen Rafa o Yazmín en el sistema). Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_CRM||path.join(__dirname,'..','crm.html'),'utf8');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const DB={clientes:[],productos:[],pedidos:[{id:'p9',folio:'P0009',fecha:'2026-10-07',cliente:'CLIENTE A',vendedor:'RAFA',estatus:'confirmado',total:500,cotizacion_origen:'C0001',items_json:'[]'}],
 cotizaciones:[{id:'c1',folio:'C0001',fecha:'2026-10-06',cliente:'CLIENTE A',vendedor:'RAFA',estatus:'convertida',total:500,notas:'Confirmada: pedido P0009 (2026-10-07)',items_json:'[]'},
  {id:'c2',folio:'C0002',fecha:'2026-10-07',cliente:'CLIENTE B',vendedor:'RAFA',estatus:'enviada',total:300,items_json:'[]'}],
 facturas:[],remisiones:[],cobranza:[],ingresos:[],gastos:[]};
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/crm.html',
 beforeParse(w){
  w.localStorage.setItem('nun_session',JSON.stringify({codigo:'RAFA-XYZ123',usuario:{codigo:'RAFA-XYZ123',nombre:'Rafa',rol:'admin'},permisos:{ver_gastos:true,ver_ingresos:true,ver_cobranza:true,editar_cobranza:true,agregar_pedidos:true,ver_dashboard:true,eliminar_documentos:true,ver_todos_clientes:true},device_id:'d1'}));
  w.alert=()=>{}; w.confirm=()=>true; w.open=()=>null;
  w.fetch=async(u,o)=>{ await sleep(5); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body){ const p=new URLSearchParams(String(u).split('?')[1]||''); return J({ok:true,data:DB[p.get('tabla')]||[]}); }
   const b=JSON.parse(o.body); if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]}); return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
setTimeout(async()=>{const r={fallas:[]};try{
 r.version=(d.body.innerHTML.match(/letter-spacing:0\.05em">(v1\.9\.\d+)/)||[])[1];
 r.botonCaptura=txt(d.getElementById('btnNuevoPedido'));
 w.eval("sesionActual = sesionActual || {codigo:'RAFA-XYZ123',usuario:{codigo:'RAFA-XYZ123',nombre:'Rafa',rol:'admin'},permisos:{ver_todos_clientes:true}}"); // la sesión guardada se valida al entrar; aquí se pone directo
 await w.eval("renderERPTab('erp_pedidos', true)"); await sleep(300);
 const pane=txt(d.getElementById('pane-erp_pedidos'));
 r.lista={titulo:/Cotizaciones y pedidos/.test(pane),nueva:/\+ Nueva cotización/.test(pane),confirmada:/C0001 .*✓ confirmada · pedido P0009/.test(pane),porConfirmar:/C0002 .*por confirmar/.test(pane),
   sinRemision:!/Remisión \/ Factura|Remisiones/.test(pane)};
 await w.eval("erpAbrirNuevoPedido()"); await sleep(200); r.modal=txt(d.getElementById('erpModalPedido')).slice(0,60); r.botonSubir=txt(d.getElementById('erpPedGuardarBtn'));
 if(!/v1\.9\.(2\d|[3-9]\d)/.test(r.version||'')) r.fallas.push('version');
 if(r.botonCaptura!=='+ Cotización') r.fallas.push('botonCaptura');
 if(Object.values(r.lista).some(v=>!v)) r.fallas.push('lista');
 if(!/Nueva cotización/.test(r.modal)||r.botonSubir!=='Subir cotización') r.fallas.push('modal');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
