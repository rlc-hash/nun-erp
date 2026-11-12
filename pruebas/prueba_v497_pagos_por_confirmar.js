// v4.97 (Rafa 12 nov: "le pico Verificar y no se registra… ponlo en Cobranza: Pagos por confirmar") — la ventana "¿Registrar este pago?" salía DETRÁS
// de la lista (z-index 400 vs 9000) y parecía que no hacía nada. Ahora sale encima, los avisos también; menú "⏳ Pagos por confirmar"; 📎 Subir comprobante.
// Chrome real (Playwright), teléfono, datos inventados, sin red.
const { chromium, devices } = require('playwright'); const path = require('path');
(async () => { const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
    const LL = [];
    const DB = { clientes: [{ id: 'c1', razon_social: 'CLIENTE PV' }], cobranza: [{ id: 'k1', cliente: 'CLIENTE PV', tipo: 'Pedido', numero: 'P0001', total: 1000, cobrado: 0, pendiente: 1000 }],
      pagosverificar: [{ id: 'pv1', cobro_id: 'k1', cliente: 'CLIENTE PV', documento: 'Pedido P0001', monto: 1000, fecha: '2026-11-12', estatus: 'por_verificar', vendedor: 'RAFA', cuenta: 'BBVA', forma: 'Transferencia' }], ingresos: [], pedidos: [], remisiones: [], facturas: [] };
    await p.addInitScript(() => { localStorage.setItem('nun_modo', 'cel'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() })); });
    await p.route('**/*', rt => { const u = rt.request().url(); if (!(u.includes('supabase') || u.includes('script.google'))) return u.startsWith('file://') ? rt.continue() : rt.fulfill({ status: 404, body: '' });
      let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {} LL.push(q); let x = { ok: true, items: [], valores: {} };
      if (q.accion === 'erp_listar') x = { ok: true, items: DB[q.tabla] || [] }; else if (q.accion === 'listar_cuentas') x = { ok: true, cuentas: [{ nombre: 'BBVA', activa: true }] };
      else if (q.accion === 'archivo_listar') x = { ok: true, items: [] }; else if (q.accion === 'archivo_subir') x = { ok: true };
      else if (q.accion === 'capturar_pago_cliente') { DB.cobranza[0].cobrado = 1000; DB.cobranza[0].pendiente = 0; }
      else if (q.accion === 'erp_upsert_batch') q.items.forEach(it => Object.assign(DB[q.tabla].find(y => y.id === it.id), it));
      return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(x) }); });
    await p.goto('file://' + (process.env.NUN_INDEX || path.join(__dirname, '..', 'index.html'))); await p.waitForTimeout(3500); await p.waitForFunction(() => document.getElementById('navPV') && document.getElementById('navPV').textContent === '1', null, { timeout: 15000 }).catch(() => {});
    r.menu = await p.evaluate(() => !!document.querySelector('.nav-btn[onclick="nunPagosPorConfirmar()"]') && document.getElementById('navPV').textContent); if (r.menu !== '1') r.fallas.push('menú Pagos por confirmar con su número');
    await p.evaluate(() => nunPagosPorConfirmar()); await p.waitForSelector('#modalPV', { timeout: 10000 }); await p.waitForTimeout(500);
    r.titulo = await p.textContent('#modalPV h3'); if (!/Pagos por confirmar \(1\)/.test(r.titulo)) r.fallas.push('título');
    r.subir = await p.evaluate(() => !!document.querySelector('#modalPV .pvComp input[type=file]')); if (!r.subir) r.fallas.push('📎 Subir');
    await p.click('#modalPV button:has-text("Confirmar y registrar")'); await p.waitForTimeout(300);
    // ¿la confirmación quedó ENCIMA? (lo que hay en el centro de la pantalla es el botón de confirmar)
    r.encima = await p.evaluate(() => { const ok = document.getElementById('confirmOk'); const rc = ok.getBoundingClientRect(); const el = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2); return el === ok || ok.contains(el); });
    if (!r.encima) r.fallas.push('la confirmación sale detrás');
    await p.click('#confirmOk'); await p.waitForTimeout(800);
    r.registro = LL.some(q => q.accion === 'capturar_pago_cliente' && q.id_doc === 'k1' && q.monto === 1000 && q.cuenta === 'BBVA'); if (!r.registro) r.fallas.push('registra el pago');
    r.verificado = DB.pagosverificar[0].estatus; if (r.verificado !== 'verificado') r.fallas.push('queda verificado');
    r.errs = errs; if (errs.length) r.fallas.push('errores');
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close(); console.log(JSON.stringify(r, null, 1)); process.exit(0); })();
