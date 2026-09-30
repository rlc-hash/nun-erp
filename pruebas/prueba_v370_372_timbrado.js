const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const items=[{sku:'RL008N',descripcion:'SET DE MALETAS',cantidad:2,precio_unitario:3000,iva_pct:16},{sku:'ZRL006N24',descripcion:'MALETA INDIVIDUAL',cantidad:1,precio_unitario:900,iva_pct:16,clave_sat:''}];
const DB={facturas:[{id:'f_old',folio:1178,cliente:'X',total:1},{id:'f_new',folio:'FT0001',cliente:'CLIENTE NUEVO',total:7888,subtotal:6800,iva:1088,items_json:JSON.stringify(items),estatus:'borrador'},{id:'f_pg',folio:'FT0002',cliente:'PUBLICO EN GENERAL',total:116,items_json:JSON.stringify([{sku:'YH008N',descripcion:'MOCHILA',cantidad:1,precio_unitario:100,iva_pct:16}])}],
 clientes:[{id:'c1',razon_social:'CLIENTE NUEVO',rfc:'AAA010101AAA',cp:'06600',regimen_fiscal:'601',uso_cfdi:'G01'},{id:'c2',razon_social:'SIN REGIMEN',rfc:'BBB010101BBB',cp:'01000'}],
 productos:[{id:'p1',sku:'RL008N',descripcion:'SET',clave_sat:''},{id:'p2',sku:'ZRL006N24',descripcion:'IND',clave_sat:''},{id:'p3',sku:'YH008N',clave_sat:'53121603'}],cobranza:[],pedidos:[],remisiones:[],usuarios:[]};
const llamadas=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; llamadas.push(b); await new Promise(z=>setTimeout(z,80)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='obtener_empresa') return J({ok:true,config:{rfc:'CCA250120SX3',cp:52786,razon_social:'COMERCIALIZADORA CASRAF',regimen_fiscal:601}});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=DB[b.tabla].find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='facturama_timbrar') return J({ok:true,uuid:'ABCDEF12-0000-0000-0000-000000000000',id:'FAC123xyz'});
   if(b.accion==='erp_actualizar'){ const x=DB[b.tabla].find(r=>r.id===b.item.id); Object.assign(x,b.item); return J({ok:true}); }
   return J({ok:true,items:[],data:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window; const d=w.document; const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{ const r={};
 try{
  w.eval("confirm=()=>{throw new Error('no debe usar confirm')}");
  for (const t of ['facturas','clientes','productos']) await w.eval(`cargarTabla('${t}')`);
  w.eval("State.data.empresa={rfc:'CCA250120SX3',cp:52786,razon_social:'COMERCIALIZADORA CASRAF',regimen_fiscal:601}");
  r.folioSug=w.eval("siguienteFolioLocal('facturas')");
  // 1) Timbrar abre la ventana, no timbra directo
  await w.eval("facturaTimbrar('f_new')"); await sleep(50);
  r.abreVentana=!!d.getElementById('modalTimbrado'); r.timbroAntes=llamadas.some(x=>x.accion==='facturama_timbrar');
  r.usoPrellenado=d.getElementById('ftUso').value; r.metodoIni=d.getElementById('ftMetodo').value; r.formaIni=d.getElementById('ftForma').value;
  // 2) Sin elegir nada → errores, no timbra
  await w.eval("facturaTimbradoConfirmar('f_new')"); r.erroresVacio=d.getElementById('ftError').textContent;
  // 3) PPD → forma 99 bloqueada
  d.getElementById('ftMetodo').value='PPD'; w.eval("facturaTimbradoMetodo()"); r.ppd=[d.getElementById('ftForma').value,d.getElementById('ftForma').disabled];
  d.getElementById('ftMetodo').value='PUE'; w.eval("facturaTimbradoMetodo()"); r.pue=[d.getElementById('ftForma').value, d.querySelector('#ftForma option[value="99"]').disabled];
  d.getElementById('ftForma').value='03';
  const sels=[...d.querySelectorAll('.ftClave')]; sels[0].value='53121502'; sels[1].value='otra'; sels[1].nextElementSibling.value='5312150'; // clave mala (7 dígitos)
  await w.eval("facturaTimbradoConfirmar('f_new')"); r.errorClaveMala=d.getElementById('ftError').textContent;
  sels[1].nextElementSibling.value='53121503';
  await Promise.all([w.eval("facturaTimbradoConfirmar('f_new')"),w.eval("facturaTimbradoConfirmar('f_new')")]); await sleep(300);
  const tim=llamadas.filter(x=>x.accion==='facturama_timbrar');
  r.vecesTimbrado=tim.length;
  const c=tim[0]&&tim[0].cfdi; r.cfdi=c&&{Serie:c.Serie,Folio:c.Folio,Forma:c.PaymentForm,Metodo:c.PaymentMethod,Uso:c.Receiver.CfdiUse,Reg:c.Receiver.FiscalRegime,CP:c.Receiver.TaxZipCode,Claves:c.Items.map(i=>i.ProductCode)};
  const f=DB.facturas.find(x=>x.id==='f_new'); r.guardado={uuid:f.uuid_sat,est:f.estatus,forma:f.forma_pago,metodo:f.metodo_pago,notas:f.notas};
  r.productos=DB.productos.map(p=>p.sku+'='+p.clave_sat);
  // 4) Cliente sin régimen: no timbra, avisa
  r.sinRegimen=w.eval("facturaValidarTimbrado({cliente:'SIN REGIMEN',metodo_pago:'PUE',forma_pago:'03',uso_cfdi:'G01',items_json:JSON.stringify([{sku:'A',clave_sat:'53121502'}])})");
  // 5) Público en general: S01 fijo, clave del catálogo ya sale
  await w.eval("facturaTimbrar('f_pg')"); await sleep(50);
  r.pg={uso:d.getElementById('ftUso').value,usoDis:d.getElementById('ftUso').disabled,clave:d.querySelector('.ftClave').value};
  d.getElementById('modalTimbrado').remove();
  // 6) Cancelar reconoce el ID de Facturama guardado en notas (sin llegar a cancelar)
  w.eval("prompt=()=>'02'; confirm=()=>false");
  const docC=w.eval("State.data.facturas.find(x=>x.id==='f_new')"); delete docC.facturama_id; docC.notas=f.notas;
  await w.eval("facturaCancelar('f_new')"); r.cancelIdRecuperado=w.eval("State.data.facturas.find(x=>x.id==='f_new').facturama_id");
  // 7) Formulario de cliente con régimen y uso
  const h=w.eval("buildFormHTML(SCHEMAS.clientes,{regimen_fiscal:'626',uso_cfdi:'G01'})"); const dv=d.createElement('div'); dv.innerHTML=h; r.formCliente={reg:dv.querySelector('#f_regimen_fiscal').value, regOps:dv.querySelectorAll('#f_regimen_fiscal option').length, uso:dv.querySelector('#f_uso_cfdi').value, vacio:w.eval("(()=>{const x=document.createElement('div');x.innerHTML=buildFormHTML(SCHEMAS.clientes,{});return x.querySelector('#f_regimen_fiscal').value})()")};
  const h2=w.eval("buildFormHTML(SCHEMAS.pagos||Object.values(SCHEMAS).find(s=>s.fields.some(f=>f.type==='select')),{})"); r.otroSelectOk=/<select/.test(h2);
  r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 }catch(e){ r.error=String(e.stack||e).slice(0,600);}
 r.errs=errs.slice(0,5); console.log(JSON.stringify(r,null,1)); w.close(); },4000);
