// v4.76 — lo que hace la oficina (Yazmín u otro que no sea Rafa) le llega a Rafa al teléfono; lo que hace Rafa no le avisa a nadie;
// a los equipos de Yazmín no les llega lo de la oficina. Corre el index.ts real con base y Google simulados (sin red, datos inventados).
const fs = require('fs'), path = require('path'), os = require('os'), { stripTypeScriptTypes } = require('module');
process.removeAllListeners('warning'); process.on('warning', () => {});
(async () => {
  const R = path.join(__dirname, '..');
  // --- base de datos simulada (lo que usa index.ts de postgres) ---
  const HOJAS = new Map(), SES = new Map(), PROPS = new Map([['en_supabase', '1']]);
  const MARCA = Symbol('lista');
  function sql(strs, ...vals){
    const q = strs.join('?').replace(/\s+/g, ' ').trim();
    const res = (() => {
      if (/^select 1/.test(q)) return [{ '?column?': 1 }];
      if (/from nun_sesiones where h =/.test(q)) { const s = SES.get(vals[0]); return s ? [{ ...s, vigente: true }] : []; }
      if (/^insert into nun_sesiones/.test(q)) {
        const [h, admin, a3, a4, a5, a6, a7] = vals; const prev = SES.get(h) || {};
        if (/rol, vend/.test(q)) SES.set(h, { ...prev, admin, nombre: a3, rol: a4, vend: a5, todos: a6, cotiza: a7 });
        else if (/admin, nombre, hasta/.test(q)) SES.set(h, { ...prev, admin, nombre: a3 });
        else SES.set(h, { ...prev, admin });
        return [];
      }
      if (/^select nombre from nun_hojas/.test(q)) return [...HOJAS.keys()].map(nombre => ({ nombre }));
      if (/^select k, v from nun_props( where k not like 'push%')?$/.test(q)) return [...PROPS].map(([k, v]) => ({ k, v }));
      if (/^select nombre, filas from nun_hojas/.test(q)) return vals[0][MARCA].filter(n => HOJAS.has(n)).map(nombre => ({ nombre, filas: JSON.parse(JSON.stringify(HOJAS.get(nombre))) }));
      if (/^insert into nun_hojas/.test(q)) { HOJAS.set(vals[0], JSON.parse(JSON.stringify(vals[1]))); return []; }
      if (/^insert into nun_props \(k, v\) values \('push_vapid'/.test(q)) { if (!PROPS.has('push_vapid')) PROPS.set('push_vapid', vals[0]); return []; }
      if (/^insert into nun_props/.test(q)) { PROPS.set(vals[0], vals[1]); return []; }
      if (/^select v from nun_props where k = 'push_vapid'/.test(q)) return PROPS.has('push_vapid') ? [{ v: PROPS.get('push_vapid') }] : [];
      if (/^select k, v from nun_props where k like 'push:%'/.test(q)) return [...PROPS].filter(([k]) => k.startsWith('push:')).map(([k, v]) => ({ k, v }));
      if (/^select k, v from nun_props where k =/.test(q)) return PROPS.has(vals[0]) ? [{ k: vals[0], v: PROPS.get(vals[0]) }] : [];
      if (/^update nun_props set v =/.test(q)) { PROPS.set(vals[1], vals[0]); return []; }
      if (/^update nun_sesiones set rol = null, admin = null, hasta = now\(\) where h =/.test(q)) { const x = SES.get(vals[0]); if (x) { x.rol = null; x.admin = null; } const r = []; r.count = x ? 1 : 0; return r; }
      return []; // historial, log, candado
    })();
    return Promise.resolve(res);
  }
  sql.end = async () => {}; sql.json = x => x;
  const P = new Proxy(sql, { apply: (t, th, a) => (a.length === 1 && Array.isArray(a[0]) && !a[0].raw) ? { [MARCA]: a[0] } : sql(...a) });
  sql.begin = async f => f(P); const fake = () => P;
  // --- Google simulado: login y "¿es código válido?" ---
  const US = {
    'DUENO-1': { usuario: { nombre: 'Rafa', rol: 'admin', vendedor_asignado: '' }, permisos: { ver_todos_clientes: true } },
    'EDGAR-1': { usuario: { nombre: 'Edgar', rol: 'vendedor', vendedor_asignado: 'Edgar' }, permisos: { ver_todos_clientes: true, agregar_pedidos: true } },
    'LUIS-1':  { usuario: { nombre: 'Luis', rol: 'vendedor', vendedor_asignado: 'Luis' }, permisos: { ver_todos_clientes: false, agregar_pedidos: true } },
    'ESTEBAN-1': { usuario: { nombre: 'Esteban', rol: 'vendedor', vendedor_asignado: 'Esteban' }, permisos: { ver_todos_clientes: false, solo_consulta: true } },
    'RAFA-1': { usuario: { nombre: 'Rafa', rol: 'admin', vendedor_asignado: '' }, permisos: { ver_todos_clientes: true } },
    'YADAH-1': { usuario: { nombre: 'Yadah', rol: 'admin', vendedor_asignado: '' }, permisos: {} },
    'YAZ-1': { usuario: { nombre: 'Yaz', rol: 'cobranza', vendedor_asignado: '' }, permisos: {} }
  };
  const PUSH = [];
  globalThis.fetch = async (u, o) => { if (String(u).startsWith('https://push.prueba/')) { PUSH.push({ u, h: o.headers, n: o.body.length }); return { status: String(u).endsWith('/vieja') ? 410 : 201 }; }
    const b = JSON.parse(o.body); const c = String(b.codigo || b.codigo_admin || '').toUpperCase(); const x = US[c];
    let r = { ok: false, requiere_login: true };
    if (b.accion === 'login' && x) r = { ok: true, ...x };
    else if (b.accion === 'facturama_timbrar' && x) r = { ok: true, uuid: 'u-1', folio: '77', total: 1160 };
    else if (b.accion === 'listar_cuentas' && x) r = { ok: true, cuentas: [] };
    else if (b.accion === 'listar_bitacora' && x && x.usuario.rol === 'admin') r = { ok: true };
    return { text: async () => JSON.stringify(r) }; };
  let handler; globalThis.Deno = { env: { get: () => 'postgres://postgres:x@db.vlqbzfotjltarelwenvu.supabase.co:5432/postgres' }, serve: h => { handler = h; } };
  const E = await import(path.join(R, 'supabase', 'functions', 'nun', 'emulador.js'));
  const PU = await import(path.join(R, 'supabase', 'functions', 'nun', 'push.js'));
  globalThis.__N = { postgres: () => fake(), CODIGO: fs.readFileSync(path.join(R, 'backend', 'Codigo.gs'), 'utf8'), E, P: PU };
  let ts = fs.readFileSync(path.join(R, 'supabase', 'functions', 'nun', 'index.ts'), 'utf8')
    .replace(/^import postgres from .*$/m, 'const postgres = globalThis.__N.postgres;')
    .replace(/^import CODIGO from .*$/m, 'const CODIGO = globalThis.__N.CODIGO;')
    .replace(/^import \{ compilar, atender \} from .*$/m, 'const { compilar, atender } = globalThis.__N.E;')
    .replace(/^import \{ crearVapid, enviar \} from .*$/m, 'const { crearVapid, enviar } = globalThis.__N.P;');
  const tmp = path.join(os.tmpdir(), 'nun_index_' + process.pid + '.mjs'); fs.writeFileSync(tmp, stripTypeScriptTypes(ts));
  await import(tmp); fs.unlinkSync(tmp);
  const post = async b => JSON.parse(await (await handler(new Request('https://x/nun', { method: 'POST', body: JSON.stringify(b) }))).text());
  const get = async (t, c) => JSON.parse(await (await handler(new Request('https://x/nun?tabla=' + t + '&codigo=' + c))).text());
  const r = {}, fallas = []; const ok = (k, c) => { if (!c) fallas.push(k); };
  for (const c of ['RAFA-1', 'YAZ-1', 'YADAH-1', 'EDGAR-1']) await post({ accion: 'login', codigo: c, device_id: 'd' });
  const { webcrypto } = require('crypto');
  const subDe = async fin => { const kp = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    return { endpoint: 'https://push.prueba/' + fin, keys: { p256dh: PU.b64u(await webcrypto.subtle.exportKey('raw', kp.publicKey)), auth: PU.b64u(webcrypto.getRandomValues(new Uint8Array(16))) } }; };
  await post({ accion: 'push_suscribir', sub: await subDe('rafa'), codigo: 'RAFA-1' });
  await post({ accion: 'push_suscribir', sub: await subDe('yaz'), codigo: 'YAZ-1' });
  r.dueno = Object.fromEntries([...PROPS].filter(([k]) => k.startsWith('push:')).map(([k, v]) => [JSON.parse(v).sub.endpoint.split('/').pop(), JSON.parse(v).dueno]));
  ok('marca-dueno', r.dueno.rafa === true && r.dueno.yaz === false);
  const espera = () => new Promise(z => setTimeout(z, 300));
  const avisos = async f => { PUSH.length = 0; await f(); await espera(); return PUSH.map(x => x.u.split('/').pop()).sort().join(','); };
  await post({ accion: 'erp_upsert_batch', tabla: 'cobranza', items: [{ id: 'k1', cliente: 'Cliente X', numero: 'R0001', total: 100, pendiente: 100, cobrado: 0 }], codigo: 'RAFA-1' });
  r.yazRemision = await avisos(() => post({ accion: 'erp_crear', tabla: 'remisiones', item: { id: 'r1', folio: 'R0009', cliente: 'Cliente X', total: 500, items_json: '[]', _sin_inventario: true }, codigo: 'YAZ-1' }));
  r.yazPago = await avisos(() => post({ accion: 'capturar_pago_cliente', id_doc: 'k1', monto: 40, cuenta: 'BBVA', fecha: '2026-11-11', codigo: 'YAZ-1', codigo_usuario: 'YAZ-1' }));
  r.yazReporta = await avisos(() => post({ accion: 'erp_crear', tabla: 'pagosverificar', item: { id: 'pvy', cobro_id: 'k1', cliente: 'Cliente X', monto: 40, documento: 'R0001', fecha: '2026-11-12' }, codigo: 'YAZ-1' })); // supabase-2.4
  r.rafaReporta = await avisos(() => post({ accion: 'erp_crear', tabla: 'pagosverificar', item: { id: 'pvr', cobro_id: 'k1', cliente: 'Cliente X', monto: 1, fecha: '2026-11-12' }, codigo: 'RAFA-1' }));
  r.yazConfirma = await avisos(() => post({ accion: 'capturar_pago_cliente', id_doc: 'k1', monto: 10, cuenta: 'BBVA', fecha: '2026-11-12', notas: 'Reportado por EDGAR en su app · Transferencia', codigo: 'YAZ-1', codigo_usuario: 'YAZ-1' })); // supabase-2.5
  r.yazRechaza = await avisos(() => post({ accion: 'erp_upsert_batch', tabla: 'pagosverificar', items: [{ id: 'pvy', estatus: 'rechazado', motivo: 'No llegó' }], codigo: 'YAZ-1' }));
  r.yazTimbra = await avisos(() => post({ accion: 'facturama_timbrar', cfdi: { CfdiType: 'I', Serie: 'FT', Folio: '77', Receiver: { Name: 'CLIENTE X' } }, codigo: 'YAZ-1' }));
  r.yazCancela = await avisos(() => post({ accion: 'erp_upsert_batch', tabla: 'remisiones', items: [{ id: 'r1', estatus: 'cancelada' }], codigo: 'YAZ-1' }));
  r.yazCambiaNota = await avisos(() => post({ accion: 'erp_upsert_batch', tabla: 'remisiones', items: [{ id: 'r1', notas: 'x' }], codigo: 'YAZ-1' }));
  r.yazLee = await avisos(() => post({ accion: 'erp_listar', tabla: 'remisiones', codigo: 'YAZ-1' }));
  r.yadahCrea = await avisos(() => post({ accion: 'erp_crear', tabla: 'facturas', item: { id: 'f1', folio: 'FT0001', cliente: 'Cliente X', total: 1 }, codigo: 'YADAH-1' }));
  r.rafaCrea = await avisos(() => post({ accion: 'erp_crear', tabla: 'remisiones', item: { id: 'r2', folio: 'R0010', cliente: 'Cliente X', total: 5, _sin_inventario: true }, codigo: 'RAFA-1' }));
  r.rafaTimbra = await avisos(() => post({ accion: 'facturama_timbrar', cfdi: { CfdiType: 'I' }, codigo: 'RAFA-1' }));
  r.vendedorCot = await avisos(() => post({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'q1', folio: '', cliente: 'Cliente X', total: 10, items_json: '[]' }, codigo: 'EDGAR-1' }));
  ok('oficina-a-rafa', r.yazRemision === 'rafa' && r.yazPago === 'rafa' && r.yazTimbra === 'rafa' && r.yazCancela === 'rafa' && r.yadahCrea === 'rafa');
  ok('pago-reportado-oficina', r.yazReporta === 'rafa' && r.rafaReporta === '');
  ok('confirma-rechaza', r.yazConfirma === 'rafa' && r.yazRechaza === 'rafa');
  ok('sin-ruido', r.yazCambiaNota === '' && r.yazLee === '' && r.rafaCrea === '' && r.rafaTimbra === '');
  ok('vendedor-igual', r.vendedorCot === 'rafa,yaz');
  r.fallas = fallas; console.log(JSON.stringify(r, null, 1));
})().catch(e => console.log(JSON.stringify({ error: String(e.stack).slice(0, 800) })));
