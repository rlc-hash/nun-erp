// v4.80 / servidor supabase-1.8 — el vendedor sube la foto del comprobante de SU pago reportado (por verificar): queda ligada al cobro
// de ese pago y el aviso a Rafa dice "📎"; no puede subirla a un pago ajeno ni ya revisado, ni ver comprobantes. Sin red, datos inventados.
const fs = require('fs'), path = require('path'), os = require('os'), { stripTypeScriptTypes } = require('module');
process.removeAllListeners('warning'); process.on('warning', () => {});
(async () => {
  const R = path.join(__dirname, '..');
  // --- base de datos simulada (lo que usa index.ts de postgres) ---
  const ARCH = new Map(), HOJAS = new Map(), SES = new Map(), PROPS = new Map([['en_supabase', '1']]);
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
      if (/^insert into nun_archivos/.test(q)) { const [id, cobro_id, ref, nombre, mime, tam, datos, quien] = vals; const r = []; if (ARCH.has(id)) { r.count = 0; return r; } ARCH.set(id, { id, cobro_id, ref, nombre, mime, tam, datos, quien, creado: new Date().toISOString(), cancelado: false }); r.count = 1; return r; }
      if (/^select id, cobro_id, ref, nombre, mime, tam, quien, creado, cancelado from nun_archivos where cobro_id =/.test(q)) return [...ARCH.values()].filter(x => x.cobro_id === vals[0]).map(({ datos, ...x }) => x);
      if (/^select cobro_id, count\(\*\)::int as n from nun_archivos where not cancelado/.test(q)) { const c = {}; ARCH.forEach(x => { if (!x.cancelado) c[x.cobro_id] = (c[x.cobro_id] || 0) + 1; }); return Object.entries(c).map(([cobro_id, n]) => ({ cobro_id, n })); }
      if (/^select id, nombre, mime, datos, cancelado from nun_archivos where id =/.test(q)) { const x = ARCH.get(vals[0]); return x ? [{ id: x.id, nombre: x.nombre, mime: x.mime, datos: x.datos, cancelado: x.cancelado }] : []; }
      if (/^update nun_archivos set cancelado = true where id =/.test(q)) { const x = ARCH.get(vals[0]); if (x) x.cancelado = true; const r = []; r.count = x ? 1 : 0; return r; }
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
  for (const c of ['RAFA-1', 'EDGAR-1', 'LUIS-1']) await post({ accion: 'login', codigo: c, device_id: 'd' });
  await post({ accion: 'erp_upsert_batch', tabla: 'cobranza', items: [{ id: 'k1', cliente: 'CLIENTE X', numero: 'R0001', total: 100, pendiente: 100, vendedor: 'EDGAR' }], codigo: 'RAFA-1' });
  await post({ accion: 'erp_upsert_batch', tabla: 'clientes', items: [{ id: 'c1', razon_social: 'CLIENTE X', vendedor: 'EDGAR' }], codigo: 'RAFA-1' });
  const { webcrypto } = require('crypto');
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  await post({ accion: 'push_suscribir', sub: { endpoint: 'https://push.prueba/rafa', keys: { p256dh: PU.b64u(await webcrypto.subtle.exportKey('raw', kp.publicKey)), auth: PU.b64u(webcrypto.getRandomValues(new Uint8Array(16))) } }, codigo: 'RAFA-1' });
  PUSH.length = 0;
  const pv = await post({ accion: 'erp_crear', tabla: 'pagosverificar', item: { id: 'pv1', cobro_id: 'k1', cliente: 'CLIENTE X', monto: 40, fecha: '2026-11-11', forma: 'Transferencia', con_comprobante: true }, codigo: 'EDGAR-1' });
  await new Promise(z => setTimeout(z, 300));
  r.pv = pv.ok; r.avisos = PUSH.length;
  const foto = Buffer.from('foto').toString('base64');
  r.sube = await post({ accion: 'archivo_subir', id: 'cmp_pv1', pv_id: 'pv1', cobro_id: 'OTRO', nombre: 'f.jpg', mime: 'image/jpeg', datos: foto, codigo: 'EDGAR-1' });
  r.ligado = ARCH.get('cmp_pv1') && ARCH.get('cmp_pv1').cobro_id === 'k1' && /pv:pv1/.test(ARCH.get('cmp_pv1').ref) && /Reportado por EDGAR/.test(ARCH.get('cmp_pv1').ref);
  r.ajeno = (await post({ accion: 'archivo_subir', id: 'cmp_x', pv_id: 'pv1', nombre: 'f.jpg', mime: 'image/jpeg', datos: foto, codigo: 'LUIS-1' })).ok;
  r.sinPv = (await post({ accion: 'archivo_subir', id: 'cmp_y', cobro_id: 'k1', nombre: 'f.jpg', mime: 'image/jpeg', datos: foto, codigo: 'EDGAR-1' })).ok;
  r.verVend = (await post({ accion: 'archivo_listar', cobro_id: 'k1', codigo: 'EDGAR-1' })).ok;
  r.rafaLoVe = (await post({ accion: 'archivo_listar', cobro_id: 'k1', codigo: 'RAFA-1' })).items.map(x => x.id).join();
  await post({ accion: 'erp_upsert_batch', tabla: 'pagosverificar', items: [{ id: 'pv1', estatus: 'verificado' }], codigo: 'RAFA-1' });
  r.yaRevisado = (await post({ accion: 'archivo_subir', id: 'cmp_z', pv_id: 'pv1', nombre: 'f.jpg', mime: 'image/jpeg', datos: foto, codigo: 'EDGAR-1' })).ok;
  ok('foto-del-vendedor', r.pv && r.avisos === 1 && r.sube.ok && r.ligado);
  ok('candados', r.ajeno === false && r.sinPv === false && r.verVend === false && r.rafaLoVe === 'cmp_pv1' && r.yaRevisado === false);
  r.sube = r.sube.ok; r.fallas = fallas; console.log(JSON.stringify(r, null, 1));
})().catch(e => console.log(JSON.stringify({ error: String(e.stack).slice(0, 800) })));
