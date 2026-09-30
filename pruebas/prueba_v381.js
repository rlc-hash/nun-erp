// v3.81 — sin Bind: sincronización apagada, complemento de pago para facturas timbradas en Bind (lee PPD del XML),
// notas de crédito timbradas (CFDI Egreso serie NC ligado a la factura), dueño con todo y cambio de código de usuario. Datos inventados.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const XMLBIND='<cfdi:Comprobante Version="4.0" Serie="A" Folio="900" FormaPago="99" MetodoPago="PPD" Total="1160.00"></cfdi:Comprobante>';
const DB={
 facturas:[{id:'bind_fac_1',folio:'900',cliente:'CLIENTE UNO',total:1160,subtotal:1000,iva:160,uuid_sat:'BBBB0000-0000-4000-8000-000000000001',estatus:'timbrada',items_json:'[]'},
  {id:'f_nc',folio:'FT0010',cliente:'CLIENTE UNO',total:1160,subtotal:1000,iva:160,uuid_sat:'aaaa0000-0000-4000-8000-000000000010',estatus:'timbrada',forma_pago:'03',metodo_pago:'PUE',
   items_json:JSON.stringify([{sku:'A1',descripcion:'MALETA',cantidad:10,precio_unitario:100,iva_pct:16,clave_sat:'53121502'}])}],
 notascredito:[{id:'nc_a',folio:'',cliente:'CLIENTE UNO',documento_origen:'FT0010',total:232,estatus:'borrador',items_json:'[]'}],
 cobranza:[{id:'bind_cob_1',numero:'V01900',cliente:'CLIENTE UNO',total:1160,cobrado:160,pendiente:1000,factura_origen:'bind_fac_1',fecha_entrega:'2026-09-01'}],
 clientes:[{id:'cl1',razon_social:'CLIENTE UNO',rfc:'CACX7605101P8',cp:'64000',regimen_fiscal:'626',uso_cfdi:'G01'}],
 usuarios:[{codigo:'EDGAR-2026',nombre:'Edgar',rol:'vendedor',vendedor_asignado:'EDGAR',activo:true,permisos:'{}'}],
 remisiones:[],pedidos:[],ingresos:[],productos:[],pagosclientes:[]};
const enviados=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'RAFA-PRUEBA9',usuario:{codigo:'RAFA-PRUEBA9',nombre:'Rafa',rol:'cobranza'},permisos:{solo_consulta:true},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; enviados.push(b); await new Promise(z=>setTimeout(z,5)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='listar_usuarios') return J({ok:true,usuarios:DB.usuarios,items:DB.usuarios});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='obtener_empresa') return J({ok:true,config:{rfc:'EKU9003173C9',cp:'11000',razon_social:'EMPRESA PRUEBA',regimen_fiscal:'601'}});
   if(b.accion==='cfdi_xml_get') return J(String(b.uuid).toUpperCase()==='BBBB0000-0000-4000-8000-000000000001'?{ok:true,xml:XMLBIND}:{ok:false});
   if(b.accion==='facturama_timbrar') return J({ok:true,uuid:'cccc0000-0000-4000-8000-00000000000'+(b.cfdi.CfdiType==='E'?'1':'2'),id:'FAMA'+b.cfdi.CfdiType,xml:''});
   if(b.accion==='crear_usuario'){ DB.usuarios.push(b.datos); return J({ok:true}); }
   if(b.accion==='actualizar_usuario'){ const x=DB.usuarios.find(u=>u.codigo===b.codigo); if(x) Object.assign(x,b.cambios); return J({ok:!!x}); }
   if(b.accion==='capturar_pago_cliente') return J({ok:true});
   return J({ok:true,items:[]}); };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
