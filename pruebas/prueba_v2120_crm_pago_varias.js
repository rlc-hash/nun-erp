// App de vendedores v2.1.22 (Rafa 12 nov: "uno solo para registrar pago: quién lo mandó, y lo pones a varias cuentas, como uno de agregar") —
// 💵 Registrar pago: ¿quién lo mandó? (cliente) · monto · cuentas que paga (la que tocaste; ＋ Agregar otra cuenta) · se reparte de la MÁS VIEJA a la más nueva.
// Un pago por verificar por cuenta (misma foto); reintento no duplica. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const PV=[],FOTOS=[];
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'COMERCIALIZADORA EJEMPLO',vendedor:'EDGAR',contacto:'Ingrid'}],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cotizaciones:[],productos:[],
  cobranza:[{id:'k2',cliente:'COMERCIALIZADORA EJEMPLO',tipo:'Remisión',numero:'V01325',total:9492.01,cobrado:0,pendiente:9492.01,fecha_emision:'2026-09-28',vendedor:'EDGAR'},
   {id:'k1',cliente:'COMERCIALIZADORA EJEMPLO',tipo:'Pedido',numero:'PED 1308',total:45800,cobrado:10000,pendiente:35800,fecha_emision:'2026-08-13',vendedor:'EDGAR'}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); let r={ok:true};
    if(b.accion==='erp_crear'&&b.tabla==='pagosverificar'){ if(PV.some(p=>p.id===b.item.id)) r={ok:true,ya_existia:true}; else PV.push(b.item); }
    if(b.accion==='archivo_subir') FOTOS.push(b.pv_id);
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[{nombre:'BBVA',activa:true}]};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(400);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(2[2-9])/.test(r.version)) r.fallas.push('version');
 // 1) desde Cobranza: botón arriba y buscar "quién lo mandó" (también por el contacto)
 w.eval("ir('cobranza')"); await sleep(30);
 r.botonCobranza=!!d.querySelector('button[onclick^="abrirRegistrarPago"]'); if(!r.botonCobranza) r.fallas.push('botón en Cobranza');
 w.eval("abrirRegistrarPago('')"); w.eval("pgBuscarCli('ingrid')"); await sleep(10);
 const op=d.querySelector('#pgCliRes .res > div'); r.encontro=op&&op.textContent; if(!/COMERCIALIZADORA EJEMPLO/.test(r.encontro||'')) r.fallas.push('buscar quién lo mandó');
 op.click(); await sleep(20);
 r.filaInicial=w.eval('S.pg.filas.join()'); if(r.filaInicial!=='k1') r.fallas.push('empieza con la más vieja');
 // 2) tocar la cuenta V01325, escribir 45,292 y ＋ Agregar la otra: se acomoda de la más vieja y se reparte
 w.eval("abrirPago('k2')"); await sleep(20);
 const m=d.getElementById('pgMonto'); m.value='45292'; m.dispatchEvent(new w.Event('input'));
 r.agregar=[...d.querySelectorAll('select option')].map(o=>o.textContent).filter(t=>/Agregar|PED/.test(t)); if(!r.agregar.some(t=>/PED 1308/.test(t))) r.fallas.push('opción agregar otra cuenta');
 w.eval("pgAgregar('k1')"); await sleep(20);
 r.reparto=[0,1].map(i=>d.getElementById('pgM'+i).value).join(); if(r.reparto!=='35800,9492') r.fallas.push('reparto de la más vieja');
 r.suma=d.getElementById('pgSuma').textContent; if(!/Se reparte completo/.test(r.suma)) r.fallas.push('suma');
 const q=d.getElementById('pgQuien'); q.value='Ingrid'; q.dispatchEvent(new w.Event('input'));
 const f=new w.File(['x'],'comp.jpg',{type:'image/jpeg'}); w.eval('prepararFoto=async f=>({nombre:f.name,mime:f.type,datos:"eA=="})'); w.__f=f; w.eval("S.pg.foto=window.__f");
 await w.eval('guardarPago()'); await sleep(100);
 r.pv=PV.map(p=>p.cobro_id+':'+p.monto); if(JSON.stringify(r.pv)!=='["k1:35800","k2:9492"]') r.fallas.push('dos pagos por verificar');
 r.notas=PV[0]&&PV[0].notas; if(!/Un pago de \$45,292\.00 repartido en 2 cuentas \(1 de 2\) · Depositó: Ingrid/.test(r.notas||'')) r.fallas.push('notas');
 if(FOTOS.length!==2) r.fallas.push('foto en cada pago');
 // 3) más de lo que deben → no deja
 w.eval("abrirPago('k2')"); const m2=d.getElementById('pgMonto'); m2.value='99999'; m2.dispatchEvent(new w.Event('input')); const n=PV.length; await w.eval('guardarPago()'); r.noDejaDeMas=PV.length===n; if(!r.noDejaDeMas) r.fallas.push('no deja más de lo que deben');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
