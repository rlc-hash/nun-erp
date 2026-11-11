// v4.79 — Cobranza: al capturar un pago se puede subir el comprobante (foto o PDF; la foto se achica a JPEG ≤1600 px),
// la pestaña 📎 Comprobantes lo lista / deja subir más, y la lista de Cobranza marca 📎. Navegador real (Playwright), servidor simulado, sin red.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
  const r = { fallas: [] }; let b;
  try {
    const ARCH = [], PAGOS = [];
    const DB = { cobranza: [{ id: 'k1', cliente: 'CLIENTE X', tipo: 'Remisión', numero: 'R0009', total: 1000, cobrado: 0, pendiente: 1000, estatus: 'pendiente', fecha_entrega: '2026-11-01' }],
      cuentas: [{ nombre: 'BBVA', activa: true }] };
    b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.addInitScript(() => { localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() })); });
    await p.route('**/*', rt => { const u = rt.request().url();
      if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
      let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
      let res = { ok: true, items: [], valores: {} };
      if (q.accion === 'erp_listar') res = { ok: true, items: DB[q.tabla] || [] };
      else if (q.accion === 'listar_cuentas') res = { ok: true, cuentas: DB.cuentas };
      else if (q.accion === 'capturar_pago_cliente') { PAGOS.push(q); res = { ok: true, nuevoCobrado: q.monto, nuevoPendiente: 1000 - q.monto }; }
      else if (q.accion === 'archivo_subir') { ARCH.push(Object.assign({ quien: 'Rafa', creado: new Date().toISOString(), cancelado: false, tam: q.datos.length * 0.75 }, q)); res = { ok: true, id: q.id }; }
      else if (q.accion === 'archivo_listar') res = { ok: true, items: ARCH.filter(x => x.cobro_id === q.cobro_id).map(({ datos, ...x }) => x) };
      else if (q.accion === 'archivo_conteo') { const c = {}; ARCH.forEach(x => { c[x.cobro_id] = (c[x.cobro_id] || 0) + 1; }); res = { ok: true, conteo: c }; }
      return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(res) }); });
    await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3000);
    // foto grande de prueba (3000×2000 PNG)
    const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, 3000, 2000); g.fillStyle = '#fff'; g.fillRect(100, 100, 800, 400); return c.toDataURL('image/png').split(',')[1]; });
    const archivo = path.join(os.tmpdir(), 'comprobante_prueba_' + process.pid + '.png'); fs.writeFileSync(archivo, Buffer.from(png, 'base64'));
    await p.evaluate(() => { State.data.cobranza = [{ id: 'k1', cliente: 'CLIENTE X', tipo: 'Remisión', numero: 'R0009', total: 1000, cobrado: 0, pendiente: 1000, estatus: 'pendiente', fecha_entrega: '2026-11-01' }]; State.data.cuentas = [{ nombre: 'BBVA', activa: true }]; abrirDrawerCobranza('k1'); });
    await p.waitForTimeout(400);
    await p.setInputFiles('#pcComp', archivo);
    r.info = await p.textContent('#pcCompInfo'); if (!/se sube al registrar/.test(r.info)) r.fallas.push('aviso del archivo');
    await p.evaluate(() => { document.getElementById('pcMonto').value = '400'; document.getElementById('pcCuenta').innerHTML = '<option>BBVA</option>'; document.getElementById('pcCuenta').value = 'BBVA'; });
    await p.evaluate(() => ejecutarPagoCliente('k1')); await p.waitForTimeout(1500);
    r.pago = PAGOS.length === 1 && PAGOS[0].monto === 400; if (!r.pago) r.fallas.push('pago');
    const a = ARCH[0] || {}; r.subido = { cobro: a.cobro_id, mime: a.mime, nombre: a.nombre, ref: a.ref, kb: Math.round((a.datos || '').length * 0.75 / 1024) };
    if (!(a.cobro_id === 'k1' && a.mime === 'image/jpeg' && /\.jpg$/.test(a.nombre) && /Pago \$400\.00/.test(a.ref))) r.fallas.push('comprobante con el pago');
    // tamaño: achicada a 1600 px
    r.medida = await p.evaluate(async d => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = 'data:image/jpeg;base64,' + d; }); return i.naturalWidth + 'x' + i.naturalHeight; }, a.datos || '');
    if (r.medida !== '1600x1067') r.fallas.push('achicar');
    // pestaña Comprobantes y subir otro (PDF) aparte
    await p.evaluate(() => { abrirDrawerCobranza('k1'); drawerCambiarTab('comprobantes'); }); await p.waitForTimeout(600);
    r.tab = (await p.textContent('#compLista')).replace(/\s+/g, ' ').trim(); if (!/comprobante_prueba.*\.jpg/.test(r.tab) || !/subió Rafa/.test(r.tab)) r.fallas.push('pestaña');
    const pdf = path.join(os.tmpdir(), 'transferencia_' + process.pid + '.pdf'); fs.writeFileSync(pdf, '%PDF-1.4\n%prueba\n');
    await p.setInputFiles('#compLista input[type=file]', pdf); await p.waitForTimeout(1200);
    r.pdf = ARCH[1] && ARCH[1].mime === 'application/pdf' && ARCH[1].cobro_id === 'k1'; if (!r.pdf) r.fallas.push('subir pdf aparte');
    r.tab2 = /transferencia_.*\.pdf/.test(await p.textContent('#compLista')); if (!r.tab2) r.fallas.push('lista tras subir');
    // 📎 en la lista de Cobranza
    await p.evaluate(() => { cerrarDrawer(); navegar('cobranza'); }); await p.waitForTimeout(1200);
    await p.evaluate(() => nunCompMarcarLista()); await p.waitForTimeout(300);
    r.marca = await p.evaluate(() => { const e = document.querySelector('[data-cobro-id="k1"] .comp-n'); return e ? e.textContent : ''; }); if (r.marca !== '📎2') r.fallas.push('📎 en la lista');
    r.version = await p.evaluate(() => (document.querySelector('.rwd-version') || {}).textContent);
    r.errs = errs.slice(0, 3); if (errs.length) r.fallas.push('errores');
    fs.unlinkSync(archivo); fs.unlinkSync(pdf);
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close();
  console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
