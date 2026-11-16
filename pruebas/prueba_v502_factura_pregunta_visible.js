// v5.02 (Yazmín 16 nov: "hice la factura de Miguel Ángel Romero y se quedó en ese estatus") — al hacer la factura desde el pedido, si ya hay otra del mismo
// cliente con el mismo total (45 días) el sistema pregunta "¿Es otra venta?". Esa pregunta salía DETRÁS del letrero "⏳ Creando factura…" (z 99999) y no se
// podía contestar: se quedaba trabado sin llegar al servidor. Ahora la pregunta sale encima (y el letrero se pone después). Navegador real; datos inventados.
const { chromium } = require('playwright'); const path = require('path');
const C = 'CLIENTE REPETIDO';
const hoy = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10), hace = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const DB = { clientes: [{ id: 'c1', razon_social: C, rfc: 'XAXX010101000', cp: '06020', regimen_fiscal: '601' }],
  pedidos: [{ id: 'bind_ord_1', folio: '1310', fecha: '2026-08-13', cliente: C, vendedor: 'EDGAR', estatus: 'facturado', total: 7030, items_json: JSON.stringify([{ sku: 'X1', descripcion: 'MALETA', cantidad: 2, precio_unitario: 3515, iva_pct: 16 }]) }],
  facturas: [{ id: 'f1', folio: 'FT0011', fecha: hace, cliente: C, estatus: 'timbrada', total: 3515, pedido_origen: '1310', items_json: '[]' }],
  remisiones: [], cobranza: [], ingresos: [] };
async function correr(b){ let r0 = '';
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p.addInitScript(() => { localStorage.setItem('nun_modo', 'compu'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() })); });
  const crea = [];
  await p.route('**/*', rt => { const u = rt.request().url(); if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
    let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (q.accion === 'erp_crear') { crea.push(q.tabla + ':' + q.item.total); return rt.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, item: { ...q.item, folio: 'FT0021' } }) }); }
    return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(q.accion === 'erp_listar' ? { ok: true, items: DB[q.tabla] || [] } : { ok: true, items: [], valores: {} }) }); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3500);
  await p.waitForTimeout(500);
  await p.evaluate(() => { nunDesdePedidos('bind_ord_1', 'facturas'); }); await p.waitForTimeout(500);
  r0 = await p.evaluate(() => { const b = document.getElementById('confirmBackdrop'); return b && b.classList.contains('show') ? document.getElementById('confirmTitle').textContent : ''; });
  if (/Bind/.test(r0)) { await p.click('#confirmOk'); await p.waitForTimeout(500); } // pedido de Bind: "¿es una venta nueva?" → sí
  const r = { errs, avisoBind: r0, hayVentana: await p.evaluate(() => !!document.getElementById('modalDP')) };
  // 1 pieza de $3,515 (mismo total que la FT0011) con el IVA incluido
  await p.evaluate(() => { const m = document.getElementById('modalDP'); const c = m.querySelectorAll('.dpCant'); c.forEach((x, i) => { x.value = i === 0 ? 1 : 0; x.dispatchEvent(new Event('input', { bubbles: true })); });
    const s = document.getElementById('dpIva'); if (s) { s.value = 'incluye'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.evaluate(() => { nunDesdePedidosCrear('facturas'); }); await p.waitForTimeout(600);
  r.pregunta = await p.evaluate(() => { const b = document.getElementById('confirmBackdrop'); if (!b || !b.classList.contains('show')) return null;
    const ok = document.getElementById('confirmOk'), q = ok.getBoundingClientRect(), arriba = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
    return { titulo: document.getElementById('confirmTitle').textContent, botonAlFrente: arriba === ok || ok.contains(arriba), ocupado: !!document.getElementById('nunOcupado') }; });
  if (r.pregunta && r.pregunta.botonAlFrente) { await p.click('#confirmOk'); await p.waitForTimeout(1500); }
  r.crea = crea; r.ocupadoAlFinal = await p.evaluate(() => !!document.getElementById('nunOcupado'));
  await ctx.close(); return r;
}
(async () => {
  const r = { fallas: [] }; let b;
  try { b = await chromium.launch(); Object.assign(r, await correr(b));
    if (!r.hayVentana) r.fallas.push('abre la ventana de factura');
    if (!(r.pregunta && /otra venta/.test(r.pregunta.titulo))) r.fallas.push('pregunta si es otra venta');
    if (!(r.pregunta && r.pregunta.botonAlFrente && !r.pregunta.ocupado)) r.fallas.push('la pregunta se ve y se puede tocar (no la tapa el letrero)');
    if (!(r.crea.length === 1 && /^facturas:3515/.test(r.crea[0]))) r.fallas.push('al contestar sí, crea la factura');
    if (r.ocupadoAlFinal) r.fallas.push('el letrero de espera se quita');
    if (r.errs.length) r.fallas.push('errores');
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close(); console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
