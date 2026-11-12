// App de vendedores v2.1.20 (Rafa 12 nov) — 💵 Un pago a varias cuentas: el vendedor escribe lo que depositó el cliente, se reparte solo empezando por la
// cuenta MÁS VIEJA (se puede cambiar), y se reporta un pago por verificar por cada cuenta (misma foto). Reintento = mismos ids, no se duplica. Sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const PV=[],FOTOS=[]; let FALLA_FOTO=0;
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'COMERCIALIZADORA EJEMPLO',vendedor:'EDGAR'}],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cotizaciones:[],productos:[],
  cobranza:[{id:'k2',cliente:'COMERCIALIZADORA EJEMPLO',tipo:'Remisión',numero:'V01325',total:9492.01,cobrado:0,pendiente:9492.01,fecha_emision:'2026-09-28',vendedor:'EDGAR'},
   {id:'k1',cliente:'COMERCIALIZADORA EJEMPLO',tipo:'Pedido',numero:'PED 1308',total:45800,cobrado:10000,pendiente:35800,fecha_emision:'2026-08-13',vendedor:'EDGAR'}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let r={ok:true};
    if(b.accion==='erp_crear'&&b.tabla==='pagosverificar'){ if(PV.some(p=>p.id===b.item.id)) r={ok:true,ya_existia:true}; else PV.push(b.item); }
    if(b.accion==='archivo_subir'){ if(FALLA_FOTO){ FALLA_FOTO--; r={ok:false,error:'sin señal'}; } else FOTOS.push(b.pv_id); }
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[{nombre:'BBVA',activa:true}]};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(400);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(2\d)/.test(r.version)) r.fallas.push('version');
 w.eval("abrirCliente('COMERCIALIZADORA EJEMPLO')"); await sleep(50);
 r.boton=!!d.querySelector('button[onclick^="abrirPagoVarios"]'); if(!r.boton) r.fallas.push('botón en el cliente');
 w.eval("abrirPagoVarios('COMERCIALIZADORA EJEMPLO')"); await sleep(30);
 r.orden=w.eval('S.pv2.L.map(x=>x.c.numero).join()'); if(r.orden!=='PED 1308,V01325') r.fallas.push('la más vieja primero');
 const m=d.getElementById('p2Monto'); m.value='45292'; m.dispatchEvent(new w.Event('input'));
 r.reparto=[0,1].map(i=>d.getElementById('p2M'+i).value).join(); if(r.reparto!=='35800,9492') r.fallas.push('reparto');
 // con foto; la 2a foto falla una vez → reintento no duplica los pagos
 const f=new w.File(['x'],'comp.jpg',{type:'image/jpeg'}); Object.defineProperty(d.getElementById('p2Foto'),'files',{value:[f]});
 w.eval('prepararFoto=async f=>({nombre:f.name,mime:f.type,datos:"eA=="})');
 FALLA_FOTO=0; let cuenta=0; const orig=w.eval('subirComprobante'); w.subirComprobante=async(id,ff)=>{ cuenta++; if(cuenta===2) return 'sin señal'; return orig(id,ff); };
 await w.eval('guardarPagoVarios()'); await sleep(50);
 r.trasFalla={pv:PV.length,fotos:FOTOS.length}; if(PV.length!==2||FOTOS.length!==1) r.fallas.push('falla de foto a la mitad');
 await w.eval('guardarPagoVarios()'); await sleep(100);
 r.final={pv:PV.map(p=>p.cobro_id+':'+p.monto),fotos:FOTOS.length,ids:PV.map(p=>p.id.replace(/^pv_\d+_\w+_/,'g_'))};
 if(JSON.stringify(r.final.pv)!=='["k1:35800","k2:9492"]'||FOTOS.length!==2) r.fallas.push('reintento sin duplicar');
 if(!/Un pago de \$45,292\.00 repartido en 2 cuentas \(1 de 2\)/.test(PV[0].notas)) r.fallas.push('notas');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
