// v4.81 (Rafa 11 nov: "olvídalo, por pieza está mejor"): con NUN_CARRY_CAJA = false el editor maneja el carry on POR PIEZA (cantidad y precio por pieza).
// v4.80 (Rafa 11 nov) — en el editor del ERP el carry on va SIEMPRE por caja de 6: Cant. = cajas y Precio = precio de la caja;
// se guarda en piezas con pz_caja: 6. Al poner un SKU de carry on en un renglón nuevo queda en cajas solo. Sin red; datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const COD='RAFA-PRUEBA1', ENV=[];
 const its=[{sku:'RL009COPU',descripcion:'CARRY ON PP RL009CO PÚRPURA',cantidad:6,precio_unitario:550,iva_pct:0,pz_caja:6},{sku:'RL009N',descripcion:'MALETA PP RL009 NEGRO SET 3 PZ',cantidad:2,precio_unitario:1650,iva_pct:0}];
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Rafa',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; if(b.accion==='erp_upsert_batch'||b.accion==='erp_crear') ENV.push(b); const t=JSON.stringify({ok:true,items:[],valores:{},item:b.item}); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(1500);
 w.eval(`State.data.productos=[{id:'p1',sku:'RL011CON',descripcion:'CARRY ON PP RL011CO NEGRO',precio:550,categoria:'CARRY ON'},{id:'p2',sku:'YH008N',descripcion:'MOCHILA',precio:300}];
   State.data.cotizaciones=[{id:'q6',folio:'C0006',fecha:'2026-11-09',cliente:'CLIENTE X',estatus:'enviada',sin_iva:true,total:4600,items_json:${JSON.stringify(JSON.stringify(its))}}]; abrirDoc('cotizaciones','q6');`);
 await sleep(400);
 const fila=i=>[...d.querySelectorAll('#docItemsMount tbody tr')[i].querySelectorAll('input')].map(x=>x.value);
 r.carry=fila(0); if(!(r.carry[2]==='6'&&r.carry[3]==='550')) r.fallas.push('se ve en piezas');
 r.etiqueta=d.querySelector('#docItemsMount tbody tr .docCajaLbl').textContent; if(r.etiqueta!=='') r.fallas.push('sin etiqueta de caja');
 r.set3=fila(1); if(!(r.set3[2]==='2'&&r.set3[3]==='1650')) r.fallas.push('set de 3 igual');
 // escribir 2 cajas a $3,000 la caja
 w.eval("docCambiarItem(0,'cantidad','12'); docCambiarItem(0,'precio_unitario','500')");
 r.guardaPiezas=w.eval('JSON.stringify([docItems[0].cantidad,docItems[0].precio_unitario,docItems[0].pz_caja])'); if(r.guardaPiezas!=='[12,500,6]') r.fallas.push('guarda en piezas');
 r.total=d.getElementById('dTotalLbl').textContent; if(r.total!=='$9,300.00') r.fallas.push('total');
 // renglón nuevo con carry on → cajas solo
 w.eval("docAgregarItem(); docCambiarItem(2,'sku','RL011CON')");
 r.nuevo=w.eval('JSON.stringify([docItems[2].cantidad,docItems[2].precio_unitario,docItems[2].pz_caja])'); if(r.nuevo!=='[1,550,null]') r.fallas.push('nuevo en piezas');
 r.nuevoSeVe=fila(2).slice(2,4).join(); if(r.nuevoSeVe!=='1,550') r.fallas.push('nuevo se ve en piezas');
 w.eval("docAgregarItem(); docCambiarItem(3,'sku','YH008N')"); r.mochila=w.eval('JSON.stringify([docItems[3].cantidad,docItems[3].pz_caja])'); if(r.mochila!=='[1,null]'&&r.mochila!=='[1,undefined]') r.fallas.push('mochila en piezas');
 // guardar: va en piezas con pz_caja
 await w.eval("guardarDoc('cotizaciones','q6')"); await sleep(800);
 const g=ENV.find(x=>x.tabla==='cotizaciones'); const gi=g&&JSON.parse((g.items?g.items[0]:g.item).items_json);
 r.guardado=gi&&gi.map(i=>[i.sku,i.cantidad,i.precio_unitario,i.pz_caja||0]); if(!gi||gi[0][1]===undefined&&false||JSON.stringify(r.guardado)!=='[["RL009COPU",12,500,6],["RL009N",2,1650,0],["RL011CON",1,550,0],["YH008N",1,300,0]]') r.fallas.push('guardado');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; r.errs=errs.slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(0);})();
