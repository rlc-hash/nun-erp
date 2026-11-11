// ============================================================
// nun-pdf.js — PDF de documentos IGUAL al del ERP (puente para la app de vendedores, v2.0.2).
// Es copia de imprimirDocumento / numeroALetras / fmtFechaLarga y del timbre (cfdiTimbreHTML: QR y sellos) de index.html. Si cambias el PDF del ERP,
// vuelve a copiarlo aquí (python3 herramientas/copiar_pdf.py). La app pone antes: State.data, escapeHTML, fmtFull,
// nunCalcDoc, nunCalcLinea, nunEsVerdad, nunR2, nunSaldoDoc, cfdiGetStore.
// ============================================================
const fmtFechaLarga = (f) => {
  if (!f) return '—';
  const d = (f instanceof Date) ? f : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(f)) ? f + 'T12:00:00' : f); // v3.78
  if (isNaN(d.getTime())) return String(f).substring(0,10);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
};
function numeroALetras(num) {
  num = Math.round((+num || 0) * 100) / 100;
  const entero = Math.floor(num);
  const cent = Math.round((num - entero) * 100);
  const unidades = ['', 'UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE'];
  const especiales = ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
  const decenas = ['', '','VEINTI','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const centenas = ['', 'CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];

  function trio(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n/100), d = Math.floor((n%100)/10), u = n%10;
    let s = '';
    if (c > 0) s += centenas[c] + ' ';
    if (d === 1) s += especiales[u];
    else if (d === 2 && u > 0) s += decenas[2] + unidades[u].toLowerCase();
    else if (d >= 2) { s += decenas[d]; if (u > 0) s += ' Y ' + unidades[u]; }
    else if (u > 0) s += unidades[u];
    return s.trim();
  }
  if (entero === 0) return 'CERO PESOS ' + String(cent).padStart(2,'0') + '/100';
  let txt = '';
  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;
  if (millones > 0) txt += (millones === 1 ? 'UN MILLÓN' : trio(millones) + ' MILLONES') + ' ';
  if (miles > 0) txt += (miles === 1 ? 'MIL' : trio(miles) + ' MIL') + ' ';
  if (resto > 0) txt += trio(resto);
  return txt.trim().toUpperCase() + ' PESOS ' + String(cent).padStart(2,'0') + '/100';
}
function nunLineaCaja(it){
  const pz = +it.pz_caja || 0, cant = +it.cantidad || 0, pu = +it.precio_unitario || 0;
  const base = String(it.descripcion || '').replace(/\s*·\s*\d+\s*(sets?|cajas?) de \d+ pz\s*$/i, ''); // v4.80 también 'cajas de'
  if (pz > 1 && cant > 0 && Math.abs(cant / pz - Math.round(cant / pz)) < 1e-9) {
    const pzu = Math.round(pu * 100) / 100;
    return { cant: Math.round(cant / pz), unidad: Math.round(cant / pz) === 1 ? 'caja' : 'cajas', pu: Math.round(pu * pz * 10000) / 10000, desc: base + ' · caja de ' + pz + ' pz (pieza ' + fmtFull(pzu) + ')' };
  }
  return { cant, unidad: it.unidad || 'pieza', pu, desc: it.descripcion || '' };
}
function imprimirDocumento(tipo, idDoc) {
  // v3.0 — PDF profesional con logo, datos fiscales, tabla de items, totales en letras
  const doc = (State.data[tipo]||[]).find(c => c.id === idDoc);
  if (!doc) return;
  const emp = State.data.empresa || {};
  const cli = (State.data.clientes||[]).find(c => (c.razon_social||'').trim() === (doc.cliente||'').trim()) || {};
  let items = [];
  try { items = doc.items_json ? JSON.parse(doc.items_json) : []; } catch(e) {}
  const tipoLabel = { cotizaciones:'COTIZACIÓN', pedidos:'PEDIDO', remisiones:'REMISIÓN', facturas:'FACTURA', ordenescompra:'ORDEN DE COMPRA', recepciones:'RECEPCIÓN', notascredito:'NOTA DE CRÉDITO', cobranza:'DOCUMENTO' }[tipo] || tipo.toUpperCase();
  const _calc = nunCalcDoc(items, nunEsVerdad(doc.sin_iva)); // v3.80 — mismo redondeo SAT que el documento
  const subtotal = +doc.subtotal || _calc.subtotal;
  const iva = nunEsVerdad(doc.sin_iva) ? 0 : (+doc.iva || _calc.iva); // v3.40 sin IVA
  const total = nunEsVerdad(doc.sin_iva) ? subtotal : (+doc.total || nunR2(subtotal + iva));
  // v3.80 — pagado y saldo reales (antes campos viejos del documento que casi nunca estaban al día)
  const _saldoPdf = (tipo === 'remisiones' || tipo === 'facturas') ? nunSaldoDoc(doc, tipo) : (+doc.saldo || 0);
  const _pagadoPdf = (tipo === 'remisiones' || tipo === 'facturas') ? Math.max(0, nunR2(total - _saldoPdf)) : (+doc.pagado || 0);
  const _pctTxt = p => (Math.round(p * 100) / 100) + '%';
  const totalLetras = numeroALetras(total) + ' M.N.';

  // v3.10.1 — Look profesional con logo SVG NUN, header degradado, tabla zebra
  const css = `
    @page { size: letter; margin: 12mm 14mm; }
    * { box-sizing:border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#0a0c0f; padding:0; margin:0; font-size:10.5px; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    /* === HEADER === */
    .head { display:flex; justify-content:space-between; align-items:flex-start; padding:18px 22px; background:#0a0c0f; color:#fff; border-radius:10px; margin-bottom:8px; }
    .head-left { flex:1; }
    .logo-svg { width:78px; height:40px; display:block; margin-bottom:10px; }
    .emp-name { font-size:13px; font-weight:700; letter-spacing:-0.01em; margin-bottom:3px; }
    .emp-data { font-size:9px; color:rgba(255,255,255,0.75); line-height:1.55; }
    .doc-title { text-align:right; min-width:200px; }
    .doc-title-lbl { font-size:9px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.16em; margin-bottom:2px; }
    .doc-title-folio { font-family:'Courier New',monospace; font-size:30px; font-weight:700; letter-spacing:-0.02em; line-height:1; }
    .doc-title-meta { font-size:9.5px; color:rgba(255,255,255,0.75); margin-top:8px; line-height:1.5; }
    .stamp { display:inline-block; padding:3px 10px; background:rgba(255,255,255,0.1); border:1px solid; border-radius:100px; font-size:8.5px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; margin-top:6px; }
    .stamp.green { color:#34d399; border-color:#34d399; } .stamp.amber { color:#fbbf24; border-color:#fbbf24; } .stamp.red { color:#fb7185; border-color:#fb7185; }
    /* === PARTIES === */
    .parties { display:grid; grid-template-columns:1.4fr 1fr; gap:8px; margin:12px 0; }
    .party { padding:11px 14px; background:#f5f6f8; border-radius:8px; border:1px solid #e9ecef; }
    .party .lbl { font-size:8.5px; color:#8a8d94; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:4px; font-weight:700; }
    .party .name { font-size:12px; font-weight:700; color:#0a0c0f; }
    .party .info { font-size:9.5px; color:#555; line-height:1.55; margin-top:3px; }
    /* === ITEMS TABLE === */
    table.items { width:100%; border-collapse:collapse; margin-top:4px; font-size:10px; border-radius:8px; overflow:hidden; }
    table.items thead { background:#0a0c0f; }
    table.items th { background:#0a0c0f; color:#fff; padding:9px 10px; text-align:left; text-transform:uppercase; font-size:8.5px; letter-spacing:0.1em; font-weight:700; }
    table.items th.right { text-align:right; }
    table.items td { padding:8px 10px; border-bottom:1px solid #eef0f3; vertical-align:top; }
    table.items tbody tr:nth-child(even) { background:#f9fafc; }
    table.items tbody tr:last-child td { border-bottom:none; }
    table.items td.right { text-align:right; font-family:'Courier New',monospace; }
    table.items td.sku { font-family:'Courier New',monospace; font-size:9.5px; color:#555; font-weight:600; }
    table.items td.desc { font-size:10.5px; line-height:1.4; }
    /* === TOTALES === */
    .totales-wrap { display:grid; grid-template-columns:1fr 280px; gap:10px; margin-top:10px; }
    .total-letras { padding:11px 14px; background:linear-gradient(135deg,#f5f6f8 0%,#eef0f3 100%); border-radius:8px; border-left:3px solid #0a0c0f; font-size:9.5px; color:#555; line-height:1.6; }
    .total-letras .lbl { font-size:8.5px; color:#8a8d94; text-transform:uppercase; letter-spacing:0.12em; font-weight:700; margin-bottom:3px; display:block; }
    .total-letras .letras { font-size:10.5px; color:#0a0c0f; font-weight:600; }
    .total-cifras { border-radius:8px; overflow:hidden; }
    .total-cifras .row { display:flex; justify-content:space-between; padding:7px 14px; font-size:10.5px; background:#fafbfc; border-bottom:1px solid #eef0f3; }
    .total-cifras .row.gran { background:linear-gradient(135deg,#0a0c0f 0%,#1d2025 100%); color:#fff; font-weight:700; font-size:14px; padding:11px 14px; border:none; }
    .total-cifras .row.gran .lbl { letter-spacing:0.08em; }
    .total-cifras .mono { font-family:'Courier New',monospace; font-weight:600; }
    /* === EXTRAS === */
    .notas { margin-top:12px; padding:11px 14px; background:linear-gradient(90deg,#fff8e6 0%,#fffbf2 100%); border-left:3px solid #e6a100; font-size:9.5px; color:#5a4500; border-radius:0 8px 8px 0; line-height:1.55; }
    .notas strong { color:#3a2900; }
    .cfdi-info { margin-top:14px; padding:11px 14px; background:linear-gradient(90deg,#f0f4ff 0%,#f7faff 100%); border-left:3px solid #2467e5; border-radius:0 8px 8px 0; font-size:9.5px; color:#234; line-height:1.55; }
    .cfdi-uuid { font-family:'Courier New',monospace; font-size:9px; color:#345; margin-top:4px; word-break:break-all; }
    .footer { margin-top:24px; padding-top:14px; border-top:1px solid #e9ecef; font-size:8.5px; color:#8a8d94; text-align:center; letter-spacing:0.04em; }
    .footer .brand { color:#0a0c0f; font-weight:700; letter-spacing:-0.01em; }
  `;
  // Logo en PDF: usa el de marca blanca si está configurado, si no el NUN real
  const _br = (typeof brandingActual === 'function') ? brandingActual() : { logo:'' };
  const logoSVG = _br.logo
    ? (_br.logo.trim().startsWith('<svg')
        ? _br.logo.replace('<svg', '<svg class="logo-svg" preserveAspectRatio="xMidYMid meet"')
        : `<img class="logo-svg" src="${_br.logo}" style="object-fit:contain">`)
    : `<svg class="logo-svg" viewBox="-2 170 599 309" xmlns="http://www.w3.org/2000/svg">
    <path fill="#fff" fill-rule="evenodd" d="M 283.5 475.9 C 264.3 473.4 246.5 466.0 230.0 453.6 C 226.1 450.7 186.8 412.3 142.7 368.4 C 98.6 324.5 61.5 287.6 60.2 286.5 C 58.2 284.9 57.7 284.8 57.0 286.0 C 56.4 286.9 56.0 311.3 56.0 344.2 C 56.0 388.9 55.7 401.0 54.8 401.1 C 48.3 401.4 2.6 400.9 1.9 400.4 C 0.5 399.6 0.7 189.9 2.1 184.4 C 4.4 175.6 15.1 169.9 23.1 173.3 C 25.3 174.2 54.7 202.9 104.2 252.4 C 146.9 295.1 182.3 330.0 182.9 330.0 C 183.5 330.0 184.0 328.8 184.0 327.2 C 184.0 325.7 184.0 298.5 184.0 266.6 C 184.0 224.3 184.2 208.4 185.1 207.4 C 186.7 205.5 236.9 205.3 238.8 207.2 C 239.7 208.1 240.0 227.5 240.0 288.5 C 240.0 341.0 240.4 370.7 241.1 374.6 C 241.7 377.8 244.0 384.3 246.2 388.9 C 259.0 415.6 290.1 428.1 318.8 418.0 C 336.4 411.8 349.1 397.5 355.8 376.5 C 357.2 372.1 357.5 360.1 357.9 283.5 C 358.3 219.5 358.8 195.0 359.7 193.5 C 363.3 187.2 371.7 183.9 378.3 186.2 C 381.2 187.2 399.5 204.9 459.9 265.2 C 502.8 308.0 538.3 343.0 538.9 343.0 C 539.7 343.0 540.1 324.8 540.2 281.2 L 540.5 219.5 L 567.5 219.5 L 594.5 219.5 L 594.8 330.5 C 595.1 453.0 595.4 446.7 588.9 451.9 C 585.6 454.5 578.2 455.8 573.3 454.5 C 571.4 454.1 546.4 429.6 492.9 375.8 C 446.1 328.8 414.7 297.9 413.9 298.2 C 412.8 298.6 412.4 305.8 411.9 337.6 C 411.3 378.3 411.0 382.1 406.3 396.5 C 388.8 450.6 338.8 482.9 283.5 475.9 Z"/>
  </svg>`;
  const itemsHTML = items.length === 0
    ? `<tr><td colspan="6" style="padding:20px;text-align:center;color:#aaa">Sin productos en el documento</td></tr>`
    : items.map(it => {
        const _lc = nunLineaCaja(it), cant = _lc.cant; // v4.78 carry on por caja
        const pu = _lc.pu;
        const desc = +it.descuento_pct || 0;
        const sub = nunCalcLinea(it, true).base; // v3.80 — importe sin IVA (cuadra con el Subtotal)
        return `<tr>
          <td class="sku">${escapeHTML(it.sku||'—')}</td>
          <td>${escapeHTML(_lc.desc)}</td>
          <td class="right">${cant}</td>
          <td class="right">${fmtFull(pu)}</td>
          <td class="right">${desc>0?_pctTxt(desc):'—'}</td>
          <td class="right">${fmtFull(sub)}</td>
        </tr>`;
      }).join('');

  let estatusStamp = '';
  if (tipo === 'facturas') {
    if (doc.estatus === 'pagada') estatusStamp = '<span class="stamp green">✓ PAGADA</span>';
    else if (doc.estatus === 'timbrada') estatusStamp = '<span class="stamp green">TIMBRADA</span>';
    else if (doc.estatus === 'cancelada') estatusStamp = '<span class="stamp red">CANCELADA</span>';
  }

  const partsHTML = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(tipoLabel)} ${escapeHTML(String(doc.folio||doc.numero||''))}</title><style>${css}</style></head><body>
    <div class="head">
      <div class="head-left">
        ${logoSVG}
        <div class="emp-name">${escapeHTML(emp.razon_social||'Comercializadora Casraf SA de CV')}</div>
        <div class="emp-data">
          ${emp.rfc?'RFC: '+escapeHTML(emp.rfc):''}${emp.regimen_fiscal?' · Régimen: '+escapeHTML(emp.regimen_fiscal):''}<br>
          ${emp.direccion?escapeHTML(emp.direccion):''}${emp.ciudad?', '+escapeHTML(emp.ciudad):''}${emp.estado?', '+escapeHTML(emp.estado):''}${emp.cp?' CP '+escapeHTML(emp.cp):''}<br>
          ${emp.email?'✉ '+escapeHTML(emp.email):''}${emp.email&&emp.telefono?' · ':''}${emp.telefono?'☎ '+escapeHTML(emp.telefono):''}
        </div>
      </div>
      <div class="doc-title">
        <div class="doc-title-lbl">${escapeHTML(tipoLabel)}</div>
        <div class="doc-title-folio">${escapeHTML((doc.serie||'')+String(doc.folio||doc.numero||'—'))}</div>
        <div class="doc-title-meta">
          Fecha: <strong>${fmtFechaLarga(doc.fecha||doc.fecha_entrega||doc.fecha_emision)}</strong><br>
          ${doc.fecha_vencimiento?'Vence: '+fmtFechaLarga(doc.fecha_vencimiento)+'<br>':''}
          ${doc.vendedor?'Vendedor: <strong>'+escapeHTML(doc.vendedor)+'</strong>':''}
        </div>
        ${estatusStamp}
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="lbl">${tipo==='ordenescompra'||tipo==='recepciones'?'PROVEEDOR':'CLIENTE'}</div>
        <div class="name">${escapeHTML(doc.cliente||doc.proveedor||'—')}</div>
        ${cli.rfc||doc.rfc_cliente?'<div class="info"><strong>RFC:</strong> '+escapeHTML(cli.rfc||doc.rfc_cliente||'')+'</div>':''}
        ${cli.direccion?'<div class="info">'+escapeHTML(cli.direccion)+'</div>':''}
        ${cli.ciudad?'<div class="info">'+escapeHTML(cli.ciudad)+(cli.estado?', '+escapeHTML(cli.estado):'')+'</div>':''}
        ${cli.contacto?'<div class="info">Atención: <strong>'+escapeHTML(cli.contacto)+'</strong></div>':''}
        ${cli.telefono?'<div class="info">Tel: '+escapeHTML(cli.telefono)+'</div>':''}
        ${cli.email?'<div class="info">'+escapeHTML(cli.email)+'</div>':''}
      </div>
      <div class="party">
        <div class="lbl">CONDICIONES</div>
        <div class="info">
          ${cli.credito_dias?'Crédito: <strong>'+cli.credito_dias+' días</strong><br>':''}
          ${doc.metodo_pago?'Método: '+escapeHTML(doc.metodo_pago)+'<br>':''}
          ${doc.forma_pago?'Forma: '+escapeHTML(doc.forma_pago)+'<br>':''}
          ${doc.uso_cfdi?'Uso CFDI: '+escapeHTML(String(doc.uso_cfdi))+'<br>':''}
          ${tipo==='cotizaciones'?'Vigencia: '+(doc.vigencia_dias||15)+' días<br>':''}
          Moneda: <strong>${escapeHTML(doc.moneda||emp.moneda||'MXN')}</strong>
        </div>
      </div>
    </div>

    <table class="items">
      <thead><tr>
        <th style="width:12%">SKU</th>
        <th>Descripción</th>
        <th class="right" style="width:7%">Cant.</th>
        <th class="right" style="width:7%">Unidad</th>
        <th class="right" style="width:12%">P. Unit.</th>
        <th class="right" style="width:7%">Desc.</th>
        <th class="right" style="width:13%">Importe</th>
      </tr></thead>
      <tbody>${items.length === 0
        ? `<tr><td colspan="7" style="padding:24px;text-align:center;color:#aaa;font-style:italic">Sin productos en el documento</td></tr>`
        : items.map(it => {
            const _lc = nunLineaCaja(it), cant = _lc.cant; // v4.78 carry on por caja
            const pu = _lc.pu;
            const desc = +it.descuento_pct || 0;
            const sub = nunCalcLinea(it, true).base; // v3.80 — importe sin IVA (cuadra con el Subtotal)
            return `<tr>
              <td class="sku">${escapeHTML(it.sku||'—')}</td>
              <td class="desc">${escapeHTML(_lc.desc)}</td>
              <td class="right">${cant}</td>
              <td class="right" style="font-size:9.5px;color:#666">${escapeHTML(_lc.unidad)}</td>
              <td class="right">${fmtFull(pu)}</td>
              <td class="right" style="color:${desc>0?'#e31937':'#aaa'}">${desc>0?_pctTxt(desc):'—'}</td>
              <td class="right" style="font-weight:600">${fmtFull(sub)}</td>
            </tr>`;
          }).join('')}
      </tbody>
    </table>

    <div class="totales-wrap">
      <div class="total-letras">
        <span class="lbl">Total con letra</span>
        <span class="letras">${totalLetras}</span>
      </div>
      <div class="total-cifras">
        <div class="row"><span>Subtotal</span><span class="mono">${fmtFull(subtotal)}</span></div>
        ${(doc.descuento>0)?'<div class="row"><span>Descuento</span><span class="mono" style="color:#e31937">-'+fmtFull(doc.descuento)+'</span></div>':''}
        <div class="row"><span>IVA</span><span class="mono">${fmtFull(iva)}</span></div>
        ${(doc.ieps>0)?'<div class="row"><span>IEPS</span><span class="mono">'+fmtFull(doc.ieps)+'</span></div>':''}
        <div class="row gran"><span class="lbl">TOTAL</span><span class="mono">${fmtFull(total)}</span></div>
        ${(_pagadoPdf>0)?'<div class="row" style="background:rgba(0,163,80,0.06)"><span>Pagado</span><span class="mono" style="color:#00a350">'+fmtFull(_pagadoPdf)+'</span></div>':''}
        ${(_saldoPdf>0)?'<div class="row" style="background:rgba(227,25,55,0.06)"><span>Saldo</span><span class="mono" style="color:#e31937;font-weight:700">'+fmtFull(_saldoPdf)+'</span></div>':''}
      </div>
    </div>

    ${doc.notas&&doc.notas!=='Importado desde Bind ERP'&&doc.notas!=='Importada desde Bind'?'<div class="notas"><strong>Notas:</strong> '+escapeHTML(doc.notas)+'</div>':''}

    ${tipo==='facturas'&&doc.uuid_sat ? (typeof cfdiTimbreHTML==='function' ? cfdiTimbreHTML(doc, total) : '<div class="cfdi-info"><strong>Comprobante Fiscal Digital por Internet (CFDI 4.0)</strong><div class="cfdi-uuid">UUID: '+escapeHTML(doc.uuid_sat)+'</div></div>') : ''}

    <div class="footer">
      Generado por <span class="brand">NUN ERP</span> · ${new Date().toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'})}
    </div>
  </body></html>`;

  // v3.10.1 — Robust to popup blocker: usa blob URL en browser; legacy en test
  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob === 'function') {
      const blob = new Blob([partsHTML], { type:'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank', 'width=900,height=700');
      if (!w) {
        if (typeof confirm !== 'undefined' && confirm('El navegador bloqueó la ventana popup. ¿Abrir el PDF en esta pestaña?')) {
          window.location.href = url;
        }
      } else {
        setTimeout(() => { try { w.print(); } catch(e) {} }, 800);
      }
      return;
    }
  } catch(e) {}
  // Legacy / test fallback
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(partsHTML); w.document.close(); setTimeout(()=>{ try{w.print();}catch(e){} }, 600); }
}
function cfdiGetTimbres(){ try { return JSON.parse(localStorage.getItem('nun_cfdi_timbres')||'{}'); } catch(e){ return {}; } }
function cfdiSetTimbres(s){ try { localStorage.setItem('nun_cfdi_timbres', JSON.stringify(s)); } catch(e){} }
function cfdiTimbreData(xmlText){
  try {
    const xdoc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const all = Array.from(xdoc.getElementsByTagName('*'));
    const find = (ln) => all.find(n => n.localName === ln);
    const comp = xdoc.documentElement, tfd = find('TimbreFiscalDigital'), emi = find('Emisor'), rec = find('Receptor');
    if (!tfd) return null;
    return {
      uuid: tfd.getAttribute('UUID')||'',
      ft: tfd.getAttribute('FechaTimbrado')||'',
      sc: (tfd.getAttribute('SelloCFD')||comp.getAttribute('Sello')||'').substring(0,180),
      fe: (tfd.getAttribute('SelloCFD')||comp.getAttribute('Sello')||'').slice(-8),
      ss: (tfd.getAttribute('SelloSAT')||'').substring(0,180),
      nc: comp.getAttribute('NoCertificado')||'',
      ns: tfd.getAttribute('NoCertificadoSAT')||'',
      pac: tfd.getAttribute('RfcProvCertif')||'',
      re: emi ? (emi.getAttribute('Rfc')||'') : '',
      rr: rec ? (rec.getAttribute('Rfc')||'') : '',
      tt: comp.getAttribute('Total')||''
    };
  } catch(e){ return null; }
}
function cfdiTimbreHTML(doc, totalNum){
  const uuid = doc.uuid_sat || '';
  // v3.36 — leer primero del almacén COMPACTO de timbres (siempre disponible)
  const td = uuid ? (cfdiGetTimbres()[uuid]) : null;
  let t = null;
  if (td){
    t = { uuid:td.uuid||uuid, fechaTimbrado:td.ft, selloCFDI:td.sc, fe:td.fe, selloSAT:td.ss, noCertCFDI:td.nc, noCertSAT:td.ns, rfcPac:td.pac, rfcEmisor:td.re, rfcReceptor:td.rr, total:td.tt||String(totalNum||'') };
  } else {
    // fallback: parsear del XML completo si está guardado
    const e = uuid ? cfdiGetStore()[uuid] : null;
    if (!e || !e.xml){
      return '<div class="cfdi-info"><strong>Comprobante Fiscal Digital por Internet (CFDI 4.0)</strong><div class="cfdi-uuid">UUID: '+escapeHTML(uuid)+'</div>'
        + '<div style="margin-top:4px;color:#888">Sube el XML en «Importar CFDI» para mostrar el sello completo.</div></div>';
    }
    const d = cfdiTimbreData(e.xml);
    if (!d) return '<div class="cfdi-info"><strong>CFDI 4.0</strong><div class="cfdi-uuid">UUID: '+escapeHTML(uuid)+'</div></div>';
    t = { uuid:d.uuid||uuid, fechaTimbrado:d.ft, selloCFDI:d.sc, fe:d.fe, selloSAT:d.ss, noCertCFDI:d.nc, noCertSAT:d.ns, rfcPac:d.pac, rfcEmisor:d.re, rfcReceptor:d.rr, total:d.tt||String(totalNum||'') };
  }
  // URL de verificación SAT + QR (estándar oficial)
  const ult8 = t.fe || (t.selloCFDI||'').slice(-8);  // v3.52 — usa los últimos 8 del sello COMPLETO (antes se cortaba a 180 → QR inválido en SAT)
  const ttFmt = (parseFloat(t.total)||0).toFixed(6).padStart(17,'0').slice(0,18);
  // v3.54 — el 'fe' (últimos 8 del sello) va LITERAL, sin URL-encode. Si se codifica el "==" a "%3D%3D"
  // el SAT no auto-llena los campos. Bind lo manda literal; ahora el QR sí funciona en el SAT.
  const verifUrl = 'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id='+t.uuid+'&re='+t.rfcEmisor+'&rr='+t.rfcReceptor+'&tt='+ttFmt+'&fe='+ult8;
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data='+encodeURIComponent(verifUrl);
  const fmtFecha = (s)=>{ try { return new Date(s).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'medium'}); } catch(e){ return s; } };
  const row = (k,v)=> v ? '<div style="display:flex;gap:8px;margin-top:3px"><span style="min-width:120px;color:#7a8190;font-weight:600">'+k+'</span><span style="font-family:\'Courier New\',monospace;word-break:break-all;flex:1">'+escapeHTML(v)+'</span></div>' : '';
  return ''
    + '<div style="margin-top:16px;padding:12px 14px;border:1px solid #d4dcf0;border-radius:10px;background:linear-gradient(90deg,#f5f8ff,#fafcff)">'
    +   '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:10px;letter-spacing:0.04em">COMPROBANTE FISCAL DIGITAL POR INTERNET · CFDI 4.0</strong><span style="font-size:8px;color:#7a8190">Timbrado: '+escapeHTML(fmtFecha(t.fechaTimbrado))+'</span></div>'
    +   '<div style="display:flex;gap:14px;align-items:flex-start">'
    +     '<img src="'+qrSrc+'" width="108" height="108" style="flex-shrink:0;border:1px solid #e0e6f5;border-radius:6px;background:#fff" alt="QR SAT"/>'
    +     '<div style="flex:1;font-size:8px;line-height:1.5">'
    +       row('Folio fiscal (UUID)', t.uuid)
    +       row('No. certificado CSD', t.noCertCFDI)
    +       row('No. certificado SAT', t.noCertSAT)
    +       row('RFC proveedor cert.', t.rfcPac)
    +       '<div style="display:flex;gap:8px;margin-top:3px"><span style="min-width:120px;color:#7a8190;font-weight:600">Sello digital CFDI</span><span style="font-family:\'Courier New\',monospace;word-break:break-all;flex:1;max-height:26px;overflow:hidden">'+escapeHTML((t.selloCFDI||'').substring(0,170))+'…</span></div>'
    +       '<div style="display:flex;gap:8px;margin-top:3px"><span style="min-width:120px;color:#7a8190;font-weight:600">Sello del SAT</span><span style="font-family:\'Courier New\',monospace;word-break:break-all;flex:1;max-height:26px;overflow:hidden">'+escapeHTML((t.selloSAT||'').substring(0,170))+'…</span></div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="margin-top:8px;font-size:7px;color:#9aa0ac;text-align:center;border-top:1px solid #e8edf7;padding-top:6px">Este documento es una representación impresa de un CFDI · Verifica en verificacfdi.facturaelectronica.sat.gob.mx</div>'
    + '</div>';
}
