const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,300)));
const REPXML=`<?xml version="1.0" encoding="utf-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="CP" Folio="0001" Fecha="2026-09-29T10:00:00" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" LugarExpedicion="11000" NoCertificado="00001000000712345678" Sello="AAAABBBBCCCCDDDDxyz12345=="><cfdi:Emisor Rfc="EKU9003173C9" Nombre="COMERCIALIZADORA CASRAF" RegimenFiscal="601"/><cfdi:Receptor Rfc="CACX7605101P8" Nombre="CLIENTE UNO DE PRUEBA" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="626" UsoCFDI="CP01"/><cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos><cfdi:Complemento><pago20:Pagos Version="2.0"><pago20:Totales MontoTotalPagos="18499.98"/><pago20:Pago FechaPago="2026-09-28T12:00:00" FormaDePagoP="03" MonedaP="MXN" TipoCambioP="1" Monto="18499.98" NumOperacion="12345"><pago20:DoctoRelacionado IdDocumento="11111111-2222-4333-8444-5555555555aa" Serie="FT" Folio="0001" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="18499.98" ImpPagado="18499.98" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/></pago20:Pago></pago20:Pagos><tfd:TimbreFiscalDigital Version="1.1" UUID="66666666-7777-4888-9999-aaaaaaaaaabb" FechaTimbrado="2026-09-29T10:00:05" RfcProvCertif="FIN1203015JA" SelloCFD="AAAABBBBCCCCDDDDxyz12345==" NoCertificadoSAT="00001000000705250068" SelloSAT="SATSATSAT"/></cfdi:Complemento></cfdi:Comprobante>`;
const FACXML=REPXML.replace('TipoDeComprobante="P"','TipoDeComprobante="I"').replace('Total="0"','Total="18499.98"').replace('66666666-7777-4888-9999-aaaaaaaaaabb','11111111-2222-4333-8444-5555555555aa');
const DB={pedidos:[{id:'p1',folio:'P0001',fecha:'2026-09-29',cliente:'CLIENTE DOS',total:3200,estatus:'confirmado',vendedor:'EDGAR',items_json:JSON.stringify([{sku:'RL007N',descripcion:'MALETA',cantidad:1,precio_unitario:1293.403,iva_pct:16},{sku:'sf007l',descripcion:'MALETA',cantidad:1,precio_unitario:1336.21,iva_pct:16}])}],
 remisiones:[{id:'bind_rem_322',folio:322,fecha:'2026-09-28T06:00:00.000Z',cliente:'CLIENTE UNO',total:18499.98,estatus:'facturada',items_json:'[]'}],
 facturas:[{id:'f322',folio:'FT0001',fecha:'2026-09-29T06:00:00.000Z',cliente:'CLIENTE UNO',total:18499.98,pedido_origen:'REM 322',estatus:'timbrada',uuid_sat:'11111111-2222-4333-8444-5555555555aa',metodo_pago:'PPD',notas:'Factura · REP CP0001 uuid=66666666-7777-4888-9999-aaaaaaaaaabb monto=18499.98 fecha=2026-09-28 parc=1',items_json:JSON.stringify([{sku:'A',descripcion:'X',cantidad:1,precio_unitario:15948.26,iva_pct:16}])}],
 notascredito:[],cobranza:[{id:'bind_cob_322',numero:'V01322',total:18499.98,cobrado:18499.98,pendiente:0}],ingresos:[],clientes:[{id:'c1',razon_social:'CLIENTE DOS',credito_dias:90}],usuarios:[]};
const XMLS={'66666666-7777-4888-9999-aaaaaaaaaabb':REPXML,'11111111-2222-4333-8444-5555555555aa':FACXML};
const ll=[],abiertas=[];
const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
 beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:'ADMIN-PRUEBA',usuario:{codigo:'ADMIN-PRUEBA',nombre:'Admin',rol:'admin'},permisos:{},ts:1}));
  w.fetch=async(u,o)=>{ const b=o&&o.body?JSON.parse(o.body):{}; ll.push(b); await new Promise(z=>setTimeout(z,20)); const J=x=>({json:async()=>JSON.parse(JSON.stringify(x))});
   if(b.accion==='erp_listar') return J({ok:true,items:DB[b.tabla]||[]});
   if(b.accion==='cfdi_xml_get') return J(XMLS[b.uuid]?{ok:true,xml:XMLS[b.uuid]}:{ok:false});
   if(b.accion==='erp_upsert_batch'){ for(const it of b.items){ const x=(DB[b.tabla]=DB[b.tabla]||[]).find(r=>r.id===it.id); if(x) Object.assign(x,it); else DB[b.tabla].push(it);} return J({ok:true}); }
   if(b.accion==='erp_crear'){ (DB[b.tabla]=DB[b.tabla]||[]).push(b.item); return J({ok:true,item:b.item}); }
   if(b.accion==='convertir_documento'){ const p=DB.pedidos.find(x=>x.id===b.id_origen); const n={id:'fac_srv1',folio:'FT0002',cliente:p.cliente,total:0,items_json:'[]',estatus:'borrador',fecha:'2026-09-29',notas:'Generado desde pedidos folio P0001'}; DB[b.tabla_destino].push(n); p.estatus='facturado'; return J({ok:true,folio:n.folio,item:{id:n.id}}); }
   return J({ok:true,items:[]}); };
  w.open=(url)=>{ const win={closed:false,_html:'',document:{open(){},write(h){win._html+=h},close(){}},print(){},close(){win.closed=true}}; abiertas.push({url,win}); return win; };
  w.Blob=class{constructor(parts){this._t=parts.join('')}}; w.URL.createObjectURL=(blob)=>{ w._ultimoBlob=blob; return 'blob:x'; };
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})});
 }});
