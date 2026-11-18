// v5.08 (Rafa 18 nov: "modifiqué el pedido (1580 → 1570) y el saldo me sigue apareciendo el anterior") — al guardar un pedido confirmado con otro total,
// su cobro propio (cob_<id>) sube o baja lo mismo; si una remisión parcial ya le restó, se respeta. Un pedido sin cobro propio no toca Cobranza.
// El aviso rojo "El servidor no respondió" ya no sale solo por usuarios/bitácora. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const IT=n=>JSON.stringify([{sku:'RL009N',descripcion:'SET',cantidad:100,precio_unitario:n,iva_pct:0,unidad:'juego'}]);
 const ENV=[]; const DB={clientes:[{id:'c1',razon_social:'CLIENTE X',vendedor:'EDGAR'}],productos:[{id:'pr1',sku:'RL009N',descripcion:'SET',precio:1580}],
  pedidos:[{id:'ped1',folio:'P0075',fecha:'2026-11-12',cliente:'CLIENTE X',vendedor:'EDGAR',comision_pct:6,estatus:'confirmado',sin_iva:true,subtotal:158000,iva:0,total:158000,items_json:IT(1580)},
   {id:'ped2',folio:'P0076',fecha:'2026-11-12',cliente:'CLIENTE X',vendedor:'EDGAR',comision_pct:6,estatus:'confirmado',sin_iva:true,subtotal:158000,iva:0,total:158000,items_json:IT(1580)}],
  cobranza:[{id:'cob_ped1',cliente:'CLIENTE X',tipo:'Pedido',numero:'P0075',total:158000,cobrado:20000,pendiente:138000,factura_origen:'ped1',estatus:'pendiente'},
   {id:'cob_ped2',cliente:'CLIENTE X',tipo:'Pedido',numero:'P0076',total:58000,cobrado:0,pendiente:58000,factura_origen:'ped2',estatus:'pendiente'}],remisiones:[],facturas:[]};
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA1',usuario:{codigo:'RAFA-PRUEBA1',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion&&!/^(erp_listar|kv_leer|listar_|obtener_|archivo_)/.test(b.accion)) ENV.push(b);
     let x={ok:true,items:[],valores:{}}; if(b.accion==='erp_listar') x={ok:true,items:JSON.parse(JSON.stringify(DB[b.tabla]||[]))};
     if(b.accion==='erp_upsert_batch'){ (b.items||[]).forEach(it=>{ const row=(DB[b.tabla]||[]).find(z=>z.id===it.id); if(row) Object.assign(row,it); }); }
     if(b.accion==='listar_usuarios') x={ok:false,error:'tardó'};
     const t=JSON.stringify(x); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(2500);
 for(const t of ['clientes','productos','pedidos','cobranza']) await w.eval(`cargarTabla('${t}')`);
 w.eval('confirmDialog=async()=>true');
 // P0075: 1580 → 1570 en 100 sets = −1,000
 w.eval("abrirDoc('pedidos','ped1')"); await sleep(300); w.eval("docCambiarItem(0,'precio_unitario','1570')"); await w.eval("guardarDoc('pedidos','ped1')"); await sleep(800);
 r.cob1=DB.cobranza[0]; if(!(r.cob1.total===157000&&r.cob1.pendiente===137000)) r.fallas.push('cobro del pedido baja lo mismo (157,000 / falta 137,000)');
 try{w.eval('cerrarDrawer()');}catch(e){}
 // P0076: una remisión parcial ya le restó 100,000 al cobro → 1580 → 1600 = +2,000 → 60,000
 w.eval("abrirDoc('pedidos','ped2')"); await sleep(300); w.eval("docCambiarItem(0,'precio_unitario','1600')"); await w.eval("guardarDoc('pedidos','ped2')"); await sleep(800);
 r.cob2=DB.cobranza[1]; if(!(r.cob2.total===60000&&r.cob2.pendiente===60000)) r.fallas.push('respeta lo que ya restó la remisión');
 // aviso rojo: usuarios no cuenta
 w.eval("State._cargaOk = Object.assign(State._cargaOk||{}, {usuarios:false}); nunAvisoCopia()"); r.avisoUsuarios=!!d.getElementById('nunAvisoCopia');
 w.eval("State._cargaOk.cobranza=false; nunAvisoCopia()"); r.avisoCobranza=(d.getElementById('nunAvisoCopia')||{}).textContent||'';
 if(r.avisoUsuarios||!/cobranza/.test(r.avisoCobranza)||/usuarios/.test(r.avisoCobranza)) r.fallas.push('aviso rojo solo para listas de la operación');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; if(!/^v5\.(0[8-9]|[1-9]\d)/.test(r.version)) r.fallas.push('version');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
