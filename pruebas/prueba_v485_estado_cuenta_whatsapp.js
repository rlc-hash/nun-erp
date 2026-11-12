// v4.85 (Rafa: "en Cobranza no hay WhatsApp") — Estado de cuenta del ERP: en compu y teléfono se hace el PDF y salen
// 💬 Enviar por WhatsApp · 📥 Guardar (· 🖨 Imprimir en compu). En compu WhatsApp baja el PDF y abre wa.me con el teléfono del cliente y el saldo;
// en el teléfono comparte el archivo. Navegador real (Playwright); servidor y generador de PDF simulados; datos inventados, sin red.
const { chromium, devices } = require('playwright'); const path = require('path');
const FAKE_PDF = 'window.html2pdf=function(){const o={set(){return o},from(){return o},outputPdf(){return Promise.resolve(new Blob(["%PDF-1.4 prueba"],{type:"application/pdf"}))}};return o};';
const DB = { clientes: [{ id: 'c1', razon_social: 'CLIENTE ESTADO', telefono: '55 1234 5678', vendedor: 'EDGAR' }],
  pedidos: [{ id: 'p1', folio: 'P0101', fecha: '2026-10-01', cliente: 'CLIENTE ESTADO', estatus: 'confirmado', total: 10000, items_json: '[]' }],
  cobranza: [{ id: 'cob_p1', cliente: 'CLIENTE ESTADO', tipo: 'Pedido', numero: 'P0101', total: 10000, cobrado: 4000, pendiente: 6000, factura_origen: 'p1', estatus: 'pendiente', fecha_emision: '2026-10-01' }],
  ingresos: [{ id: 'i1', fecha: '2026-10-05', cliente: 'CLIENTE ESTADO', monto: 4000, factura: 'P0101', cuenta: 'BBVA', tipo: 'cobro' }], remisiones: [], facturas: [] };
async function correr(b, cel, falla){
  const ctx = await b.newContext(cel ? { ...devices['Pixel 7'], acceptDownloads: true } : { viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p.addInitScript(cel => { localStorage.setItem('nun_modo', cel ? 'cel' : 'compu'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() }));
    window.__abierto = []; const o = window.open; window.open = (u, ...x) => { window.__abierto.push(String(u)); return null; };
    window.__compartido = null; navigator.canShare = cel ? (() => true) : undefined; if (cel) navigator.share = async d => { if (window.__falla) { const e = new Error('Permission denied'); e.name = 'NotAllowedError'; throw e; } window.__compartido = { n: d.files.length, nombre: d.files[0].name, text: d.text }; }; }, cel);
  if (falla) await p.addInitScript(() => { window.__falla = true; });
  await p.route('**/*', rt => { const u = rt.request().url();
    if (u.includes('html2pdf')) return rt.fulfill({ contentType: 'application/javascript', body: FAKE_PDF });
    if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
    let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(q.accion === 'erp_listar' ? { ok: true, items: DB[q.tabla] || [] } : { ok: true, items: [], valores: {} }) }); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3500);
  await p.evaluate(() => nunEstadoCuentaAbrir('c1')); await p.waitForTimeout(300);
  await p.click('#ecPdfBox button'); await p.waitForSelector('text=💬 Enviar por WhatsApp', { timeout: 15000 });
  const botones = await p.$$eval('#ecPdfBox button', bs => bs.map(x => x.textContent.trim()));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('text=💬 Enviar por WhatsApp')]);
  await p.waitForTimeout(300);
  const r = { botones, planB: await p.evaluate(() => { const a = document.querySelector('#ecWaLink a'); return a ? { href: a.href, texto: document.getElementById('ecWaLink').textContent.replace(/\s+/g, ' ').trim() } : null; }), descargo: !!dl, abierto: await p.evaluate(() => window.__abierto), compartido: await p.evaluate(() => window.__compartido), errs };
  await ctx.close(); return r;
}
(async () => {
  const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch();
    r.compu = await correr(b, false); r.cel = await correr(b, true); r.celNoDeja = await correr(b, true, true); // v4.92
    if (r.compu.botones.join('|') !== '💬 Enviar por WhatsApp|📥 Guardar PDF|🖨 Imprimir') r.fallas.push('botones compu');
    if (!(r.compu.descargo && r.compu.abierto.length === 1 && /^https:\/\/wa\.me\/525512345678\?text=/.test(r.compu.abierto[0]) && /saldo%20pendiente%20%246%2C000\.00/.test(r.compu.abierto[0]))) r.fallas.push('whatsapp compu');
    if (r.cel.botones.join('|') !== '💬 Enviar por WhatsApp|📥 Guardar PDF') r.fallas.push('botones teléfono');
    if (!(r.cel.compartido && r.cel.compartido.n === 1 && /^Estado_de_cuenta_CLIENTE_ESTADO_.*\.pdf$/.test(r.cel.compartido.nombre) && /saldo pendiente \$6,000\.00/.test(r.cel.compartido.text))) r.fallas.push('whatsapp teléfono');
    if (r.cel.planB || r.cel.descargo) r.fallas.push('teléfono que sí comparte no debe bajar ni mostrar plan B');
    // v4.92: el teléfono no deja compartir → baja el PDF, dice por qué y da botón Abrir WhatsApp con el teléfono del cliente
    if (!(r.celNoDeja.descargo && r.celNoDeja.planB && /^https:\/\/wa\.me\/525512345678\?text=/.test(r.celNoDeja.planB.href) && /no dejó compartir/.test(r.celNoDeja.planB.texto) && !r.celNoDeja.compartido)) r.fallas.push('plan B teléfono');
    if (r.compu.errs.length || r.cel.errs.length || r.celNoDeja.errs.length) r.fallas.push('errores');
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close();
  console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
