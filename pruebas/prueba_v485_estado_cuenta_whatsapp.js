// v4.85 → v5.04 (Rafa 17 nov: "quiero que se mande el PDF por WhatsApp, no un link") — Estado de cuenta del ERP: 💬 Enviar por WhatsApp comparte el
// ARCHIVO PDF (sin texto ni liga; no se sube nada al servidor). Si el teléfono no deja: el PDF se guarda en Descargas y sale 💬 Abrir chat de WhatsApp
// (wa.me con el teléfono del cliente) para adjuntarlo. En la compu: baja el PDF y abre WhatsApp. 📥 Guardar PDF solo baja el archivo.
// Navegador real (Playwright); servidor y generador de PDF simulados; datos inventados, sin red.
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
    window.__abierto = []; window.open = (u) => { window.__abierto.push(String(u)); return null; };
    window.__compartido = null; navigator.canShare = cel ? (() => true) : undefined;
    if (cel) navigator.share = async d => { if (window.__falla) { const e = new Error('Permission denied'); e.name = 'NotAllowedError'; throw e; }
      window.__compartido = { n: d.files.length, nombre: d.files[0].name, tipo: d.files[0].type, text: d.text || null, contenido: await d.files[0].text() }; }; }, cel);
  if (falla) await p.addInitScript(() => { window.__falla = true; });
  const subidas = []; await ctx.route('https://wa.me/**', rt => rt.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }));
  await p.route('**/*', rt => { const u = rt.request().url();
    if (u.includes('html2pdf')) return rt.fulfill({ contentType: 'application/javascript', body: FAKE_PDF });
    if (!(u.includes('supabase') || u.includes('script.google'))) return rt.continue();
    let q = {}; try { q = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (q.accion === 'compartir_subir') subidas.push(q.nombre);
    return rt.fulfill({ contentType: 'application/json', body: JSON.stringify(q.accion === 'erp_listar' ? { ok: true, items: DB[q.tabla] || [] } : { ok: true, items: [], valores: {} }) }); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(3500);
  await p.evaluate(() => nunEstadoCuentaAbrir('c1')); await p.waitForTimeout(300);
  await p.click('#ecPdfBox button'); await p.waitForSelector('#ecPdfBox :text("Enviar por WhatsApp")', { timeout: 15000 });
  const botones = await p.$$eval('#ecPdfBox > button, #ecPdfBox > a', bs => bs.map(x => x.textContent.trim()));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('#ecPdfBox button:has-text("Enviar por WhatsApp")')]); await p.waitForTimeout(300);
  const r = { botones, subidas, errs, descargo: !!dl, abierto: await p.evaluate(() => window.__abierto), compartido: await p.evaluate(() => window.__compartido),
    planB: await p.evaluate(() => { const a = document.querySelector('#ecPdfBox_wa a'); return a ? { href: a.href, texto: document.getElementById('ecPdfBox_wa').textContent.replace(/\s+/g, ' ').trim() } : null; }) };
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('#ecPdfBox button:has-text("Guardar PDF")')]); r.guarda = dl2 ? dl2.suggestedFilename() : null;
  await ctx.close(); return r;
}
(async () => {
  const r = { fallas: [] }; let b;
  try {
    b = await chromium.launch();
    r.compu = await correr(b, false); r.cel = await correr(b, true); r.celNoDeja = await correr(b, true, true);
    const pdfOk = n => /^Estado_de_cuenta_CLIENTE_ESTADO_.*\.pdf$/.test(n || '');
    if (r.compu.botones.join('|') !== '💬 Enviar por WhatsApp|📥 Guardar PDF|🖨 Imprimir') r.fallas.push('botones compu');
    if (r.cel.botones.join('|') !== '💬 Enviar por WhatsApp|📥 Guardar PDF') r.fallas.push('botones teléfono');
    if (!(r.cel.compartido && r.cel.compartido.n === 1 && pdfOk(r.cel.compartido.nombre) && r.cel.compartido.tipo === 'application/pdf' && r.cel.compartido.contenido === '%PDF-1.4 prueba' && !r.cel.compartido.text)) r.fallas.push('teléfono comparte el ARCHIVO PDF (sin liga)');
    if (r.cel.planB || r.cel.descargo || r.cel.abierto.length) r.fallas.push('si comparte, no baja ni abre otra cosa');
    if (!(r.celNoDeja.descargo && r.celNoDeja.planB && /^https:\/\/wa\.me\/525512345678\?text=/.test(r.celNoDeja.planB.href) && /no dejó compartir el PDF \(NotAllowedError\)/.test(r.celNoDeja.planB.texto) && /Descargas/.test(r.celNoDeja.planB.texto))) r.fallas.push('si el teléfono no deja: Descargas + abrir chat');
    if (!(r.compu.descargo && r.compu.abierto.length === 1 && /^https:\/\/wa\.me\/525512345678\?text=/.test(r.compu.abierto[0]) && !/pdf%3D|pdf=/.test(r.compu.abierto[0]))) r.fallas.push('compu: baja el PDF y abre WhatsApp sin liga');
    if ([r.compu, r.cel, r.celNoDeja].some(x => !pdfOk(x.guarda))) r.fallas.push('Guardar PDF baja el archivo');
    if ([r.compu, r.cel, r.celNoDeja].some(x => x.subidas.length)) r.fallas.push('no se sube nada al servidor');
    if ([r.compu, r.cel, r.celNoDeja].some(x => x.errs.length)) r.fallas.push('errores');
  } catch (e) { r.error = String(e.stack).slice(0, 500); }
  if (b) await b.close();
  console.log(JSON.stringify(r, null, 1)); process.exit(0);
})();
