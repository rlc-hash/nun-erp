// v4.63 — Servidor (supabase/functions/nun/index.ts) con vendedores: cada uno recibe solo lo suyo, sin costos ni gastos;
// Luis (no ve a todos) solo sus clientes; Edgar todos; escriben solo cotizaciones/clientes/pagos por verificar.
// Corre el index.ts real (quitándole los tipos) con una base de datos y un Google simulados. Datos inventados, sin red.
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
    'YAZ-1': { usuario: { nombre: 'Yaz', rol: 'cobranza', vendedor_asignado: '' }, permisos: {} }
  };
  const PUSH = [];
  globalThis.fetch = async (u, o) => { if (String(u).startsWith('https://push.prueba/')) { PUSH.push({ u, h: o.headers, n: o.body.length }); return { status: String(u).endsWith('/vieja') ? 410 : 201 }; }
    const b = JSON.parse(o.body); const c = String(b.codigo || b.codigo_admin || '').toUpperCase(); const x = US[c];
    let r = { ok: false, requiere_login: true };
    if (b.accion === 'login' && x) r = { ok: true, ...x };
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
  // datos (los sube el dueño)
  for (const c of ['DUENO-1', 'EDGAR-1', 'LUIS-1', 'ESTEBAN-1', 'YAZ-1']) await post({ accion: 'login', codigo: c, device_id: 'd' });
  const D = 'DUENO-1', mk = (tabla, items) => post({ accion: 'erp_upsert_batch', tabla, items, codigo: D });
  await mk('clientes', [{ id: 'c1', razon_social: 'CLIENTE DE LUIS S.A. DE C.V.', vendedor: 'LUIS' }, { id: 'c2', razon_social: 'Cliente de Edgar', vendedor: 'EDGAR' }]);
  await mk('productos', [{ id: 'p1', sku: 'RL001', descripcion: 'Maleta', costo: 500, costo_factura: 450, precio: 1100, stock_actual: 7, stock_comprometido: 0 }]);
  await mk('cobranza', [{ id: 'k1', cliente: 'Cliente de Luis', numero: 'P0001', total: 100, pendiente: 100, vendedor: 'CASA' }, { id: 'k2', cliente: 'CLIENTE DE EDGAR', numero: 'P0002', total: 50, pendiente: 50, vendedor: 'EDGAR' },
    { id: 'k3', cliente: 'Otro', numero: 'P0003', total: 9, pendiente: 9, vendedor: 'LUIS' }]);
  await mk('gastos', [{ id: 'g1', concepto: 'renta', monto: 1 }]);
  // admin igual que antes
  r.dueno = { cobranza: (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: D })).items.length, costo: (await post({ accion: 'erp_listar', tabla: 'productos', codigo: D })).items[0].costo };
  ok('dueno', r.dueno.cobranza === 3 && r.dueno.costo === 500);
  // Luis: solo sus clientes y lo que lleva su nombre; sin costos; sin gastos ni kv
  const lc = await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: 'LUIS-1' });
  r.luis = { cobranza: lc.items.map(x => x.id).sort().join(','), clientes: (await get('clientes', 'LUIS-1')).data.map(x => x.id).join(','),
    producto: (await post({ accion: 'erp_listar', tabla: 'productos', codigo: 'LUIS-1' })).items[0],
    gastos: (await post({ accion: 'erp_listar', tabla: 'gastos', codigo: 'LUIS-1' })).ok, gastosGet: (await get('gastos', 'LUIS-1')).ok,
    kv: (await post({ accion: 'kv_leer', codigo: 'LUIS-1' })).ok, pago: (await post({ accion: 'capturar_pago_cliente', id_doc: 'k1', monto: 1, codigo: 'LUIS-1' })).ok };
  ok('luis', r.luis.cobranza === 'k1,k3' && r.luis.clientes === 'c1' && r.luis.producto.costo === undefined && r.luis.producto.costo_factura === undefined && r.luis.producto.stock_actual === 7
    && !r.luis.gastos && !r.luis.gastosGet && !r.luis.kv && !r.luis.pago);
  // Edgar: ve a todos (sin costos)
  r.edgar = { cobranza: (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: 'EDGAR-1' })).items.length, costo: (await get('productos', 'EDGAR-1')).data[0].costo };
  ok('edgar', r.edgar.cobranza === 3 && r.edgar.costo === undefined);
  // v4.65 — avisos push: la oficina se suscribe (Yazmín y el dueño); un vendedor no
  const { webcrypto } = require('crypto');
  const subDe = async (fin) => { const kp = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    return { endpoint: 'https://push.prueba/' + fin, keys: { p256dh: PU.b64u(await webcrypto.subtle.exportKey('raw', kp.publicKey)), auth: PU.b64u(webcrypto.getRandomValues(new Uint8Array(16))) } }; };
  r.push = { clave: !!(await post({ accion: 'push_clave', codigo: D })).clave, vendedorNo: (await post({ accion: 'push_suscribir', sub: await subDe('v'), codigo: 'EDGAR-1' })).ok === false,
    dueno: (await post({ accion: 'push_suscribir', sub: await subDe('rafa'), codigo: D })).ok, yaz: (await post({ accion: 'push_suscribir', sub: await subDe('vieja'), codigo: 'YAZ-1' })).ok };
  r.push.prueba = (await post({ accion: 'push_probar', codigo: D })).enviados; r.push.enPrueba = PUSH.map(x => x.u.split('/').pop()).join(','); PUSH.length = 0;
  ok('push-suscribir', r.push.clave && r.push.vendedorNo && r.push.dueno && r.push.yaz && r.push.prueba === 1);
  // Cotización: el servidor pone vendedor/estatus/folio; Esteban (solo consulta) no puede
  const cl = await post({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'q1', folio: '', cliente: 'Cliente de Luis', vendedor: 'EDGAR', estatus: 'convertida', total: 10, items_json: JSON.stringify([{ sku: 'RL001', cantidad: 2, precio_unitario: 5 }]) }, codigo: 'LUIS-1' });
  r.cot = { ok: cl.ok, folio: cl.item && cl.item.folio, vendedor: cl.item && cl.item.vendedor, estatus: cl.item && cl.item.estatus,
    esteban: (await post({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'q2', cliente: 'x', total: 1 }, codigo: 'ESTEBAN-1' })).ok,
    pedidoDirecto: (await post({ accion: 'erp_crear', tabla: 'pedidos', item: { id: 'x1', cliente: 'x', total: 1 }, codigo: 'LUIS-1' })).ok,
    cancelarAjena: (await post({ accion: 'erp_upsert_batch', tabla: 'cotizaciones', items: [{ id: 'q1', estatus: 'cancelada' }], codigo: 'EDGAR-1' })).ok,
    cambiarTotal: (await post({ accion: 'erp_upsert_batch', tabla: 'cotizaciones', items: [{ id: 'q1', total: 1 }], codigo: 'EDGAR-1' })).ok, // v4.91 la de otro no
    cambiarEstatus: (await post({ accion: 'erp_upsert_batch', tabla: 'cotizaciones', items: [{ id: 'q1', estatus: 'convertida' }], codigo: 'LUIS-1' })).ok,
    apartadoAntes: +(await post({ accion: 'erp_listar', tabla: 'productos', codigo: D })).items[0].stock_comprometido,
    cancelarPropia: (await post({ accion: 'erp_upsert_batch', tabla: 'cotizaciones', items: [{ id: 'q1', estatus: 'cancelada', notas: 'ya no' }], codigo: 'LUIS-1' })).ok,
    cancelarOtraVez: (await post({ accion: 'erp_upsert_batch', tabla: 'cotizaciones', items: [{ id: 'q1', estatus: 'cancelada' }], codigo: 'LUIS-1' })).ok };
  await new Promise(z => setTimeout(z, 300));
  r.push.alSubir = PUSH.map(x => x.u.split('/').pop()).sort().join(',');
  r.push.cabeceras = PUSH[0] && PUSH[0].h['Content-Encoding'] === 'aes128gcm' && /^vapid t=.+, k=/.test(PUSH[0].h.Authorization);
  r.push.viejaMarcada = JSON.parse([...PROPS].find(([k, v]) => k.startsWith('push:') && /vieja/.test(v))[1]).activo === false;
  ok('push-cotizacion', r.push.alSubir === 'rafa,vieja' && r.push.cabeceras && r.push.viejaMarcada);
  r.cot.apartadoDespues = +(await post({ accion: 'erp_listar', tabla: 'productos', codigo: D })).items[0].stock_comprometido;
  ok('cotizacion', r.cot.ok && r.cot.folio === 'C0001' && r.cot.vendedor === 'LUIS' && r.cot.estatus === 'enviada' && !r.cot.esteban && !r.cot.pedidoDirecto && !r.cot.cancelarAjena && !r.cot.cambiarTotal && !r.cot.cambiarEstatus && r.cot.cancelarPropia && !r.cot.cancelarOtraVez && r.cot.apartadoAntes === 2 && r.cot.apartadoDespues === 0);
  // v4.91 (Rafa 12 nov) — el vendedor CORRIGE su cotización por confirmar: lo apartado se ajusta, la oficina recibe aviso; no la de otro, ni folio/estatus, ni cliente ajeno
  const apt = async () => +(await post({ accion: 'erp_listar', tabla: 'productos', codigo: D })).items[0].stock_comprometido;
  const q3 = await post({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'q3', folio: '', cliente: 'Cliente de Luis', total: 2200, items_json: JSON.stringify([{ sku: 'RL001', cantidad: 2, precio_unitario: 1100 }]) }, codigo: 'LUIS-1' });
  const edt = (it, c) => post({ accion: 'erp_upsert_batch', tabla: 'cotizaciones', items: [{ id: 'q3', ...it }], codigo: c || 'LUIS-1' }).then(x => x.ok);
  const nPush = PUSH.length;
  r.editar = { creada: q3.ok, antes: await apt(),
    ok: await edt({ items_json: JSON.stringify([{ sku: 'RL001', cantidad: 5, precio_unitario: 1000 }]), subtotal: 5000, iva: 0, total: 5000, envio: 'Fletera X', notas: 'corregida' }) };
  r.editar.despues = await apt(); await new Promise(z => setTimeout(z, 300)); r.editar.aviso = PUSH.length > nPush;
  const fila = (await post({ accion: 'erp_listar', tabla: 'cotizaciones', codigo: D })).items.find(x => x.id === 'q3');
  r.editar.guardado = fila.total == 5000 && fila.envio === 'Fletera X' && fila.estatus === 'enviada' && fila.vendedor === 'LUIS' && fila.folio === q3.item.folio;
  Object.assign(r.editar, { folio: await edt({ folio: 'X1' }), convertir: await edt({ estatus: 'convertida' }), clienteAjeno: await edt({ cliente: 'Cliente de Edgar' }),
    deOtro: await edt({ total: 1 }, 'EDGAR-1'), sinProductos: await edt({ items_json: '[]' }) });
  r.editar.cancelar = await edt({ estatus: 'cancelada' }); r.editar.alCancelar = await apt(); r.editar.yaCancelada = await edt({ total: 3 });
  ok('editar-cotizacion', r.editar.creada && r.editar.antes === 2 && r.editar.ok && r.editar.despues === 5 && r.editar.aviso && r.editar.guardado && !r.editar.folio && !r.editar.convertir &&
    !r.editar.clienteAjeno && !r.editar.deOtro && !r.editar.sinProductos && r.editar.cancelar && r.editar.alCancelar === 0 && !r.editar.yaCancelada);
  // Pago reportado: queda por verificar y NO toca Cobranza
  const pv = await post({ accion: 'erp_crear', tabla: 'pagosverificar', item: { id: 'v1', cobro_id: 'k1', cliente: 'Cliente de Luis', monto: 40, estatus: 'verificado', fecha: '2026-11-03', cuenta: 'BBVA' }, codigo: 'LUIS-1' });
  const k1 = (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: D })).items.find(x => x.id === 'k1');
  r.pago = { ok: pv.ok, estatus: pv.item && pv.item.estatus, vendedor: pv.item && pv.item.vendedor, pendiente: k1.pendiente,
    edgarNoLoVe: !(await post({ accion: 'erp_listar', tabla: 'pagosverificar', codigo: 'ESTEBAN-1' })).items.length,
    duenoLoVe: (await post({ accion: 'erp_listar', tabla: 'pagosverificar', codigo: D })).items.length };
  ok('pago', r.pago.ok && r.pago.estatus === 'por_verificar' && r.pago.vendedor === 'LUIS' && r.pago.pendiente === 100 && r.pago.edgarNoLoVe && r.pago.duenoLoVe === 1);
  // v4.67 — Rafa cierra la sesión de Edgar: su siguiente movimiento pide volver a entrar; un vendedor no puede cerrar sesiones
  r.cerrar = { vendedorNo: (await post({ accion: 'cerrar_sesiones', codigos: ['LUIS-1'], codigo: 'EDGAR-1' })).ok === false,
    dueno: (await post({ accion: 'cerrar_sesiones', codigos: ['EDGAR-1', 'DUENO-1'], codigo: D })).cerradas };
  r.cerrar.edgarFuera = (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: 'EDGAR-1' })).requiere_login === true;
  r.cerrar.duenoSigue = (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: D })).ok === true;
  await post({ accion: 'login', codigo: 'EDGAR-1', device_id: 'd' }); r.cerrar.edgarVuelve = (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: 'EDGAR-1' })).ok === true;
  ok('cerrar-sesiones', r.cerrar.vendedorNo && r.cerrar.dueno === 1 && r.cerrar.edgarFuera && r.cerrar.duenoSigue && r.cerrar.edgarVuelve);
  // sesión vieja sin rol (no administrador): vuelve a entrar una vez; el administrador no
  SES.forEach((s, h) => { if (s.nombre === 'Yaz' || s.nombre === 'Rafa') { delete s.rol; } });
  r.relogin = { yaz: (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: 'YAZ-1' })).requiere_login === true, rafa: (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: D })).ok,
    yazTrasEntrar: (await post({ accion: 'login', codigo: 'YAZ-1', device_id: 'd' })).ok && (await post({ accion: 'erp_listar', tabla: 'cobranza', codigo: 'YAZ-1' })).items.length === 3 };
  ok('relogin', r.relogin.yaz && r.relogin.rafa && r.relogin.yazTrasEntrar);
  r.fallas = fallas; console.log(JSON.stringify(r, null, 1));
})().catch(e => console.log(JSON.stringify({ error: String(e.stack).slice(0, 800) })));