setTimeout(async()=>{const r={};try{
 for (const t of ['facturas','notascredito','cobranza','clientes','remisiones','ingresos']) await w.eval(`cargarTabla('${t}')`);
 w.eval("State.data.empresa={rfc:'EKU9003173C9',cp:'11000',razon_social:'EMPRESA PRUEBA',regimen_fiscal:'601'}");
 r.version=d.body.innerHTML.match(/v3\.\d+ · Sistema NUN/)[0];
 w.eval("window.confirmDialog=async()=>true; window.confirm=()=>true");
 // 1) dueño con todo aunque su usuario diga "cobranza / solo consulta"
 r.dueno={admin:w.eval("nunEsAdmin()"),soloConsulta:w.eval("nunSoloConsulta()"),usuarios:w.eval("moduloPermitido('usuarios')"),gastos:w.eval("moduloPermitido('gastos')")};
 // 2) Bind apagado: no se pide nada a Bind
 const antes=enviados.length; await w.eval("sincronizarConBindAhora(false)"); await w.eval("bindFetch('/api/Clients').catch(e=>window.__bindErr=e.message)");
 r.bind={pidioBind:enviados.slice(antes).some(b=>b.accion==='bind_proxy'),mensaje:w.__bindErr||''};
 // 3) complemento para factura de Bind
 await w.eval("nunAbrirComplementoPago('bind_fac_1')"); await sleep(200);
 const mr=d.getElementById('modalREP'); const fb=DB.facturas.find(f=>f.id==='bind_fac_1');
 r.repBind={abre:!!mr,metodoGuardado:fb.metodo_pago,saldoAnt:mr&&d.getElementById('repSaldoAnt').value,pideParc:!!(mr&&d.getElementById('repParc'))};
 if(mr){ d.getElementById('repMonto').value='400'; d.getElementById('repForma').value='03'; d.getElementById('repCobranza').checked=false;
  await w.eval("nunConfirmarComplementoPago('bind_fac_1')"); r.repBind.sinParc=d.getElementById('repError').textContent;
  d.getElementById('repParc').value='2'; await w.eval("nunConfirmarComplementoPago('bind_fac_1')"); await sleep(300);
  const t=enviados.filter(b=>b.accion==='facturama_timbrar').pop(); const rel=t&&t.cfdi.Complemento.Payments[0].RelatedDocuments[0];
  r.repBind.cfdi=rel?{parc:rel.PartialityNumber,ant:rel.PreviousBalanceAmount,pag:rel.AmountPaid,insoluto:rel.ImpSaldoInsoluto}:null;
  r.repBind.nota=(DB.facturas.find(f=>f.id==='bind_fac_1').notas||'').replace(/uuid=\S+/,'uuid=…');
  await w.eval("cargarTabla('facturas')"); r.repBind.saldoDespues=w.eval("nunSaldoDoc(State.data.facturas.find(f=>f.id==='bind_fac_1'),'facturas')"); }
 // 4) nota de crédito timbrada
 await w.eval("nunAbrirTimbrarNC('nc_a')"); await sleep(200);
 d.getElementById('ncTipo').value='descuento'; d.getElementById('ncForma').value='03';
 await w.eval("nunTimbrarNC('nc_a')"); await sleep(300); r.ncErr=(d.getElementById('ncError')||{}).textContent;
 const tn=enviados.filter(b=>b.accion==='facturama_timbrar'&&b.cfdi.CfdiType==='E').pop(); const nca=DB.notascredito.find(n=>n.id==='nc_a');
 r.nc={tipo:tn&&tn.cfdi.CfdiType,serie:tn&&tn.cfdi.Serie,folio:tn&&tn.cfdi.Folio,uso:tn&&tn.cfdi.Receiver.CfdiUse,rel:tn&&tn.cfdi.Relations.Type+':'+tn.cfdi.Relations.Cfdis[0].Uuid.slice(0,8),
  item:tn&&[tn.cfdi.Items[0].ProductCode,tn.cfdi.Items[0].UnitCode,tn.cfdi.Items[0].Subtotal,tn.cfdi.Items[0].Taxes[0].Total,tn.cfdi.Items[0].Total].join(' '),
  guardada:{folio:nca.folio,estatus:nca.estatus,uuid:!!nca.uuid_sat,total:nca.total},saldoFactura:w.eval("nunSaldoDoc(State.data.facturas.find(f=>f.id==='f_nc'),'facturas')")};
 // 5) cambiar código de usuario: nuevo con lo mismo y el viejo desactivado (nunca borrado)
 w.eval("State.data.usuarios = " + JSON.stringify(DB.usuarios));
 await w.eval("nunCambiarCodigoUsuario('EDGAR-2026',{codigo:'EDGAR-K7P2QX9',nombre:'Edgar',rol:'vendedor',vendedor_asignado:'EDGAR',max_dispositivos:2,activo:true,permisos:{}})"); await sleep(200);
 r.codigo={nuevo:!!DB.usuarios.find(u=>u.codigo==='EDGAR-K7P2QX9'),viejo:DB.usuarios.find(u=>u.codigo==='EDGAR-2026').activo,borro:enviados.some(b=>b.accion==='eliminar_usuario')};
 await w.eval("nunCambiarCodigoUsuario('EDGAR-K7P2QX9',{codigo:'ABC',nombre:'Edgar',rol:'vendedor',vendedor_asignado:'EDGAR',permisos:{}})"); r.codigo.cortoRechazado=DB.usuarios.length===2;
 r.fallas=[];
 if(!r.dueno.admin||r.dueno.soloConsulta||!r.dueno.gastos) r.fallas.push('dueno');
 if(r.bind.pidioBind||!/ya no se usa/.test(r.bind.mensaje)) r.fallas.push('bind');
 if(!r.repBind.abre||r.repBind.metodoGuardado!=='PPD'||r.repBind.saldoAnt!=='1000'||!/parcialidad/.test(r.repBind.sinParc||'')) r.fallas.push('repBindAbre');
 if(!r.repBind.cfdi||r.repBind.cfdi.parc!==2||r.repBind.cfdi.ant!==1000||r.repBind.cfdi.insoluto!==600||r.repBind.saldoDespues!==600) r.fallas.push('repBindCfdi');
 if(r.nc.tipo!=='E'||r.nc.serie!=='NC'||r.nc.folio!=='0001'||r.nc.uso!=='G02'||!/^01:aaaa0000/.test(r.nc.rel)||r.nc.item!=='84111506 ACT 200.00 32.00 232.00') r.fallas.push('ncCfdi');
 if(r.nc.guardada.folio!=='NC0001'||!r.nc.guardada.uuid||r.nc.saldoFactura!==928) r.fallas.push('ncGuardada');
 if(!r.codigo.nuevo||r.codigo.viejo!==false||r.codigo.borro||!r.codigo.cortoRechazado) r.fallas.push('codigo');
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
