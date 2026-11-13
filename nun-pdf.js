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
  if (typeof NUN_CARRY_CAJA !== 'undefined' && NUN_CARRY_CAJA && pz > 1 && cant > 0 && Math.abs(cant / pz - Math.round(cant / pz)) < 1e-9) { // v4.81 apagado: por PIEZA
    const pzu = Math.round(pu * 100) / 100;
    return { cant: Math.round(cant / pz), unidad: Math.round(cant / pz) === 1 ? 'caja' : 'cajas', pu: Math.round(pu * pz * 10000) / 10000, desc: base + ' · caja de ' + pz + ' pz (pieza ' + fmtFull(pzu) + ')' };
  }
  // v4.96 (Rafa 12 nov: "en vez de juego pon set") — la unidad del renglón o la del producto; "juego" se muestra como "set"
  let _u = it.unidad; if (!_u) { try { const _ps = (typeof State !== 'undefined' && State.data && State.data.productos) || (typeof S !== 'undefined' && S && S.d && S.d.productos) || []; const _p = _ps.find(x => String(x.sku||'').trim().toUpperCase() === String(it.sku||'').trim().toUpperCase()); _u = _p && _p.unidad; } catch(e){} }
  _u = String(_u || 'pieza'); if (/^juegos?$/i.test(_u.trim())) _u = 'set';
  return { cant, unidad: _u, pu, desc: it.descripcion || '' };
}
function imprimirDocumento(tipo, idDoc, soloHTML) {
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
    .head { display:flex; justify-content:space-between; align-items:flex-start; padding:18px 22px; background:#0a0c0f; color:#fff; border-radius:10px; margin-bottom:8px; } /* v4.98 (Rafa): arriba negro con el logo blanco; lo demás blanco con líneas */
    .head-left { flex:1; }
    .logo-svg { width:78px; height:40px; display:block; margin-bottom:10px; }
    .emp-name { font-size:13px; font-weight:700; letter-spacing:-0.01em; margin-bottom:3px; }
    .emp-data { font-size:9px; color:rgba(255,255,255,0.78); line-height:1.55; }
    .doc-title { text-align:right; min-width:200px; }
    .doc-title-lbl { font-size:9px; color:rgba(255,255,255,0.55); text-transform:uppercase; letter-spacing:0.16em; margin-bottom:2px; }
    .doc-title-folio { font-family:'Courier New',monospace; font-size:30px; font-weight:700; letter-spacing:-0.02em; line-height:1; }
    .doc-title-meta { font-size:9.5px; color:rgba(255,255,255,0.78); margin-top:8px; line-height:1.5; }
    .stamp { display:inline-block; padding:3px 10px; background:transparent; border:1px solid; border-radius:100px; font-size:8.5px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; margin-top:6px; }
    .stamp.green { color:#34d399; border-color:#34d399; } .stamp.amber { color:#fbbf24; border-color:#fbbf24; } .stamp.red { color:#fb7185; border-color:#fb7185; }
    /* === PARTIES === */
    .parties { display:grid; grid-template-columns:1.4fr 1fr; gap:8px; margin:12px 0; }
    .party { padding:11px 14px; background:transparent; border-radius:8px; border:1px solid #e3e6ea; }
    .party .lbl { font-size:8.5px; color:#8a8d94; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:4px; font-weight:700; }
    .party .name { font-size:12px; font-weight:700; color:#0a0c0f; }
    .party .info { font-size:9.5px; color:#555; line-height:1.55; margin-top:3px; }
    /* === ITEMS TABLE === */
    table.items { width:100%; border-collapse:collapse; margin-top:4px; font-size:10px; border-radius:8px; overflow:hidden; }
    table.items thead { background:transparent; }
    table.items th { background:transparent; color:#0a0c0f; border-top:1px solid #0a0c0f; border-bottom:2px solid #0a0c0f; padding:9px 10px; text-align:left; text-transform:uppercase; font-size:8.5px; letter-spacing:0.1em; font-weight:700; }
    table.items th.right { text-align:right; }
    table.items td { padding:8px 10px; border-bottom:1px solid #eef0f3; vertical-align:top; }
    table.items tbody tr:nth-child(even) { background:transparent; }
    table.items tbody tr:last-child td { border-bottom:none; }
    table.items td.right { text-align:right; font-family:'Courier New',monospace; }
    table.items td.sku { font-family:'Courier New',monospace; font-size:9.5px; color:#555; font-weight:600; }
    table.items td.desc { font-size:10.5px; line-height:1.4; }
    /* === TOTALES === */
    .totales-wrap { display:grid; grid-template-columns:1fr 280px; gap:10px; margin-top:10px; }
    .total-letras { padding:11px 14px; background:transparent; border:1px solid #e3e6ea; border-radius:8px; border-left:3px solid #0a0c0f; font-size:9.5px; color:#555; line-height:1.6; }
    .total-letras .lbl { font-size:8.5px; color:#8a8d94; text-transform:uppercase; letter-spacing:0.12em; font-weight:700; margin-bottom:3px; display:block; }
    .total-letras .letras { font-size:10.5px; color:#0a0c0f; font-weight:600; }
    .total-cifras { border-radius:8px; overflow:hidden; }
    .total-cifras .row { display:flex; justify-content:space-between; padding:7px 14px; font-size:10.5px; background:transparent; border-bottom:1px solid #eef0f3; }
    .total-cifras .row.gran { background:transparent; color:#0a0c0f; font-weight:700; font-size:14px; padding:11px 14px; border:none; border-top:2px solid #0a0c0f; }
    .total-cifras .row.gran .lbl { letter-spacing:0.08em; }
    .total-cifras .mono { font-family:'Courier New',monospace; font-weight:600; }
    /* === EXTRAS === */
    .notas { margin-top:12px; padding:11px 14px; background:transparent; border-left:3px solid #e6a100; font-size:9.5px; color:#5a4500; border-radius:0 8px 8px 0; line-height:1.55; }
    .notas strong { color:#3a2900; }
    .cfdi-info { margin-top:14px; padding:11px 14px; background:transparent; border-left:3px solid #2467e5; border-radius:0 8px 8px 0; font-size:9.5px; color:#234; line-height:1.55; }
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
  const logoNegro = logoSVG.replace(/fill="(#fff|#ffffff|white)"/gi, 'fill="#0a0c0f"').replace(/fill:\s*(#fff|#ffffff|white)\b/gi, 'fill:#0a0c0f'); // v4.96 logo negro sobre blanco
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

  const partsHTML = `<!doctype html><html style="color-scheme:only light;background:#fff"><head><meta charset="utf-8"><meta name="color-scheme" content="only light"><title>${escapeHTML(tipoLabel)} ${escapeHTML(String(doc.folio||doc.numero||''))}</title><style>${css}</style></head><body>
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

  if (soloHTML) return partsHTML; // v4.96 para compartir el PDF por WhatsApp
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
function nunLogoPDF(){
  const br = (typeof brandingActual === 'function') ? brandingActual() : { logo:'' };
  if (br && br.logo) return br.logo.trim().startsWith('<svg') ? br.logo.replace('<svg', '<svg class="logo" preserveAspectRatio="xMidYMid meet"') : `<img class="logo" src="${br.logo}" style="object-fit:contain">`;
  const m = String(imprimirDocumento).match(/<svg class="logo-svg" viewBox[\s\S]*?<\/svg>/);
  return m ? m[0].replace('class="logo-svg"', 'class="logo"') : '';
}
function nunECHTMLDe(D){
  const cli = D.cliente || {}, S2 = { total: +D.total || 0, pagado: +D.pagado || 0, falta: +D.falta || 0, pagos: D.pagos || [] };
  const e = escapeHTML, hoy = new Date(), hoyISO = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
  const dmy = f => { const x = String(f||'').slice(0, 10).split('-'); return x.length === 3 ? x[2] + '/' + x[1] + '/' + x[0] : '—'; };
  const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], my = f => { const x = String(f||'').slice(0, 10).split('-'); return x.length === 3 ? MES[+x[1] - 1] + ' ' + x[0] : ''; };
  const dias = f => { const x = String(f||'').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return ''; return Math.max(0, Math.floor((hoy - new Date(x + 'T12:00:00')) / 86400000)); };
  const est = (falta, pagado) => falta <= 0.5 ? '<span class="st ok">Liquidado</span>' : pagado > 0.5 ? '<span class="st par">Parcial</span>' : '<span class="st pen">Pendiente</span>';
  const filas = (D.filas || []).slice().sort((a, b) => String(a.fecha||'').localeCompare(String(b.fecha||'')));
  const fechas = filas.map(f => String(f.fecha||'').slice(0, 10)).filter(Boolean).sort();
  const conSaldo = filas.filter(f => f.falta > 0.5).length, pct = S2.total > 0 ? Math.min(100, Math.round(S2.pagado / S2.total * 1000) / 10) : 0;
  const totPagos = Math.round(S2.pagos.reduce((a, i) => a + (+i.monto||0), 0) * 100) / 100;
  const logo = (typeof nunLogoPDF === 'function' ? nunLogoPDF() : '').replace('class="logo"', 'class="logo" style="width:92px;height:48px;display:block"');
  const AZ = '#0b1d3a', NA = '#f25a1d', _nunEC = { prod: !!D.conProd, pagos: D.conPagos !== false };
  return `<!doctype html><html style="color-scheme:only light;background:#fff"><head><meta charset="utf-8"><meta name="color-scheme" content="only light"><title>Estado de cuenta · ${e(cli.razon_social)}</title><style>
    @page { size: letter; margin: 0; }
    * { box-sizing:border-box; }
    body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#14181f; margin:0; font-size:10px; line-height:1.4; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .head { background:${AZ}; color:#fff; padding:26px 34px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:5px solid ${NA}; }
    .head h1 { margin:0; font-size:25px; font-weight:700; text-align:right; letter-spacing:-.01em; } .head .emp { font-size:8.5px; letter-spacing:.2em; color:rgba(255,255,255,.65); text-transform:uppercase; text-align:right; margin-top:4px; }
    .cuerpo { padding:22px 34px 26px; }
    .tres { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:12px; }
    .card { background:#f1f2f4; border-radius:6px; padding:10px 12px; } .lbl { font-size:7.5px; letter-spacing:.14em; text-transform:uppercase; color:#6b7280; margin-bottom:3px; }
    .card b { font-size:12px; } .card .sub { font-size:8.5px; color:#6b7280; margin-top:1px; }
    .kpi { border:1px solid #d6d9de; border-radius:6px; padding:11px 13px; } .kpi .v { font-size:17px; font-weight:700; letter-spacing:-.01em; }
    .barra { height:5px; background:#e3e5e8; border-radius:4px; margin-top:7px; overflow:hidden; } .barra i { display:block; height:100%; background:#1f7a4d; }
    .kpi .sub { font-size:8px; color:#6b7280; margin-top:4px; }
    .kpi.osc { background:${AZ}; color:#fff; border-color:${AZ}; } .kpi.osc .lbl, .kpi.osc .sub { color:rgba(255,255,255,.7); }
    h2 { font-size:8.5px; letter-spacing:.18em; text-transform:uppercase; color:#374151; margin:20px 0 6px; }
    table { width:100%; border-collapse:collapse; font-size:9px; }
    th { background:${AZ}; color:#fff; padding:6px 6px; text-align:left; font-size:7.2px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; } th.r { text-align:right; } th.c { text-align:center; }
    td { padding:6px 6px; border-bottom:1px solid #e6e8eb; vertical-align:top; } tbody tr:nth-child(even) td { background:#f6f7f8; }
    td.r { text-align:right; white-space:nowrap; } td.c { text-align:center; } td.b { font-weight:700; } td.n { color:#9aa0a8; } td.doc { color:#6b7280; font-size:8.3px; }
    .fol { display:block; color:#6b7280; font-size:7.8px; }
    tr.det td { background:#fff !important; color:#555; font-size:8px; padding:0 6px 6px; } tr.det span { display:inline-block; margin-right:12px; }
    tr.tot td { font-weight:700; background:#e9ebee !important; border-top:2px solid ${AZ}; } tr.tot td.na { background:${NA} !important; color:#fff; }
    .st { display:inline-block; padding:2px 7px; border-radius:100px; font-size:7px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    .st.ok { background:#e2f4ea; color:#1f7a4d; } .st.par { background:#fde8de; color:#c2410c; } .st.pen { background:#fde2e2; color:#b91c1c; }
    .nota { margin-top:16px; border-left:3px solid ${NA}; padding:6px 12px; font-size:8.3px; color:#4b5563; line-height:1.55; }
    .pie { margin-top:18px; font-size:7.5px; color:#9aa0a8; text-align:center; }
    tr { page-break-inside:avoid; }
  </style></head><body>
    <div class="head"><div>${logo}</div><div><h1>Estado de cuenta</h1><div class="emp">Comercializadora Casraf S.A. de C.V.</div></div></div>
    <div class="cuerpo">
    <div class="tres">
      <div class="card"><div class="lbl">Cliente</div><b>${e(cli.razon_social)}</b>${cli.vendedor ? '<div class="sub">Vendedor: ' + e(cli.vendedor) + '</div>' : ''}</div>
      <div class="card"><div class="lbl">Fecha de corte</div><b>${dmy(hoyISO)}</b></div>
      <div class="card"><div class="lbl">Periodo</div><b>${fechas.length ? (my(fechas[0]) === my(fechas[fechas.length - 1]) ? my(fechas[0]) : my(fechas[0]) + ' – ' + my(fechas[fechas.length - 1])) : '—'}</b><div class="sub">${filas.length} ${filas.length === 1 ? 'pedido' : 'pedidos'}</div></div>
    </div>
    <div class="tres">
      <div class="kpi"><div class="lbl">Total facturado</div><div class="v">${fmtFull(S2.total)}</div></div>
      <div class="kpi"><div class="lbl">Total pagado</div><div class="v">${fmtFull(S2.pagado)}</div><div class="barra"><i style="width:${pct}%"></i></div><div class="sub">${pct}% cubierto</div></div>
      <div class="kpi osc"><div class="lbl">Saldo pendiente</div><div class="v">${fmtFull(S2.falta)}</div><div class="sub">MXN · ${conSaldo} ${conSaldo === 1 ? 'pedido' : 'pedidos'} con saldo</div></div>
    </div>
    <h2>Detalle de pedidos</h2>
    <table><thead><tr><th>#</th><th>Pedido</th><th>Entrega</th><th>Remisión / Factura</th><th class="r">Importe</th><th class="r">Pagado</th><th class="r">Saldo</th><th class="c">Días</th><th>Estatus</th></tr></thead><tbody>
      ${filas.map((f, k) => `<tr><td class="n">${String(k + 1).padStart(2, '0')}</td><td>${dmy(f.fecha)}${f.folio ? '<span class="fol">' + e(f.folio) + '</span>' : ''}</td><td>${f.ent ? dmy(f.ent) : '—'}</td><td class="doc">${e(f.docs) || '—'}</td>
        <td class="r">${fmtFull(f.total)}</td><td class="r">${f.pagado > 0.5 ? fmtFull(f.pagado) : '—'}</td><td class="r ${f.falta > 0.5 ? 'b' : ''}">${fmtFull(f.falta > 0.5 ? f.falta : 0)}</td>
        <td class="c">${f.falta > 0.5 && f.ent ? dias(f.ent) : '—'}</td><td>${est(f.falta, f.pagado)}</td></tr>`
        + (_nunEC.prod && f.prods.length ? `<tr class="det"><td></td><td colspan="8">${f.prods.map(it => `<span>${+it.cantidad || 0} × <b>${e(it.sku||'')}</b> ${e(it.descripcion||'')} · ${fmtFull(it.precio_unitario)}</span>`).join('')}</td></tr>` : '')).join('')}
      <tr class="tot"><td colspan="4">Totales</td><td class="r">${fmtFull(S2.total)}</td><td class="r">${fmtFull(S2.pagado)}</td><td class="r na">${fmtFull(S2.falta)}</td><td colspan="2"></td></tr>
    </tbody></table>
    <div class="nota">Importes en pesos mexicanos (MXN). Días = días transcurridos desde la fecha de entrega hasta la fecha de corte, solo para pedidos con saldo.${S2.falta > 0.5 ? ' Saldo pendiente: ' + fmtFull(S2.falta) + ' (' + e(numeroALetras(S2.falta)) + ' M.N.).' : ''} Si detecta alguna diferencia con sus registros, favor de comunicarlo para conciliarla.</div>
    ${_nunEC.pagos && S2.pagos.length ? `<h2>Historial de pagos</h2><table><thead><tr><th>#</th><th>Fecha</th><th>Documento</th><th>Forma / cuenta</th><th class="r">Monto</th></tr></thead><tbody>
      ${S2.pagos.map((i, k) => `<tr><td class="n">${String(k + 1).padStart(2, '0')}</td><td>${dmy(i.fecha)}</td><td class="doc">${e(String(i.factura||''))}</td><td class="doc">${e(String(i.cuenta||''))}</td><td class="r">${fmtFull(i.monto)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="4">Total pagos (${S2.pagos.length})</td><td class="r">${fmtFull(totPagos)}</td></tr></tbody></table>` : ''}
    <div class="pie">Generado por NUN · ${new Date().toLocaleString('es-MX', { dateStyle:'long', timeStyle:'short' })}</div>
    </div>
  </body></html>`;
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
const SAT_FORMA_PAGO = [['01','Efectivo'],['02','Cheque nominativo'],['03','Transferencia electrónica'],['04','Tarjeta de crédito'],['28','Tarjeta de débito'],['99','Por definir']];
function nunLeerREP(xml){
  const x = new DOMParser().parseFromString(xml, 'text/xml');
  const all = Array.from(x.getElementsByTagName('*'));
  const uno = ln => all.find(n => n.localName === ln);
  const todos = ln => all.filter(n => n.localName === ln);
  const at = (n, a) => n ? (n.getAttribute(a) || '') : '';
  const comp = x.documentElement, emi = uno('Emisor'), rec = uno('Receptor'), tfd = uno('TimbreFiscalDigital');
  const pagos = todos('Pago').map(p => ({
    fecha: at(p,'FechaPago'), forma: at(p,'FormaDePagoP'), moneda: at(p,'MonedaP'), monto: +at(p,'Monto') || 0, operacion: at(p,'NumOperacion'),
    docs: Array.from(p.getElementsByTagName('*')).filter(n => n.localName === 'DoctoRelacionado').map(d => ({
      uuid: at(d,'IdDocumento'), serie: at(d,'Serie'), folio: at(d,'Folio'), parc: at(d,'NumParcialidad'),
      ant: +at(d,'ImpSaldoAnt') || 0, pagado: +at(d,'ImpPagado') || 0, insoluto: +at(d,'ImpSaldoInsoluto') || 0, objeto: at(d,'ObjetoImpDR') }))
  }));
  return {
    serie: at(comp,'Serie'), folio: at(comp,'Folio'), fecha: at(comp,'Fecha'), lugar: at(comp,'LugarExpedicion'),
    emisor: { rfc: at(emi,'Rfc'), nombre: at(emi,'Nombre'), regimen: at(emi,'RegimenFiscal') },
    receptor: { rfc: at(rec,'Rfc'), nombre: at(rec,'Nombre'), cp: at(rec,'DomicilioFiscalReceptor'), regimen: at(rec,'RegimenFiscalReceptor'), uso: at(rec,'UsoCFDI') },
    uuid: at(tfd,'UUID'), pagos, total: pagos.reduce((s, p) => s + p.monto, 0)
  };
}
function nunHtmlREP(xml){
  const R = nunLeerREP(xml);
  const emp = State.data.empresa || {};
  const forma = k => { const f = (typeof SAT_FORMA_PAGO !== 'undefined' ? SAT_FORMA_PAGO : []).find(([c]) => c === k); return k + (f ? ' · ' + f[1] : ''); };
  const e = escapeHTML, m = n => fmtFull(n);
  const fechaL = s => { try { return fmtFechaLarga(String(s).substring(0,10)); } catch(x){ return s; } };
  const td = cfdiTimbreData(xml); if (td && R.uuid) { const tm = cfdiGetTimbres(); if (!tm[R.uuid]) { tm[R.uuid] = td; cfdiSetTimbres(tm); } }
  const timbre = R.uuid ? cfdiTimbreHTML({ uuid_sat: R.uuid }, 0) : '';
  const filasDocs = R.pagos.map(p => p.docs.map(d => `<tr>
      <td class="mono">${e((d.serie||'') + (d.folio||''))}</td><td class="mono" style="font-size:8.5px">${e(d.uuid)}</td>
      <td class="r">${e(d.parc)}</td><td class="r">${m(d.ant)}</td><td class="r"><b>${m(d.pagado)}</b></td><td class="r">${m(d.insoluto)}</td></tr>`).join('')).join('');
  const bloquesPago = R.pagos.map(p => `<div class="caja"><div class="lbl">Pago recibido</div>
      <div class="g4"><div><span>Fecha de pago</span><b>${e(fechaL(p.fecha))}</b></div><div><span>Forma de pago</span><b>${e(forma(p.forma))}</b></div>
      <div><span>Monto</span><b>${m(p.monto)} ${e(p.moneda||'MXN')}</b></div><div><span>Núm. de operación</span><b>${e(p.operacion||'—')}</b></div></div></div>`).join('');
  const css = `@page{size:letter;margin:12mm 14mm}*{box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0a0c0f;margin:0;font-size:10.5px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .head{display:flex;justify-content:space-between;padding:18px 22px;background:#0a0c0f;color:#fff;border-radius:10px}.logo{width:78px;height:40px;display:block;margin-bottom:10px}
    .emp{font-size:13px;font-weight:700}.emp-d{font-size:9px;color:rgba(255,255,255,.75);line-height:1.55}.tit{text-align:right}.tit .l{font-size:9px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.16em}
    .tit .f{font-family:'Courier New',monospace;font-size:28px;font-weight:700;line-height:1.1}.tit .x{font-size:9.5px;color:rgba(255,255,255,.75);margin-top:6px}
    .dos{display:grid;grid-template-columns:1.3fr 1fr;gap:8px;margin:12px 0}.caja{padding:11px 14px;background:#f5f6f8;border:1px solid #e9ecef;border-radius:8px;margin-bottom:8px}
    .lbl{font-size:8.5px;color:#8a8d94;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:4px}.nom{font-size:12px;font-weight:700}.inf{font-size:9.5px;color:#555;margin-top:2px}
    .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.g4 span{display:block;font-size:8.5px;color:#8a8d94}.g4 b{font-size:11px}
    table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}th{background:#0a0c0f;color:#fff;padding:8px 9px;text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em}
    td{padding:8px 9px;border-bottom:1px solid #eef0f3}.r{text-align:right;font-family:'Courier New',monospace}.mono{font-family:'Courier New',monospace}
    .tot{display:flex;justify-content:space-between;margin-top:10px;padding:11px 14px;background:#0a0c0f;color:#fff;border-radius:8px;font-weight:700;font-size:13px}
    .letras{margin-top:8px;padding:9px 14px;background:#f5f6f8;border-left:3px solid #0a0c0f;border-radius:0 8px 8px 0;font-size:10px}
    .pie{margin-top:20px;padding-top:12px;border-top:1px solid #e9ecef;font-size:8.5px;color:#8a8d94;text-align:center}`;
  return `<!doctype html><html style="color-scheme:only light;background:#fff"><head><meta charset="utf-8"><meta name="color-scheme" content="only light"><title>Complemento de pago ${e(R.serie + R.folio)}</title><style>${css}</style></head><body>
    <div class="head"><div>${nunLogoPDF()}<div class="emp">${e(R.emisor.nombre || emp.razon_social || '')}</div>
      <div class="emp-d">RFC: ${e(R.emisor.rfc)} · Régimen: ${e(R.emisor.regimen)}<br>Lugar de expedición: CP ${e(R.lugar)}</div></div>
      <div class="tit"><div class="l">Complemento de pago</div><div class="f">${e(R.serie + R.folio)}</div>
      <div class="x">Emitido: <b>${e(fechaL(R.fecha))}</b><br>CFDI tipo P · Pagos 2.0</div></div></div>
    <div class="dos"><div class="caja" style="margin:0"><div class="lbl">Cliente</div><div class="nom">${e(R.receptor.nombre)}</div>
      <div class="inf"><b>RFC:</b> ${e(R.receptor.rfc)} · <b>CP:</b> ${e(R.receptor.cp)}</div><div class="inf"><b>Régimen:</b> ${e(R.receptor.regimen)} · <b>Uso CFDI:</b> ${e(R.receptor.uso)}</div></div>
      <div class="caja" style="margin:0"><div class="lbl">Concepto</div><div class="inf">84111506 · Pago · Unidad ACT · Importe $0.00</div><div class="inf">Moneda del comprobante: XXX</div></div></div>
    ${bloquesPago}
    <div class="lbl" style="margin-top:6px">Factura(s) que se pagan</div>
    <table><thead><tr><th>Factura</th><th>Folio fiscal (UUID)</th><th class="r">Parcialidad</th><th class="r">Saldo anterior</th><th class="r">Pagado</th><th class="r">Saldo pendiente</th></tr></thead><tbody>${filasDocs}</tbody></table>
    <div class="tot"><span>TOTAL PAGADO</span><span class="mono">${m(R.total)}</span></div>
    <div class="letras"><b>Con letra:</b> ${e(numeroALetras(R.total))} M.N.</div>
    ${timbre}
    <div class="pie">Generado por <b>NUN ERP</b> · ${new Date().toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'})}</div></body></html>`;
}
