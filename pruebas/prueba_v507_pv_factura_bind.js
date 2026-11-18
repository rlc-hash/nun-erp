// v5.07 (18 nov: "no le deja a Yazmín timbrar") — pago reportado de una factura PPD que viene de Bind: la ventana del complemento pedía
// "Número de parcialidad" vacío y el aviso quedaba escondido abajo. Ahora: si el cobro no tiene ningún pago, la parcialidad sale 1 sola y llega a timbrar;
// si falta algo, el aviso se ve. Y si el documento ya está pagado (se registró por otro lado), sale ✔ Ya estaba registrado (no registra otra vez).
// Navegador real (Playwright); servidor simulado (no timbra); datos inventados.
const { chromium } = require('playwright'); const path = require('path');
const DB = {
  clientes: [{ id: 'c1', razon_social: 'CLIENTE BIND', rfc: 'XAXX010101000', cp: '06020', regimen_fiscal: '612', vendedor: 'EDGAR' }],
  facturas: [{ id: 'bind_f1', folio: 901, fecha: '2026-03-01', cliente: 'CLIENTE BIND', total: 1160, subtotal: 1000, iva: 160, estatus: 'timbrada', metodo_pago: 'PPD', uuid_sat: 'AAAA-1', notas: 'Importada desde Bind' },
    { id: 'bind_f2', folio: 902, fecha: '2026-03-02', cliente: 'CLIENTE BIND', total: 580, subtotal: 500, iva: 80, estatus: 'timbrada', metodo_pago: 'PPD', uuid_sat: 'AAAA-2', notas: 'Importada desde Bind' }],
  cobranza: [{ id: 'bind_cob_f1', cliente: 'CLIENTE BIND', tipo: 'Factura', numero: 901, total: 1160, cobrado: 0, pendiente: 1160, factura_origen: 'bind_f1', fecha_emision: '2026-03-01' },
    { id: 'bind_cob_f2', cliente: 'CLIENTE BIND', tipo: 'Factura', numero: 902, total: 580, cobrado: 580, pendiente: 0, factura_origen: 'bind_f2', fecha_emision: '2026-03-02' }],
  pagosverificar: [{ id: 'pv1', fecha: '2026-11-18', cliente: 'CLIENTE BIND', cobro_id: 'bind_cob_f1', documento: 'Factura 901', monto: 1160, cuenta: 'BBVA', forma: 'Transferencia', referencia: '123', vendedor: 'EDGAR', estatus: 'por_verificar', creado: '2026-11-18T10:00:00Z' },
    { id: 'pv2', fecha: '2026-11-18', cliente: 'CLIENTE BIND', cobro_id: 'bind_cob_f2', documento: 'Factura 902', monto: 580, cuenta: 'BBVA', forma: 'Transferencia', referencia: '123', vendedor: 'EDGAR', estatus: 'por_verificar', creado: '2026-11-18T10:00:01Z' }],
  ingresos: [], pedidos: [], remisiones: [] };
(async () => {
  const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
    const errs = [], esc = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
    await p.addInitScript(() => { localStorage.setItem('nun_modo', 'compu'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() })); window.open = () => null; });
    await p.route('**/*', rt => { const u = rt.request().url();
      if (u.startsWith('file:')) return rt.continue();
      if (!(u.includes('supabase') || u.includes('script.google'))) return rt.fulfill({ status: 404, body: '' });
      let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
      let x = { ok: true, items: [], valores: {} };
      if (q.accion === 'erp_listar') x = { ok: true, items: DB[q.tabla] || [] };
      else if (q.accion === 'listar_cuentas') x = { ok: true, cuentas: [{ nombre: 'BBVA', activa: true }] };
      else if (q.accion === 'facturama_timbrar') { esc.push(q); x = { ok: false, error: 'SIMULADO' }; }
      else if (q.accion === 'capturar_pago_cliente' || q.accion === 'erp_upsert_batch') { esc.push(q); if (q.tabla === 'pagosverificar') q.items.forEach(it => Object.assign(DB.pagosverificar.find(z => z.id === it.id), it)); }
      return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(x) }); });
    await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3500);
    r.version = await p.evaluate(() => document.querySelector('.rwd-version').textContent); if (!/^v5\.(0[7-9]|[1-9]\d)/.test(r.version)) r.fallas.push('version');
    await p.evaluate(async () => { await cargarTabla('pagosverificar', { ttl: 1 }); nunPVAbrir(); }); await p.waitForTimeout(500);
    const txt = await p.locator('#modalPV').innerText();
    r.botones = await p.$$eval('#modalPV button', bs => bs.map(x => x.textContent.trim()));
    if (!r.botones.includes('🧾 Confirmar y timbrar complemento (901)')) r.fallas.push('901 con botón de complemento');
    if (r.botones.some(x => /\(902\)/.test(x)) || !r.botones.includes('✔ Ya estaba registrado') || !/ya está pagado/.test(txt)) r.fallas.push('902 pagada: Ya estaba registrado, sin timbrar');
    // 901: parcialidad 1 sola, llega a timbrar
    await p.click('#modalPV button:has-text("complemento (901)")'); await p.waitForTimeout(1200);
    r.parc = await p.evaluate(() => document.getElementById('repParc').value); if (r.parc !== '1') r.fallas.push('parcialidad 1 sola');
    await p.click('#repBoton'); await p.waitForTimeout(500); await p.click('#confirmOk'); await p.waitForTimeout(1200);
    const t = esc.find(q => q.accion === 'facturama_timbrar'); r.timbro = t ? t.cfdi.Complemento.Payments[0].RelatedDocuments[0] : null;
    if (!(r.timbro && r.timbro.PartialityNumber === 1 && Math.abs(r.timbro.PreviousBalanceAmount - 1160) < 0.01)) r.fallas.push('llega a timbrar con parcialidad 1');
    // si falta algo, el aviso se ve (toast)
    await p.evaluate(() => { document.getElementById('repParc').value = ''; }); await p.click('#repBoton'); await p.waitForTimeout(400);
    r.toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.innerText).join('|')); if (!/parcialidad/.test(r.toast)) r.fallas.push('aviso visible');
    await p.evaluate(() => document.getElementById('modalREP').remove());
    // 902: ya estaba registrado
    await p.evaluate(() => nunPVAbrir()); await p.click('#modalPV button:has-text("Ya estaba registrado")'); await p.waitForTimeout(400); await p.click('#confirmOk'); await p.waitForTimeout(1000);
    r.pv2 = DB.pagosverificar[1].estatus; if (r.pv2 !== 'verificado' || esc.some(q => q.accion === 'capturar_pago_cliente')) r.fallas.push('902 queda confirmado sin registrar otra vez');
    if (errs.length) { r.errs = errs; r.fallas.push('errores'); }
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close();
  console.log(JSON.stringify(r, null, 1)); process.exit(r.error || r.fallas.length ? 1 : 0);
})();
