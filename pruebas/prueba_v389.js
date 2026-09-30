// v3.89 — cancelar un pago desde Ingresos: queda CANCELADO (no se borra) y el documento recupera su saldo.
// Caso 1: pago de Bind (sin renglón en PagosClientes). Caso 2: pago capturado en el sistema (usa la anulación del servidor). Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const N='CLIENTE PRUEBA DELTA';
const DB={ingresos:[{id:'bind_pag_1',fecha:'2026-05-01',cliente:N,factura:'V01100',cuenta:'BBVA',tipo:'cobro',monto:25000},{id:'ing_2',fecha:'2026-09-30',cliente:N,factura:'R0005',cuenta:'Efectivo',tipo:'cobro',monto:1000}],
 cobranza:[{id:'bind_cob_100',numero:'V01100',cliente:N,total:95000,cobrado:95000,pendiente:0},{id:'cob_r5',numero:'R0005',cliente:N,total:5000,cobrado:1000,pendiente:4000}],
 pagosclientes:[{timestamp:'2026-09-30T18:00:00.000Z',id_doc:'cob_r5',cliente:N,monto:1000,ingreso_id:'ing_2'}],clientes:[],usuarios:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(!o||!o.body) return J({ok:true,mensaje:'NUN ERP backend v0.9.10'});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='editar_pago_manual'){ const p=DB.pagosclientes.find(x=>x.timestamp===b.timestamp); const c=DB.cobranza.find(x=>x.id===p.id_doc); c.cobrado-=p.monto; c.pendiente=c.total-c.cobrado; DB.ingresos.find(i=>i.id===p.ingreso_id).tipo='CANCELADO'; p.monto=0; return J({ok:true}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 w.eval("window.confirmDialog=async()=>true; window.prompt=()=>'se capturó dos veces'");
 await w.eval("cargarTabla('ingresos')"); w.eval("navegar('ingresos')"); await sleep(300);
 w.eval("abrirFormGenerico('ingresos','bind_pag_1')"); await sleep(200);
 r.boton=[...d.querySelectorAll('.drawer button')].some(b=>b.textContent.trim()==='Cancelar pago');
 await w.eval("nunCancelarIngreso('bind_pag_1')"); await sleep(300);
 const i1=DB.ingresos[0], c1=DB.cobranza[0]; r.bind={tipo:i1.tipo,monto:i1.monto,motivo:/se capturó dos veces/.test(i1.comentarios||''),cobrado:c1.cobrado,pendiente:c1.pendiente};
 await w.eval("nunCancelarIngreso('ing_2')"); await sleep(300);
 const i2=DB.ingresos[1], c2=DB.cobranza[1]; r.sistema={tipo:i2.tipo,cobrado:c2.cobrado,pendiente:c2.pendiente,usoServidor:enviados.some(b=>b.accion==='editar_pago_manual')};
 r.lista=w.eval("State.data.ingresos.length"); r.borro=enviados.some(b=>/eliminar/.test(b.accion||''));
 r.fallas=[]; if(!r.boton) r.fallas.push('boton');
 if(r.bind.tipo!=='CANCELADO'||r.bind.monto!==25000||!r.bind.motivo||r.bind.cobrado!==70000||r.bind.pendiente!==25000) r.fallas.push('bind');
 if(r.sistema.tipo!=='CANCELADO'||r.sistema.cobrado!==0||r.sistema.pendiente!==5000||!r.sistema.usoServidor) r.fallas.push('sistema');
 if(r.lista!==0||r.borro) r.fallas.push('lista');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
