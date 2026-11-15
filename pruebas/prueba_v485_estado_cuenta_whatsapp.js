// v4.85 → v5.01 (Rafa 15 nov: "no me deja enviar por WhatsApp", NotAllowedError: Permission denied) — Estado de cuenta del ERP: al hacer el PDF se
// sube al servidor (compartir_subir) y 💬 Enviar por WhatsApp es una LIGA a wa.me con el teléfono del cliente, el saldo y la liga del PDF (no usa el
// "compartir" del teléfono). 📤 Compartir archivo queda de reserva (si el teléfono no deja: se guarda en Descargas y lo dice). Si la liga no se puede
// preparar, lo dice y quedan Compartir/Guardar. Navegador real (Playwright); servidor y generador de PDF simulados; datos inventados, sin red.
const { chromium, devices } = require('playwright'); const path = require('path');
const FAKE_PDF = 'window.html2pdf=function(){const o={set(){return o},from(){return o},outputPdf(){return Promise.resolve(new Blob(["%PDF-1.4 prueba"],{type:"application/pdf"}))}};return o};';
const DB = { clientes: [{ id: 'c1', razon_social: 'CLIENTE ESTADO', telefono: '55 1234 5678', vendedor: 'EDGAR' }],
  pedidos: [{ id: 'p1', folio: 'P0101', fecha: '2026-10-01', cliente: 'CLIENTE ESTADO', estatus: 'confirmado', total: 10000, items_json: '[]' }],
  cobranza: [{ id: 'cob_p1', cliente: 'CLIENTE ESTADO', tipo: 'Pedido', numero: 'P0101', total: 10000, cobrado: 4000, pendiente: 6000, factura_origen: 'p1', estatus: 'pendiente', fecha_emision: '2026-10-01' }],
  ingresos: [{ id: 'i1', fecha: '2026-10-05', cliente: 'CLIENTE ESTADO', monto: 4000, factura: 'P0101', cuenta: 'BBVA', tipo: 'cobro' }], remisiones: [], facturas: [] };
const LIGA = 'https://vlqbzfotjltarelwenvu.supabase.co/functions/v1/nun?pdf=0123456789abcdef0123456789abcdef';
async function correr(b, cel, falla, sinLiga){
  const ctx = await b.newContext(cel ? { ...devices['Pixel 7'], acceptDownloads: true } : { viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p.addInitScript(cel => { localStorage.setItem('nun_modo', cel ? 'cel' : 'compu'); localStorage.setItem('nun_sesion_v2', JSON.stringify({ codigo: 'RAFA-PRUEBA1', usuario: { codigo: 'RAFA-PRUEBA1', nombre: 'Rafa', rol: 'admin' }, permisos: {}, ts: Date.now() }));
    window.__compartido = null; navigator.canShare = cel ? (() => true) : undefined; if (cel) navigator.share = async d => { if (window.__falla) { const e = new Error('Permission denied'); e.name = 'NotAllowedError'; throw e; } window.__compartido = { n: d.files.length, nombre: d.files[0].name, text: d.text }; }; }, cel);
  if (falla) await p.addInitScript(() => { window.__falla = true; });
  const subidas = []; await ctx.route('https://wa.me/**', rt => rt.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }));
  await p.route('**/*', rt => { const u = rt.request().url();
    if (u.includes('html2pdf')) return rt.fulfill({ contentType: 'application/javascript', body: FAKE_PDF });
    if (u.startsWith('https://wa.me/')) return rt.fulfill({ contentType: 'text/html', body: '<p>wa</p>' });
    if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
    let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (q.accion === 'compartir_subir') { subidas.push({ nombre: q.nombre, mime: q.mime, datos: q.datos }); return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(sinLiga ? { ok: false, error: 'sin señal' } : { ok: true, url: LIGA }) }); }
    return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(q.accion === 'erp_listar' ? { ok: true, items: DB[q.tabla] || [] } : { ok: true, items: [], valores: {} }) }); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3500);
  await p.evaluate(() => nunEstadoCuentaAbrir('c1')); await p.waitForTimeout(300);
  await p.click('#ecPdfBox button'); await p.waitForSelector('#ecPdfBox :text("Guardar PDF")', { timeout: 15000 });
  const r = { subidas: subidas.map(x => ({ nombre: x.nombre, mime: x.mime, pdf: Buffer.from(x.datos || '', 'base64').toString() })), errs,
    botones: await p.$$eval('#ecPdfBox a, #ecPdfBox button', bs => bs.map(x => x.textContent.trim())),
    link: await p.evaluate(() => { const a = document.querySelector('#ecPdfBox a.btn'); return a ? { href: a.href, target: a.target } : null; }),
    texto: await p.evaluate(() => document.getElementById('ecPdfBox').textContent.replace(/\s+/g, ' ').trim()) };
  if (r.link) { const [pg] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), p.click('#ecPdfBox a.btn')]); r.abrio = pg ? pg.url() : null; }
  if (cel) { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('text=📤 Compartir archivo')]); await p.waitForTimeout(300);
    r.compartir = { compartido: await p.evaluate(() => window.__compartido), descargo: !!dl }; }
  await ctx.close(); return r;
}
(async () => {
  const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch();
    r.compu = await correr(b, false); r.cel = await correr(b, true); r.celNoDeja = await correr(b, true, true); r.sinLiga = await correr(b, true, false, true);
    const waOk = x => x.link && x.link.target === '_blank' && /^https:\/\/wa\.me\/525512345678\?text=/.test(x.link.href) && decodeURIComponent(x.link.href).includes('saldo pendiente $6,000.00') && decodeURIComponent(x.link.href).includes(LIGA);
    if (!(r.compu.subidas.length === 1 && /^Estado_de_cuenta_CLIENTE_ESTADO_.*\.pdf$/.test(r.compu.subidas[0].nombre) && r.compu.subidas[0].mime === 'application/pdf' && r.compu.subidas[0].pdf === '%PDF-1.4 prueba')) r.fallas.push('sube el PDF');
    if (r.compu.botones.join('|') !== '💬 Enviar por WhatsApp|📥 Guardar PDF|🖨 Imprimir') r.fallas.push('botones compu');
    if (!waOk(r.compu) || !r.compu.abrio || !/^https:\/\/wa\.me\/525512345678/.test(r.compu.abrio)) r.fallas.push('whatsapp compu');
    if (r.cel.botones.join('|') !== '💬 Enviar por WhatsApp|📤 Compartir archivo|📥 Guardar PDF') r.fallas.push('botones teléfono');
    if (!waOk(r.cel) || !r.cel.abrio) r.fallas.push('whatsapp teléfono (liga)');
    if (!/en el chat de CLIENTE ESTADO/.test(r.cel.texto)) r.fallas.push('dice a qué chat');
    if (!(r.cel.compartir.compartido && r.cel.compartir.compartido.n === 1 && !r.cel.compartir.descargo)) r.fallas.push('compartir de reserva');
    if (!(waOk(r.celNoDeja) && !r.celNoDeja.compartir.compartido && r.celNoDeja.compartir.descargo)) r.fallas.push('teléfono que no deja compartir: liga sí, compartir → Descargas');
    if (!(!r.sinLiga.link && /No se pudo preparar la liga \(sin señal\)/.test(r.sinLiga.texto) && r.sinLiga.botones.includes('📤 Compartir archivo') && r.sinLiga.botones.includes('📥 Guardar PDF'))) r.fallas.push('sin liga avisa');
    if ([r.compu, r.cel, r.celNoDeja, r.sinLiga].some(x => x.errs.length)) r.fallas.push('errores');
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close();
  console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
