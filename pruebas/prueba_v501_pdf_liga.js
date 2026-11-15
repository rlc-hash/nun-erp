// servidor supabase-2.7 (15 nov) — PDF por WhatsApp como LIGA: compartir_subir (oficina y vendedor con sesión) guarda el PDF y da la liga;
// GET ?pdf=<k> lo entrega como application/pdf; liga falsa o sin sesión = no. Corre el index.ts real con base y Google simulados.
const fs = require('fs'), path = require('path'), os = require('os'), { stripTypeScriptTypes } = require('module');
process.removeAllListeners('warning'); process.on('warning', () => {});
(async () => {
  const R = path.join(__dirname, '..');
  // --- base de datos simulada (lo que usa index.ts de postgres) ---
  const COMP = new Map(), ARCH = new Map(), HOJAS = new Map(), SES = new Map(), PROPS = new Map([['en_supabase', '1']]);
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
      if (/^insert into nun_compartidos/.test(q)) { const [k, nombre, mime, tam, datos, quien] = vals; COMP.set(k, { k, nombre, mime, tam, datos, quien, vistas: 0 }); return []; }
      if (/^select nombre, mime, datos from nun_compartidos where k =/.test(q)) { const x = COMP.get(vals[0]); return x ? [x] : []; }
      if (/^update nun_compartidos set vistas/.test(q)) { const x = COMP.get(vals[0]); if (x) x.vistas++; return []; }
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
  const r = {}, fallas = []; const ok = (k, c) => { if (!c) fallas.push(k); };
  for (const c of ['RAFA-1', 'EDGAR-1']) await post({ accion: 'login', codigo: c, device_id: 'd' });
  const pdf = Buffer.from('%PDF-1.4 prueba').toString('base64');
  const a = await post({ accion: 'compartir_subir', nombre: 'Estado_de_cuenta_CLIENTE.pdf', mime: 'application/pdf', datos: pdf, codigo: 'RAFA-1' });
  r.oficina = a; ok('oficina-liga', a.ok && /^https:\/\/vlqbzfotjltarelwenvu\.supabase\.co\/functions\/v1\/nun\?pdf=[0-9a-f]{32}$/.test(a.url));
  const e = await post({ accion: 'compartir_subir', nombre: 'Pedido_P0001.pdf', mime: 'application/pdf', datos: pdf, codigo: 'EDGAR-1' });
  ok('vendedor-liga', e.ok && /\?pdf=[0-9a-f]{32}$/.test(e.url) && e.url !== a.url);
  ok('quien-vendedor', [...COMP.values()].some(x => x.quien === 'EDGAR'));
  r.sinSesion = await post({ accion: 'compartir_subir', nombre: 'x.pdf', datos: pdf, codigo: 'NADIE-9' }); ok('sin-sesion', !r.sinSesion.ok);
  r.noPdf = await post({ accion: 'compartir_subir', nombre: 'x.exe', mime: 'application/octet-stream', datos: pdf, codigo: 'RAFA-1' }); ok('solo-pdf-xml', !r.noPdf.ok);
  r.xml = await post({ accion: 'compartir_subir', nombre: 'Factura_FT0001.xml', mime: 'application/xml', datos: Buffer.from('<x/>').toString('base64'), codigo: 'EDGAR-1' }); ok('xml', r.xml.ok);
  r.malo = await post({ accion: 'compartir_subir', nombre: 'x.pdf', datos: 'no es base64 !!', codigo: 'RAFA-1' }); ok('base64', !r.malo.ok);
  const g = await handler(new Request('https://x/nun?pdf=' + a.url.split('pdf=')[1]));
  r.get = { status: g.status, tipo: g.headers.get('content-type'), disp: g.headers.get('content-disposition') };
  const txt = Buffer.from(await g.arrayBuffer()).toString();
  ok('entrega-pdf', g.status === 200 && r.get.tipo === 'application/pdf' && /inline; filename="Estado_de_cuenta_CLIENTE.pdf"/.test(r.get.disp) && txt === '%PDF-1.4 prueba');
  ok('cuenta-vistas', [...COMP.values()].find(x => x.nombre === 'Estado_de_cuenta_CLIENTE.pdf').vistas === 1);
  const n = await handler(new Request('https://x/nun?pdf=' + '0'.repeat(32))); ok('no-existe', n.status === 404);
  const m = await handler(new Request('https://x/nun?pdf=../../etc')); ok('liga-invalida', m.status === 404);
  const v = await handler(new Request('https://x/nun')); r.version = JSON.parse(await v.text()).mensaje; ok('version', /supabase-2\.(7|[89])/.test(r.version));
  r.fallas = fallas; console.log(JSON.stringify(r, null, 1));
})().catch(e => console.log(JSON.stringify({ error: String(e.stack).slice(0, 800) })));
