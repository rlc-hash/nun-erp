// v4.82 / servidor supabase-1.9 — (1) el aviso a Rafa dice QUIÉN fue aunque el usuario no tenga nombre guardado (inicio del código: YAZMIN-… → Yazmin)
// y qué cotización/pedido; (2) tras 4 s sin peticiones el servidor abre conexiones nuevas (las viejas se quedaban colgadas al despertar). Sin red.
const fs = require('fs'), path = require('path'), os = require('os'), { stripTypeScriptTypes } = require('module');
process.removeAllListeners('warning'); process.on('warning', () => {});
(async () => {
  const R = path.join(__dirname, '..');
  // --- base de datos simulada (lo que usa index.ts de postgres) ---
  const LOG = [], AVISOS = []; let POOLS = 0; const HOJAS = new Map(), SES = new Map(), PROPS = new Map([['en_supabase', '1']]);
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
      if (/^insert into nun_log/.test(q)) LOG.push({ accion: vals[0], quien: vals[4] });
      return []; // historial, log, candado
    })();
    return Promise.resolve(res);
  }
  sql.end = async () => {}; sql.json = x => x;
  const P = new Proxy(sql, { apply: (t, th, a) => (a.length === 1 && Array.isArray(a[0]) && !a[0].raw) ? { [MARCA]: a[0] } : sql(...a) });
  sql.begin = async f => f(P); const fake = () => { POOLS++; return P; };
  // --- Google simulado: login y "¿es código válido?" ---
  const US = {
    'DUENO-1': { usuario: { nombre: 'Rafa', rol: 'admin', vendedor_asignado: '' }, permisos: { ver_todos_clientes: true } },
    'EDGAR-1': { usuario: { nombre: 'Edgar', rol: 'vendedor', vendedor_asignado: 'Edgar' }, permisos: { ver_todos_clientes: true, agregar_pedidos: true } },
    'LUIS-1':  { usuario: { nombre: 'Luis', rol: 'vendedor', vendedor_asignado: 'Luis' }, permisos: { ver_todos_clientes: false, agregar_pedidos: true } },
    'ESTEBAN-1': { usuario: { nombre: 'Esteban', rol: 'vendedor', vendedor_asignado: 'Esteban' }, permisos: { ver_todos_clientes: false, solo_consulta: true } },
    'RAFA-1': { usuario: { nombre: 'Rafa', rol: 'admin', vendedor_asignado: '' }, permisos: { ver_todos_clientes: true } },
    'YADAH-1': { usuario: { nombre: 'Yadah', rol: 'admin', vendedor_asignado: '' }, permisos: {} },
    'YAZMIN-1': { usuario: { nombre: '', rol: 'cobranza', vendedor_asignado: '' }, permisos: {} }, 'YAZ-1': { usuario: { nombre: 'Yaz', rol: 'cobranza', vendedor_asignado: '' }, permisos: {} }
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
  globalThis.__N = { AV: AVISOS, postgres: () => fake(), CODIGO: fs.readFileSync(path.join(R, 'backend', 'Codigo.gs'), 'utf8'), E, P: PU };
  let ts = fs.readFileSync(path.join(R, 'supabase', 'functions', 'nun', 'index.ts'), 'utf8')
    .replace(/^import postgres from .*$/m, 'const postgres = globalThis.__N.postgres;')
    .replace(/^import CODIGO from .*$/m, 'const CODIGO = globalThis.__N.CODIGO;')
    .replace(/^import \{ compilar, atender \} from .*$/m, 'const { compilar, atender } = globalThis.__N.E;')
    .replace(/^import \{ crearVapid, enviar \} from .*$/m, 'const { crearVapid } = globalThis.__N.P; const enviar = async (sub, datos) => { globalThis.__N.AV.push(datos); return 201; };');
  const tmp = path.join(os.tmpdir(), 'nun_index_' + process.pid + '.mjs'); fs.writeFileSync(tmp, stripTypeScriptTypes(ts));
  await import(tmp); fs.unlinkSync(tmp);
  const post = async b => JSON.parse(await (await handler(new Request('https://x/nun', { method: 'POST', body: JSON.stringify(b) }))).text());
  const get = async (t, c) => JSON.parse(await (await handler(new Request('https://x/nun?tabla=' + t + '&codigo=' + c))).text());
  const r = {}, fallas = []; const ok = (k, c) => { if (!c) fallas.push(k); };
  const espera = t => new Promise(z => setTimeout(z, t));
  for (const c of ['RAFA-1', 'YAZMIN-1', 'EDGAR-1']) await post({ accion: 'login', codigo: c, device_id: 'd' });
  const { webcrypto } = require('crypto'); const kp = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  await post({ accion: 'push_suscribir', sub: { endpoint: 'https://push.prueba/rafa', keys: { p256dh: PU.b64u(await webcrypto.subtle.exportKey('raw', kp.publicKey)), auth: PU.b64u(webcrypto.getRandomValues(new Uint8Array(16))) } }, codigo: 'RAFA-1' });
  await post({ accion: 'erp_upsert_batch', tabla: 'productos', items: [{ id: 'p1', sku: 'RL009N', precio: 1650, stock_actual: 50, stock_comprometido: 0 }], codigo: 'RAFA-1' });
  const c = await post({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'q1', folio: '', cliente: 'CLIENTE X', total: 3300, items_json: JSON.stringify([{ sku: 'RL009N', cantidad: 2, precio_unitario: 1650 }]) }, codigo: 'EDGAR-1' });
  await espera(200); AVISOS.length = 0; LOG.length = 0;
  const cf = await post({ accion: 'confirmar_cotizacion', id: 'q1', codigo: 'YAZMIN-1' }); await espera(300);
  r.confirmo = cf.ok; r.aviso = AVISOS.map(a => a.titulo).join(' | ');
  r.log = LOG.filter(l => /^confirmar_cotizacion/.test(l.accion)).map(l => l.quien).join();
  ok('nombre-en-aviso', r.confirmo && /^✅ Yazmin confirmó la cotización C0001 → pedido P0001$/.test(r.aviso));
  ok('nombre-en-registro', r.log === 'Yazmin');
  ok('sin-codigo', !/YAZMIN-1/.test(JSON.stringify(AVISOS) + JSON.stringify(LOG)));
  // conexiones: varias peticiones seguidas usan el mismo pool; después de 4 s quietas se abre uno nuevo
  const p0 = POOLS; await Promise.all([1, 2, 3].map(() => post({ accion: 'erp_listar', tabla: 'clientes', codigo: 'RAFA-1' })));
  await post({ accion: 'erp_listar', tabla: 'clientes', codigo: 'RAFA-1' }); r.seguidas = POOLS - p0;
  await espera(4300); await post({ accion: 'erp_listar', tabla: 'clientes', codigo: 'RAFA-1' }); r.trasDormir = POOLS - p0 - r.seguidas;
  ok('pool-fresco', r.seguidas === 0 && r.trasDormir === 1);
  r.fallas = fallas; console.log(JSON.stringify(r, null, 1));
})().catch(e => console.log(JSON.stringify({ error: String(e.stack).slice(0, 800) })));