const w=dom.window,d=w.document;const sleep=t=>new Promise(z=>setTimeout(z,t));
const blobTxt=async()=>w._ultimoBlob? w._ultimoBlob._t:'';
setTimeout(async()=>{const r={};try{
 for (const t of Object.keys(DB).filter(t=>t!=='usuarios')) await w.eval(`cargarTabla('${t}')`);
 r.version=d.body.innerHTML.match(/v\d+\.\d+ · Sistema NUN/)[0];
 r.fechaLarga=w.eval("fmtFechaLarga('2026-09-28')");
 w.eval("abrirDoc('facturas','f322')"); await sleep(600);
 const html=d.body.innerHTML;
 r.botones=[/nunPdfREP\('66666666/.test(html),/📄 PDF CP0001/.test(html),/📎 Archivos/.test(html),/📎 archivos/.test(html),html.includes("nunPdfDoc('facturas','f322')")];
 const arch=d.getElementById('nunArchMount'); r.archivos=arch?arch.textContent.replace(/\s+/g,' ').trim().slice(0,400):'(no montado aún: '+(html.includes('nunArchMount'))+')';
 r.cacheXml=Object.keys(w._nunXml);
 r.timbreFactura=!!w.eval("cfdiGetTimbres()['11111111-2222-4333-8444-5555555555aa']");
 // PDF del complemento
 await w.eval("nunPdfREP('66666666-7777-4888-9999-aaaaaaaaaabb')");
 const rep=await blobTxt();
 r.pdfREP={titulo:(rep.match(/<title>([^<]*)/)||[])[1], cliente:rep.includes('CLIENTE UNO DE'), factura:/FT0001/.test(rep), monto:rep.includes('$18,499.98'), forma:rep.includes('03 · Transferencia'), letras:/DIECIOCHO MIL/.test(rep), qr:rep.includes('verificacfdi'), fecha:(rep.match(/Fecha de pago<\/span><b>([^<]*)/)||[])[1], logo:rep.includes('class="logo"')};
 // Sin caché: abre ventana primero y la llena después
 w._nunXml={}; w.localStorage.removeItem('nun_cfdi_timbres');
 const n0=abiertas.length; await w.eval("nunPdfREP('66666666-7777-4888-9999-aaaaaaaaaabb')"); r.sinCache={ventanas:abiertas.length-n0, llena:/TOTAL PAGADO/.test(abiertas[abiertas.length-1].win._html)};
 // PDF de la factura sin timbre local → lo trae del XML y sale con QR
 w._nunXml={}; w.localStorage.removeItem('nun_cfdi_timbres');
 await w.eval("nunPdfDoc('facturas','f322')"); const fp=await blobTxt(); r.pdfFactura={qr:fp.includes('verificacfdi'), uuid:fp.includes('11111111')};
 // XML no existe
 await w.eval("nunPdfREP('no-existe')"); r.toastNoExiste=d.body.textContent.includes('No encontré el XML de este complemento');
 // Pedido → factura: el servidor la crea vacía; el sistema copia los productos
 w.eval("cerrarDrawer()"); w.eval("window.confirmDialog=async()=>true");
 await w.eval("convertirDocConItems('pedidos','p1','facturas')"); await sleep(300);
 const f2=DB.facturas.find(f=>f.id==='fac_srv1'); r.conversion={items:JSON.parse(f2.items_json).length,total:f2.total,folio:f2.folio,pedido_origen:f2.pedido_origen,cob:DB.cobranza.filter(c=>/FT0002|fac_srv1/.test(JSON.stringify(c))).map(c=>c.total)};
 // Remisión: pestaña archivos
 w.eval("abrirDoc('remisiones','bind_rem_322')"); await sleep(400); r.archRem=(d.getElementById('nunArchMount')||{}).textContent?.replace(/\s+/g,' ').slice(0,200);
}catch(e){r.error=String(e.stack).slice(0,600)} r.errs=errs.slice(0,3); console.log(JSON.stringify(r,null,1)); w.close();},3500);
