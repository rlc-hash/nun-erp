// v4.82: diseño nuevo (formato de Rafa): sin RFC ni piezas por defecto; 'Historial de pagos', estatus Liquidado/Parcial y % cubierto.
// v4.71 — ESTADO DE CUENTA del cliente (Cobranza → 📄 Estado de cuenta y en la ficha): elegir cliente y pedidos (todos / solo los que deben / a mano),
// documentos con saldo que no son de ningún pedido, pagos recibidos ligados por folio; PDF con la marca NUN (Total · Pagado · Saldo).
// Servidor de verdad (Codigo.gs en el emulador de Supabase), datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
(async()=>{
 const E=await import(path.join(__dirname,'..','supabase','functions','nun','emulador.js'));
 const fn=E.compilar(fs.readFileSync(path.join(__dirname,'..','backend','Codigo.gs'),'utf8'));
 const DB=new Map(); let PROPS={en_supabase:'1'}; const COD='DUENO-PRUEBA1';
 const servidor=async(tipo,payload)=>{ const r=await E.atender({fn,existentes:[...DB.keys()],props:PROPS,cargar:async ns=>new Map(ns.map(n=>[n,JSON.parse(JSON.stringify(DB.get(n)||[]))])),
   sesion:c=>String(c||'').toUpperCase()===COD,admin:c=>String(c||'').toUpperCase()===COD,tipo,payload});
   for(const s of r.sucias) DB.set(s.nombre,JSON.parse(JSON.stringify(s.filas))); if(r.props) PROPS=r.props; return r.texto; };
 const post=async b=>JSON.parse(await servidor('post',JSON.stringify(Object.assign({codigo:COD},b))));
 await post({accion:'inicializar'});
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.URL.createObjectURL=b=>{ w.__blob=b; return 'blob:x'; }; w.__abiertas=[]; w.open=()=>{ const v={html:'',closed:false,document:{open(){},write:x=>{v.html+=x},close(){}},print(){}}; w.__abiertas.push(v); return v; };
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true,mensaje:'NUN ERP backend'}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
 await sleep(3000); const r={fallas:[]};
 try{
  const C='CLIENTE ESTADO', L=a=>JSON.stringify(a.map(([s,c,p,ds])=>({sku:s,descripcion:ds,cantidad:c,precio_unitario:p})));
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'ce',razon_social:C,rfc:'XAXX010101000',telefono:'5500000000',vendedor:'EDGAR'}});
  await post({accion:'erp_crear',tabla:'clientes',item:{id:'otro',razon_social:'OTRO CLIENTE'}});
  // P1: pagado completo (cobro propio); P2: debe 4,000; P3: de otro cliente (no sale)
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p1',folio:'P0101',fecha:'2026-10-01',cliente:C,estatus:'confirmado',total:10000,items_json:L([['RL005B',10,1000,'MALETA RL005 BEIGE']]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_p1',numero:'P0101',cliente:C,tipo:'Pedido',total:10000,cobrado:10000,pendiente:0,factura_origen:'p1',fecha_emision:'2026-10-01'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p2',folio:'P0102',fecha:'2026-10-20',cliente:C,estatus:'confirmado',total:6000,items_json:L([['YH008N',20,300,'MOCHILA YH008 NEGRO']]),_sin_inventario:true}});
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'cob_p2',numero:'P0102',cliente:C,tipo:'Pedido',total:6000,cobrado:2000,pendiente:4000,factura_origen:'p2',fecha_emision:'2026-10-20'}});
  await post({accion:'erp_crear',tabla:'pedidos',item:{id:'p3',folio:'P0103',fecha:'2026-10-21',cliente:'OTRO CLIENTE',estatus:'confirmado',total:999,items_json:'[]',_sin_inventario:true}});
  // documento viejo con saldo sin pedido
  await post({accion:'erp_crear',tabla:'cobranza',item:{id:'bind_cob_9',numero:'V01300',cliente:C,tipo:'Remisión',total:1500,cobrado:500,pendiente:1000,factura_origen:'bind_rem_9',fecha_emision:'2026-09-01'}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i1',fecha:'2026-10-02',cliente:C,monto:10000,factura:'P0101',cuenta:'BBVA',tipo:'PAGO'}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i2',fecha:'2026-10-25',cliente:C,monto:2000,factura:'P0102',cuenta:'BBVA',tipo:'PAGO'}});
  await post({accion:'erp_crear',tabla:'ingresos',item:{id:'i3',fecha:'2026-09-05',cliente:C,monto:500,factura:'V01300',cuenta:'Efectivo',tipo:'PAGO'}});
  await w.eval("navegar('cobranza')"); await sleep(400);
  r.boton=/Estado de cuenta/.test(txt(d.querySelector('.page-title'))); if(!r.boton) r.fallas.push('boton');
  await w.eval("nunEstadoCuentaAbrir()"); await sleep(400);
  const inp=d.getElementById('ecCli'); inp.value=C; inp.dispatchEvent(new w.Event('input')); await sleep(50);
  const tot=()=>txt(d.getElementById('ecTot'));
  r.todo=tot(); if(!/Total\$17,500\.00.*Pagado\$12,500\.00.*Saldo pendiente\$5,000\.00.*2 pedido\(s\) \+ 1 documento\(s\) · 3 pago\(s\)/.test(r.todo)) r.fallas.push('todo');
  await w.eval("nunECMarcar('saldo')"); r.saldo=tot(); if(!/Total\$7,500\.00.*Saldo pendiente\$5,000\.00.*1 pedido\(s\) \+ 1 documento\(s\) · 2 pago\(s\)/.test(r.saldo)) r.fallas.push('soloDeben');
  // a mano: solo P0102
  const cks=[...d.querySelectorAll('#ecCuerpo input[type=checkbox]')]; cks[2].checked=false; cks[2].dispatchEvent(new w.Event('change')); // el de V01300
  r.mano=tot(); if(!/Total\$6,000\.00.*Pagado\$2,000\.00.*Saldo pendiente\$4,000\.00.*1 pedido\(s\) · 1 pago\(s\)/.test(r.mano)) r.fallas.push('aMano');
  await w.eval("nunECMarcar('todo')"); await w.eval("nunECPdf()"); await sleep(100);
  const h=w.__blob?await w.__blob.text():''; if(process.env.NUN_GUARDAR_HTML) fs.writeFileSync(process.env.NUN_GUARDAR_HTML,h); // para verlo
  const t=h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  r.pdf={titulo:/Estado de cuenta/i.test(t), cliente:t.includes(C), pedidos:t.includes('P0101')&&t.includes('P0102')&&!t.includes('P0103'), otro:t.includes('V01300'),
   sinPiezas:!t.includes('MOCHILA YH008 NEGRO'), saldo:/Saldo pendiente \$5,000\.00/.test(t), letras:/CINCO MIL PESOS/.test(t), pagos:/Historial de pagos/.test(t)&&/Total pagos \(3\) \$12,500\.00/.test(t), estatus:/Liquidado/.test(t)&&/Parcial/.test(t), cubierto:/71\.4% cubierto/.test(t), logo:/<svg/.test(h)};
  if(Object.values(r.pdf).some(v=>!v)) r.fallas.push('pdf');
  // ficha del cliente también tiene el botón
  w.eval("document.getElementById('modalEC').remove(); abrirDetalleCliente('ce')"); await sleep(300);
  r.ficha=/Estado de cuenta/.test(txt(d.querySelector('.drawer details'))); if(!r.ficha) r.fallas.push('ficha');
  r.version=txt(d.querySelector('.rwd-version')); if(!/v4\.(7[1-9]|[89]\d)/.test(r.version)) r.fallas.push('version');
 }catch(e){r.error=String(e.stack).slice(0,700)}
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores'); console.log(JSON.stringify(r,null,1)); w.close();
})();
