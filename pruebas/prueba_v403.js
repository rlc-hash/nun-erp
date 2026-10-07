// v4.03 — Remisión desde pedido sin bajar listas completas (el servidor a veces tarda 30-60 s); aviso si ya hay una remisión igual del
// cliente (mismo total, 45 días) para no duplicarla; y al cambiar el total de una remisión queda escrito el monto de antes. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE DIEZ', it=(sku,c,pu)=>({sku,descripcion:'PIEZA '+sku,cantidad:c,precio_unitario:pu,iva_pct:0});
const hoy=new Date().toISOString().substring(0,10);
const DB={clientes:[{id:'cl1',razon_social:N}],
 pedidos:[{id:'p4',folio:'P0004',cliente:N,estatus:'borrador',vendedor:'EDGAR',fecha:hoy,sin_iva:true,total:4650,items_json:JSON.stringify([it('A',3,1550)])}],
 remisiones:[{id:'r6',folio:'R0006',cliente:N,estatus:'borrador',total:4650,fecha:hoy,pedido_origen:'',items_json:JSON.stringify([it('A',3,1550)])},
  {id:'r323',folio:'323',cliente:'CLIENTA ONCE',estatus:'pendiente',total:5550,fecha:'2026-09-28',sin_iva:true,notas:'Importada desde Bind ERP',items_json:JSON.stringify([it('B',1,5550)])}],
 facturas:[],cobranza:[{id:'bind_cob_323',numero:'V01323',cliente:'CLIENTA ONCE',total:5550,cobrado:0,pendiente:5550,factura_origen:'r323'}],ingresos:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'COBR-PRUEBA1',usuario:{codigo:'COBR-PRUEBA1',nombre:'Yazmin',rol:'cobranza'},permisos:{ver_operacion:true,editar_operacion:true,ver_catalogos:true},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.11'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(Object.assign({},b.item)); return J({ok:true,item:b.item}); }
   if(b.accion==='erp_upsert_batch'){ for(const x of b.items){ const y=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===x.id); if(y) Object.assign(y,x); else DB[b.tabla].push(x);} return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['clientes','pedidos','remisiones','facturas','cobranza']) await w.eval(`cargarTabla('${t}')`);
 // 1) ya hay R0006 igual: primero dice "no" → no se crea nada
 w.eval("window.__preg=[]; window.confirmDialog=async(o)=>{ window.__preg.push(o.message); return window.__resp; }; window.__resp=false");
 await w.eval("nunDesdePedidos('p4')"); await sleep(200);
 await w.eval("nunDesdePedidosCrear('remisiones')"); await sleep(300);
 r.avisoNo={pregunta:/Ya existe la remisión R0006 de CLIENTE DIEZ por \$4,650.00.*sin pedido/.test(w.__preg[0]||''),creadas:DB.remisiones.length,boton:!!d.getElementById('dpBoton')&&!d.getElementById('dpBoton').disabled}; // v4.14 sin botón de remisión: el de factura queda libre
 // 2) dice "sí, es otra venta" → se crea sin bajar listas completas antes de terminar
 w.eval("window.__resp=true"); const antes=enviados.length;
 await w.eval("nunDesdePedidosCrear('remisiones')");
 const llamadas=enviados.slice(antes).map(b=>b.accion+(b.tabla?':'+b.tabla:''));
 r.crear={creadas:DB.remisiones.length,listasAntesDeTerminar:llamadas.slice(0,llamadas.indexOf('erp_upsert_batch:pedidos')+1).filter(x=>/^erp_listar/.test(x)).length,llamadas:llamadas.join(','),pedido:DB.pedidos[0].estatus};
 await sleep(300);
 // 3) cambiar el total de una remisión: queda el monto de antes en sus notas y Cobranza se actualiza
 w.eval("abrirDoc('remisiones','r323')"); await sleep(300);
 w.eval("docItems[0].precio_unitario=5250"); await w.eval("guardarDoc('remisiones','r323')"); await sleep(400);
 const rr=DB.remisiones.find(x=>x.id==='r323'); r.cambio={total:rr.total,nota:/Total cambió de \$5,550.00 a \$5,250.00 el \d{4}-\d{2}-\d{2} \(Yazmin\)/.test(rr.notas||''),conservaBind:/Importada desde Bind ERP/.test(rr.notas||''),cobro:DB.cobranza.find(c=>c.id==='bind_cob_323').total};
 r.fallas=[];
 if(!r.avisoNo.pregunta||r.avisoNo.creadas!==2||r.avisoNo.boton!==true) r.fallas.push('avisoNo');
 if(r.crear.creadas!==3||r.crear.listasAntesDeTerminar!==0||r.crear.pedido!=='entregado') r.fallas.push('crear');
 if(r.cambio.total!==5250||!r.cambio.nota||!r.cambio.conservaBind||r.cambio.cobro!==5250) r.fallas.push('cambio');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},4000);
