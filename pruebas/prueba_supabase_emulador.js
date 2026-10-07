// Prueba del servidor en Supabase (supabase/functions/nun/emulador.js): corre backend/Codigo.gs sin cambios sobre hojas
// guardadas como en la tabla nun_hojas (memoria, sin red, datos inventados). Revisa que haga lo mismo que en Google.
const fs = require('fs'), path = require('path');
(async () => {
  const E = await import(path.join(__dirname, '..', 'supabase', 'functions', 'nun', 'emulador.js'));
  const code = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Codigo.gs'), 'utf8');
  const fn = E.compilar(code);
  const DB = new Map(); let PROPS = { en_supabase: '1' }; let cargas = 0;   // v0.9.13: en Supabase la propiedad en_supabase=1
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
  // v0.9.14 — un '' se ignora; con _vaciar sí se borra el campo
  await llamar({ accion: 'erp_upsert_batch', tabla: 'facturas', items: [{ id: 'fa', pedido_origen: '' }], codigo: C });
  const fa2 = (await llamar({ accion: 'erp_listar', tabla: 'facturas', codigo: C })).items.find(x => x.id === 'fa');
  await llamar({ accion: 'erp_upsert_batch', tabla: 'facturas', items: [{ id: 'fa', pedido_origen: '', _vaciar: ['pedido_origen'] }], codigo: C });
  const fa3 = (await llamar({ accion: 'erp_listar', tabla: 'facturas', codigo: C })).items.find(x => x.id === 'fa');
  r.vaciar = { vacioSeIgnora: fa2.pedido_origen, conVaciar: fa3.pedido_origen, clienteSigue: fa3.cliente };
  ok('vaciar', fa2.pedido_origen === '1244' && fa3.pedido_origen === '' && fa3.cliente === 'X');
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
  // v0.9.15 — FLUJO NUEVO: cotización aparta → confirmar = pedido (venta, descuenta inventario, 1 cobro) → factura sin otro cobro
  DB.get('Productos').push(DB.get('Productos')[0].map(h => ({ id: 'p2', sku: 'B2', stock_actual: 10, stock_comprometido: 0 }[h] ?? '')));
  const stockB = async () => { const it = (await llamar({ accion: 'erp_listar', tabla: 'productos', codigo: C })).items.find(x => x.sku === 'B2'); return it.stock_actual + '/' + it.stock_comprometido; };
  const cot = await llamar({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'cot1', folio: '', cliente: 'CLIENTE Z', vendedor: 'EDGAR', total: 300, subtotal: 300, iva: 0, estatus: 'enviada', items_json: JSON.stringify([{ sku: 'B2', cantidad: 3, precio_unitario: 100 }]) }, codigo: 'VEND-PRUEBA2', usuario: 'EDGAR' });
  const F = { folioCot: cot.item && cot.item.folio, trasCotizacion: await stockB() };
  const conf = await llamar({ accion: 'confirmar_cotizacion', id: 'cot1', codigo: C, usuario: 'Rafa' });
  const cobs = (await llamar({ accion: 'erp_listar', tabla: 'cobranza', codigo: C })).items.filter(x => x.factura_origen === (conf.pedido || {}).id);
  const cotD = (await llamar({ accion: 'erp_listar', tabla: 'cotizaciones', codigo: C })).items.find(x => x.id === 'cot1');
  const pedD = (await llamar({ accion: 'erp_listar', tabla: 'pedidos', codigo: C })).items.find(x => x.id === (conf.pedido || {}).id);
  Object.assign(F, { ok: conf.ok, folioPed: pedD && pedD.folio, estatusPed: pedD && pedD.estatus, origen: pedD && pedD.cotizacion_origen, trasConfirmar: await stockB(),
    cobros: cobs.map(c => c.tipo + ' ' + c.numero + ' ' + c.total + ' pend ' + c.pendiente), cot: cotD.estatus,
    otraVez: (await llamar({ accion: 'confirmar_cotizacion', id: 'cot1', codigo: C })).error || 'sin error' });
  const fac = await llamar({ accion: 'convertir_documento', tabla_origen: 'pedidos', id_origen: conf.pedido.id, tabla_destino: 'facturas', usuario: 'Rafa', codigo: C });
  const facD = (await llamar({ accion: 'erp_listar', tabla: 'facturas', codigo: C })).items.find(x => x.id === fac.nuevoId);
  F.factura = { cobroCreado: !!fac.cobranzaCreada, cobrosDelPedido: (await llamar({ accion: 'erp_listar', tabla: 'cobranza', codigo: C })).items.filter(x => /cancel/.test(x.estatus) === false && (x.factura_origen === fac.nuevoId)).length, nota: /Cobro en P\d{4} \(id cob_/.test(facD.notas || '') };
  F.cancelarConFactura = (await llamar({ accion: 'cancelar_pedido_venta', id: conf.pedido.id, codigo: C })).error || 'sin error';
  await llamar({ accion: 'erp_upsert_batch', tabla: 'facturas', items: [{ id: fac.nuevoId, estatus: 'cancelada' }], codigo: C });
  const canc = await llamar({ accion: 'cancelar_pedido_venta', id: conf.pedido.id, codigo: C, motivo: 'prueba' });
  const cobC = (await llamar({ accion: 'erp_listar', tabla: 'cobranza', codigo: C })).items.find(x => x.id === 'cob_' + conf.pedido.id);
  F.cancelar = { ok: canc.ok, cobro: cobC.estatus, stock: await stockB(), pedido: (await llamar({ accion: 'erp_listar', tabla: 'pedidos', codigo: C })).items.find(x => x.id === conf.pedido.id).estatus };
  // con pagos no se puede cancelar
  await llamar({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'cot2', cliente: 'CLIENTE Z', total: 100, estatus: 'enviada', items_json: JSON.stringify([{ sku: 'B2', cantidad: 1, precio_unitario: 100 }]) }, codigo: C });
  const conf2 = await llamar({ accion: 'confirmar_cotizacion', id: 'cot2', codigo: C });
  await llamar({ accion: 'capturar_pago_cliente', id_doc: 'cob_' + conf2.pedido.id, monto: 50, fecha: '2026-10-07', cuenta: 'BBVA', codigo_usuario: C, codigo: C });
  F.cancelarConPago = (await llamar({ accion: 'cancelar_pedido_venta', id: conf2.pedido.id, codigo: C })).error || 'sin error';
  // cotización rechazada libera lo apartado
  await llamar({ accion: 'erp_crear', tabla: 'cotizaciones', item: { id: 'cot3', cliente: 'CLIENTE Z', total: 200, estatus: 'enviada', items_json: JSON.stringify([{ sku: 'B2', cantidad: 2, precio_unitario: 100 }]) }, codigo: C });
  F.cot3Apartada = await stockB(); await llamar({ accion: 'cotizacion_liberar', id: 'cot3', codigo: C }); F.cot3Liberada = await stockB();
  F.bitacoraSinCodigos = !DB.get('Bitacora').slice(1).some(r => /PRUEBA\d/.test(String(r[1]))) && !DB.get('MovInventario').slice(1).some(r => r.some(v => /PRUEBA\d/.test(String(v))));
  r.flujo = F;
  ok('flujo', /^C\d{4}$/.test(F.folioCot || '') && F.trasCotizacion === '10/3' && F.ok && /^P\d{4}$/.test(F.folioPed || '') && F.estatusPed === 'confirmado' && F.origen === F.folioCot
    && F.trasConfirmar === '7/0' && F.cobros.length === 1 && /^Pedido P\d{4} 300 pend 300$/.test(F.cobros[0]) && F.cot === 'convertida' && /ya se confirmó/.test(F.otraVez)
    && !F.factura.cobroCreado && F.factura.cobrosDelPedido === 0 && F.factura.nota && /factura .* sin cancelar/.test(F.cancelarConFactura)
    && F.cancelar.ok && F.cancelar.cobro === 'cancelado' && F.cancelar.stock === '10/0' && F.cancelar.pedido === 'cancelado' && /tiene pagos/.test(F.cancelarConPago)
    && F.cot3Apartada === '9/2' && F.cot3Liberada === '9/0' && F.bitacoraSinCodigos);
  // usuarios: la hoja existe pero nunca sale
  r.listarSinCambios = (await llamar({ accion: 'erp_listar', tabla: 'pedidos', codigo: C }))._sucias.length;
  ok('lecturaNoEscribe', r.listarSinCambios === 0);
  r.cargas = cargas;
  console.log(JSON.stringify({ r, fallas }, null, 1));
})().catch(e => { console.log(JSON.stringify({ error: String(e && e.stack || e) })); });
