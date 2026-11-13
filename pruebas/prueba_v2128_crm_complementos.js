// App v2.1.28 (Rafa 13 nov) — complementos de pago en la app: la factura (y el pedido de esa factura) muestran sus complementos timbrados
// (de las notas "REP CP… uuid=…"); al tocar uno se arma el PDF con nunHtmlREP (de nun-pdf.js) y se puede enviar/guardar PDF y XML.
// Al reportar un pago de factura PPD sale el aviso; en "Pagos por confirmar" de la oficina, la liga al sistema para timbrar. Sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const XREP=`<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Serie="CP" Folio="1" Fecha="2026-11-13T10:00:00" LugarExpedicion="06020" Total="0"><cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA PRUEBA" RegimenFiscal="601"/><cfdi:Receptor Rfc="XAXX010101000" Nombre="CLIENTE PV" DomicilioFiscalReceptor="06020" RegimenFiscalReceptor="601" UsoCFDI="CP01"/><cfdi:Complemento><pago20:Pagos><pago20:Pago FechaPago="2026-11-12T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="600.00"><pago20:DoctoRelacionado IdDocumento="aaaa" Serie="FT" Folio="10" NumParcialidad="1" ImpSaldoAnt="1160.00" ImpPagado="600.00" ImpSaldoInsoluto="560.00" ObjetoImpDR="02"/></pago20:Pago></pago20:Pagos><tfd:TimbreFiscalDigital UUID="cccc-1" FechaTimbrado="2026-11-13T10:00:01" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="000"/></cfdi:Complemento></cfdi:Comprobante>`;
(async()=>{const r={fallas:[]};try{
 const LL=[]; const DB={clientes:[{id:'c1',razon_social:'CLIENTE PV',vendedor:'EDGAR'}],remisiones:[],ingresos:[],cotizaciones:[],productos:[],
  pedidos:[{id:'p1',folio:'P0001',cliente:'CLIENTE PV',total:1160,estatus:'facturado',vendedor:'EDGAR',fecha:'2026-11-01'}],
  facturas:[{id:'f1',folio:'FT0010',cliente:'CLIENTE PV',total:1160,metodo_pago:'PPD',uuid_sat:'aaaa',estatus:'timbrada',pedido_origen:'P0001',fecha:'2026-11-01',vendedor:'EDGAR',
    notas:'Cobro en P0001 (id cob_p1) · REP CP0001 uuid=cccc-1 monto=600.00 fecha=2026-11-12 parc=1 sant=1160.00 fid=x'},
   {id:'f2',folio:'FT0011',cliente:'CLIENTE PV',total:500,metodo_pago:'PUE',uuid_sat:'bbbb',estatus:'timbrada',fecha:'2026-11-02',vendedor:'EDGAR',notas:''}],
  cobranza:[{id:'cob_p1',cliente:'CLIENTE PV',tipo:'Pedido',numero:'P0001',total:1160,cobrado:600,pendiente:560,factura_origen:'p1',fecha_emision:'2026-11-01',vendedor:'EDGAR'},
   {id:'cob_f2',cliente:'CLIENTE PV',tipo:'Factura',numero:'FT0011',total:500,cobrado:0,pendiente:500,factura_origen:'f2',fecha_emision:'2026-11-02',vendedor:'EDGAR'}],
  pagosverificar:[{id:'pv1',cobro_id:'cob_p1',cliente:'CLIENTE PV',documento:'Pedido P0001',monto:560,fecha:'2026-11-13',estatus:'por_verificar',vendedor:'EDGAR',cuenta:'BBVA',forma:'Transferencia'}]};
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{}; w.open=()=>null;
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); LL.push(b); let r={ok:true};
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Rafa',rol:'admin'},permisos:{}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[{nombre:'BBVA',activa:true}]};
    else if(b.accion==='archivo_listar') r={ok:true,items:[]};
    else if(b.accion==='cfdi_xml_get') r=b.uuid==='cccc-1'?{ok:true,xml:XREP}:{ok:false};
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=dom.window.document; await sleep(400);
 d.getElementById('lgCod').value='rafa-x'; await w.eval('entrar()'); await sleep(500);
 r.version=(d.querySelector('.ver')||{}).textContent; if(!/^v2\.1\.(2[8-9])/.test(r.version)) r.fallas.push('version');
 r.reps=w.eval("JSON.stringify(repsDe(S.d.facturas[0]))"); if(!/"folio":"CP0001".*"monto":600.*"parc":1/.test(r.reps)) r.fallas.push('lee complementos');
 r.ppd=w.eval("JSON.stringify([facPPDDeCobro('cob_p1').map(f=>f.folio), facPPDDeCobro('cob_f2').map(f=>f.folio)])"); if(r.ppd!=='[["FT0010"],[]]') r.fallas.push('factura PPD del cobro');
 // hoja de la factura: complementos + aviso PPD
 w.eval("abrirDoc('facturas','f1')"); await sleep(50); const hf=d.body.textContent;
 if(!/Complementos de pago/.test(hf)||!/CP0001/.test(hf)||!/parcialidad 1/.test(hf)) r.fallas.push('complementos en factura');
 if(!/se timbra el complemento/.test(hf)) r.fallas.push('aviso PPD en factura');
 // hoja del pedido: también sale el complemento de su factura
 w.eval("abrirDoc('pedidos','p1')"); await sleep(50); if(!/Complementos de pago[\s\S]*CP0001/.test(d.body.textContent)) r.fallas.push('complementos en pedido');
 // factura PUE: nada de complementos
 w.eval("abrirDoc('facturas','f2')"); await sleep(50); r.pue=d.getElementById('hoja').textContent.replace(/\s+/g,' ').slice(0,400); if(/Complementos de pago|se timbra el complemento/.test(r.pue)) r.fallas.push('PUE sin complemento');
 // tocar el complemento: PDF con nunHtmlREP (html2pdf simulado)
 w.eval("htmlAPdf = async (html, nombre) => { window._repHtml = html; return new File(['%PDF'], nombre, {type:'application/pdf'}); }");
 await w.eval("abrirREP('cccc-1','CP0001','CLIENTE PV')"); await sleep(50);
 r.repHtml=String(w._repHtml||'').length; const h=String(w._repHtml||'');
 if(!/Complemento de pago/.test(h)||!/CP1/.test(h)||!/600\.00/.test(h)||!/560\.00/.test(h)||!/only light/.test(h)) r.fallas.push('PDF del complemento');
 r.box=(d.getElementById('repBox')||{}).textContent||''; if(!/Enviar por WhatsApp/.test(r.box)||!/Guardar PDF/.test(r.box)||!/XML/.test(r.box)) r.fallas.push('botones');
 r.nombres=w.eval("[REP.pdf.name, REP.xml.name].join(',')"); if(r.nombres!=='Complemento_CP0001.pdf,Complemento_CP0001.xml') r.fallas.push('nombres');
 // reportar pago del cobro del pedido (factura PPD): sale el aviso
 w.eval("abrirPago('cob_p1')"); await sleep(50); if(!/Es de factura PPD/.test(d.body.textContent)) r.fallas.push('aviso al reportar');
 // oficina: pago por confirmar de factura PPD → liga al sistema
 w.eval('abrirEspera()'); await sleep(50); const a=d.querySelector('a[href*="ir=cobranza&pv=pv1"]'); if(!a||!/factura PPD FT0010/.test(d.body.textContent)) r.fallas.push('liga al sistema');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
