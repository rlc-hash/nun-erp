// v5.03 (auditoría 16 nov) — CAPAS: una ventana o ficha que se abre desde otra ventana más alta quedaba ESCONDIDA detrás (parecía trabado).
// Ahora toda ventana nueva ("modal…") y la ficha salen encima de lo que ya está abierto; preguntas/avisos/letrero siempre encima de todo.
// Navegador real (Playwright), datos inventados, sin red.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
    await p.addInitScript(() => { localStorage.setItem('nun_modo', 'compu'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() })); });
    await p.route('**/*', rt => { const u = rt.request().url(); if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
      return rt.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, items: [], valores: {} }) }); });
    await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3000);
    const alFrente = id => p.evaluate(id => { const el = document.getElementById(id); if (!el) return null; const q = el.querySelector('.boton') || el; const b = q.getBoundingClientRect();
      const x = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(b.height / 2, 40)); return !!x && (x === q || q.contains(x)); }, id);
    const ventana = (id, z) => p.evaluate(([id, z]) => { const m = document.createElement('div'); m.id = id; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:' + z + ';display:flex;align-items:center;justify-content:center';
      m.innerHTML = '<button class="boton" style="width:200px;height:80px">' + id + '</button>'; document.body.appendChild(m); }, [id, z]);
    await ventana('modalAlta', 9000); await p.waitForTimeout(50); r.alta = await alFrente('modalAlta');
    // ficha (drawer) abierta desde la ventana alta
    await p.evaluate(() => abrirDrawer({ title: 'Ficha', body: '<button class="boton" id="enFicha" style="width:200px;height:80px">ficha</button>' })); await p.waitForTimeout(400);
    r.ficha = await p.evaluate(() => { const q = document.getElementById('enFicha').getBoundingClientRect(); const x = document.elementFromPoint(q.x + 50, q.y + 20); return !!x && x.id === 'enFicha'; });
    // ventana de número bajo (como "Pago y complemento", 130) abierta encima de todo eso
    await ventana('modalBaja', 130); await p.waitForTimeout(50); r.baja = await alFrente('modalBaja'); r.zBaja = await p.evaluate(() => document.getElementById('modalBaja').style.zIndex);
    // la pregunta sigue encima de todo
    await p.evaluate(() => { confirmDialog({ title: '¿Seguro?', message: 'x' }); }); await p.waitForTimeout(100);
    r.pregunta = await p.evaluate(() => { const ok = document.getElementById('confirmOk').getBoundingClientRect(); const x = document.elementFromPoint(ok.x + ok.width / 2, ok.y + ok.height / 2); return !!x && (x.id === 'confirmOk' || document.getElementById('confirmOk').contains(x)); });
    await p.click('#confirmOk');
    // al cerrar la de arriba y la ficha, la ventana alta vuelve a quedar al frente y la ficha regresa a su número normal
    await p.evaluate(() => { document.getElementById('modalBaja').remove(); cerrarDrawer(); }); await p.waitForTimeout(400);
    r.altaOtraVez = await alFrente('modalAlta'); r.zFicha = await p.evaluate(() => document.getElementById('drawer').style.zIndex);
    if (!r.alta) r.fallas.push('ventana alta al frente');
    if (!r.ficha) r.fallas.push('la ficha sale encima de la ventana alta');
    if (!r.baja || !(+r.zBaja > 9000)) r.fallas.push('ventana de número bajo sale encima');
    if (!r.pregunta) r.fallas.push('la pregunta siempre encima');
    if (!r.altaOtraVez || r.zFicha !== '') r.fallas.push('al cerrar todo regresa');
    if (errs.length) { r.errs = errs; r.fallas.push('errores'); }
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close(); console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
