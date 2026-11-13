// v4.96 (Rafa 12 nov) — 💬 WhatsApp en la ficha de cotizaciones y pedidos: se hace el PDF del documento (el mismo de 📄 PDF) y se comparte; si el teléfono
// no deja, se guarda y sale "Abrir WhatsApp" con el cliente. El PDF ya es todo blanco con líneas (sin bloques negros) y "juego" sale como "set".
// Navegador real (Playwright), generador de PDF simulado, datos inventados, sin red.
const { chromium, devices } = require('playwright'); const path = require('path');
const FAKE_PDF = 'window.html2pdf=function(){const o={set(){return o},from(){return o},outputPdf(){return Promise.resolve(new Blob(["%PDF-1.4 prueba"],{type:"application/pdf"}))}};return o};';
const DB = { clientes: [{ id: 'c1', razon_social: 'CLIENTE DOC', telefono: '55 1234 5678' }], productos: [{ id: 'p1', sku: 'RL009N', descripcion: 'MALETA RL009 NEGRO SET 3 PZ', unidad: 'juego', precio: 1650 }],
  cotizaciones: [{ id: 'q1', folio: 'C0099', fecha: '2026-11-12', cliente: 'CLIENTE DOC', vendedor: 'EDGAR', estatus: 'enviada', total: 8250, subtotal: 8250, iva: 0, sin_iva: true, items_json: JSON.stringify([{ sku: 'RL009N', descripcion: 'MALETA RL009 NEGRO SET 3 PZ', cantidad: 5, precio_unitario: 1650, iva_pct: 0 }]) }],
  pedidos: [{ id: 'p1', folio: 'P0099', fecha: '2026-11-12', cliente: 'CLIENTE DOC', vendedor: 'EDGAR', estatus: 'confirmado', total: 1650, subtotal: 1650, iva: 0, sin_iva: true, items_json: JSON.stringify([{ sku: 'RL009N', descripcion: 'MALETA', cantidad: 1, unidad: 'juego', precio_unitario: 1650, iva_pct: 0 }]) }],
  cobranza: [], remisiones: [], facturas: [], ingresos: [] };
async function correr(b, falla){
  const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p.addInitScript(falla => { localStorage.setItem('nun_modo', 'cel'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() }));
    window.__comp = []; navigator.canShare = () => true; navigator.share = async d => { if (falla) { const e = new Error('Permission denied'); e.name = 'NotAllowedError'; throw e; } window.__comp.push({ nombre: d.files[0].name, text: d.text }); }; }, falla);
  await p.route('**/*', rt => { const u = rt.request().url();
    if (u.includes('html2pdf')) return rt.fulfill({ contentType: 'application/javascript', body: FAKE_PDF });
    if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
    let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(q.accion === 'erp_listar' ? { ok: true, items: DB[q.tabla] || [] } : { ok: true, items: [], valores: {} }) }); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3500);
  const r = { errs };
  for (const [t, id] of [['cotizaciones', 'q1'], ['pedidos', 'p1']]) {
    await p.evaluate(([t, id]) => abrirDoc(t, id), [t, id]); await p.waitForTimeout(400);
    await p.click('#drawer button:has-text("💬 WhatsApp")'); await p.waitForSelector('#docWABox button:has-text("Enviar por WhatsApp")', { timeout: 15000 });
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('#docWABox button:has-text("Enviar por WhatsApp")')]); await p.waitForTimeout(300);
    r[t] = { comp: await p.evaluate(() => window.__comp.slice(-1)[0] || null), bajo: !!dl, planB: await p.evaluate(() => { const a = document.querySelector('#docWALink a'); return a ? a.href : null; }) };
    await p.evaluate(() => { const m = document.getElementById('modalDocWA'); if (m) m.remove(); cerrarDrawer(); });
  }
  r.html = await p.evaluate(() => imprimirDocumento('pedidos', 'p1', true));
  await ctx.close(); return r;
}
(async () => {
  const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch();
    const ok = await correr(b, false), no = await correr(b, true);
    r.ok = { cot: ok.cotizaciones, ped: ok.pedidos }; r.no = { cot: no.cotizaciones };
    if (!(ok.cotizaciones.comp && /^Cotizacion_C0099\.pdf$/.test(ok.cotizaciones.comp.nombre) && /Cotización C0099 de CLIENTE DOC por \$8,250\.00/.test(ok.cotizaciones.comp.text))) r.fallas.push('compartir cotización');
    if (!(ok.pedidos.comp && /^Pedido_P0099\.pdf$/.test(ok.pedidos.comp.nombre))) r.fallas.push('compartir pedido');
    if (!(no.cotizaciones.bajo && /^https:\/\/wa\.me\/525512345678\?text=/.test(no.cotizaciones.planB || ''))) r.fallas.push('plan B si el teléfono no deja');
    // colores: sin fondos negros; "juego" → "set" (también si el renglón no trae unidad: la del producto)
    // v4.98: solo el encabezado va negro (logo blanco); lo demás blanco con líneas, y la hoja se declara "solo clara" (el modo oscuro del teléfono no la oscurece)
    const h = ok.html; r.negros = (h.match(/background:\s*(#0a0c0f|linear-gradient\(135deg,#0a0c0f)/g) || []).length;
    if (r.negros !== 1 || !/\.head \{[^}]*background:#0a0c0f/.test(h)) r.fallas.push('solo el encabezado negro');
    if (!/<meta name="color-scheme" content="only light">/.test(h)) r.fallas.push('hoja solo clara');
    if (!/>set</.test(h) || />juego</.test(h)) r.fallas.push('juego → set');
    if (ok.errs.length || no.errs.length) r.fallas.push('errores');
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close();
  console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
