// App de vendedores v1.9.13 — "Mismo precio a todos" en el pedido y el dueño (RAFA-…) con todos los permisos. Datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_CRM||path.join(__dirname,'..','crm.html'),'utf8');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const DB={clientes:[{id:'cl1',razon_social:'CLIENTE PRUEBA UNO'}],productos:[{sku:'A1',descripcion:'PIEZA A',precio:100},{sku:'B2',descripcion:'PIEZA B',precio:200}],pedidos:[],cobranza:[],ingresos:[],gastos:[]};
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/crm.html',
 beforeParse(w){
  w.localStorage.setItem('nun_session',JSON.stringify({codigo:'RAFA-XYZ123',usuario:{codigo:'RAFA-XYZ123',nombre:'Rafa',rol:'cobranza'},permisos:{ver_cobranza:true,gestionar_usuarios:false},device_id:'d1'}));
  w.alert=()=>{}; w.confirm=()=>true; w.open=()=>null;
  w.fetch=async(u,o)=>{ await sleep(5); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body){ const p=new URLSearchParams(String(u).split('?')[1]||''); return J({ok:true,data:DB[p.get('tabla')]||[]}); }
   const b=JSON.parse(o.body); if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]}); return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;
setTimeout(async()=>{const r={};try{
 r.version=(d.body.innerHTML.match(/v1\.9\.\d+/)||[''])[0];
 r.dueno={admin:w.eval("nunEsAdmin()"),todos:w.eval("['ver_gastos','eliminar_documentos','gestionar_usuarios','ver_todos_clientes'].every(k=>sesionActual.permisos[k]===true)")};
 await w.eval("erpAbrirNuevoPedido()"); await sleep(300);
 w.eval("erpAgregarLinea(); erpAgregarLinea()");
 const filas=()=>[...d.querySelectorAll('#erpPedLineas > div')];
 const pon=(i,c,v)=>{ w.eval("erpLineaCambio("+i+",'"+c+"',"+JSON.stringify(v)+")"); };
 pon(0,'sku','A1'); pon(0,'cantidad',2); pon(1,'sku','B2'); pon(1,'cantidad',3); pon(2,'sku','C3'); pon(2,'cantidad',1);
 d.getElementById('erpPrecioTodos').value='1550'; w.eval("erpAplicarPrecioTodos()");
 const precios=()=>filas().map(f=>f.querySelectorAll('input[type=number]')[1].value);
 r.precios=precios(); r.totales=d.getElementById('erpPedTotales').textContent.replace(/\s+/g,' ').trim();
 d.getElementById('erpPrecioTodos').value='0'; w.eval("erpAplicarPrecioTodos()"); r.ceroNoCambia=precios().every(v=>v==='1550');
 r.fallas=[]; if(!/^v1\.9\.(1[3-9]|[2-9]\d)$/.test(r.version)) r.fallas.push('version'); if(!r.dueno.admin||!r.dueno.todos) r.fallas.push('dueno');
 if(r.precios.join()!=='1550,1550,1550'||!/Total: \$10,788\.00/.test(r.totales)||!r.ceroNoCambia) r.fallas.push('precioTodos');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3000);
