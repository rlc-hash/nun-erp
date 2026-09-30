const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={pedidos:[{id:'p1',folio:'P0001',fecha:'2026-09-29',cliente:'CLI',total:1160,estatus:'confirmado',items_json:'[]'}],
 remisiones:[{id:'r1',folio:'R0001',fecha:'2026-09-29',cliente:'CLI',total:1160,pedido_origen:'P0001',estatus:'facturada',items_json:'[]'},
   {id:'bind_rem_322',folio:322,fecha:'2026-09-28T06:00:00.000Z',cliente:'CLIENTE UNO',total:18499.98,estatus:'facturada',items_json:'[]'}],
 facturas:[{id:'f1',folio:'FT0002',fecha:'2026-09-29',cliente:'CLI',total:1160,pedido_origen:'R0001',estatus:'timbrada',uuid_sat:'u1',metodo_pago:'PPD',notas:'REP CP0002 uuid=aa monto=500.00 fecha=2026-09-29 parc=1',items_json:'[]'},
   {id:'f322',folio:'FT0001',fecha:'2026-09-29',cliente:'CLIENTE UNO',total:18499.98,pedido_origen:'REM 322',estatus:'timbrada',uuid_sat:'u2',metodo_pago:'PPD',notas:'REP CP0001 uuid=bb monto=18499.98 fecha=2026-09-28 parc=1',items_json:'[]'},
   {id:'bind_fac_1092',folio:1092,fecha:'2026-03-01T06:00:00.000Z',cliente:'X',total:5000,pedido_origen:'',estatus:'timbrada',uuid_sat:'u3',items_json:'[]'}],
 notascredito:[{id:'nc1',folio:1005,fecha:'2026-03-05T06:00:00.000Z',documento_origen:'1092',total:1000,estatus:'timbrada',motivo:'devolución'}],
 cobranza:[{id:'cob_r1',numero:'R0001',factura_origen:'r1',total:1160,cobrado:500,pendiente:660},{id:'bind_cob_322',numero:'V01322',total:18499.98,cobrado:18499.98,pendiente:0},{id:'bind_cob_1092',numero:'1092',total:5000,cobrado:4000,pendiente:0}],
 ingresos:[{id:'i1',fecha:'2026-09-29',factura:'R0001',monto:500,cuenta:'BBVA',comentarios:'Pago factura FT0002'},{id:'i2',fecha:'2026-09-28T06:00:00.000Z',factura:'V01322',monto:18499.98,cuenta:'BBVA'}],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,20)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]}); return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB).filter(t=>t!=='usuarios')) await w.eval(`cargarTabla('${t}')`);
 r.fechas=w.eval("[fmtFecha('2026-09-29'),fmtFecha('2026-09-28T06:00:00.000Z')]");
 r.saldos=w.eval("['f1','f322','bind_fac_1092'].map(id=>{const f=State.data.facturas.find(x=>x.id===id);return f.folio+':'+nunSaldoDoc(f,'facturas')})");
 const html=w.eval("renderDocOperativo('facturas')"); r.kpi=(html.match(/<div class="sub">([^<]*)/)||[])[1];
 w.eval("navegar('facturas')"); await sleep(300);
 r.estatusLista=[...d.querySelectorAll('#dtMountDoc_facturas tbody tr')].map(tr=>tr.textContent.replace(/\s+/g,' ').trim().slice(0,70));
 w.eval("abrirDoc('facturas','f1')"); await sleep(200);
 r.panel=(d.querySelector('.drawer-body, #drawerBody, .drawer')||d.body).textContent.replace(/\s+/g,' ').match(/Pedido P0001.*?ver detalle/)?.[0];
 r.accionesPanel=[...d.querySelectorAll("button")].map(b=>b.textContent.trim()).filter(t=>/PDF|XML|Pago|Cancelar ante|Factura|Remisi/.test(t));
 r.pie=[...d.querySelectorAll('.drawer-footer button, #drawerFooter button')].map(b=>b.textContent.trim());
 w.eval("drawerCambiarTab('rel')"); await sleep(100);
 r.rel=(d.getElementById('nunRelMount')||{}).textContent.replace(/\s+/g,' ').slice(0,400);
 w.eval("abrirDoc('pedidos','p1')"); await sleep(200); r.panelPedido=d.body.textContent.replace(/\s+/g,' ').match(/Pedido P0001.*?ver detalle/)?.[0];
 w.eval("abrirDoc('facturas','bind_fac_1092')"); await sleep(200); r.panelNC=d.body.textContent.replace(/\s+/g,' ').match(/Factura 1092.*?ver detalle/)?.[0];
}catch(e){r.error=String(e.stack).slice(0,500)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3000);
