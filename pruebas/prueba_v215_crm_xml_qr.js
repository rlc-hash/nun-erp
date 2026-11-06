// App de vendedores v2.1.5: el PDF de una factura timbrada sale con el QR del SAT y los sellos (toma el XML del servidor con cfdi_xml_get,
// igual que el ERP) y hay botón 📃 XML para bajarlo. Servidor simulado, datos inventados, sin red.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const HTML=fs.readFileSync(process.env.NUN_VEND||path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
const sleep=t=>new Promise(z=>setTimeout(z,t));
const UUID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const XML='<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Total="1160.00" NoCertificado="00001000000500000000" Sello="SELLOCFDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAbCd1234=="><cfdi:Emisor Rfc="EKU9003173C9"/><cfdi:Receptor Rfc="XAXX010101000"/><cfdi:Complemento><tfd:TimbreFiscalDigital UUID="'+UUID.toUpperCase()+'" FechaTimbrado="2026-11-01T10:00:00" SelloCFD="SELLOCFDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAbCd1234==" SelloSAT="SELLOSATYYYY" NoCertificadoSAT="00001000000700000000" RfcProvCertif="SPR190613I52"/></cfdi:Complemento></cfdi:Comprobante>';
(async()=>{const r={fallas:[]};try{
 const DB={clientes:[{id:'c1',razon_social:'CLIENTE UNO',vendedor:'EDGAR'}],productos:[],cotizaciones:[],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],
  facturas:[{id:'f1',folio:'FT0001',fecha:'2026-11-01',cliente:'CLIENTE UNO',vendedor:'EDGAR',estatus:'timbrada',uuid_sat:UUID,subtotal:1000,iva:160,total:1160,items_json:'[{"sku":"RL001","descripcion":"Maleta","cantidad":1,"precio_unitario":1000,"iva_pct":16}]'},
           {id:'f2',folio:'FT0002',fecha:'2026-11-01',cliente:'CLIENTE UNO',vendedor:'EDGAR',estatus:'borrador',total:100,items_json:'[]'}],
  cobranza:[]};
 const env=[];const errs=[];const vc=new VirtualConsole();vc.on("jsdomError",e=>{ if(!/navigation to another Document/.test(e.message)) errs.push(String(e.message).slice(0,300)); }); // la descarga (a.click) en jsdom avisa "navigation"
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.confirm=()=>true; w.scrollTo=()=>{}; w.__abiertas=[]; w.__bajadas=[]; w.open=(u)=>{ const v={u,html:'',document:{write:x=>{v.html+=x},close(){}},print(){}}; w.__abiertas.push(v); return v; };
   w.URL.createObjectURL=b=>{ w.__bajadas.push(b); return 'blob:x'; }; w.URL.revokeObjectURL=()=>{};
   w.fetch=async(u,o)=>{ await sleep(2); const b=JSON.parse(o.body); env.push(b); let r={ok:true};
    if(b.accion==='login') r={ok:true,usuario:{nombre:'Edgar',rol:'vendedor',vendedor_asignado:'Edgar'},permisos:{agregar_pedidos:true,ver_todos_clientes:true}};
    else if(b.accion==='erp_listar') r={ok:true,items:DB[b.tabla]||[]};
    else if(b.accion==='listar_cuentas') r={ok:true,cuentas:[]};
    else if(b.accion==='cfdi_xml_get') r=b.uuid===UUID.toUpperCase()?{ok:true,xml:XML}:{ok:false,error:'no'}; // como Bind: solo en mayúsculas
    return {json:async()=>JSON.parse(JSON.stringify(r))}; }; }});
 const w=dom.window,d=w.document; await sleep(400);
 d.getElementById('lgCod').value='edgar-x'; await w.eval('entrar()'); await sleep(300);
 r.version=(d.querySelector('.ver')||{}).textContent;
 if(r.version!=='v2.1.5') r.fallas.push('version');
 await w.eval("S.d.empresa={razon_social:'EMPRESA PRUEBA'}; abrirDoc('facturas','f1')"); await sleep(100);
 r.botonXml=/📃 XML/.test(d.getElementById('hoja').textContent); if(!r.botonXml) r.fallas.push('botonXml');
 r.xmlAlAbrir=env.filter(b=>b.accion==='cfdi_xml_get').length>0;
 const coU=w.URL.createObjectURL; w.URL.createObjectURL=undefined; await w.eval("pdfDoc('facturas','f1')"); await sleep(200);
 const pdf=(w.__abiertas.slice(-1)[0]||{}).html||'';
 r.pdf={qr:/api\.qrserver\.com/.test(pdf), verifica:/verificacfdi/.test(pdf)&&/re%3DEKU9003173C9/.test(pdf), uuid:pdf.includes(UUID.toUpperCase()), sello:/SELLOSATYYYY/.test(pdf), factura:/FT0001/.test(pdf)};
 if(Object.values(r.pdf).some(v=>!v)) r.fallas.push('pdfQR');
 w.URL.createObjectURL=coU; await w.eval("xmlDoc('"+UUID+"','FT0001')"); await sleep(200);
 const bl=w.__bajadas.slice(-1)[0]; r.xml=bl?{nombre:bl.name,igual:(await bl.text())===XML}:null;
 if(!r.xml||r.xml.nombre!=='Factura_FT0001.xml'||!r.xml.igual) r.fallas.push('xml');
 await w.eval("cerrarHoja();abrirDoc('facturas','f2')"); r.sinTimbrarSinXml=!/📃 XML/.test(d.getElementById('hoja').textContent); if(!r.sinTimbrarSinXml) r.fallas.push('sinTimbrar');
 r.errs=errs.slice(0,3); if(errs.length) r.fallas.push('errores');
}catch(e){r.error=String(e.stack).slice(0,400);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
