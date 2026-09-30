const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const DB={pedidos:[{id:'p1',folio:'P0001',fecha:'2026-09-29',cliente:'CLIENTE DOS DE PRUEBA',total:3200,estatus:'confirmado',vendedor:'EDGAR',items_json:JSON.stringify([{sku:'RL007N',descripcion:'MALETA',cantidad:1,precio_unitario:1293.403,iva_pct:16}])}],
 facturas:[],remisiones:[],
 cobranza:[{id:'c1',numero:'1070',cliente:'TIENDA TRES',total:20700,cobrado:20700,pendiente:0,fecha_entrega:'2026-05-01T06:00:00.000Z'},{id:'c2',numero:'V01322',cliente:'CLIENTE UNO',total:18499.98,cobrado:18499.98,pendiente:0,fecha_entrega:'2026-04-01T06:00:00.000Z'},{id:'c3',numero:'V01100',cliente:'CLIENTE DOS DE PRUEBA',total:500,cobrado:0,pendiente:500,fecha_entrega:'2026-06-01T06:00:00.000Z'}],
 ingresos:[{id:'i1',fecha:'2026-05-29T06:00:00.000Z',cliente:'TIENDA TRES',factura:'1070',monto:20700,cuenta:'BBVA',tipo:'cobro'},{id:'i2',fecha:'2026-09-28T06:00:00.000Z',cliente:'CLIENTE UNO',factura:'V01322',monto:18499.98,cuenta:'BBVA',tipo:'cobro'},{id:'i3',fecha:'2025-09-07T06:00:00.000Z',cliente:'CLIENTE DOS DE PRUEBA',factura:'1029',monto:1000,cuenta:'BBVA',tipo:'cobro'},{id:'i4',fecha:'2026-09-29T06:00:00.000Z',cliente:'CLIENTE DOS DE PRUEBA',factura:'FT0002',monto:3199.72,cuenta:'BBVA',tipo:'cobro'},{id:'i5',fecha:'2026-09-30T06:00:00.000Z',cliente:'CLIENTE DOS DE PRUEBA',factura:'X',monto:99,tipo:'CANCELADO_BIND'}],
 clientes:[{id:'cl1',razon_social:'CLIENTE DOS DE PRUEBA',credito_dias:90}],usuarios:[]};
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; await new Promise(z=>setTimeout(z,15)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='convertir_documento'){ const p=DB.pedidos.find(x=>x.id===b.id_origen); const n={id:'fac_srv1',folio:'FAC-2026-0001',cliente:p.cliente,total:0,items_json:'[]',estatus:'borrador',fecha:'2026-09-29'}; DB.facturas.push(n); DB.cobranza.push({id:'cob_srv1',numero:'FAC-2026-0001',descripcion:'Factura FAC-2026-0001',factura_origen:'fac_srv1',cliente:p.cliente,total:0,cobrado:0,pendiente:0,fecha_entrega:'2026-09-29'}); return J({ok:true,folio:n.folio,item:{id:n.id}}); }
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB).filter(t=>t!=='usuarios')) await w.eval(`cargarTabla('${t}')`);
 r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 w.eval("navegar('ingresos')"); await sleep(400);
 r.ingresos=[...d.querySelectorAll('#dtMount_ingresos tbody tr')].map(tr=>tr.textContent.replace(/\s+/g,' ').trim().slice(0,40));
 w.eval("navegar('cobranza')"); await sleep(400);
 const filas=()=>[...d.querySelectorAll('#cobranzaMount tbody tr')].map(tr=>tr.textContent.replace(/\s+/g,' ').trim().slice(0,90));
 r.cobHead=[...d.querySelectorAll('#cobranzaMount thead th')].map(t=>t.textContent.trim()).join('|');
 r.cobDefault=filas();
 w.eval("cbFiltro('orden','pago-desc')"); await sleep(300); r.cobPorPago=filas();
 r.sinMutar=w.eval("State.data.cobranza.some(c=>'_ult_pago' in c)");
 w.eval("abrirDetalleCliente('cl1')"); await sleep(300);
 r.tabs=[...d.querySelectorAll('.drawer-tabs button, .drawer .tab, [onclick^=\"drawerCambiarTab\"]')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,8);
 r.pagosCli=(d.getElementById('nunPagosCliMount')||{}).textContent?.replace(/\s+/g,' ').trim();
 w.eval("cerrarDrawer()"); w.eval("window.confirmDialog=async()=>true");
 await w.eval("convertirDocConItems('pedidos','p1','facturas')"); await sleep(300);
 r.conv={fac:DB.facturas.map(f=>f.folio+' '+f.total), cob:DB.cobranza.filter(c=>c.factura_origen==='fac_srv1').map(c=>[c.numero,c.descripcion,c.total,c.pendiente,c.vendedor])};
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
