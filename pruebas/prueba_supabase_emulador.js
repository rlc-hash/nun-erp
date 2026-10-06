// Prueba del servidor en Supabase (supabase/functions/nun/emulador.js): corre backend/Codigo.gs sin cambios sobre hojas
// guardadas como en la tabla nun_hojas (memoria, sin red, datos inventados). Revisa que haga lo mismo que en Google.
const fs = require('fs'), path = require('path');
(async () => {
  const E = await import(path.join(__dirname, '..', 'supabase', 'functions', 'nun', 'emulador.js'));
  const code = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Codigo.gs'), 'utf8');
  const fn = E.compilar(code);
  const DB = new Map(); let PROPS = {}; let cargas = 0;
  const COD = { 'DUENO-PRUEBA1': { admin: true }, 'VEND-PRUEBA2': { admin: false } };
  async function llamar(body, tipo){
    const r = await E.atender({ fn, existentes: [...DB.keys()], props: PROPS,
      cargar: async ns => { cargas++; return new Map(ns.map(n => [n, JSON.parse(JSON.stringify(DB.get(n) || []))])); },
      sesion: c => !!COD[String(c || '').toUpperCase().trim()], admin: c => !!(COD[String(c || '').toUpperCase().trim()] || {}).admin,
      tipo: tipo || 'post', payload: tipo === 'get' ? body : JSON.stringify(body) });
    for (const s of r.sucias) DB.set(s.nombre, JSON.parse(JSON.stringify(s.filas)));   // como si se guardara en Postgres (JSON)
    if (r.props) PROPS = r.props;
    return Object.assign(JSON.parse(r.texto), { _corridas: r.corridas, _sucias: r.sucias.map(s => s.nombre) });
  }
  const C = 'DUENO-PRUEBA1', r = {}, fallas = [];
  const ok = (k, cond) => { if (!cond) fallas.push(k); };
  // sin código / código inválido
  r.sinCodigo = (await llamar({ accion: 'erp_listar', tabla: 'pedidos' })).requiere_login === true;
  r.malCodigo = (await llamar({ accion: 'erp_listar', tabla: 'pedidos', codigo: 'NADIE' })).requiere_login === true;
  r.usuariosNo = (await llamar({ accion: 'erp_listar', tabla: 'usuarios', codigo: C })).ok === false;
  ok('auth', r.sinCodigo && r.malCodigo && r.usuariosNo);
  // crear hojas y folios únicos
  const a = await llamar({ accion: 'erp_crear', tabla: 'facturas', item: { id: 'fa', folio: 'FT0001', cliente: 'X', total: 1 }, codigo: C });
  const b = await llamar({ accion: 'erp_crear', tabla: 'facturas', item: { id: 'fb', folio: 'FT0001', cliente: 'Y', total: 2 }, codigo: C });
  const b2 = await llamar({ accion: 'erp_crear', tabla: 'facturas', item: { id: 'fb', folio: 'FT0001', cliente: 'Y', total: 2 }, codigo: C });
  const lf = await llamar({ accion: 'erp_listar', tabla: 'facturas', codigo: C });
  r.folios = { a: a.item.folio, b: b.item.folio, reintento: b2.ya_existia === true, filas: lf.items.length, corridasListar: lf._corridas, hojaCreada: a._sucias };
  ok('folios', r.folios.a === 'FT0001' && r.folios.b === 'FT0002' && r.folios.reintento && r.folios.filas === 2);
  // upsert solo de los campos enviados
  await llamar({ accion: 'erp_upsert_batch', tabla: 'facturas', items: [{ id: 'fa', pedido_origen: '1244' }], codigo: C });
  const fa = (await llamar({ accion: 'erp_listar', tabla: 'facturas', codigo: C })).items.find(x => x.id === 'fa');
  r.upsert = { pedido_origen: fa.pedido_origen, cliente: fa.cliente, total: fa.total };
  ok('upsert', fa.pedido_origen === '1244' && fa.cliente === 'X' && fa.total === 1);
  // cobranza + pago + anular pago (nada se borra)
  await llamar({ accion: 'erp_crear', tabla: 'cobranza', item: { id: 'c1', numero: 'R0001', cliente: 'X', total: 100, cobrado: 0, pendiente: 100 }, codigo: C });
  const pg = await llamar({ accion: 'capturar_pago_cliente', id_doc: 'c1', monto: 40, fecha: '2026-09-30', cuenta: 'BBVA', codigo_usuario: C, codigo: C });
  let cob = (await llamar({ accion: 'erp_listar', tabla: 'cobranza', codigo: C })).items[0];
  r.pago = { ok: pg.ok, cobrado: cob.cobrado, pendiente: cob.pendiente, hojas: pg._sucias.sort() };
  ok('pago', pg.ok && +cob.cobrado === 40 && +cob.pendiente === 60);
  const ts = DB.get('PagosClientes')[1][0];
  const an = await llamar({ accion: 'editar_pago_manual', timestamp: ts, nuevo_monto: 0, codigo_usuario: C });
  cob = (await llamar({ accion: 'erp_listar', tabla: 'cobranza', codigo: C })).items[0];
  const ing = (await llamar({ accion: 'erp_listar', tabla: 'ingresos', codigo: C })).items;
  r.anular = { ok: an.ok, cobrado: cob.cobrado, ingresos: ing.length, tipo: ing[0] && ing[0].tipo };
  ok('anular', an.ok && +cob.cobrado === 0 && ing.length === 1);
  // GET del CRM
  const g = await llamar({ tabla: 'cobranza', codigo: 'VEND-PRUEBA2' }, 'get');
  r.get = { ok: g.ok, n: (g.data || []).length, sinCodigo: (await llamar({ tabla: 'cobranza' }, 'get')).ok };
  ok('get', g.ok && r.get.n === 1 && r.get.sinCodigo === false);
  // inventario: pedido aparta, convertir a remisión libera; folio NUN en la conversión
  await llamar({ accion: 'inicializar', codigo: C });
  DB.get('Productos').push(DB.get('Productos')[0].map(h => ({ id: 'p1', sku: 'A1', stock_actual: 10, stock_comprometido: 0 }[h] ?? '')));
  await llamar({ accion: 'erp_crear', tabla: 'pedidos', item: { id: 'ped1', folio: 'P0001', cliente: 'X', estatus: 'confirmado', items_json: JSON.stringify([{ sku: 'A1', cantidad: 3 }]) }, codigo: C });
  const prod = async () => { const it = (await llamar({ accion: 'erp_listar', tabla: 'productos', codigo: C })).items[0]; return it.stock_actual + '/' + it.stock_comprometido; };
  r.inventario = { trasPedido: await prod() };
  const conv = await llamar({ accion: 'convertir_documento', tabla_origen: 'pedidos', id_origen: 'ped1', tabla_destino: 'remisiones', usuario: 'x', codigo: C });
  r.inventario.trasRemision = await prod(); r.inventario.folio = conv.folio;
  ok('inventario', r.inventario.trasPedido === '10/3' && /^R\d{4}$/.test(conv.folio || ''));
  // inicializar solo admin
  r.inicializarVendedor = (await llamar({ accion: 'inicializar', codigo: 'VEND-PRUEBA2' })).ok;
  ok('admin', r.inicializarVendedor === false);
  // KV en partes de 45,000
  const largo = 'x'.repeat(100000);
  await llamar({ accion: 'kv_guardar', pares: { k1: largo, k2: 'hola' }, codigo: C });
  await llamar({ accion: 'kv_guardar', pares: { k2: 'adios' }, codigo: C });
  const kv = (await llamar({ accion: 'kv_leer', codigo: C })).valores;
  r.kv = { k1: kv.k1.length, k2: kv.k2, renglones: DB.get('ERP_Estado').length };
  ok('kv', kv.k1.length === 100000 && kv.k2 === 'adios' && r.kv.renglones === 5);
  // usuarios: la hoja existe pero nunca sale
  r.listarSinCambios = (await llamar({ accion: 'erp_listar', tabla: 'pedidos', codigo: C }))._sucias.length;
  ok('lecturaNoEscribe', r.listarSinCambios === 0);
  r.cargas = cargas;
  console.log(JSON.stringify({ r, fallas }, null, 1));
})().catch(e => { console.log(JSON.stringify({ error: String(e && e.stack || e) })); });
