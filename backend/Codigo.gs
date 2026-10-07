// ============================================================
// NUN ERP — Backend (Google Apps Script) · v0.9.9
// Proyecto de la hoja "Copia de NUN ERP". Implementación activa: la URL que termina en …Dt2A/exec.
//
// v0.9.9 (30-sep-2026) — auditoría de seguridad y "nunca borrar":
//  · NINGÚN código de acceso escrito aquí. El código maestro se guarda en Propiedades del script
//    (clave: codigo_maestro). Si no existe, no hay código maestro.
//  · Todas las acciones piden un código de usuario activo (antes varias no lo pedían, y el GET
//    entregaba cualquier hoja, incluida Usuarios con todos los códigos, a quien tuviera la liga).
//  · La hoja Usuarios nunca sale por erp_listar / GET (solo listar_usuarios, para admins).
//  · Nada se borra: eliminar = cancelar / desactivar; "borrar todo", "dedupe" y borrar por prefijo
//    quedan desactivados; anular un pago marca el ingreso como CANCELADO (no borra renglones).
//  · Folios NUN (P/R/FT/NC) únicos: si dos personas guardan al mismo tiempo, el segundo recibe el
//    siguiente folio libre (con candado).
//  · Inventario: al convertir pedido→remisión se libera lo apartado; nueva acción pedido_liberar
//    (al cancelar un pedido); el pedido de origen se encuentra por folio o por id.
//  · Bind apagado (ya no se usa desde el 29-sep-2026): sincronización y proxy desactivados; el
//    activador automático se borra solo si llega a correr.
//
// v0.9.15 (7-oct-2026) — FLUJO NUEVO DE VENTA: el vendedor sube COTIZACIÓN (folio C0001; aparta inventario); al CONFIRMARLA
//  (confirmar_cotizacion) se vuelve PEDIDO: se libera lo apartado, se descuenta el inventario y nace UN cobro (tipo Pedido).
//  La factura que salga de ese pedido NO crea otro cobro: se cobra en el del pedido. Las remisiones ya no se usan.
//  activar_pedido (pedido capturado directo), cancelar_pedido_venta (sin pagos: cancela el cobro y regresa el inventario), cotizacion_liberar.
// v0.9.14 (7-oct-2026) — erp_upsert_batch puede VACIAR campos a propósito: item._vaciar = ['pedido_origen'] (un '' normal se sigue ignorando).
// v0.9.13 (6-oct-2026) — los datos viven en Supabase: este servidor de Google ya NO guarda (una página vieja abierta recibe "recarga la página").
//  Aquí solo se entra, se manejan usuarios y se timbra (Supabase se lo pide). En Supabase la propiedad en_supabase=1 deja todo igual que antes.
// v0.9.12 (6-oct-2026) — listas en memoria rápida de Google (CacheService) hasta que haya un cambio: el sistema carga mucho más rápido.
// v0.9.11 (30-sep-2026) — documentos nuevos y convertidos llevan folio NUN (P0001/R0001/FT0001/NC0001), ya no REM-2026-0001.
// v0.9.10 (30-sep-2026) — el usuario de Rafa (código RAFA-…) solo lo ve y lo cambia Rafa (o el código maestro).
//  Nadie más puede crear códigos de dueño (RAFA-, YADAH-, MASTER-NUN-), porque esos dan permisos de dueño.
// ============================================================

const VERSION_ERP = 'v0.9.15';

// v0.9.2 — Mapeo de tablas que el CRM pide por nombre "corto" a la hoja real del ERP.
// El CRM usa 'clientes' para su catálogo de vendedores (NO el catálogo fiscal 'clientes' del ERP).
function _tablaCRM(nombreCorto) {
  const map = { gastos:'gastos', ingresos:'ingresos', cobranza:'cobranza', clientes:'clientescat' };
  return map[nombreCorto] || null;
}
// v0.9.9 — el código maestro vive en Propiedades del script (clave codigo_maestro), nunca en el código
function _codigoMaestro() {
  try { return String(PropertiesService.getScriptProperties().getProperty('codigo_maestro') || '').toUpperCase().trim(); } catch(e) { return ''; }
}
function _esMaestro(c) { const m = _codigoMaestro(); return !!m && String(c || '').toUpperCase().trim() === m; }
// v0.9.10 — el usuario de Rafa y los códigos de dueño solo los maneja Rafa (RAFA-…) o el código maestro
function _esRafa(c) { const x = String(c || '').toUpperCase().trim(); return _esMaestro(x) || (x.indexOf('RAFA-') === 0 && x.length > 5); }
function _esCodigoDueno(c) { const x = String(c || '').toUpperCase().trim(); return ['RAFA-','YADAH-','MASTER-NUN-'].some(p => x.indexOf(p) === 0); }
function _protegido(codigoTarget, codigoAdmin) {
  const t = String(codigoTarget || '').toUpperCase().trim();
  if (t.indexOf('RAFA-') === 0 && !_esRafa(codigoAdmin)) return 'Ese usuario solo lo puede cambiar Rafa';
  return '';
}
// v0.9.13 — ¿este código corre en Supabase? (allá la propiedad en_supabase vale 1). En Google solo quedan estas acciones:
// entrar, usuarios, Facturama, y lecturas (Supabase las usa para revisar códigos y para copiar/comparar datos).
const ACC_EN_GOOGLE = /^(login|liberar_dispositivo|listar_usuarios|crear_usuario|actualizar_usuario|eliminar_usuario|facturama_guardar_cred|facturama_estado|facturama_timbrar|facturama_cancelar|listar_cuentas|listar_bitacora|erp_listar|kv_leer|obtener_empresa|cfdi_xml_get|cfdi_xml_uuids)$/;
function _enSupabase() { try { return String(PropertiesService.getScriptProperties().getProperty('en_supabase') || '') === '1'; } catch(e) { return false; } }
// v0.9.9 — tablas que nunca se entregan por las lecturas genéricas
const TABLAS_PRIVADAS = { usuarios:true };
// v0.9.9 — Bind ya no se usa
const BIND_APAGADO = true;

// ============================================================
// DEFINICIÓN DE TABLAS
// ============================================================
const TABLAS = {
  // Configuración y auth
  usuarios:    { nombre:'Usuarios',    cols:['codigo','nombre','rol','permisos','vendedor_asignado','dispositivos','max_dispositivos','activo','creado','creado_por'] },
  cuentas:     { nombre:'Cuentas',     cols:['nombre','tipo','activa','notas'] },
  vendedores:  { nombre:'Vendedores',  cols:['nombre','activo'] },

  // Catálogos
  clientes:    { nombre:'Clientes',    cols:['id','rfc','razon_social','nombre_comercial','contacto','email','telefono','direccion','ciudad','estado','cp','regimen_fiscal','uso_cfdi','credito_dias','limite_credito','vendedor','activo','fecha_alta','notas'] },
  productos:   { nombre:'Productos',   cols:['id','sku','descripcion','descripcion_larga','categoria','unidad','clave_sat','costo','precio','precio_min','stock_actual','stock_comprometido','stock_minimo','activo','fecha_alta','notas'] },
  proveedores: { nombre:'Proveedores', cols:['id','rfc','razon_social','contacto','email','telefono','direccion','condiciones_pago','dias_credito','activo','fecha_alta','notas'] },

  // Inventario
  movinventario: { nombre:'MovInventario', cols:['id','fecha','sku','tipo','cantidad','costo_unitario','referencia','ref_id','motivo','usuario','notas','almacen'] },

  // Operación ventas
  cotizaciones: { nombre:'Cotizaciones', cols:['id','folio','fecha','cliente','vendedor','comision_pct','vigencia_dias','subtotal','iva','total','sin_iva','estatus','items_json','notas','creado_por'] },
  pedidos:      { nombre:'Pedidos',      cols:['id','folio','fecha','cliente','vendedor','comision_pct','cotizacion_origen','subtotal','iva','total','sin_iva','estatus','items_json','fecha_entrega','sin_entregar','notas','creado_por'] },
  facturas:     { nombre:'Facturas',     cols:['id','folio','fecha','cliente','pedido_origen','subtotal','iva','total','sin_iva','estatus','uuid_sat','pdf_url','xml_url','items_json','vendedor','comision_pct','metodo_pago','forma_pago','uso_cfdi','notas','creado_por'] },

  // Compras
  ordenescompra:    { nombre:'OrdenesCompra',    cols:['id','folio','fecha','proveedor','subtotal','iva','total','estatus','items_json','fecha_estimada','condiciones','notas','creado_por'] },
  recepciones:      { nombre:'Recepciones',      cols:['id','folio','fecha','oc_origen','proveedor','items_json','notas','creado_por'] },
  pagosproveedores: { nombre:'PagosProveedores', cols:['id','fecha','proveedor','oc_relacionada','monto','cuenta','metodo','referencia','notas','creado_por'] },

  // Financieros propios del ERP
  cobranza:      { nombre:'Cobranza',      cols:['id','fecha_entrega','fecha_emision','fecha_vencimiento','cliente','tipo','numero','estatus','vendedor','descripcion','credito','total','cobrado','pendiente','dias_vencido','sin_entregar','folio_fiscal','factura_origen'] },
  ingresos:      { nombre:'Ingresos',      cols:['id','fecha','cliente','factura','cuenta','tipo','monto','comentarios','registrado_por'] },
  gastos:        { nombre:'Gastos',        cols:['id','fecha','concepto','descripcion','categoria','metodo','responsable','monto'] },
  pagosclientes: { nombre:'PagosClientes', cols:['timestamp','id_doc','cliente','monto','fecha','cuenta','notas','usuario','codigo_usuario','ingreso_id'] },

  // v0.2.0 — Configuración y nuevos módulos
  empresa:          { nombre:'EmpresaConfig',     cols:['clave','valor'] },
  sucursales:       { nombre:'Sucursales',        cols:['id','nombre','tipo','direccion','ciudad','estado','cp','telefono','responsable','activo','notas'] },
  listasprecios:    { nombre:'ListasPrecios',     cols:['id','nombre','descripcion','tipo','descuento_pct','activa','notas'] },
  seriesfolios:     { nombre:'SeriesFolios',      cols:['id','tipo_documento','serie','folio_actual','prefijo','sufijo','activa','notas'] },
  categorias:       { nombre:'Categorias',        cols:['id','nombre','padre','descripcion','activa','orden'] },
  remisiones:       { nombre:'Remisiones',        cols:['id','folio','fecha','cliente','vendedor','comision_pct','pedido_origen','sucursal','subtotal','iva','total','sin_iva','estatus','items_json','fecha_entrega','sin_entregar','factura_generada','notas','creado_por'] },
  // v0.9.9 — notas de crédito: cliente, uuid_sat, forma_pago y sin_iva (las timbra el ERP desde v3.81)
  notascredito:     { nombre:'NotasCredito',      cols:['id','folio','fecha','tipo','contraparte','documento_origen','subtotal','iva','total','motivo','estatus','items_json','notas','creado_por','cliente','uuid_sat','forma_pago','sin_iva','vendedor','comision_pct'] },
  bitacora:         { nombre:'Bitacora',          cols:['timestamp','usuario','accion','tabla','registro_id','detalle'] },

  // v0.5.0 — Importaciones y TC
  importaciones:    { nombre:'Importaciones',     cols:['id','folio','fecha','fecha_eta','proveedor','moneda_origen','tc_compra','subtotal_origen','subtotal_mxn','flete_mxn','aduana_mxn','impuestos_mxn','otros_mxn','gastos_accesorios_mxn','total_costo_mxn','base_prorrateo','items_json','estatus','pedimento_sat','notas','creado_por','fecha_cierre']
                    // estatus: borrador | en_transito | recibida | cerrada | cancelada
                    // base_prorrateo: valor | peso | unidades
                  },
  tiposcambio:      { nombre:'TiposCambio',       cols:['id','fecha','moneda','valor_mxn','fuente','notas'] },

  // v0.6.0 — CRM y recordatorios
  contactoscrm:     { nombre:'ContactosCRM',      cols:['id','fecha','cliente','tipo','asunto','descripcion','vendedor','resultado','proximo_seguimiento','creado_por'] },
  oportunidades:    { nombre:'Oportunidades',     cols:['id','fecha_creacion','cliente','vendedor','monto_estimado','etapa','probabilidad','fecha_cierre_estimado','productos_json','notas','creado_por','actualizado']
                    // etapa: prospeccion | cotizacion | negociacion | cierre | ganada | perdida
                  },
  recordatorios:    { nombre:'Recordatorios',     cols:['id','fecha_objetivo','tipo','cliente','asignado_a','descripcion','completado','completado_fecha','creado_por']
                    // tipo: llamada | email | visita | tarea | seguimiento
                  },

  // v0.7.0 — Estado compartido multi-usuario (Procurement, GL, Bancos, Automation, OM, INV)
  // Guarda snapshots JSON de los módulos que antes vivían solo en localStorage.
  // Valores largos se parten en chunks de 45,000 chars (límite de celda de Sheets es 50,000).
  kvstore:          { nombre:'ERP_Estado',        cols:['clave','parte','valor','actualizado','actualizado_por'] },

  // v0.8.0 — XMLs de CFDI (sello completo) en el backend, NO en el navegador.
  // Un renglón por (uuid, parte). Descarga bajo demanda por uuid.
  cfdixml:          { nombre:'CFDI_XML',           cols:['uuid','parte','xml','fecha','total','cliente','tipo'] },

  // v0.9.2 — CONSOLIDACIÓN CRM: hojas que antes vivían en el backend separado del CRM.
  // clientescat = catálogo de asignación cliente→vendedor (DISTINTO de 'clientes' fiscal).
  clientescat:      { nombre:'ClientesCatalogo',   cols:['id','nombre','nombre_normalizado','vendedor','aliases','notas','activo','creado'] },
  aplazamientos:    { nombre:'Aplazamientos',      cols:['codigo_usuario','alerta_id','expira','dias','creado'] }
};

// ============================================================
// PERMISOS DE USUARIO
// ============================================================
const PERMISOS_PLANTILLAS = {
  'admin': {
    ver_catalogos: true, editar_catalogos: true,
    ver_inventario: true, editar_inventario: true,
    ver_operacion: true, editar_operacion: true,
    ver_compras: true, editar_compras: true,
    ver_financieros: true, editar_financieros: true,
    ver_reportes: true, eliminar_documentos: true,
    gestionar_usuarios: true, ver_todos_clientes: true
  },
  'cobranza': {
    ver_catalogos: true, editar_catalogos: false,
    ver_inventario: true, editar_inventario: false,
    ver_operacion: true, editar_operacion: true,
    ver_compras: false, editar_compras: false,
    ver_financieros: true, editar_financieros: true,
    ver_reportes: true, eliminar_documentos: false,
    gestionar_usuarios: false, ver_todos_clientes: true
  },
  'vendedor': {
    ver_catalogos: true, editar_catalogos: false,
    ver_inventario: true, editar_inventario: false,
    ver_operacion: true, editar_operacion: true,
    ver_compras: false, editar_compras: false,
    ver_financieros: false, editar_financieros: false,
    ver_reportes: false, eliminar_documentos: false,
    gestionar_usuarios: false, ver_todos_clientes: false
  },
  'contador': {
    ver_catalogos: true, editar_catalogos: false,
    ver_inventario: true, editar_inventario: false,
    ver_operacion: true, editar_operacion: false,
    ver_compras: true, editar_compras: false,
    ver_financieros: true, editar_financieros: false,
    ver_reportes: true, eliminar_documentos: false,
    gestionar_usuarios: false, ver_todos_clientes: true
  }
};

function calcularPermisos(usuario) {
  let permisos = PERMISOS_PLANTILLAS[usuario.rol] || PERMISOS_PLANTILLAS['cobranza'];
  if (usuario.permisos) {
    try {
      const custom = typeof usuario.permisos === 'string' ? JSON.parse(usuario.permisos) : usuario.permisos;
      permisos = Object.assign({}, permisos, custom);
    } catch(e) {}
  }
  // Pestañas visibles según permisos
  const pestanas = ['dashboard'];
  if (permisos.ver_catalogos) pestanas.push('clientes','productos','proveedores');
  if (permisos.ver_inventario) pestanas.push('inventario');
  if (permisos.ver_operacion) pestanas.push('cotizaciones','pedidos','facturas');
  if (permisos.ver_compras) pestanas.push('ordenescompra','recepciones','pagosproveedores');
  if (permisos.ver_financieros) pestanas.push('cobranza','ingresos','gastos');
  if (permisos.ver_reportes) pestanas.push('reportes');
  permisos.pestanas = pestanas;
  return permisos;
}

// ============================================================
// HOJA: asegurar existencia y migración automática
// ============================================================
function asegurarHoja(tabla) {
  const def = TABLAS[tabla];
  if (!def) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(def.nombre);
  if (!hoja) {
    hoja = ss.insertSheet(def.nombre);
    hoja.appendRow(def.cols);
    hoja.getRange(1, 1, 1, def.cols.length).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    hoja.setFrozenRows(1);
    return hoja;
  }
  // Auto-migración: agregar columnas faltantes al final
  const headers = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0];
  def.cols.forEach(c => {
    if (headers.indexOf(c) < 0) {
      const nuevaCol = hoja.getLastColumn() + 1;
      hoja.getRange(1, nuevaCol).setValue(c).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    }
  });
  return hoja;
}

// ============================================================
// INICIALIZACIÓN: crea las hojas que falten (ya no siembra ningún código de acceso — v0.9.9)
// ============================================================
function inicializarERP() {
  // Crear hojas básicas
  asegurarHoja('usuarios');
  asegurarHoja('cuentas');
  asegurarHoja('vendedores');

  // Sembrar cuentas mínimas si está vacía
  const hojaC = asegurarHoja('cuentas');
  if (hojaC.getLastRow() < 2) {
    hojaC.appendRow(['Efectivo', 'caja', true, '']);
    hojaC.appendRow(['BBVA Casraf', 'banco', true, 'cuenta principal']);
  }

  // Crear las hojas del ERP para que aparezcan inmediatamente
  ['clientes','productos','proveedores','movinventario','cotizaciones','pedidos','facturas',
   'ordenescompra','recepciones','pagosproveedores','cobranza','ingresos','gastos','pagosclientes',
   'empresa','sucursales','listasprecios','seriesfolios','categorias','remisiones','notascredito','bitacora',
   'importaciones','tiposcambio','contactoscrm','oportunidades','recordatorios'
  ].forEach(t => asegurarHoja(t));

  // Sembrar configuración mínima de empresa
  const hojaEmp = asegurarHoja('empresa');
  if (hojaEmp.getLastRow() < 2) {
    [['razon_social','Comercializadora Casraf SA de CV'],
     ['rfc',''],
     ['regimen_fiscal',''],
     ['direccion',''],
     ['ciudad',''],
     ['estado',''],
     ['cp',''],
     ['telefono',''],
     ['email',''],
     ['moneda','MXN'],
     ['iva_default','16']
    ].forEach(r => hojaEmp.appendRow(r));
  }

  // Sembrar sucursal/almacén principal
  const hojaSuc = asegurarHoja('sucursales');
  if (hojaSuc.getLastRow() < 2) {
    hojaSuc.appendRow(['suc_principal', 'Matriz', 'matriz', '', '', '', '', '', '', true, '']);
  }

  // Sembrar listas de precios estándar
  const hojaLP = asegurarHoja('listasprecios');
  if (hojaLP.getLastRow() < 2) {
    [['lp_lista','Lista','precio normal de catálogo','base',0,true,''],
     ['lp_mayoreo','Mayoreo','-10% para volumen','descuento',10,true,''],
     ['lp_especial','Especial','negociado por cliente','manual',0,true,'']
    ].forEach(r => hojaLP.appendRow(r));
  }

  // Sembrar series y folios para todos los tipos de documento
  const hojaSF = asegurarHoja('seriesfolios');
  if (hojaSF.getLastRow() < 2) {
    const año = new Date().getFullYear();
    [['srl_cot', 'cotizacion',  año, 0, 'COT-'+año+'-', '', true, ''],
     ['srl_ped', 'pedido',      año, 0, 'PED-'+año+'-', '', true, ''],
     ['srl_fac', 'factura',     año, 0, 'FAC-'+año+'-', '', true, ''],
     ['srl_rem', 'remision',    año, 0, 'REM-'+año+'-', '', true, ''],
     ['srl_oc',  'ordencompra', año, 0, 'OC-'+año+'-',  '', true, ''],
     ['srl_rec', 'recepcion',   año, 0, 'REC-'+año+'-', '', true, ''],
     ['srl_nc',  'notacredito', año, 0, 'NC-'+año+'-',  '', true, ''],
     ['srl_imp', 'importacion', año, 0, 'IMP-'+año+'-', '', true, '']
    ].forEach(r => hojaSF.appendRow(r));
  }

  // Sembrar categorías iniciales
  const hojaCat = asegurarHoja('categorias');
  if (hojaCat.getLastRow() < 2) {
    [['cat_maletas',  'Maletas',  '', 'Maletas de viaje y maletines',     true, 1],
     ['cat_mochilas', 'Mochilas', '', 'Mochilas escolares y de viaje',    true, 2],
     ['cat_accesorios','Accesorios','','Cintos, candados, etiquetas',     true, 3]
    ].forEach(r => hojaCat.appendRow(r));
  }

  SpreadsheetApp.flush();
  return { ok:true, mensaje:'ERP inicializado (hojas creadas).' };
}

// ============================================================
// AUTH
// ============================================================
function validarCodigo(codigo, deviceId, deviceName) {
  const c = String(codigo || '').toUpperCase().trim();
  // Maestro de emergencia (v0.9.9: guardado en Propiedades del script)
  if (_esMaestro(c)) {
    return {
      ok: true,
      usuario: { codigo: c, nombre: 'Maestro', rol: 'admin', vendedor_asignado: '' },
      permisos: calcularPermisos({ rol:'admin' })
    };
  }
  if (!c) return { ok:false, error:'Código no encontrado' };
  const hoja = asegurarHoja('usuarios');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  for (let i = 1; i < datos.length; i++) {
    const codFila = String(datos[i][idx.codigo] || '').toUpperCase().trim();
    if (codFila === c) {
      const activo = datos[i][idx.activo];
      if (activo === false || activo === 'false' || activo === 'FALSE') {
        return { ok:false, error:'Usuario inactivo' };
      }
      // Manejo de dispositivos (simplificado: aceptamos si está dentro del máximo)
      let dispositivos = [];
      try {
        const raw = datos[i][idx.dispositivos];
        if (raw) dispositivos = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch(e) { dispositivos = []; }
      // v0.9.3: admins y código maestro = dispositivos ILIMITADOS. max_dispositivos <= 0 también.
      const rolUsuario = String(datos[i][idx.rol] || '').toLowerCase();
      const maxRaw = parseInt(datos[i][idx.max_dispositivos]);
      const ilimitado = (rolUsuario === 'admin') || (!isNaN(maxRaw) && maxRaw <= 0);
      const max = isNaN(maxRaw) ? 2 : maxRaw;
      const yaRegistrado = dispositivos.some(d => d.id === deviceId);
      if (!yaRegistrado) {
        if (!ilimitado && dispositivos.length >= max) {
          return {
            ok:false,
            error:'Máximo de dispositivos alcanzado (' + max + '). Libera uno desde otro dispositivo o pide al admin.',
            dispositivos_actuales: dispositivos
          };
        }
        dispositivos.push({ id: deviceId, nombre: deviceName || 'dispositivo', fecha: new Date().toISOString() });
        hoja.getRange(i+1, idx.dispositivos + 1).setValue(JSON.stringify(dispositivos));
      }
      const usuario = {
        codigo: codFila,
        nombre: datos[i][idx.nombre],
        rol: datos[i][idx.rol],
        permisos: datos[i][idx.permisos],
        vendedor_asignado: datos[i][idx.vendedor_asignado] || ''
      };
      return {
        ok: true,
        usuario: { codigo: codFila, nombre: usuario.nombre, rol: usuario.rol, vendedor_asignado: usuario.vendedor_asignado },
        permisos: calcularPermisos(usuario)
      };
    }
  }
  return { ok:false, error:'Código no encontrado' };
}

function liberarDispositivo(codigoUsuario, deviceId, codigoAdmin) {
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const prot = _protegido(codigoUsuario, codigoAdmin); if (prot) return { ok:false, error: prot }; // v0.9.10
  const hoja = asegurarHoja('usuarios');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.codigo]).toUpperCase() === String(codigoUsuario).toUpperCase()) {
      let dispositivos = [];
      try { dispositivos = JSON.parse(datos[i][idx.dispositivos] || '[]'); } catch(e) {}
      dispositivos = dispositivos.filter(d => d.id !== deviceId);
      hoja.getRange(i+1, idx.dispositivos + 1).setValue(JSON.stringify(dispositivos));
      return { ok:true };
    }
  }
  return { ok:false, error:'No encontrado' };
}

function validarAdmin(codigo) {
  if (!codigo) return false;
  const c = String(codigo).toUpperCase().trim();
  if (_esMaestro(c)) return true;
  const hoja = asegurarHoja('usuarios');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.codigo]).toUpperCase().trim() === c) {
      const act = datos[i][idx.activo];
      if (act === false || act === 'false' || act === 'FALSE') return false; // v0.9.9 — inactivo no es admin
      const rol = datos[i][idx.rol];
      return rol === 'admin';
    }
  }
  return false;
}

function crearUsuario(datosNuevo, codigoAdmin) {
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const hoja = asegurarHoja('usuarios');
  const codigo = String(datosNuevo.codigo || '').toUpperCase().trim();
  if (!codigo) return { ok:false, error:'Código requerido' };
  if (_esCodigoDueno(codigo) && !_esRafa(codigoAdmin)) return { ok:false, error:'Solo Rafa puede crear códigos que empiezan con RAFA-, YADAH- o MASTER-NUN-' }; // v0.9.10
  // Verificar duplicado
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).toUpperCase() === codigo) return { ok:false, error:'Ya existe ese código' };
  }
  hoja.appendRow([
    codigo,
    datosNuevo.nombre || '',
    datosNuevo.rol || 'cobranza',
    typeof datosNuevo.permisos === 'object' ? JSON.stringify(datosNuevo.permisos) : (datosNuevo.permisos || ''),
    datosNuevo.vendedor_asignado || '',
    '',
    datosNuevo.max_dispositivos || 2,
    true,
    new Date().toISOString(),
    codigoAdmin
  ]);
  try { CacheService.getScriptCache().remove('codigos_activos'); } catch(e) {} // v0.9.9 — el nuevo entra de inmediato
  registrarBitacora(codigoAdmin, 'crear_usuario', 'usuarios', '', datosNuevo.nombre || '');
  return { ok:true };
}

function listarUsuarios(codigoAdmin) {
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const hoja = asegurarHoja('usuarios');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, usuarios: [] };
  const headers = datos[0];
  const usuarios = [];
  const verRafa = _esRafa(codigoAdmin); // v0.9.10 — el usuario de Rafa no le aparece a nadie más
  for (let i = 1; i < datos.length; i++) {
    const o = {};
    headers.forEach((h,j) => { o[h] = datos[i][j]; });
    if (!verRafa && String(o.codigo || '').toUpperCase().trim().indexOf('RAFA-') === 0) continue;
    try { o.dispositivos = JSON.parse(o.dispositivos || '[]'); } catch(e) { o.dispositivos = []; }
    usuarios.push(o);
  }
  return { ok:true, usuarios };
}

// ============================================================
// CRUD GENÉRICO
// ============================================================
// v0.9.12 — LISTAS EN MEMORIA RÁPIDA (CacheService): leer toda la hoja tarda y a veces Google falla; la lista armada se guarda
// en pedazos de 90 KB por 6 horas. Cualquier cambio (crear, guardar, pago, cancelar…) sube la "versión" y todas las listas
// se vuelven a leer de la hoja en la siguiente consulta. Si la memoria falla, se lee la hoja como siempre.
function _listaVer(){ try { return CacheService.getScriptCache().get('L_ver') || '1'; } catch(e){ return '1'; } }
function _listaInvalidar(){ try { CacheService.getScriptCache().put('L_ver', Date.now() + '_' + Math.random().toString(36).slice(2, 8), 21600); } catch(e){} }
// v0.9.12 — si alguien cambia algo directo en la hoja de Google, las listas en memoria se vuelven a leer
function onEdit(e){ _listaInvalidar(); }
function onChange(e){ _listaInvalidar(); }
function _listaCacheGet(tabla){
  try {
    const c = CacheService.getScriptCache(), base = 'L_' + _listaVer() + '_' + tabla, n = +(c.get(base + '_n') || 0);
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push(base + '_' + i);
    const all = c.getAll(keys); let txt = '';
    for (let i = 0; i < n; i++) { const pz = all[base + '_' + i]; if (pz == null) return null; txt += pz; }
    return JSON.parse(txt);
  } catch(e){ return null; }
}
function _listaCachePut(tabla, items){
  try {
    const c = CacheService.getScriptCache(), base = 'L_' + _listaVer() + '_' + tabla, txt = JSON.stringify(items), T = 90000, obj = {};
    const n = Math.ceil(txt.length / T); if (n > 90) return;
    for (let i = 0; i < n; i++) obj[base + '_' + i] = txt.substring(i * T, (i + 1) * T);
    c.putAll(obj, 21600); c.put(base + '_n', String(n), 21600);
  } catch(e){}
}
function erpListar(tabla) {
  const _c = _listaCacheGet(tabla); if (_c) return { ok:true, items:_c, cache:true }; // v0.9.12
  const r = _erpListarHoja(tabla);
  if (r.ok && Array.isArray(r.items)) _listaCachePut(tabla, r.items);
  return r;
}
function _erpListarHoja(tabla) {
  const hoja = asegurarHoja(tabla);
  if (!hoja) return { ok:false, error:'Tabla desconocida' };
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, items: [] };
  const headers = datos[0];
  const items = [];
  for (let i = 1; i < datos.length; i++) {
    const o = {};
    headers.forEach((h,idx) => {
      let v = datos[i][idx];
      if (v instanceof Date) v = v.toISOString();
      o[h] = v;
    });
    items.push(o);
  }
  return { ok:true, items };
}

function objetoAFila(hoja, obj) {
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  return headers.map(h => obj[h] !== undefined && obj[h] !== null ? obj[h] : '');
}

// v0.9.9 — folios NUN que no se pueden repetir (Pedido P0001, Remisión R0001, Factura FT0001, Nota de crédito NC0001)
const PREF_FOLIO_NUN = { pedidos:'P', remisiones:'R', facturas:'FT', notascredito:'NC', cotizaciones:'C' }; // v0.9.15 cotizaciones C0001
function _folioNUNLibre(hoja, tabla, item) {
  const pref = PREF_FOLIO_NUN[tabla];
  const folio = String(item.folio || '').trim();
  // v0.9.11 — sin folio o con folio del servidor viejo (REM-2026-0001, PED-…, FAC-…, NC-…): se le da el siguiente folio NUN (R0001…)
  const viejo = !folio || /^(COT|PED|REM|FAC|NC|DOC)-\d{4}-\d+$/i.test(folio);
  if (!pref || (!viejo && !new RegExp('^' + pref + '\\d{4,}$').test(folio))) return folio;
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const iF = headers.indexOf('folio'), iId = headers.indexOf('id');
  if (iF < 0) return folio;
  const re = new RegExp('^' + pref + '(\\d{4,})$');
  let max = 0, repetido = false;
  for (let i = 1; i < datos.length; i++) {
    const f = String(datos[i][iF] || '').trim();
    const m = f.match(re); if (m) max = Math.max(max, parseInt(m[1], 10));
    if (f === folio && String(datos[i][iId]) !== String(item.id || '')) repetido = true;
  }
  return (repetido || viejo) ? pref + String(max + 1).padStart(4, '0') : folio;
}

function erpCrear(tabla, item) {
  const hoja = asegurarHoja(tabla);
  if (!hoja) return { ok:false, error:'Tabla desconocida' };
  if (!item.id) {
    item.id = tabla.substring(0,3) + '_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6);
  }
  if (!item.fecha_alta && TABLAS[tabla].cols.indexOf('fecha_alta') >= 0) {
    item.fecha_alta = new Date().toISOString().substring(0,10);
  }
  if (item.activo === undefined && TABLAS[tabla].cols.indexOf('activo') >= 0) item.activo = true;
  if (!PREF_FOLIO_NUN[tabla]) { // tablas sin folio NUN: igual que antes
    hoja.appendRow(objetoAFila(hoja, item));
    SpreadsheetApp.flush();
    return { ok:true, item };
  }
  // v0.9.9 — pedidos/remisiones/facturas/notas: con candado, el folio NUN se revisa y se escribe sin que otro guardado se meta en medio
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) { return { ok:false, error:'Sistema ocupado, reintenta' }; }
  try {
    // si el id ya existe (reintento), no se duplica
    const datos = hoja.getDataRange().getValues();
    const iId = datos[0].indexOf('id');
    if (iId >= 0) for (let i = 1; i < datos.length; i++) if (String(datos[i][iId]) === String(item.id)) return { ok:true, item, ya_existia:true };
    const folioOriginal = item.folio;
    item.folio = _folioNUNLibre(hoja, tabla, item);
    hoja.appendRow(objetoAFila(hoja, item));
    SpreadsheetApp.flush();
    return item.folio !== folioOriginal ? { ok:true, item, folio_cambiado:true, folio_anterior: folioOriginal } : { ok:true, item };
  } finally { lock.releaseLock(); }
}

// ============================================================
// v0.9.9 — BIND APAGADO: ya no se usa desde el 29-sep-2026.
// Las funciones se quedan para historial pero no hacen nada.
// ============================================================
function syncBindGuardarKey(apiKey) { return { ok:false, error:'Bind ya no se usa' }; }
function syncBindEstado() { return { ok:true, apagado:true, triggerActivo: ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sincronizarBindAutomatico') }; }
function syncBindSetupTrigger(minutos) { apagarSyncBind(); return { ok:true, msg:'Bind ya no se usa: sincronización automática apagada' }; }
// Borra el activador automático de Bind (se puede correr a mano desde el editor: Ejecutar → apagarSyncBind)
function apagarSyncBind() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sincronizarBindAutomatico') { ScriptApp.deleteTrigger(t); n++; } });
  return { ok:true, activadores_borrados:n };
}
// Si el activador viejo llega a correr, se apaga solo y no toca nada
function sincronizarBindAutomatico() { return apagarSyncBind(); }

// UPSERT: actualiza si existe, inserta si no
function erpUpsert(tabla, items) {
  if (!items.length) return { insertados:0, actualizados:0 };
  const hoja = asegurarHoja(tabla);
  if (!hoja) return { error:'tabla desconocida' };
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const idxId = headers.indexOf('id');
  if (idxId < 0) return { error:'columna id no existe' };
  const lastRow = hoja.getLastRow();
  const idsExistentes = {};
  if (lastRow > 1) {
    const idsCol = hoja.getRange(2, idxId+1, lastRow-1, 1).getValues();
    for (let i = 0; i < idsCol.length; i++) {
      if (idsCol[i][0]) idsExistentes[idsCol[i][0]] = i + 2; // fila real
    }
  }
  const filasNuevas = [];
  let actualizados = 0;
  for (const it of items) {
    if (!it.id) continue;
    if (idsExistentes[it.id]) {
      // Update fila existente
      const fila = headers.map(h => it[h] !== undefined && it[h] !== null ? it[h] : '');
      hoja.getRange(idsExistentes[it.id], 1, 1, headers.length).setValues([fila]);
      actualizados++;
    } else {
      filasNuevas.push(headers.map(h => it[h] !== undefined && it[h] !== null ? it[h] : ''));
    }
  }
  if (filasNuevas.length > 0) {
    const startRow = hoja.getLastRow() + 1;
    hoja.getRange(startRow, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
  }
  SpreadsheetApp.flush();
  return { insertados: filasNuevas.length, actualizados };
}

// v0.9.9 — desactivado: por regla no se borran datos
function erpBorrarPorPrefijo(prefijo) {
  return { ok:false, error:'Por regla del sistema no se borran datos (se marcan como cancelados o duplicados).' };
}

// v3.7.9 — Bulk: guarda muchos items de la misma tabla en una sola escritura
function erpBulkCrear(tabla, items) {
  const hoja = asegurarHoja(tabla);
  if (!hoja) return { ok:false, error:'Tabla desconocida' };
  if (!items || !items.length) return { ok:true, insertados:0 };

  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const colId = TABLAS[tabla].cols.indexOf('id') >= 0;
  const colFechaAlta = TABLAS[tabla].cols.indexOf('fecha_alta') >= 0;
  const colActivo = TABLAS[tabla].cols.indexOf('activo') >= 0;
  const hoy = new Date().toISOString().substring(0,10);

  // Leer ids existentes para evitar duplicados
  const lastRow = hoja.getLastRow();
  const idsExistentes = {};
  if (lastRow > 1 && colId) {
    const idxId = headers.indexOf('id');
    if (idxId >= 0) {
      const idsCol = hoja.getRange(2, idxId+1, lastRow-1, 1).getValues();
      for (let i = 0; i < idsCol.length; i++) {
        if (idsCol[i][0]) idsExistentes[idsCol[i][0]] = true;
      }
    }
  }

  const filasNuevas = [];
  let omitidos = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.id) it.id = tabla.substring(0,3) + '_' + new Date().getTime() + '_' + i + '_' + Math.random().toString(36).substring(2,6);
    if (idsExistentes[it.id]) { omitidos++; continue; }
    if (colFechaAlta && !it.fecha_alta) it.fecha_alta = hoy;
    if (colActivo && it.activo === undefined) it.activo = true;
    filasNuevas.push(headers.map(h => it[h] !== undefined && it[h] !== null ? it[h] : ''));
  }

  if (filasNuevas.length > 0) {
    const startRow = hoja.getLastRow() + 1;
    hoja.getRange(startRow, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
    SpreadsheetApp.flush();
  }
  return { ok:true, insertados: filasNuevas.length, omitidos: omitidos };
}

function erpActualizar(tabla, item) {
  const hoja = asegurarHoja(tabla);
  if (!hoja || !item.id) return { ok:false, error:'Tabla o id inválido' };
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idxId = headers.indexOf('id');
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idxId] === item.id) {
      const fila = headers.map(h => item[h] !== undefined ? item[h] : datos[i][headers.indexOf(h)]);
      hoja.getRange(i+1, 1, 1, headers.length).setValues([fila]);
      SpreadsheetApp.flush();
      return { ok:true, item };
    }
  }
  return { ok:false, error:'No encontrado' };
}

// v0.9.9 — NUNCA borra: marca el renglón como cancelado (estatus) o inactivo (activo=false).
// Ingresos: tipo CANCELADO (no cuenta en sumas). Si la tabla no tiene cómo marcarse, no hace nada.
function erpEliminar(tabla, id) {
  const hoja = asegurarHoja(tabla);
  if (!hoja || !id) return { ok:false, error:'Tabla o id inválido' };
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idxId = headers.indexOf('id');
  const iEst = headers.indexOf('estatus'), iAct = headers.indexOf('activo'), iTipo = headers.indexOf('tipo');
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idxId] === id) {
      if (tabla === 'ingresos' && iTipo >= 0) hoja.getRange(i+1, iTipo+1).setValue('CANCELADO');
      else if (iEst >= 0) hoja.getRange(i+1, iEst+1).setValue(/^(remisiones|facturas|notascredito)$/.test(tabla) ? 'cancelada' : 'cancelado');
      else if (iAct >= 0) hoja.getRange(i+1, iAct+1).setValue(false);
      else return { ok:false, error:'Por regla del sistema no se borran datos y esta tabla no tiene cómo marcarse como cancelada' };
      if (tabla === 'cobranza' && headers.indexOf('pendiente') >= 0 && !(parseFloat(datos[i][headers.indexOf('cobrado')]) > 0)) hoja.getRange(i+1, headers.indexOf('pendiente')+1).setValue(0);
      SpreadsheetApp.flush();
      return { ok:true, marcado:true };
    }
  }
  return { ok:false, error:'No encontrado' };
}

// ============================================================
// v0.7.0 — KV STORE: estado compartido multi-usuario
// ============================================================
function kvLeerTodo() {
  const hoja = asegurarHoja('kvstore');
  const lastRow = hoja.getLastRow();
  const out = {};
  if (lastRow < 2) return out;
  const datos = hoja.getRange(2, 1, lastRow - 1, 3).getValues(); // clave, parte, valor
  const partes = {};
  datos.forEach(function(f) {
    const clave = String(f[0] || ''); if (!clave) return;
    if (!partes[clave]) partes[clave] = [];
    partes[clave][parseInt(f[1]) || 0] = String(f[2] || '');
  });
  Object.keys(partes).forEach(function(k) { out[k] = partes[k].join(''); });
  return out;
}

function kvGuardar(pares, usuario) {
  const claves = Object.keys(pares || {});
  if (!claves.length) return { ok:true, guardadas:0 };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return { ok:false, error:'Sistema ocupado, reintenta' }; }
  try {
    const hoja = asegurarHoja('kvstore');
    const lastRow = hoja.getLastRow();
    const datos = lastRow > 1 ? hoja.getRange(2, 1, lastRow - 1, 5).getValues() : [];
    // conservar filas de claves que NO se están actualizando
    const conservar = datos.filter(function(f) { return claves.indexOf(String(f[0] || '')) < 0 && String(f[0] || ''); });
    const ahora = new Date().toISOString();
    const CHUNK = 45000;
    claves.forEach(function(k) {
      const v = String(pares[k] == null ? '' : pares[k]);
      const nChunks = Math.max(1, Math.ceil(v.length / CHUNK));
      for (let i = 0; i < nChunks; i++) {
        conservar.push([k, i, v.substring(i * CHUNK, (i + 1) * CHUNK), ahora, usuario || '']);
      }
    });
    if (lastRow > 1) hoja.getRange(2, 1, lastRow - 1, 5).clearContent();
    if (conservar.length) hoja.getRange(2, 1, conservar.length, 5).setValues(conservar);
    SpreadsheetApp.flush();
    return { ok:true, guardadas: claves.length };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// v0.8.0 — CFDI XML: almacén de XMLs timbrados en el backend
// ============================================================
const CFDI_CHUNK = 45000;
function cfdiXmlGuardar(docs){
  // docs: [{uuid, xml, fecha, total, cliente, tipo}]
  if (!docs || !docs.length) return { ok:true, guardados:0 };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e){ return { ok:false, error:'Sistema ocupado, reintenta' }; }
  try {
    const hoja = asegurarHoja('cfdixml');
    const lastRow = hoja.getLastRow();
    const existentes = lastRow > 1 ? hoja.getRange(2,1,lastRow-1,7).getValues() : [];
    const nuevosUuids = {}; docs.forEach(d => nuevosUuids[String(d.uuid)] = true);
    // conservar filas de uuids que NO se actualizan
    const conservar = existentes.filter(f => !nuevosUuids[String(f[0]||'')] && String(f[0]||''));
    docs.forEach(d => {
      const xml = String(d.xml||'');
      const n = Math.max(1, Math.ceil(xml.length / CFDI_CHUNK));
      for (let i=0;i<n;i++){
        conservar.push([d.uuid, i, xml.substring(i*CFDI_CHUNK,(i+1)*CFDI_CHUNK), d.fecha||'', d.total||'', d.cliente||'', d.tipo||'']);
      }
    });
    if (lastRow > 1) hoja.getRange(2,1,lastRow-1,7).clearContent();
    if (conservar.length) hoja.getRange(2,1,conservar.length,7).setValues(conservar);
    SpreadsheetApp.flush();
    return { ok:true, guardados: docs.length };
  } finally { lock.releaseLock(); }
}
function cfdiXmlGet(uuid){
  const hoja = asegurarHoja('cfdixml');
  const lastRow = hoja.getLastRow();
  if (lastRow < 2) return { ok:false, error:'No encontrado' };
  const datos = hoja.getRange(2,1,lastRow-1,3).getValues(); // uuid, parte, xml
  const partes = [];
  datos.forEach(f => { if (String(f[0]) === String(uuid)) partes[parseInt(f[1])||0] = String(f[2]||''); });
  if (!partes.length) return { ok:false, error:'No encontrado' };
  return { ok:true, uuid: uuid, xml: partes.join('') };
}
function cfdiXmlUuids(){
  const hoja = asegurarHoja('cfdixml');
  const lastRow = hoja.getLastRow();
  if (lastRow < 2) return { ok:true, uuids: [] };
  const datos = hoja.getRange(2,1,lastRow-1,1).getValues();
  const set = {}; datos.forEach(f => { if (String(f[0]||'')) set[String(f[0])] = true; });
  return { ok:true, uuids: Object.keys(set) };
}

// ============================================================
// v0.9.0 — FACTURAMA: timbrado directo (PAC). Credenciales en
// PropertiesService (NUNCA viajan al navegador).
// ============================================================
function facturamaBaseUrl(){
  const modo = PropertiesService.getScriptProperties().getProperty('fact_modo') || 'sandbox';
  return modo === 'produccion' ? 'https://api.facturama.mx' : 'https://apisandbox.facturama.mx';
}
function facturamaAuthHeader(){
  const p = PropertiesService.getScriptProperties();
  const u = p.getProperty('fact_usuario'), pw = p.getProperty('fact_password');
  if (!u || !pw) return null;
  return 'Basic ' + Utilities.base64Encode(u + ':' + pw);
}
function facturamaGuardarCredenciales(usuario, password, modo, codigoAdmin){
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const p = PropertiesService.getScriptProperties();
  if (usuario) p.setProperty('fact_usuario', usuario);
  if (password) p.setProperty('fact_password', password);
  p.setProperty('fact_modo', (modo === 'produccion') ? 'produccion' : 'sandbox');
  return { ok:true, modo: p.getProperty('fact_modo'), tiene_credenciales: !!(p.getProperty('fact_usuario') && p.getProperty('fact_password')) };
}
function facturamaEstado(){
  const p = PropertiesService.getScriptProperties();
  return { ok:true, modo: p.getProperty('fact_modo') || 'sandbox', tiene_credenciales: !!(p.getProperty('fact_usuario') && p.getProperty('fact_password')) };
}
// Timbrar un CFDI. cfdi = objeto en formato Facturama (Receiver, Items, etc.)
function facturamaTimbrar(cfdi){
  const auth = facturamaAuthHeader();
  if (!auth) return { ok:false, error:'Sin credenciales de Facturama. Configúralas en el ERP.' };
  try {
    const resp = UrlFetchApp.fetch(facturamaBaseUrl() + '/3/cfdis', {
      method:'post', contentType:'application/json',
      headers:{ Authorization: auth },
      payload: JSON.stringify(cfdi), muteHttpExceptions:true
    });
    const code = resp.getResponseCode();
    const txt = resp.getContentText();
    if (code >= 200 && code < 300){
      const data = JSON.parse(txt);
      const id = data.Id;
      // Descargar el XML timbrado
      let xml = '';
      try {
        const rx = UrlFetchApp.fetch(facturamaBaseUrl() + '/cfdi/xml/issued/' + id, { headers:{ Authorization: auth }, muteHttpExceptions:true });
        if (rx.getResponseCode() === 200){ const j = JSON.parse(rx.getContentText()); xml = Utilities.newBlob(Utilities.base64Decode(j.Content)).getDataAsString(); }
      } catch(e){}
      return { ok:true, id:id, uuid: data.Complement && data.Complement.TaxStamp ? data.Complement.TaxStamp.Uuid : (data.Uuid||''), folio: data.Folio||'', total: data.Total||0, xml:xml, raw:data };
    }
    return { ok:false, error:'Facturama ('+code+'): ' + txt.substring(0,500) };
  } catch(e){ return { ok:false, error:'Error al timbrar: ' + e.message }; }
}
// Cancelar un CFDI timbrado
function facturamaCancelar(id, motivo){
  const auth = facturamaAuthHeader();
  if (!auth) return { ok:false, error:'Sin credenciales' };
  try {
    const url = facturamaBaseUrl() + '/cfdi/' + id + (motivo ? '?motive=' + encodeURIComponent(motivo) : '');
    const resp = UrlFetchApp.fetch(url, { method:'delete', headers:{ Authorization: auth }, muteHttpExceptions:true });
    return (resp.getResponseCode() < 300) ? { ok:true } : { ok:false, error: resp.getContentText().substring(0,400) };
  } catch(e){ return { ok:false, error:e.message }; }
}

// ============================================================
// v0.7.0 — VALIDACIÓN DE SESIÓN (auth para acciones de datos)
// ============================================================
function validarSesion(codigo) {
  const c = String(codigo || '').toUpperCase().trim();
  if (!c) return { ok:false, error:'Sin código de usuario' };
  if (_esMaestro(c)) return { ok:true };
  // Cache 2 min para no leer la hoja de usuarios en cada request
  const cache = CacheService.getScriptCache();
  let codigos = null;
  try { codigos = JSON.parse(cache.get('codigos_activos') || 'null'); } catch(e) {}
  if (!codigos) {
    const hoja = asegurarHoja('usuarios');
    const datos = hoja.getDataRange().getValues();
    const headers = datos[0];
    const idxCod = headers.indexOf('codigo');
    const idxAct = headers.indexOf('activo');
    codigos = [];
    for (let i = 1; i < datos.length; i++) {
      const act = datos[i][idxAct];
      if (act === false || act === 'false' || act === 'FALSE') continue;
      const cod = String(datos[i][idxCod] || '').toUpperCase().trim();
      if (cod) codigos.push(cod);
    }
    try { cache.put('codigos_activos', JSON.stringify(codigos), 120); } catch(e) {}
  }
  if (codigos.indexOf(c) >= 0) return { ok:true };
  return { ok:false, error:'Código de usuario inválido o inactivo' };
}

function erpImportarBulk(tabla, items) {
  const hoja = asegurarHoja(tabla);
  if (!hoja) return { ok:false, error:'Tabla desconocida' };
  if (!Array.isArray(items) || items.length === 0) return { ok:false, error:'Sin items' };
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const filas = items.map(it => {
    if (!it.id) it.id = tabla.substring(0,3) + '_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6);
    if (!it.fecha_alta && headers.indexOf('fecha_alta') >= 0) it.fecha_alta = new Date().toISOString().substring(0,10);
    if (it.activo === undefined && headers.indexOf('activo') >= 0) it.activo = true;
    return headers.map(h => it[h] !== undefined && it[h] !== null ? it[h] : '');
  });
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, headers.length).setValues(filas);
  SpreadsheetApp.flush();
  return { ok:true, cantidad: filas.length };
}

// ============================================================
// INVENTARIO
// ============================================================
function registrarMovInventario(payload) {
  const cantidad = parseFloat(payload.cantidad) || 0;
  if (cantidad === 0) return { ok:false, error:'Cantidad debe ser distinta de 0' };
  if (!payload.sku) return { ok:false, error:'SKU requerido' };
  const tipo = (payload.tipo || '').toLowerCase();
  if (['entrada','salida','ajuste'].indexOf(tipo) < 0) return { ok:false, error:'Tipo inválido' };

  const mov = {
    id: 'mov_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6),
    fecha: payload.fecha || new Date().toISOString().substring(0,10),
    sku: payload.sku,
    tipo: tipo,
    cantidad: cantidad,
    costo_unitario: parseFloat(payload.costo_unitario) || 0,
    referencia: payload.referencia || '',
    ref_id: payload.ref_id || '',
    motivo: payload.motivo || '',
    usuario: _quien(payload.usuario), // v0.9.15
    notas: payload.notas || '',
    almacen: payload.almacen || 'Matriz'
  };
  const r = erpCrear('movinventario', mov);
  if (!r.ok) return r;

  // Actualizar stock_actual del producto
  const hojaProd = asegurarHoja('productos');
  const datosProd = hojaProd.getDataRange().getValues();
  const headersProd = datosProd[0];
  const idxSku = headersProd.indexOf('sku');
  const idxStock = headersProd.indexOf('stock_actual');
  let stockActualizado = false;
  for (let i = 1; i < datosProd.length; i++) {
    if (String(datosProd[i][idxSku]).trim() === String(payload.sku).trim()) {
      let s = parseFloat(datosProd[i][idxStock]) || 0;
      let nuevo;
      if (tipo === 'entrada') nuevo = s + cantidad;
      else if (tipo === 'salida') nuevo = s - cantidad;
      else nuevo = cantidad; // ajuste = nuevo stock absoluto
      hojaProd.getRange(i+1, idxStock + 1).setValue(nuevo);
      stockActualizado = true;
      break;
    }
  }
  SpreadsheetApp.flush();
  return { ok:true, mov, stockActualizado };
}

function listarMovimientosSku(sku) {
  const hoja = asegurarHoja('movinventario');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, items: [] };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const items = [];
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.sku]).trim() === String(sku).trim()) {
      const o = {};
      headers.forEach((h,j) => {
        let v = datos[i][j];
        if (v instanceof Date) v = v.toISOString();
        o[h] = v;
      });
      items.push(o);
    }
  }
  return { ok:true, items: items.reverse() };
}

// ============================================================
// CUENTAS y VENDEDORES (helpers)
// ============================================================
function obtenerCuentas() {
  const hoja = asegurarHoja('cuentas');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  return datos.slice(1).map(r => ({ nombre: r[0], tipo: r[1], activa: r[2] !== false && r[2] !== 'false', notas: r[3] }));
}
function guardarCuentas(cuentas) {
  const hoja = asegurarHoja('cuentas');
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila > 1) hoja.deleteRows(2, ultimaFila - 1);
  if (!cuentas || cuentas.length === 0) return;
  const filas = cuentas.map(c => [c.nombre, c.tipo || '', c.activa !== false, c.notas || '']);
  hoja.getRange(2, 1, filas.length, 4).setValues(filas);
}
function obtenerVendedores() {
  const hoja = asegurarHoja('vendedores');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  return datos.slice(1).map(r => ({ nombre: String(r[0]).toUpperCase(), activo: r[1] !== false && r[1] !== 'false' }));
}
function guardarVendedores(vendedores) {
  const hoja = asegurarHoja('vendedores');
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila > 1) hoja.deleteRows(2, ultimaFila - 1);
  if (!vendedores || vendedores.length === 0) return;
  const filas = vendedores.map(v => [v.nombre.toUpperCase(), v.activo !== false]);
  hoja.getRange(2, 1, filas.length, 2).setValues(filas);
}

// ============================================================
// CAPTURA DE PAGO A FACTURA (cobra y baja a Ingresos)
// ============================================================
function capturarPagoCliente(payload) {
  const monto = parseFloat(payload.monto) || 0;
  if (monto <= 0) return { ok:false, error:'Monto inválido' };
  if (!payload.id_doc) return { ok:false, error:'Documento requerido' };

  // v0.9.9 — con candado: dos pagos al mismo tiempo no se pisan el "cobrado"
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) { return { ok:false, error:'Sistema ocupado, reintenta' }; }
  try {
  const hojaCob = asegurarHoja('cobranza');
  const datos = hojaCob.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);

  let fila = -1, doc = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === payload.id_doc) {
      fila = i + 1;
      doc = {};
      headers.forEach((h,j) => doc[h] = datos[i][j]);
      break;
    }
  }
  if (fila < 0) return { ok:false, error:'Documento no encontrado en Cobranza' };
  if (/^cancelad/i.test(String(doc.estatus || ''))) return { ok:false, error:'Ese documento está cancelado' }; // v0.9.9

  const cobrado = parseFloat(doc.cobrado) || 0;
  const total = parseFloat(doc.total) || 0;
  const saldo = total - cobrado;
  if (monto > saldo + 0.01) return { ok:false, error:'Monto mayor al saldo pendiente ($' + saldo.toFixed(2) + ')' };

  const nuevoCobrado = cobrado + monto;
  const nuevoPendiente = Math.max(0, total - nuevoCobrado);
  hojaCob.getRange(fila, idx.cobrado + 1).setValue(nuevoCobrado);
  hojaCob.getRange(fila, idx.pendiente + 1).setValue(nuevoPendiente);

  // Crear ingreso
  const ingresoId = 'ing_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6);
  const ingreso = {
    id: ingresoId,
    fecha: payload.fecha || new Date().toISOString().substring(0,10),
    cliente: doc.cliente,
    factura: doc.numero || '',
    cuenta: payload.cuenta || 'Efectivo',
    tipo: 'cobro',
    monto: monto,
    comentarios: 'Pago de ' + (doc.tipo || 'documento') + ' ' + (doc.numero || '') + (payload.notas ? ' · ' + payload.notas : ''),
    registrado_por: payload.usuario || ''
  };
  erpCrear('ingresos', ingreso);

  // Bitácora de pago
  const hojaPag = asegurarHoja('pagosclientes');
  hojaPag.appendRow([
    new Date().toISOString(),
    payload.id_doc,
    doc.cliente,
    monto,
    ingreso.fecha,
    payload.cuenta || 'Efectivo',
    payload.notas || '',
    payload.usuario || '',
    payload.codigo_usuario || '',
    ingresoId
  ]);

  SpreadsheetApp.flush();
  return { ok:true, nuevoCobrado, nuevoPendiente };
  } finally { lock.releaseLock(); }
}

// ============================================================
// FOLIO AUTOMÁTICO — consume y devuelve el siguiente folio
// ============================================================
function siguienteFolio(tipoDocumento, serie) {
  const hoja = asegurarHoja('seriesfolios');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const año = new Date().getFullYear();
  serie = serie || año;

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.tipo_documento]).toLowerCase() === String(tipoDocumento).toLowerCase()
        && String(datos[i][idx.serie]) === String(serie)
        && datos[i][idx.activa] !== false) {
      const folio = parseInt(datos[i][idx.folio_actual]) || 0;
      const siguiente = folio + 1;
      hoja.getRange(i+1, idx.folio_actual + 1).setValue(siguiente);
      const prefijo = datos[i][idx.prefijo] || '';
      const sufijo  = datos[i][idx.sufijo]  || '';
      SpreadsheetApp.flush();
      return { ok:true, folio: prefijo + String(siguiente).padStart(4, '0') + sufijo, numero: siguiente };
    }
  }
  // No existe, crearla
  const prefijoDefault = {
    cotizacion:'COT-', pedido:'PED-', factura:'FAC-', remision:'REM-',
    ordencompra:'OC-', recepcion:'REC-', notacredito:'NC-'
  }[tipoDocumento.toLowerCase()] || 'DOC-';
  const id = 'srl_' + new Date().getTime();
  hoja.appendRow([id, tipoDocumento, serie, 1, prefijoDefault + año + '-', '', true, 'auto-creada']);
  SpreadsheetApp.flush();
  return { ok:true, folio: prefijoDefault + año + '-' + '0001', numero: 1 };
}

// ============================================================
// BITÁCORA / AUDIT LOG
// ============================================================
// v0.9.15 — nunca guardar un código de acceso completo en bitácora ni inventario (cualquiera con usuario puede leer esas hojas)
function _quien(u) { const s = String(u || '').trim(); const m = s.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)-[A-Za-z0-9-]{2,}$/); return m ? m[1].toUpperCase() + '-…' : s; }
function registrarBitacora(usuario, accion, tabla, registroId, detalle) {
  try {
    const hoja = asegurarHoja('bitacora');
    hoja.appendRow([new Date().toISOString(), _quien(usuario), accion || '', tabla || '', registroId || '', detalle || '']);
  } catch(e) { /* no rompe si falla la bitácora */ }
}

function listarBitacora(filtros, codigoAdmin) {
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const hoja = asegurarHoja('bitacora');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, items: [] };
  const headers = datos[0];
  const items = [];
  for (let i = Math.max(1, datos.length - 500); i < datos.length; i++) {
    const o = {};
    headers.forEach((h,j) => {
      let v = datos[i][j];
      if (v instanceof Date) v = v.toISOString();
      o[h] = v;
    });
    items.push(o);
  }
  return { ok:true, items: items.reverse() };
}

// ============================================================
// USUARIOS — gestión completa
// ============================================================
function actualizarUsuario(codigoTarget, cambios, codigoAdmin) {
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const prot = _protegido(codigoTarget, codigoAdmin); if (prot) return { ok:false, error: prot }; // v0.9.10
  const hoja = asegurarHoja('usuarios');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  // v0.9.9 — no se puede desactivar al último administrador activo (para no quedarse fuera)
  if (cambios.activo === false || cambios.activo === 'false') {
    const t = String(codigoTarget).toUpperCase().trim();
    let otrosAdmins = 0;
    for (let i = 1; i < datos.length; i++) {
      const cod = String(datos[i][idx.codigo]).toUpperCase().trim(), act = datos[i][idx.activo];
      if (cod !== t && datos[i][idx.rol] === 'admin' && !(act === false || act === 'false' || act === 'FALSE')) otrosAdmins++;
    }
    if (!otrosAdmins) return { ok:false, error:'No se puede desactivar al único administrador activo' };
  }
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.codigo]).toUpperCase() === String(codigoTarget).toUpperCase()) {
      if (cambios.nombre !== undefined)             hoja.getRange(i+1, idx.nombre+1).setValue(cambios.nombre);
      if (cambios.rol !== undefined)                hoja.getRange(i+1, idx.rol+1).setValue(cambios.rol);
      if (cambios.permisos !== undefined)           hoja.getRange(i+1, idx.permisos+1).setValue(typeof cambios.permisos === 'object' ? JSON.stringify(cambios.permisos) : cambios.permisos);
      if (cambios.vendedor_asignado !== undefined)  hoja.getRange(i+1, idx.vendedor_asignado+1).setValue(cambios.vendedor_asignado);
      if (cambios.max_dispositivos !== undefined)   hoja.getRange(i+1, idx.max_dispositivos+1).setValue(cambios.max_dispositivos);
      if (cambios.activo !== undefined)             hoja.getRange(i+1, idx.activo+1).setValue(cambios.activo);
      // v0.9.9 — la bitácora ya no guarda permisos completos ni códigos
      registrarBitacora(codigoAdmin, 'actualizar_usuario', 'usuarios', String(datos[i][idx.nombre] || ''), Object.keys(cambios).join(','));
      try { CacheService.getScriptCache().remove('codigos_activos'); } catch(e) {} // v0.9.9 — se aplica de inmediato
      SpreadsheetApp.flush();
      return { ok:true };
    }
  }
  return { ok:false, error:'Usuario no encontrado' };
}

// v0.9.9 — ya no se borra: se DESACTIVA (pierde el acceso, su historial se conserva)
function eliminarUsuario(codigoTarget, codigoAdmin) {
  return actualizarUsuario(codigoTarget, { activo:false }, codigoAdmin);
}

// ============================================================
// EMPRESA CONFIG (clave-valor)
// ============================================================
function obtenerEmpresaConfig() {
  const hoja = asegurarHoja('empresa');
  const datos = hoja.getDataRange().getValues();
  const obj = {};
  for (let i = 1; i < datos.length; i++) {
    obj[datos[i][0]] = datos[i][1];
  }
  return obj;
}
function guardarEmpresaConfig(config, codigoAdmin) {
  if (!validarAdmin(codigoAdmin)) return { ok:false, error:'No autorizado' };
  const hoja = asegurarHoja('empresa');
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila > 1) hoja.deleteRows(2, ultimaFila - 1);
  const filas = Object.entries(config).map(([k,v]) => [k, v]);
  if (filas.length > 0) hoja.getRange(2, 1, filas.length, 2).setValues(filas);
  registrarBitacora(codigoAdmin, 'guardar_empresa_config', 'empresa', '', Object.keys(config).join(','));
  SpreadsheetApp.flush();
  return { ok:true };
}

// ============================================================
// v0.3.0 — CONVERSIONES ENTRE DOCUMENTOS
// ============================================================
// Mapas de qué se puede convertir en qué y campos a copiar
const REGLAS_CONVERSION = {
  'cotizaciones->pedidos':   { campoOrigen:'cotizacion_origen', tipoFolio:'pedido',      estatusOrigen:'convertida', estatusDestino:'borrador'   },
  'pedidos->remisiones':     { campoOrigen:'pedido_origen',     tipoFolio:'remision',    estatusOrigen:'en_produccion', estatusDestino:'borrador' },
  'pedidos->facturas':       { campoOrigen:'pedido_origen',     tipoFolio:'factura',     estatusOrigen:'facturado', estatusDestino:'borrador'    },
  'remisiones->facturas':    { campoOrigen:'remision_origen',   tipoFolio:'factura',     estatusOrigen:'facturada', estatusDestino:'borrador'    }
};

function convertirDocumento(tablaOrigen, idOrigen, tablaDestino, usuario) {
  const clave = tablaOrigen + '->' + tablaDestino;
  const regla = REGLAS_CONVERSION[clave];
  if (!regla) return { ok:false, error:'Conversión no permitida: ' + clave };

  const ssOrigen = asegurarHoja(tablaOrigen);
  const datos = ssOrigen.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let filaOrigen = -1, docOrigen = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idOrigen) {
      filaOrigen = i + 1;
      docOrigen = {};
      headers.forEach((h,j) => { let v = datos[i][j]; if (v instanceof Date) v = v.toISOString(); docOrigen[h] = v; });
      break;
    }
  }
  if (!docOrigen) return { ok:false, error:'Documento origen no encontrado' };
  if (/^cancelad/i.test(String(docOrigen.estatus || ''))) return { ok:false, error:'El documento de origen está cancelado' }; // v0.9.9

  // Generar folio nuevo — v0.9.11: pedidos/remisiones/facturas/notas llevan folio NUN (lo pone erpCrear); ya no REM-2026-0001
  const folioRes = PREF_FOLIO_NUN[tablaDestino] ? { folio:'' } : siguienteFolio(regla.tipoFolio, new Date().getFullYear());

  // Construir el nuevo documento copiando campos relevantes
  const nuevo = {
    folio: folioRes.folio,
    fecha: new Date().toISOString().substring(0,10),
    cliente: docOrigen.cliente,
    proveedor: docOrigen.proveedor,
    vendedor: docOrigen.vendedor,
    subtotal: docOrigen.subtotal,
    iva: docOrigen.iva,
    total: docOrigen.total,
    sin_iva: docOrigen.sin_iva, // v0.9.9
    estatus: regla.estatusDestino,
    items_json: docOrigen.items_json,
    notas: 'Generado desde ' + tablaOrigen + ' folio ' + (docOrigen.folio || idOrigen),
    creado_por: usuario || ''
  };
  // Campo de origen específico
  nuevo[regla.campoOrigen] = docOrigen.folio || idOrigen;
  if (tablaDestino === 'remisiones') {
    nuevo.fecha_entrega = docOrigen.fecha_entrega || new Date().toISOString().substring(0,10);
    nuevo.sin_entregar = false;
  }
  if (tablaDestino === 'facturas') {
    nuevo.metodo_pago = docOrigen.metodo_pago || '';
    nuevo.forma_pago  = docOrigen.forma_pago  || '';
    nuevo.uso_cfdi    = docOrigen.uso_cfdi    || '';
  }

  const r = erpCrear(tablaDestino, nuevo);
  if (!r.ok) return r;

  // Marcar origen como convertido / siguiente paso
  ssOrigen.getRange(filaOrigen, idx.estatus + 1).setValue(regla.estatusOrigen);

  // Efectos colaterales:
  // - Remisión: descarga inventario y libera lo apartado por el pedido (v0.9.9)
  // - Factura: genera fila en Cobranza
  let cobranzaCreada = null;
  let inventarioAfectado = false;
  if (tablaDestino === 'remisiones') {
    inventarioAfectado = aplicarInventarioDocumento(r.item.id, tablaDestino, 'salida', usuario).afectado;
    if (tablaOrigen === 'pedidos') { try { _ajustarComprometido(_itemsDeDoc('pedidos', idOrigen), -1); } catch(e) {} }
  }
  if (tablaDestino === 'facturas') {
    // v0.9.15 — si el pedido ya es venta (tiene su cobro), la factura se cobra ahí: no se crea otro cobro
    const _cp = tablaOrigen === 'pedidos' ? _cobroPropioPedido(idOrigen) : null;
    if (_cp) _anotar('facturas', r.item.id, 'Cobro en ' + (_cp.numero || '') + ' (id ' + _cp.id + ')');
    else cobranzaCreada = generarCobranzaDesdeFactura(r.item, usuario);
  }

  registrarBitacora(usuario, 'convertir', tablaOrigen + '->' + tablaDestino, idOrigen, r.item.id);
  SpreadsheetApp.flush();
  return { ok:true, nuevoId: r.item.id, folio: r.item.folio, cobranzaCreada, inventarioAfectado }; // v0.9.11 el folio NUN que quedó
}

// ============================================================
// AFECTACIÓN DE INVENTARIO desde un documento
// ============================================================
function aplicarInventarioDocumento(idDoc, tabla, tipoMov, usuario) {
  const hoja = asegurarHoja(tabla);
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let doc = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idDoc) {
      doc = {};
      headers.forEach((h,j) => doc[h] = datos[i][j]);
      break;
    }
  }
  if (!doc) return { afectado:false, error:'Documento no encontrado' };

  let items = [];
  try { items = JSON.parse(doc.items_json || '[]'); } catch(e) { items = []; }
  if (!Array.isArray(items) || items.length === 0) return { afectado:false, error:'Sin items' };

  let movimientos = 0;
  items.forEach(it => {
    if (!it.sku || !it.cantidad) return;
    registrarMovInventario({
      fecha: new Date().toISOString().substring(0,10),
      sku: it.sku,
      tipo: tipoMov,
      cantidad: parseFloat(it.cantidad) || 0,
      costo_unitario: parseFloat(it.precio_unitario || it.costo_unitario) || 0,
      referencia: doc.folio || tabla,
      ref_id: idDoc,
      motivo: tabla === 'recepciones' ? 'compra' : (tabla === 'remisiones' || tabla === 'facturas') ? 'venta' : tabla === 'pedidos' ? (tipoMov === 'entrada' ? 'cancelación de venta' : 'venta') : '', // v0.9.15 pedidos
      usuario: usuario || '',
      notas: 'Auto desde ' + tabla + ' ' + (doc.folio || idDoc)
    });
    movimientos++;
  });
  return { afectado: movimientos > 0, movimientos };
}

// ============================================================
// COBRANZA desde FACTURA
// ============================================================
function generarCobranzaDesdeFactura(facturaItem, usuario) {
  // Crea una fila en Cobranza ligada a la factura
  const hojaCli = asegurarHoja('clientes');
  // Buscar crédito del cliente (días)
  let credito = 0;
  try {
    const datosCli = hojaCli.getDataRange().getValues();
    const headersCli = datosCli[0];
    const idxCli = {};
    headersCli.forEach((h,i) => idxCli[h] = i);
    for (let i = 1; i < datosCli.length; i++) {
      if (String(datosCli[i][idxCli.razon_social]).trim() === String(facturaItem.cliente).trim()) {
        credito = parseInt(datosCli[i][idxCli.credito_dias]) || 0;
        break;
      }
    }
  } catch(e) {}

  const fechaEmision = facturaItem.fecha || new Date().toISOString().substring(0,10);
  const fechaVenc = (() => {
    const d = new Date(fechaEmision);
    d.setDate(d.getDate() + credito);
    return d.toISOString().substring(0,10);
  })();

  const cob = {
    fecha_entrega: fechaEmision,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVenc,
    cliente: facturaItem.cliente,
    tipo: 'Factura',
    numero: facturaItem.folio,
    estatus: 'pendiente',
    vendedor: facturaItem.vendedor || '',
    descripcion: 'Factura ' + facturaItem.folio,
    credito,
    total: parseFloat(facturaItem.total) || 0,
    cobrado: 0,
    pendiente: parseFloat(facturaItem.total) || 0,
    dias_vencido: 0,
    sin_entregar: false,
    folio_fiscal: facturaItem.uuid_sat || '',
    factura_origen: facturaItem.id
  };
  return erpCrear('cobranza', cob);
}

// ============================================================
// RECEPCIÓN DE OC: sube inventario + crea cuenta por pagar
// ============================================================
function recibirOrdenCompra(idOC, usuario) {
  const hojaOC = asegurarHoja('ordenescompra');
  const datos = hojaOC.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let filaOC = -1, oc = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idOC) {
      filaOC = i + 1;
      oc = {};
      headers.forEach((h,j) => oc[h] = datos[i][j]);
      break;
    }
  }
  if (!oc) return { ok:false, error:'OC no encontrada' };
  if (String(oc.estatus || '') === 'recibida') return { ok:false, error:'Esta orden de compra ya se recibió' }; // v0.9.9 — no subir inventario dos veces

  // 1. Crear recepción
  const folioRec = siguienteFolio('recepcion', new Date().getFullYear());
  const rec = {
    folio: folioRec.folio,
    fecha: new Date().toISOString().substring(0,10),
    oc_origen: oc.folio || idOC,
    proveedor: oc.proveedor,
    items_json: oc.items_json,
    notas: 'Recepción automática de ' + (oc.folio || idOC),
    creado_por: usuario || ''
  };
  const rRec = erpCrear('recepciones', rec);

  // 2. Subir inventario
  const inv = aplicarInventarioDocumento(rRec.item.id, 'recepciones', 'entrada', usuario);

  // 3. Marcar OC como recibida
  hojaOC.getRange(filaOC, idx.estatus + 1).setValue('recibida');

  // 4. Cuenta por pagar: se deja rastro con pago = 0 y nota del total de la OC
  const pago = {
    fecha: new Date().toISOString().substring(0,10),
    proveedor: oc.proveedor,
    oc_relacionada: oc.folio || idOC,
    monto: 0,
    cuenta: '',
    metodo: '',
    referencia: '',
    notas: 'Cuenta por pagar generada — Total OC: ' + (parseFloat(oc.total) || 0).toFixed(2),
    creado_por: usuario || ''
  };
  erpCrear('pagosproveedores', pago);

  registrarBitacora(usuario, 'recibir_oc', 'ordenescompra', idOC, rRec.item.id);
  SpreadsheetApp.flush();
  return { ok:true, recepcionId: rRec.item.id, folio: folioRec.folio, inventarioAfectado: inv.afectado, movimientos: inv.movimientos };
}

// ============================================================
// CONFIRMAR PEDIDO (genera Cobranza preliminar tipo Remisión)
// ============================================================
function confirmarPedido(idPedido, usuario) {
  const hoja = asegurarHoja('pedidos');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let fila = -1, ped = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idPedido) {
      fila = i + 1;
      ped = {};
      headers.forEach((h,j) => ped[h] = datos[i][j]);
      break;
    }
  }
  if (!ped) return { ok:false, error:'Pedido no encontrado' };
  hoja.getRange(fila, idx.estatus + 1).setValue('confirmado');
  registrarBitacora(usuario, 'confirmar_pedido', 'pedidos', idPedido, '');
  SpreadsheetApp.flush();
  return { ok:true };
}

// ============================================================
// v0.4.0 — REPORTES
// ============================================================
function _diasEntre(fecha1, fecha2) {
  const d1 = (fecha1 instanceof Date) ? fecha1 : new Date(fecha1);
  const d2 = (fecha2 instanceof Date) ? fecha2 : new Date(fecha2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.floor((d2 - d1) / 86400000);
}

function reporteAging() {
  const hoja = asegurarHoja('cobranza');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, buckets: { '0-30':0, '31-60':0, '61-90':0, '90+':0 }, docs: [], total: 0 };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const hoy = new Date();
  const buckets = { '0-30':0, '31-60':0, '61-90':0, '90+':0 };
  const docs = [];
  for (let i = 1; i < datos.length; i++) {
    const pend = parseFloat(datos[i][idx.pendiente]) || 0;
    if (pend <= 0) continue;
    if (/^cancelad/i.test(String(datos[i][idx.estatus] || ''))) continue; // v0.9.9
    if (datos[i][idx.sin_entregar] === true || datos[i][idx.sin_entregar] === 'true') continue;
    const fv = datos[i][idx.fecha_vencimiento] || datos[i][idx.fecha_entrega] || datos[i][idx.fecha_emision];
    const dias = Math.max(0, _diasEntre(fv, hoy));
    let bucket;
    if (dias <= 30) bucket = '0-30';
    else if (dias <= 60) bucket = '31-60';
    else if (dias <= 90) bucket = '61-90';
    else bucket = '90+';
    buckets[bucket] += pend;
    docs.push({
      cliente: datos[i][idx.cliente],
      numero: datos[i][idx.numero],
      tipo: datos[i][idx.tipo],
      fecha_emision: datos[i][idx.fecha_emision] instanceof Date ? datos[i][idx.fecha_emision].toISOString() : datos[i][idx.fecha_emision],
      total: parseFloat(datos[i][idx.total]) || 0,
      cobrado: parseFloat(datos[i][idx.cobrado]) || 0,
      pendiente: pend,
      dias_vencido: dias,
      bucket
    });
  }
  const total = buckets['0-30'] + buckets['31-60'] + buckets['61-90'] + buckets['90+'];
  return { ok:true, buckets, docs, total };
}

function reporteEstadoCuenta(cliente) {
  if (!cliente) return { ok:false, error:'Cliente requerido' };
  // Facturas en Cobranza
  const hojaCob = asegurarHoja('cobranza');
  const dCob = hojaCob.getDataRange().getValues();
  const hCob = dCob[0]; const iCob = {}; hCob.forEach((h,i)=> iCob[h]=i);
  const facturas = [];
  let totalFacturado = 0, totalCobrado = 0, totalPendiente = 0;
  for (let i = 1; i < dCob.length; i++) {
    if (String(dCob[i][iCob.cliente]).trim() !== String(cliente).trim()) continue;
    if (/^cancelad/i.test(String(dCob[i][iCob.estatus] || ''))) continue; // v0.9.9
    facturas.push({
      fecha: dCob[i][iCob.fecha_emision] instanceof Date ? dCob[i][iCob.fecha_emision].toISOString() : dCob[i][iCob.fecha_emision],
      numero: dCob[i][iCob.numero],
      tipo: dCob[i][iCob.tipo],
      total: parseFloat(dCob[i][iCob.total]) || 0,
      cobrado: parseFloat(dCob[i][iCob.cobrado]) || 0,
      pendiente: parseFloat(dCob[i][iCob.pendiente]) || 0,
      dias_vencido: dCob[i][iCob.dias_vencido] || 0
    });
    totalFacturado += parseFloat(dCob[i][iCob.total]) || 0;
    totalCobrado  += parseFloat(dCob[i][iCob.cobrado]) || 0;
    totalPendiente += parseFloat(dCob[i][iCob.pendiente]) || 0;
  }
  // Pagos recientes en Ingresos
  const hojaIng = asegurarHoja('ingresos');
  const dIng = hojaIng.getDataRange().getValues();
  const hIng = dIng[0]; const iIng = {}; hIng.forEach((h,i)=> iIng[h]=i);
  const pagos = [];
  for (let i = 1; i < dIng.length; i++) {
    if (String(dIng[i][iIng.cliente]).trim() !== String(cliente).trim()) continue;
    if (/CANCELADO|DUPLICADO/i.test(String(dIng[i][iIng.tipo] || ''))) continue; // v0.9.9
    pagos.push({
      fecha: dIng[i][iIng.fecha] instanceof Date ? dIng[i][iIng.fecha].toISOString() : dIng[i][iIng.fecha],
      factura: dIng[i][iIng.factura],
      cuenta: dIng[i][iIng.cuenta],
      monto: parseFloat(dIng[i][iIng.monto]) || 0,
      comentarios: dIng[i][iIng.comentarios]
    });
  }
  // Notas de crédito
  const hojaNC = asegurarHoja('notascredito');
  const dNC = hojaNC.getDataRange().getValues();
  const hNC = dNC[0]; const iNC = {}; hNC.forEach((h,i)=> iNC[h]=i);
  const ncs = [];
  let totalNC = 0;
  for (let i = 1; i < dNC.length; i++) {
    const ncCliente = String(dNC[i][iNC.cliente] || dNC[i][iNC.contraparte] || '').trim(); // v0.9.9 — NC nuevas usan "cliente"
    if (ncCliente !== String(cliente).trim()) continue;
    if (dNC[i][iNC.tipo] && dNC[i][iNC.tipo] !== 'cliente') continue;
    if (/cancel/i.test(String(dNC[i][iNC.estatus] || ''))) continue;
    ncs.push({
      fecha: dNC[i][iNC.fecha] instanceof Date ? dNC[i][iNC.fecha].toISOString() : dNC[i][iNC.fecha],
      folio: dNC[i][iNC.folio],
      origen: dNC[i][iNC.documento_origen],
      total: parseFloat(dNC[i][iNC.total]) || 0,
      motivo: dNC[i][iNC.motivo]
    });
    totalNC += parseFloat(dNC[i][iNC.total]) || 0;
  }
  return { ok:true, cliente, facturas, pagos, ncs, totalFacturado, totalCobrado, totalPendiente, totalNC };
}

function reportePyL(año) {
  año = año || new Date().getFullYear();
  const hojaIng = asegurarHoja('ingresos');
  const hojaGas = asegurarHoja('gastos');
  const dIng = hojaIng.getDataRange().getValues();
  const dGas = hojaGas.getDataRange().getValues();
  const hI = dIng[0]; const iI = {}; hI.forEach((h,i)=> iI[h]=i);
  const hG = dGas[0]; const iG = {}; hG.forEach((h,i)=> iG[h]=i);
  const meses = {};
  for (let m = 1; m <= 12; m++) meses[String(m).padStart(2,'0')] = { ingresos:0, gastos:0, neto:0 };
  for (let i = 1; i < dIng.length; i++) {
    if (/CANCELADO|DUPLICADO/i.test(String(dIng[i][iI.tipo] || ''))) continue; // v0.9.9
    let f = dIng[i][iI.fecha];
    if (f instanceof Date) f = f.toISOString();
    f = String(f || '');
    if (f.substring(0,4) !== String(año)) continue;
    const mes = f.substring(5,7);
    if (meses[mes]) meses[mes].ingresos += parseFloat(dIng[i][iI.monto]) || 0;
  }
  for (let i = 1; i < dGas.length; i++) {
    let f = dGas[i][iG.fecha];
    if (f instanceof Date) f = f.toISOString();
    f = String(f || '');
    if (f.substring(0,4) !== String(año)) continue;
    const mes = f.substring(5,7);
    if (meses[mes]) meses[mes].gastos += parseFloat(dGas[i][iG.monto]) || 0;
  }
  let totIng = 0, totGas = 0;
  Object.keys(meses).forEach(m => {
    meses[m].neto = meses[m].ingresos - meses[m].gastos;
    totIng += meses[m].ingresos;
    totGas += meses[m].gastos;
  });
  return { ok:true, año, meses, totales: { ingresos: totIng, gastos: totGas, neto: totIng - totGas } };
}

function reporteTopClientes(año) {
  año = año || new Date().getFullYear();
  const hoja = asegurarHoja('facturas');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, items: [] };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const map = {};
  for (let i = 1; i < datos.length; i++) {
    if (/cancel/i.test(String(datos[i][idx.estatus] || ''))) continue; // v0.9.9
    let f = datos[i][idx.fecha];
    if (f instanceof Date) f = f.toISOString();
    f = String(f || '');
    if (f.substring(0,4) !== String(año)) continue;
    const cli = datos[i][idx.cliente] || 'Sin cliente';
    const total = parseFloat(datos[i][idx.total]) || 0;
    if (!map[cli]) map[cli] = { cliente: cli, total: 0, count: 0 };
    map[cli].total += total;
    map[cli].count += 1;
  }
  const items = Object.values(map).sort((a,b) => b.total - a.total).slice(0, 50);
  return { ok:true, items };
}

function reporteTopProductos(año) {
  año = año || new Date().getFullYear();
  // Suma cantidades vendidas desde items_json de facturas
  const hoja = asegurarHoja('facturas');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, items: [] };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const map = {};
  for (let i = 1; i < datos.length; i++) {
    if (/cancel/i.test(String(datos[i][idx.estatus] || ''))) continue; // v0.9.9
    let f = datos[i][idx.fecha];
    if (f instanceof Date) f = f.toISOString();
    f = String(f || '');
    if (f.substring(0,4) !== String(año)) continue;
    let items = [];
    try { items = JSON.parse(datos[i][idx.items_json] || '[]'); } catch(e) {}
    if (!Array.isArray(items)) continue;
    items.forEach(it => {
      const sku = it.sku || '—';
      const cant = parseFloat(it.cantidad) || 0;
      const pu = parseFloat(it.precio_unitario) || 0;
      const venta = cant * pu;
      if (!map[sku]) map[sku] = { sku, descripcion: it.descripcion || '', cantidad: 0, venta: 0 };
      map[sku].cantidad += cant;
      map[sku].venta += venta;
    });
  }
  const items = Object.values(map).sort((a,b) => b.venta - a.venta).slice(0, 50);
  return { ok:true, items };
}

// ============================================================
// v0.9.4 — COMISIONES (reglas reales NUN, validadas contra el Excel maestro de Rafa)
//   EDGAR   = 6% de lo suyo + 1% de LUIS + 3% de YADAH + 1% de ESTEBAN
//   LUIS    = 5% de lo suyo
//   ESTEBAN = 5% de lo suyo
//   YADAH   = 4% del TOTAL cobrado de la empresa (no gana por sus propios clientes)
//   RAFA    = 4% del TOTAL cobrado de la empresa
//   YAZMIN  = $15,000 fijos al mes
// Base de cálculo: la columna 'cobrado' de Cobranza, agrupada por el vendedor del documento.
// (El ERP y la app calculan las comisiones en pantalla con Ingresos; este reporte es de respaldo.)
// ============================================================
const COMIS_YAZMIN_FIJO_MES = 15000;

// Normaliza nombres (quita acentos, mayúsculas, colapsa espacios)
function _normNombre(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Normaliza el vendedor y tolera errores de dedo (ej. "EGDAR" → EDGAR)
function _normVendedor(v) {
  const s = _normNombre(v);
  if (!s) return '';
  if (s.indexOf('EDGAR') === 0 || s.indexOf('EGDAR') === 0) return 'EDGAR';
  if (s.indexOf('YADAH') === 0 || s.indexOf('YADA')  === 0) return 'YADAH';
  if (s.indexOf('LUIS')    === 0) return 'LUIS';
  if (s.indexOf('ESTEBAN') === 0) return 'ESTEBAN';
  if (s.indexOf('RAFA')    === 0) return 'RAFA';
  if (s.indexOf('YAZMIN')  === 0 || s.indexOf('YASMIN') === 0) return 'YAZMIN';
  return s;
}

// Palabras que no ayudan a identificar a un cliente
const _STOP_TOKENS = { DE:1, LA:1, EL:1, LOS:1, LAS:1, Y:1, DEL:1, MTY:1, SLP:1, SA:1, CV:1 };
function _tokens(s) {
  return _normNombre(s).split(' ').filter(t => t.length > 2 && !_STOP_TOKENS[t]);
}

// Índice del catálogo cliente→vendedor
function _indiceCatalogo() {
  const cat = asegurarHoja('clientescat');
  const dc = cat.getDataRange().getValues();
  const hc = dc[0]; const ic = {}; hc.forEach((h,i) => ic[h] = i);
  const lista = [];
  for (let i = 1; i < dc.length; i++) {
    const nom = dc[i][ic.nombre_normalizado] || dc[i][ic.nombre];
    const v = _normVendedor(dc[i][ic.vendedor]);
    if (!nom || !v) continue;
    lista.push({ exacto: _normNombre(nom), toks: _tokens(nom), vend: v });
  }
  return lista;
}

// Empareja el cliente de un documento contra el catálogo.
function _vendedorDeCliente(cliente, lista) {
  const n = _normNombre(cliente);
  if (!n) return '';
  for (let i = 0; i < lista.length; i++) if (lista[i].exacto === n) return lista[i].vend;
  const dt = {};
  _tokens(cliente).forEach(t => dt[t] = 1);
  let best = '', bestN = 1;
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i];
    if (c.toks.length < 2 || c.toks.length <= bestN) continue;
    let todas = true;
    for (let j = 0; j < c.toks.length; j++) { if (!dt[c.toks[j]]) { todas = false; break; } }
    if (todas) { best = c.vend; bestN = c.toks.length; }
  }
  return best;
}

function reporteComisiones(mes, año) {
  año = año || new Date().getFullYear();

  // Catálogo cliente→vendedor (respaldo cuando el documento no trae vendedor)
  const lista = _indiceCatalogo();

  // Cobranza: sumar COBRADO por vendedor
  const hoja = asegurarHoja('cobranza');
  const d = hoja.getDataRange().getValues();
  const h = d[0]; const idx = {}; h.forEach((x,i) => idx[x] = i);
  const porVend = {}; let totalCobrado = 0; let sinVendedor = 0;
  const sinAtribuir = {};
  for (let i = 1; i < d.length; i++) {
    let f = d[i][idx.fecha_emision] || d[i][idx.fecha_entrega];
    if (f instanceof Date) f = f.toISOString();
    f = String(f || '');
    if (año && f.substring(0,4) !== String(año)) continue;
    if (mes && f.substring(5,7) !== String(mes).padStart(2,'0')) continue;
    const cobrado = parseFloat(d[i][idx.cobrado]) || 0;
    if (!cobrado) continue;
    let v = _normVendedor(d[i][idx.vendedor]);
    if (!v) v = _vendedorDeCliente(d[i][idx.cliente], lista);
    totalCobrado += cobrado;
    if (!v) {
      sinVendedor += cobrado;
      const cl = String(d[i][idx.cliente] || '(sin nombre)');
      sinAtribuir[cl] = (sinAtribuir[cl] || 0) + cobrado;
      continue;
    }
    porVend[v] = (porVend[v] || 0) + cobrado;
  }

  const c = k => porVend[k] || 0;
  const items = [];
  const edgarCom = c('EDGAR')*0.06 + c('LUIS')*0.01 + c('YADAH')*0.03 + c('ESTEBAN')*0.01;
  items.push({ vendedor:'EDGAR',   cobrado:c('EDGAR'),   comision: edgarCom,        detalle:'6% propio + 1% Luis + 3% Yadah + 1% Esteban' });
  items.push({ vendedor:'LUIS',    cobrado:c('LUIS'),    comision: c('LUIS')*0.05,   detalle:'5% de lo suyo' });
  items.push({ vendedor:'ESTEBAN', cobrado:c('ESTEBAN'), comision: c('ESTEBAN')*0.05,detalle:'5% de lo suyo' });
  items.push({ vendedor:'YADAH',   cobrado:c('YADAH'),   comision: totalCobrado*0.04,detalle:'4% del total cobrado de la empresa' });
  items.push({ vendedor:'RAFA',    cobrado:c('RAFA'),    comision: totalCobrado*0.04,detalle:'4% del total cobrado de la empresa' });
  items.push({ vendedor:'YAZMIN',  cobrado:0,
               comision: mes ? COMIS_YAZMIN_FIJO_MES : COMIS_YAZMIN_FIJO_MES*12,
               detalle: mes ? '$15,000 fijos del mes' : '$15,000 fijos x 12 meses' });

  // Clientes cuyo cobrado no se pudo atribuir a ningún vendedor (para que Rafa los revise)
  const pendientes = Object.keys(sinAtribuir)
    .map(c => ({ cliente: c, cobrado: sinAtribuir[c] }))
    .sort((a,b) => b.cobrado - a.cobrado);

  return { ok:true, mes, año,
           total_cobrado: totalCobrado,
           sin_vendedor: sinVendedor,
           clientes_sin_vendedor: pendientes,
           items };
}

function kardexProducto(sku) {
  if (!sku) return { ok:false, error:'SKU requerido' };
  const hoja = asegurarHoja('movinventario');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, movimientos: [], stock: 0 };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  // Stock actual del producto
  const hojaP = asegurarHoja('productos');
  const dP = hojaP.getDataRange().getValues();
  const hP = dP[0]; const iP = {}; hP.forEach((h,i)=> iP[h]=i);
  let stockActual = 0, descripcion = '', costo = 0;
  for (let i = 1; i < dP.length; i++) {
    if (String(dP[i][iP.sku]).trim() === String(sku).trim()) {
      stockActual = parseFloat(dP[i][iP.stock_actual]) || 0;
      descripcion = dP[i][iP.descripcion] || '';
      costo = parseFloat(dP[i][iP.costo]) || 0;
      break;
    }
  }
  const movs = [];
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.sku]).trim() !== String(sku).trim()) continue;
    const o = {};
    headers.forEach((h,j) => { let v = datos[i][j]; if (v instanceof Date) v = v.toISOString(); o[h] = v; });
    movs.push(o);
  }
  movs.sort((a,b) => String(a.fecha||'').localeCompare(String(b.fecha||'')));
  // Calcular balance corriente
  let balance = 0;
  movs.forEach(m => {
    const c = parseFloat(m.cantidad) || 0;
    if (m.tipo === 'entrada') balance += c;
    else if (m.tipo === 'salida') balance -= c;
    else if (m.tipo === 'ajuste') balance = c;
    m.balance = balance;
  });
  return { ok:true, sku, descripcion, stock_actual: stockActual, costo, valor_inventario: stockActual * costo, movimientos: movs.reverse() };
}

// ============================================================
// v0.5.0 — IMPORTACIONES (pedimentos con prorrateo de gastos)
// ============================================================
function calcularProrrateoImportacion(items, gastosAccesoriosMXN, tc, base) {
  base = base || 'valor';
  tc = parseFloat(tc) || 1;
  gastosAccesoriosMXN = parseFloat(gastosAccesoriosMXN) || 0;
  if (!Array.isArray(items)) items = [];

  let baseTotal = 0;
  const conMxn = items.map(it => {
    const cant = parseFloat(it.cantidad) || 0;
    const cuOrig = parseFloat(it.costo_unitario_origen) || 0;
    const subtotalOrigen = cant * cuOrig;
    const subtotalMxn = subtotalOrigen * tc;
    const peso = parseFloat(it.peso_unit) || 0;
    const pesoTotal = cant * peso;
    let valorBase;
    if (base === 'peso') valorBase = pesoTotal;
    else if (base === 'unidades') valorBase = cant;
    else valorBase = subtotalMxn;
    baseTotal += valorBase;
    return Object.assign({}, it, {
      subtotal_origen: subtotalOrigen,
      subtotal_mxn: subtotalMxn,
      _base: valorBase
    });
  });

  return conMxn.map(it => {
    const proporcion = baseTotal > 0 ? (it._base / baseTotal) : 0;
    const gastosProrrateados = gastosAccesoriosMXN * proporcion;
    const cant = parseFloat(it.cantidad) || 0;
    const costoReal = (it.subtotal_mxn + gastosProrrateados) / (cant || 1);
    const out = Object.assign({}, it);
    out.subtotal_origen = it.subtotal_origen;
    out.subtotal_mxn = it.subtotal_mxn;
    out.gastos_prorrateados = gastosProrrateados;
    out.costo_real_unitario = costoReal;
    out.costo_real_total = costoReal * cant;
    delete out._base;
    return out;
  });
}

// Crea o actualiza una importación en borrador / en_transito
function guardarImportacion(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const tc = parseFloat(payload.tc_compra) || 1;
  const flete = parseFloat(payload.flete_mxn) || 0;
  const aduana = parseFloat(payload.aduana_mxn) || 0;
  const impuestos = parseFloat(payload.impuestos_mxn) || 0;
  const otros = parseFloat(payload.otros_mxn) || 0;
  const gastosAcc = flete + aduana + impuestos + otros;
  const base = payload.base_prorrateo || 'valor';

  const conProrrateo = calcularProrrateoImportacion(items, gastosAcc, tc, base);
  const subtotalOrigen = conProrrateo.reduce((s,it) => s + (it.subtotal_origen || 0), 0);
  const subtotalMxn = conProrrateo.reduce((s,it) => s + (it.subtotal_mxn || 0), 0);
  const totalCostoMxn = subtotalMxn + gastosAcc;

  const id = payload.id || ('imp_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6));
  let folio = payload.folio;
  if (!folio) {
    const f = siguienteFolio('importacion', new Date().getFullYear());
    folio = f.folio;
  }

  const item = {
    id,
    folio,
    fecha: payload.fecha || new Date().toISOString().substring(0,10),
    fecha_eta: payload.fecha_eta || '',
    proveedor: payload.proveedor || '',
    moneda_origen: payload.moneda_origen || 'USD',
    tc_compra: tc,
    subtotal_origen: subtotalOrigen,
    subtotal_mxn: subtotalMxn,
    flete_mxn: flete,
    aduana_mxn: aduana,
    impuestos_mxn: impuestos,
    otros_mxn: otros,
    gastos_accesorios_mxn: gastosAcc,
    total_costo_mxn: totalCostoMxn,
    base_prorrateo: base,
    items_json: JSON.stringify(conProrrateo),
    estatus: payload.estatus || 'borrador',
    pedimento_sat: payload.pedimento_sat || '',
    notas: payload.notas || '',
    creado_por: payload.creado_por || '',
    fecha_cierre: payload.fecha_cierre || ''
  };

  if (payload.id) {
    return erpActualizar('importaciones', item);
  } else {
    return erpCrear('importaciones', item);
  }
}

// Cierra una importación: aplica el inventario con costo real y actualiza productos.costo
function cerrarImportacion(idImportacion, usuario) {
  const hoja = asegurarHoja('importaciones');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let fila = -1, imp = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idImportacion) {
      fila = i + 1;
      imp = {};
      headers.forEach((h,j) => imp[h] = datos[i][j]);
      break;
    }
  }
  if (!imp) return { ok:false, error:'Importación no encontrada' };
  if (imp.estatus === 'cerrada') return { ok:false, error:'Esta importación ya está cerrada' };

  let items = [];
  try { items = JSON.parse(imp.items_json || '[]'); } catch(e) {}
  if (!Array.isArray(items) || items.length === 0) return { ok:false, error:'Sin items en la importación' };

  let movs = 0;
  items.forEach(it => {
    if (!it.sku || !it.cantidad) return;
    registrarMovInventario({
      fecha: new Date().toISOString().substring(0,10),
      sku: it.sku,
      tipo: 'entrada',
      cantidad: parseFloat(it.cantidad) || 0,
      costo_unitario: parseFloat(it.costo_real_unitario) || 0,
      referencia: imp.folio || idImportacion,
      ref_id: idImportacion,
      motivo: 'importacion',
      usuario: usuario || '',
      notas: 'Importación cerrada · costo real prorrateado'
    });
    movs++;
  });

  const hojaProd = asegurarHoja('productos');
  const datosP = hojaProd.getDataRange().getValues();
  const hdrsP = datosP[0];
  const iP = {};
  hdrsP.forEach((h,i) => iP[h] = i);
  items.forEach(it => {
    if (!it.sku) return;
    for (let i = 1; i < datosP.length; i++) {
      if (String(datosP[i][iP.sku]).trim() === String(it.sku).trim()) {
        const stockAnterior = parseFloat(datosP[i][iP.stock_actual]) || 0;
        const costoAnterior = parseFloat(datosP[i][iP.costo]) || 0;
        const cantNueva = parseFloat(it.cantidad) || 0;
        const costoNuevo = parseFloat(it.costo_real_unitario) || 0;
        const stockPrevio = stockAnterior - cantNueva;
        const promedio = (stockAnterior > 0)
          ? ((Math.max(0, stockPrevio) * costoAnterior + cantNueva * costoNuevo) / stockAnterior)
          : costoNuevo;
        hojaProd.getRange(i+1, iP.costo + 1).setValue(promedio);
        break;
      }
    }
  });

  hoja.getRange(fila, idx.estatus + 1).setValue('cerrada');
  if (idx.fecha_cierre >= 0) hoja.getRange(fila, idx.fecha_cierre + 1).setValue(new Date().toISOString().substring(0,10));

  registrarBitacora(usuario, 'cerrar_importacion', 'importaciones', idImportacion, 'movs=' + movs);
  SpreadsheetApp.flush();
  return { ok:true, movimientos: movs };
}

// Reporte de margen real para una importación cerrada
function reporteMargenImportacion(idImportacion) {
  const hoja = asegurarHoja('importaciones');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let imp = null;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idImportacion) {
      imp = {};
      headers.forEach((h,j) => imp[h] = datos[i][j]);
      break;
    }
  }
  if (!imp) return { ok:false, error:'Importación no encontrada' };

  let items = [];
  try { items = JSON.parse(imp.items_json || '[]'); } catch(e) {}

  const hojaProd = asegurarHoja('productos');
  const dP = hojaProd.getDataRange().getValues();
  const hP = dP[0]; const iP = {}; hP.forEach((h,i)=> iP[h]=i);
  const precios = {};
  for (let i = 1; i < dP.length; i++) {
    precios[String(dP[i][iP.sku]).trim()] = parseFloat(dP[i][iP.precio]) || 0;
  }

  const enriched = items.map(it => {
    const sku = it.sku;
    const cantidad = parseFloat(it.cantidad) || 0;
    const costoReal = parseFloat(it.costo_real_unitario) || 0;
    const precioActual = precios[sku] || 0;
    const margenAbs = precioActual - costoReal;
    const margenPct = precioActual > 0 ? (margenAbs / precioActual * 100) : 0;
    const utilidadTotal = margenAbs * cantidad;
    return {
      sku,
      descripcion: it.descripcion || '',
      cantidad,
      costo_origen_unit: parseFloat(it.costo_unitario_origen) || 0,
      costo_real_unit: costoReal,
      precio_venta: precioActual,
      margen_unit: margenAbs,
      margen_pct: margenPct,
      utilidad_potencial: utilidadTotal
    };
  });

  const totales = {
    inversion: parseFloat(imp.total_costo_mxn) || 0,
    venta_potencial: enriched.reduce((s,e) => s + (e.precio_venta * e.cantidad), 0),
    utilidad_potencial: enriched.reduce((s,e) => s + e.utilidad_potencial, 0)
  };
  totales.margen_pct = totales.venta_potencial > 0 ? (totales.utilidad_potencial / totales.venta_potencial * 100) : 0;

  return { ok:true, importacion: imp, items: enriched, totales };
}

// Tipos de cambio
function guardarTC(payload) {
  const item = {
    id: 'tc_' + payload.fecha + '_' + (payload.moneda || 'USD'),
    fecha: payload.fecha,
    moneda: payload.moneda,
    valor_mxn: parseFloat(payload.valor_mxn) || 0,
    fuente: payload.fuente || 'manual',
    notas: payload.notas || ''
  };
  return erpCrear('tiposcambio', item);
}

function obtenerTCmasReciente(moneda) {
  const hoja = asegurarHoja('tiposcambio');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:false, error:'Sin TC registrados' };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let masReciente = null;
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.moneda]).toUpperCase() !== String(moneda || 'USD').toUpperCase()) continue;
    const f = datos[i][idx.fecha] instanceof Date ? datos[i][idx.fecha].toISOString().substring(0,10) : String(datos[i][idx.fecha] || '').substring(0,10);
    const valor = parseFloat(datos[i][idx.valor_mxn]) || 0;
    if (!masReciente || f > masReciente.fecha) masReciente = { fecha: f, valor };
  }
  return masReciente ? { ok:true, tc: masReciente } : { ok:false, error:'Sin TC para esa moneda' };
}

// ============================================================
// v0.6.0 — MULTI-ALMACÉN
// ============================================================
function transferirInventario(payload) {
  const cantidad = parseFloat(payload.cantidad) || 0;
  if (cantidad <= 0) return { ok:false, error:'Cantidad debe ser > 0' };
  if (!payload.sku) return { ok:false, error:'SKU requerido' };
  if (!payload.almacen_origen || !payload.almacen_destino) return { ok:false, error:'Almacenes requeridos' };
  if (payload.almacen_origen === payload.almacen_destino) return { ok:false, error:'El origen y destino deben ser distintos' };

  const stockOrigen = stockSkuAlmacen(payload.sku, payload.almacen_origen);
  if (cantidad > stockOrigen + 0.001) {
    return { ok:false, error:`Stock insuficiente en ${payload.almacen_origen}: ${stockOrigen.toFixed(2)} disponible` };
  }

  registrarMovInventario({
    fecha: payload.fecha || new Date().toISOString().substring(0,10),
    sku: payload.sku,
    tipo: 'salida',
    cantidad: cantidad,
    motivo: 'transferencia',
    almacen: payload.almacen_origen,
    referencia: 'TRANSF',
    ref_id: 'transferencia',
    usuario: payload.usuario || '',
    notas: 'Transferencia a ' + payload.almacen_destino + (payload.notas ? ' · ' + payload.notas : '')
  });
  registrarMovInventario({
    fecha: payload.fecha || new Date().toISOString().substring(0,10),
    sku: payload.sku,
    tipo: 'entrada',
    cantidad: cantidad,
    motivo: 'transferencia',
    almacen: payload.almacen_destino,
    referencia: 'TRANSF',
    ref_id: 'transferencia',
    usuario: payload.usuario || '',
    notas: 'Transferencia desde ' + payload.almacen_origen + (payload.notas ? ' · ' + payload.notas : '')
  });
  registrarBitacora(payload.usuario || '', 'transferencia_inventario', 'movinventario', payload.sku,
    `${cantidad} de ${payload.almacen_origen} a ${payload.almacen_destino}`);
  SpreadsheetApp.flush();
  return { ok:true };
}

function stockSkuAlmacen(sku, almacen) {
  const hoja = asegurarHoja('movinventario');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return 0;
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let total = 0;
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.sku]).trim() !== String(sku).trim()) continue;
    const movAlmacen = idx.almacen !== undefined ? (datos[i][idx.almacen] || 'Matriz') : 'Matriz';
    if (String(movAlmacen).trim() !== String(almacen).trim()) continue;
    const cant = parseFloat(datos[i][idx.cantidad]) || 0;
    if (datos[i][idx.tipo] === 'entrada') total += cant;
    else if (datos[i][idx.tipo] === 'salida') total -= cant;
    else if (datos[i][idx.tipo] === 'ajuste') total = cant;
  }
  return total;
}

function stockPorAlmacen() {
  const hoja = asegurarHoja('movinventario');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, stock: {} };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const stock = {};
  for (let i = 1; i < datos.length; i++) {
    const sku = String(datos[i][idx.sku] || '').trim();
    if (!sku) continue;
    const almacen = idx.almacen !== undefined ? (datos[i][idx.almacen] || 'Matriz') : 'Matriz';
    const alm = String(almacen).trim() || 'Matriz';
    if (!stock[sku]) stock[sku] = {};
    if (!stock[sku][alm]) stock[sku][alm] = 0;
    const cant = parseFloat(datos[i][idx.cantidad]) || 0;
    if (datos[i][idx.tipo] === 'entrada') stock[sku][alm] += cant;
    else if (datos[i][idx.tipo] === 'salida') stock[sku][alm] -= cant;
    else if (datos[i][idx.tipo] === 'ajuste') stock[sku][alm] = cant;
  }
  return { ok:true, stock };
}

// ============================================================
// v0.6.0 — CRM
// ============================================================
function ultimaCompraCliente(cliente) {
  const hoja = asegurarHoja('facturas');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return null;
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  let ultima = null;
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.cliente]).trim() !== String(cliente).trim()) continue;
    let f = datos[i][idx.fecha];
    if (f instanceof Date) f = f.toISOString();
    f = String(f || '').substring(0,10);
    if (!ultima || f > ultima.fecha) {
      ultima = { fecha: f, folio: datos[i][idx.folio], total: parseFloat(datos[i][idx.total]) || 0 };
    }
  }
  return ultima;
}

function listarCumpleaños() {
  const hoja = asegurarHoja('clientes');
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok:true, items: [] };
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  const items = [];
  const hoyM = new Date().getMonth() + 1;
  const hoyD = new Date().getDate();
  for (let i = 1; i < datos.length; i++) {
    let cumple = null;
    const notas = String(datos[i][idx.notas] || '');
    const match = notas.match(/cumple:\s*(\d{4})-(\d{2})-(\d{2})|cumple:\s*(\d{2})\/(\d{2})/i);
    if (match) {
      if (match[2] && match[3]) cumple = { mes: parseInt(match[2]), dia: parseInt(match[3]) };
      else if (match[4] && match[5]) cumple = { dia: parseInt(match[4]), mes: parseInt(match[5]) };
    }
    if (!cumple) continue;
    const diasAhora = (cumple.mes - 1) * 31 + cumple.dia;
    const diasHoy = (hoyM - 1) * 31 + hoyD;
    let diff = diasAhora - diasHoy;
    if (diff < 0) diff += 365;
    items.push({
      cliente: datos[i][idx.razon_social],
      contacto: datos[i][idx.contacto],
      mes: cumple.mes,
      dia: cumple.dia,
      dias_para: diff
    });
  }
  items.sort((a,b) => a.dias_para - b.dias_para);
  return { ok:true, items };
}

function moverEtapaOportunidad(idOp, nuevaEtapa, usuario) {
  const hoja = asegurarHoja('oportunidades');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idOp) {
      hoja.getRange(i+1, idx.etapa + 1).setValue(nuevaEtapa);
      if (idx.actualizado >= 0) hoja.getRange(i+1, idx.actualizado + 1).setValue(new Date().toISOString());
      registrarBitacora(usuario, 'mover_etapa', 'oportunidades', idOp, 'a ' + nuevaEtapa);
      SpreadsheetApp.flush();
      return { ok:true };
    }
  }
  return { ok:false, error:'Oportunidad no encontrada' };
}

function marcarRecordatorio(id, completado, usuario) {
  const hoja = asegurarHoja('recordatorios');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h,i) => idx[h] = i);
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === id) {
      hoja.getRange(i+1, idx.completado + 1).setValue(!!completado);
      if (completado) hoja.getRange(i+1, idx.completado_fecha + 1).setValue(new Date().toISOString().substring(0,10));
      else hoja.getRange(i+1, idx.completado_fecha + 1).setValue('');
      registrarBitacora(usuario, completado ? 'completar_recordatorio' : 'reabrir_recordatorio', 'recordatorios', id, '');
      SpreadsheetApp.flush();
      return { ok:true };
    }
  }
  return { ok:false, error:'No encontrado' };
}

// ============================================================
// v0.9.2 — CONSOLIDACIÓN CRM: cobranza, pagos, aplazamientos, importaciones
// ============================================================

// Helper: lee una hoja completa a { hoja, headers, idx, filas }.
function _leerHoja(tabla) {
  const hoja = asegurarHoja(tabla);
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  return { hoja, headers, idx, filas: datos };
}

// ---- Editar / anular un pago manual (ERP). nuevo_monto = 0 ⇒ anula el pago. ----
// v0.9.9 — ANULAR ya no borra renglones: el ingreso queda con tipo CANCELADO (no cuenta) y el
// renglón del pago queda con monto 0 y la nota "ANULADO (era $X)".
function editarPagoManual(body) {
  if (!validarAdmin(body.codigo_usuario || body.codigo)) return { ok:false, error:'No autorizado' };
  if (!body.timestamp) return { ok:false, error:'timestamp requerido' };
  const nuevoMonto = parseFloat(body.nuevo_monto) || 0;

  const P = _leerHoja('pagosclientes');
  let filaPago = -1, pago = null;
  for (let i = 1; i < P.filas.length; i++) {
    const ts = P.filas[i][P.idx.timestamp];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    if (tsStr === String(body.timestamp) || ts === body.timestamp) {
      filaPago = i; pago = {}; P.headers.forEach((h,j) => pago[h] = P.filas[i][j]); break;
    }
  }
  if (filaPago < 0) return { ok:false, error:'Pago no encontrado' };

  const montoViejo = parseFloat(pago.monto) || 0;
  const delta = nuevoMonto - montoViejo; // negativo si se reduce/anula

  // 1) Ajustar Cobranza (cobrado / pendiente)
  const C = _leerHoja('cobranza');
  for (let i = 1; i < C.filas.length; i++) {
    if (C.filas[i][C.idx.id] === pago.id_doc) {
      const total = parseFloat(C.filas[i][C.idx.total]) || 0;
      const cobradoAct = parseFloat(C.filas[i][C.idx.cobrado]) || 0;
      const nuevoCobrado = Math.max(0, cobradoAct + delta);
      C.hoja.getRange(i+1, C.idx.cobrado + 1).setValue(nuevoCobrado);
      C.hoja.getRange(i+1, C.idx.pendiente + 1).setValue(Math.max(0, total - nuevoCobrado));
      break;
    }
  }

  // 2) Ajustar el Ingreso ligado (anular = tipo CANCELADO, no se borra)
  if (pago.ingreso_id) {
    const I = _leerHoja('ingresos');
    for (let i = 1; i < I.filas.length; i++) {
      if (I.filas[i][I.idx.id] === pago.ingreso_id) {
        if (nuevoMonto <= 0) {
          I.hoja.getRange(i+1, I.idx.tipo + 1).setValue('CANCELADO');
          if (I.idx.comentarios !== undefined) I.hoja.getRange(i+1, I.idx.comentarios + 1).setValue('ANULADO ' + new Date().toISOString().substring(0,10) + ' · ' + String(I.filas[i][I.idx.comentarios] || ''));
        } else {
          I.hoja.getRange(i+1, I.idx.monto + 1).setValue(nuevoMonto);
        }
        break;
      }
    }
  }

  // 3) Renglón del pago: se queda (monto 0 y nota si se anuló)
  P.hoja.getRange(filaPago + 1, P.idx.monto + 1).setValue(Math.max(0, nuevoMonto));
  if (nuevoMonto <= 0 && P.idx.notas !== undefined) P.hoja.getRange(filaPago + 1, P.idx.notas + 1).setValue('ANULADO (era $' + montoViejo.toFixed(2) + ') · ' + String(pago.notas || ''));

  registrarBitacora(body.codigo_usuario || '', nuevoMonto <= 0 ? 'anular_pago' : 'editar_pago',
                    'pagosclientes', pago.id_doc, 'monto ' + montoViejo + '→' + nuevoMonto);
  SpreadsheetApp.flush();
  return { ok:true, anulado: nuevoMonto <= 0, nuevo_monto: nuevoMonto };
}

// ---- Crear "pedido" (renglón de Cobranza) desde el CRM ----
function crmCrearPedido(body) {
  const total = parseFloat(body.total) || 0;
  const item = {
    fecha_entrega: body.fecha_entrega || '',
    fecha_emision: body.fecha_emision || new Date().toISOString().substring(0,10),
    cliente: body.cliente || '',
    tipo: body.tipo || 'pedido',
    numero: body.numero || '',
    estatus: 'pendiente',
    vendedor: body.vendedor || '',
    descripcion: body.descripcion || '',
    total: total,
    cobrado: 0,
    pendiente: total,
    dias_vencido: 0
  };
  return erpCrear('cobranza', item);
}

// ---- Actualizar renglón de Cobranza con un objeto de cambios parciales ----
function crmActualizarPedido(id, cambios) {
  if (!id) return { ok:false, error:'id requerido' };
  const item = Object.assign({ id: id }, cambios || {});
  return erpActualizar('cobranza', item);
}

// ---- Historial de pagos manuales de un documento ----
function crmObtenerPagosDoc(idDoc) {
  if (!idDoc) return { ok:false, error:'id_doc requerido' };
  const P = _leerHoja('pagosclientes');
  const pagos = [];
  for (let i = 1; i < P.filas.length; i++) {
    if (P.filas[i][P.idx.id_doc] === idDoc) {
      const o = {};
      P.headers.forEach((h,j) => { let v = P.filas[i][j]; if (v instanceof Date) v = v.toISOString(); o[h] = v; });
      pagos.push(o);
    }
  }
  return { ok:true, pagos };
}

// ---- Aplazamientos de alertas ----
function crmListarAplazamientos(codigoUsuario) {
  const A = _leerHoja('aplazamientos');
  const aplazamientos = [];
  for (let i = 1; i < A.filas.length; i++) {
    if (!codigoUsuario || String(A.filas[i][A.idx.codigo_usuario]) === String(codigoUsuario)) {
      const o = {};
      A.headers.forEach((h,j) => { let v = A.filas[i][j]; if (v instanceof Date) v = v.toISOString(); o[h] = v; });
      aplazamientos.push(o);
    }
  }
  return { ok:true, aplazamientos };
}

function crmGuardarAplazamiento(body) {
  if (!body.alerta_id) return { ok:false, error:'alerta_id requerido' };
  const A = _leerHoja('aplazamientos');
  for (let i = 1; i < A.filas.length; i++) {
    if (String(A.filas[i][A.idx.codigo_usuario]) === String(body.codigo_usuario) &&
        String(A.filas[i][A.idx.alerta_id]) === String(body.alerta_id)) {
      A.hoja.getRange(i+1, A.idx.expira + 1).setValue(body.expira || '');
      A.hoja.getRange(i+1, A.idx.dias + 1).setValue(body.dias || '');
      SpreadsheetApp.flush();
      return { ok:true, actualizado:true };
    }
  }
  A.hoja.appendRow([body.codigo_usuario || '', body.alerta_id, body.expira || '', body.dias || '', new Date().toISOString()]);
  SpreadsheetApp.flush();
  return { ok:true, creado:true };
}

// (quita un recordatorio aplazado de una alerta; no son datos del negocio)
function crmEliminarAplazamiento(codigoUsuario, alertaId) {
  if (!alertaId) return { ok:false, error:'alerta_id requerido' };
  const A = _leerHoja('aplazamientos');
  for (let i = A.filas.length - 1; i >= 1; i--) {
    if (String(A.filas[i][A.idx.codigo_usuario]) === String(codigoUsuario) &&
        String(A.filas[i][A.idx.alerta_id]) === String(alertaId)) {
      A.hoja.deleteRow(i+1);
      SpreadsheetApp.flush();
      return { ok:true };
    }
  }
  return { ok:true, no_encontrado:true };
}

// ---- Importaciones batch (UPSERT). Devuelve resultado{nuevos,actualizados,sin_cambio,errores}. ----
// Nota: un valor vacío ('') no borra lo que ya había en la celda.
function _crmUpsertBatch(tabla, items, claveMatch) {
  const lock = LockService.getScriptLock(); // v0.9.9 — dos guardados al mismo tiempo no se pisan
  try { lock.waitLock(20000); } catch(e) { return { ok:false, error:'Sistema ocupado, reintenta' }; }
  try {
  const S = _leerHoja(tabla);
  const res = { nuevos:0, actualizados:0, sin_cambio:0, errores:[] };
  const mapa = {};
  const kIdx = S.idx[claveMatch];
  for (let i = 1; i < S.filas.length; i++) {
    const k = String(S.filas[i][kIdx] || '').trim().toLowerCase();
    if (k) mapa[k] = i;
  }
  const nuevasFilas = [];
  (items || []).forEach(item => {
    try {
      const k = String(item[claveMatch] || '').trim().toLowerCase();
      if (k && mapa[k] !== undefined) {
        const i = mapa[k];
        const filaVieja = S.filas[i];
        const vaciar = Array.isArray(item._vaciar) ? item._vaciar : []; // v0.9.14
        const filaNueva = S.headers.map((h, j) => vaciar.indexOf(h) >= 0 ? '' : (item[h] !== undefined && item[h] !== null && item[h] !== '') ? item[h] : filaVieja[j]);
        let cambio = false;
        for (let j = 0; j < S.headers.length; j++) { if (String(filaNueva[j]) !== String(filaVieja[j])) { cambio = true; break; } }
        if (cambio) { S.hoja.getRange(i+1, 1, 1, S.headers.length).setValues([filaNueva]); res.actualizados++; }
        else res.sin_cambio++;
      } else {
        if (!item.id) item.id = tabla.substring(0,3) + '_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6);
        nuevasFilas.push(S.headers.map(h => (item[h] !== undefined && item[h] !== null) ? item[h] : ''));
        res.nuevos++;
      }
    } catch(e) { res.errores.push(String(e)); }
  });
  if (nuevasFilas.length) {
    S.hoja.getRange(S.hoja.getLastRow() + 1, 1, nuevasFilas.length, S.headers.length).setValues(nuevasFilas);
  }
  SpreadsheetApp.flush();
  return { ok:true, resultado: res };
  } finally { lock.releaseLock(); }
}

function crmImportarCobranzaBatch(items) { return _crmUpsertBatch('cobranza', items, 'id'); }
function crmImportarIngresosBatch(items) { return _crmUpsertBatch('ingresos', items, 'id'); }
function crmImportarGastosBatch(items)   { return _crmUpsertBatch('gastos', items, 'id'); }
function crmImportarClientesBatch(items) { return _crmUpsertBatch('clientescat', items, 'nombre_normalizado'); }

// v0.9.9 — "Dedupe" y "Borrar todo" desactivados: por regla no se borran datos
function crmDedupeCobranza(dryRun) { return { ok:false, error:'Por regla del sistema no se borran datos (los duplicados se marcan, no se borran).' }; }
function crmBorrarTodo(tabla) { return { ok:false, error:'Por regla del sistema no se borran datos.' }; }

// ============================================================
// v0.9.7 — INVENTARIO AUTOMATICO (flujo NUN)
//   PEDIDO creado  -> APARTA (stock_comprometido +)   ... no baja stock fisico
//   REMISION       -> SALE fisico (stock_actual -) y LIBERA el apartado
//   PEDIDO cancelado -> LIBERA el apartado (v0.9.9: acción pedido_liberar)
//   FACTURA        -> NO toca inventario (evita doble descuento)
//   Disponible = stock_actual - stock_comprometido
// ============================================================
// v0.9.9 — el documento se encuentra por id O por folio (las remisiones guardan el FOLIO del pedido)
function _itemsDeDoc(tabla, idOFolio) {
  const hoja = asegurarHoja(tabla);
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0]; const idx = {}; headers.forEach((h,i)=>idx[h]=i);
  const k = String(idOFolio || '').trim();
  if (!k) return [];
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][idx.id]) === k || (idx.folio !== undefined && String(datos[i][idx.folio]).trim() === k)) {
      try { return JSON.parse(datos[i][idx.items_json] || '[]'); } catch(e) { return []; }
    }
  }
  return [];
}
function _ajustarComprometido(items, signo) {
  const hoja = asegurarHoja('productos');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0]; const idx = {}; headers.forEach((h,i)=>idx[h]=i);
  if (idx.stock_comprometido === undefined) return 0;
  let n = 0;
  (items || []).forEach(it => {
    if (!it.sku || !it.cantidad) return;
    const sku = String(it.sku).trim().toUpperCase();
    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][idx.sku]).trim().toUpperCase() === sku) {
        const actual = parseFloat(datos[i][idx.stock_comprometido]) || 0;
        const nuevo = Math.max(0, actual + signo * (parseFloat(it.cantidad) || 0));
        hoja.getRange(i+1, idx.stock_comprometido + 1).setValue(nuevo);
        datos[i][idx.stock_comprometido] = nuevo;
        n++;
        break;
      }
    }
  });
  SpreadsheetApp.flush();
  return n;
}
function pedidoApartar(idPedido, usuario) {
  const n = _ajustarComprometido(_itemsDeDoc('pedidos', idPedido), +1);
  if (n) registrarBitacora(usuario || '', 'apartar_inventario', 'pedidos', idPedido, n + ' SKU(s) apartados');
  return { ok:true, apartados:n };
}
function pedidoLiberar(idPedido, usuario) {
  const n = _ajustarComprometido(_itemsDeDoc('pedidos', idPedido), -1);
  if (n) registrarBitacora(usuario || '', 'liberar_apartado', 'pedidos', idPedido, n + ' SKU(s) liberados');
  return { ok:true, liberados:n };
}
function remisionAplicar(idRem, usuario) {
  const r = aplicarInventarioDocumento(idRem, 'remisiones', 'salida', usuario);
  const hoja = asegurarHoja('remisiones');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0]; const idx = {}; headers.forEach((h,i)=>idx[h]=i);
  let pedOrigen = '';
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.id] === idRem) { pedOrigen = datos[i][idx.pedido_origen] || ''; break; }
  }
  let liberados = 0;
  if (pedOrigen) liberados = _ajustarComprometido(_itemsDeDoc('pedidos', pedOrigen), -1);
  return { ok:true, salida: r, liberados: liberados };
}

// ============================================================
// v0.9.15 — FLUJO NUEVO DE VENTA (cotización → pedido = venta → factura opcional)
// ============================================================
function _hoyISO(){ return new Date().toISOString().substring(0,10); }
function _filaPorId(tabla, id){
  const S = _leerHoja(tabla), k = String(id || '').trim(); if (!k) return null;
  for (let i = 1; i < S.filas.length; i++) if (String(S.filas[i][S.idx.id]) === k || (S.idx.folio !== undefined && String(S.filas[i][S.idx.folio]).trim() === k && tabla !== 'cobranza')) {
    const o = {}; S.headers.forEach((h, j) => { let v = S.filas[i][j]; if (v instanceof Date) v = v.toISOString(); o[h] = v; }); return { S, i, obj: o };
  }
  return null;
}
function _poner(f, campo, valor){ if (f && f.S.idx[campo] !== undefined) { f.S.hoja.getRange(f.i + 1, f.S.idx[campo] + 1).setValue(valor); f.obj[campo] = valor; } }
function _anotar(tabla, id, texto){ const f = _filaPorId(tabla, id); if (f) _poner(f, 'notas', (f.obj.notas ? String(f.obj.notas) + ' · ' : '') + texto); }
function _cobroPropioPedido(idPedido){
  const S = _leerHoja('cobranza'), k = String(idPedido || '');
  for (let i = 1; i < S.filas.length; i++) {
    if (String(S.filas[i][S.idx.factura_origen]) === k && !/cancel/i.test(String(S.filas[i][S.idx.estatus] || ''))) { const o = {}; S.headers.forEach((h, j) => o[h] = S.filas[i][j]); return o; }
  }
  return null;
}
function _creditoDias(cliente){
  try { const S = _leerHoja('clientes'); for (let i = 1; i < S.filas.length; i++) if (String(S.filas[i][S.idx.razon_social]).trim() === String(cliente || '').trim()) return parseInt(S.filas[i][S.idx.credito_dias]) || 0; } catch(e) {}
  return 0;
}
function cotizacionApartar(id, usuario){ const n = _ajustarComprometido(_itemsDeDoc('cotizaciones', id), +1); if (n) registrarBitacora(usuario || '', 'apartar_inventario', 'cotizaciones', id, n + ' SKU(s) apartados'); return { ok:true, apartados:n }; }
function cotizacionLiberar(id, usuario){
  const f = _filaPorId('cotizaciones', id); if (!f) return { ok:false, error:'No encontré la cotización' };
  if (/convertida/i.test(String(f.obj.estatus || ''))) return { ok:true, liberados:0 }; // lo apartado ya se liberó al confirmarla
  const n = _ajustarComprometido(_itemsDeDoc('cotizaciones', id), -1); if (n) registrarBitacora(usuario || '', 'liberar_apartado', 'cotizaciones', id, n + ' SKU(s) liberados'); return { ok:true, liberados:n };
}
// El pedido se vuelve VENTA: descuenta inventario y nace su cobro (uno solo). liberarApartado = si el pedido había apartado al crearse.
function activarPedido(idPedido, usuario, liberarApartado){
  const f = _filaPorId('pedidos', idPedido); if (!f) return { ok:false, error:'No encontré el pedido' };
  const p = f.obj;
  if (/cancel/i.test(String(p.estatus || ''))) return { ok:false, error:'El pedido está cancelado' };
  if (/^bind_/.test(String(p.id))) return { ok:false, error:'Los pedidos de Bind no se confirman aquí (ya tienen su venta)' };
  if (_cobroPropioPedido(p.id)) return { ok:false, error:'Este pedido ya está confirmado (ya tiene su cobro en Cobranza)' };
  if (liberarApartado) _ajustarComprometido(_itemsDeDoc('pedidos', p.id), -1);
  const inv = aplicarInventarioDocumento(p.id, 'pedidos', 'salida', usuario);
  const hoy = _hoyISO(), cred = _creditoDias(p.cliente), venc = new Date(hoy + 'T12:00:00'); venc.setDate(venc.getDate() + cred);
  const total = parseFloat(p.total) || 0;
  const cob = { id:'cob_' + p.id, fecha_entrega:hoy, fecha_emision:hoy, fecha_vencimiento:venc.toISOString().substring(0,10), cliente:p.cliente, tipo:'Pedido',
    numero:String(p.folio || p.id), estatus:'pendiente', vendedor:p.vendedor || '', descripcion:'Venta del pedido ' + (p.folio || '') + (p.cotizacion_origen ? ' (cotización ' + p.cotizacion_origen + ')' : ''),
    credito:cred, total:total, cobrado:0, pendiente:total, dias_vencido:0, sin_entregar:'', folio_fiscal:'', factura_origen:p.id };
  const rc = erpCrear('cobranza', cob); if (!rc.ok) return rc;
  _poner(f, 'estatus', 'confirmado');
  registrarBitacora(usuario || '', 'activar_pedido', 'pedidos', p.id, 'venta ' + total + ' · cobro ' + cob.id);
  return { ok:true, pedido:p, cobro:cob, inventario:inv };
}
function confirmarCotizacion(idCot, usuario){
  const f = _filaPorId('cotizaciones', idCot); if (!f) return { ok:false, error:'No encontré la cotización' };
  const c = f.obj;
  if (/convertida/i.test(String(c.estatus || ''))) return { ok:false, error:'Esta cotización ya se confirmó (es pedido)' };
  if (/rechaz|cancel/i.test(String(c.estatus || ''))) return { ok:false, error:'La cotización está ' + c.estatus };
  let its = []; try { its = JSON.parse(c.items_json || '[]'); } catch(e) {}
  if (!its.length) return { ok:false, error:'La cotización no tiene productos' };
  const ped = { id:'ped_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2,6), folio:'', fecha:_hoyISO(), cliente:c.cliente, vendedor:c.vendedor || '',
    comision_pct:c.comision_pct || '', cotizacion_origen:String(c.folio || c.id), subtotal:c.subtotal, iva:c.iva, total:c.total, sin_iva:c.sin_iva || '', estatus:'borrador',
    items_json:c.items_json, fecha_entrega:'', sin_entregar:'', notas:'De la cotización ' + (c.folio || ''), creado_por:usuario || c.creado_por || '' };
  const r = erpCrear('pedidos', ped); if (!r.ok) return r;
  _ajustarComprometido(its, -1);               // lo apartado por la cotización se libera…
  const a = activarPedido(ped.id, usuario, false); // …y el pedido descuenta el inventario y crea su cobro
  const f2 = _filaPorId('cotizaciones', idCot);
  _poner(f2, 'estatus', 'convertida'); _poner(f2, 'notas', (f2.obj.notas ? String(f2.obj.notas) + ' · ' : '') + 'Confirmada: pedido ' + r.item.folio + ' (' + _hoyISO() + ')');
  registrarBitacora(usuario || '', 'confirmar_cotizacion', 'cotizaciones', idCot, 'pedido ' + r.item.folio);
  return { ok: !!a.ok, pedido:r.item, cobro:a.cobro, error:a.error };
}
// Cancelar un pedido que ya es venta: solo si no tiene pagos ni factura viva. Cancela su cobro y regresa el inventario. No se borra nada.
function cancelarPedidoVenta(idPedido, usuario, motivo){
  const f = _filaPorId('pedidos', idPedido); if (!f) return { ok:false, error:'No encontré el pedido' };
  const p = f.obj, cob = _cobroPropioPedido(p.id);
  if (!cob) { const l = pedidoLiberar(p.id, usuario); _poner(f, 'estatus', 'cancelado'); return { ok:true, flujo:'anterior', liberados:l.liberados }; }
  if ((parseFloat(cob.cobrado) || 0) > 0.005) return { ok:false, error:'El pedido tiene pagos por $' + (parseFloat(cob.cobrado) || 0).toFixed(2) + '. Primero cancela esos pagos.' };
  const F = _leerHoja('facturas'), viva = [];
  for (let i = 1; i < F.filas.length; i++) {
    const po = String(F.filas[i][F.idx.pedido_origen] || '').split(/[,;]/).map(x => x.trim());
    if ((po.indexOf(String(p.folio)) >= 0 || po.indexOf(String(p.id)) >= 0) && !/cancel/i.test(String(F.filas[i][F.idx.estatus] || ''))) viva.push(F.filas[i][F.idx.folio]);
  }
  if (viva.length) return { ok:false, error:'El pedido tiene la factura ' + viva.join(', ') + ' sin cancelar. Cancélala primero.' };
  const fc = _filaPorId('cobranza', cob.id);
  _poner(fc, 'estatus', 'cancelado'); _poner(fc, 'pendiente', 0);
  _poner(fc, 'descripcion', String(cob.descripcion || '') + ' · cancelado el ' + _hoyISO() + (motivo ? ': ' + motivo : ''));
  const inv = aplicarInventarioDocumento(p.id, 'pedidos', 'entrada', usuario);
  _poner(f, 'estatus', 'cancelado');
  registrarBitacora(usuario || '', 'cancelar_pedido_venta', 'pedidos', p.id, motivo || '');
  return { ok:true, cobro:cob.id, inventario:inv };
}
function stockDisponible() {
  const hoja = asegurarHoja('productos');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0]; const idx = {}; headers.forEach((h,i)=>idx[h]=i);
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    const act = parseFloat(datos[i][idx.stock_actual]) || 0;
    const com = parseFloat(datos[i][idx.stock_comprometido]) || 0;
    out.push({ sku: datos[i][idx.sku], descripcion: datos[i][idx.descripcion],
               stock_actual: act, comprometido: com, disponible: act - com });
  }
  return { ok:true, items: out };
}

// v0.9.8 — Regenera los timbres compactos (QR) desde los XML guardados y sobrescribe el KV.
function cfdiRegenerarTimbres(codigo){
  const hoja = asegurarHoja('cfdixml');
  const datos = hoja.getDataRange().getValues();
  const h = datos[0]; const idx = {}; h.forEach((x,i)=>idx[x]=i);
  const partes = {};
  for (let i=1;i<datos.length;i++){
    const uuid = String(datos[i][idx.uuid]||'').toUpperCase();
    if(!uuid) continue;
    const parte = parseInt(datos[i][idx.parte])||0;
    if(!partes[uuid]) partes[uuid]=[];
    partes[uuid][parte] = datos[i][idx.xml]||'';
  }
  const g = (xml,re)=>{ const m=xml.match(re); return m?m[1]:''; };
  const timbres = {};
  Object.keys(partes).forEach(uuid=>{
    const xml = partes[uuid].join('');
    const selloCFD = g(xml,/SelloCFD="([^"]*)"/) || g(xml,/\sSello="([^"]*)"/);
    const selloSAT = g(xml,/SelloSAT="([^"]*)"/);
    timbres[uuid] = {
      uuid: uuid,
      ft: g(xml,/FechaTimbrado="([^"]*)"/),
      sc: selloCFD.substring(0,180),
      fe: selloCFD.slice(-8),
      ss: selloSAT.substring(0,180),
      nc: g(xml,/\sNoCertificado="([^"]*)"/),
      ns: g(xml,/NoCertificadoSAT="([^"]*)"/),
      pac: g(xml,/RfcProvCertif="([^"]*)"/),
      re: g(xml,/Emisor[^>]*?Rfc="([^"]*)"/),
      rr: g(xml,/Receptor[^>]*?Rfc="([^"]*)"/),
      tt: g(xml,/\sTotal="([^"]*)"/)
    };
  });
  kvGuardar({ 'nun_cfdi_timbres': JSON.stringify(timbres) }, codigo || '');
  return { ok:true, timbres_regenerados: Object.keys(timbres).length };
}

// ============================================================
// ROUTER
// ============================================================
function doGet(e) {
  try {
    const tabla = e.parameter.tabla;
    // v0.9.2 — El CRM pide GET ?tabla=gastos|ingresos|cobranza|clientes y espera { ok, data:[...] }.
    // v0.9.9 — ahora pide el código de un usuario activo (&codigo=) y nunca entrega Usuarios.
    if (tabla) {
      const sesion = validarSesion(e.parameter.codigo);
      if (!sesion.ok) return resp({ ok:false, error:'AUTH: ' + (sesion.error || 'sesión inválida'), requiere_login:true });
      const real = _tablaCRM(tabla) || (TABLAS[tabla] ? tabla : null);
      if (real && !TABLAS_PRIVADAS[real]) {
        const r = erpListar(real);
        return resp({ ok: r.ok, data: r.items || [], items: r.items || [], error: r.error });
      }
      return resp({ ok:false, error:'Tabla no disponible' });
    }
    return resp({ ok:true, mensaje:'NUN ERP backend ' + VERSION_ERP });
  } catch(err) {
    return resp({ ok:false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const accion = body.accion;

    // ===== AUTH (lo único que no pide código de usuario) =====
    if (accion === 'login') return resp(validarCodigo(body.codigo, body.device_id, body.device_name));

    // ===== v0.9.9 — CANDADO DE SESIÓN PARA TODO LO DEMÁS =====
    // (antes solo algunas acciones lo pedían; p. ej. capturar_pago, crear/actualizar/eliminar del CRM,
    //  inicializar y siguiente_folio funcionaban sin código)
    // En las acciones de usuarios, body.codigo es el usuario A CAMBIAR; quien lo pide va en codigo_admin
    const esAccUsuarios = /^(listar_usuarios|crear_usuario|actualizar_usuario|eliminar_usuario|liberar_dispositivo)$/.test(String(accion));
    const codigoSesion = esAccUsuarios ? body.codigo_admin : (body.codigo || body.codigo_usuario || body.codigo_admin);
    const sesion = validarSesion(codigoSesion);
    if (!sesion.ok) return resp({ ok:false, error:'AUTH: ' + (sesion.error || 'sesión inválida'), requiere_login:true });

    // ===== v0.9.13 — en Google ya no se guarda nada: la verdad está en Supabase =====
    if (!_enSupabase() && !ACC_EN_GOOGLE.test(String(accion))) return resp({ ok:false, recargar:true, error:'El sistema ya usa el servidor nuevo: recarga la página (en compu Ctrl+Shift+R; en celular cierra y abre la app). No se guardó nada.' });

    // ===== v0.9.12 — cualquier acción que no sea de solo lectura invalida las listas en memoria =====
    if (!/^(erp_listar|listar_|obtener_|cfdi_xml_get|facturama_estado|siguiente_folio_ver|leer|consultar|buscar|version)/.test(String(accion))) _listaInvalidar();

    // ===== v0.9.9 — Usuarios nunca por las acciones genéricas =====
    if (/^erp_/.test(String(accion)) && TABLAS_PRIVADAS[body.tabla]) return resp({ ok:false, error:'Tabla no disponible' });

    // ===== v0.9.9 — Bind apagado =====
    if (accion === 'bind_proxy' || /^sync_bind_/.test(String(accion))) {
      if (accion === 'sync_bind_estado') return resp(syncBindEstado());
      if (accion === 'sync_bind_setup_trigger') return resp(syncBindSetupTrigger(0));
      return resp({ ok:false, error:'Bind ya no se usa (desde el 29-sep-2026)' });
    }

    if (accion === 'liberar_dispositivo') return resp(liberarDispositivo(body.codigo_usuario, body.device_id, body.codigo_admin));
    if (accion === 'listar_usuarios')     return resp(listarUsuarios(body.codigo_admin));
    if (accion === 'crear_usuario')       return resp(crearUsuario(body.datos, body.codigo_admin));
    if (accion === 'actualizar_usuario')  return resp(actualizarUsuario(body.codigo, body.cambios, body.codigo_admin));
    if (accion === 'eliminar_usuario')    return resp(eliminarUsuario(body.codigo, body.codigo_admin));
    if (accion === 'inicializar') {
      if (!validarAdmin(codigoSesion)) return resp({ ok:false, error:'No autorizado' });
      return resp(inicializarERP());
    }

    // ===== EMPRESA / FOLIOS / BITÁCORA =====
    if (accion === 'obtener_empresa')     return resp({ ok:true, config: obtenerEmpresaConfig() });
    if (accion === 'guardar_empresa')     return resp(guardarEmpresaConfig(body.config, body.codigo_admin));
    if (accion === 'siguiente_folio')     return resp(siguienteFolio(body.tipo_documento, body.serie));
    if (accion === 'listar_bitacora')     return resp(listarBitacora(body.filtros, body.codigo_admin));

    // ===== CUENTAS =====
    if (accion === 'listar_cuentas')      return resp({ ok:true, cuentas: obtenerCuentas() });
    if (accion === 'guardar_cuentas') {
      if (!validarAdmin(body.codigo_admin)) return resp({ ok:false, error:'No autorizado' });
      guardarCuentas(body.cuentas);
      return resp({ ok:true });
    }

    // ===== VENDEDORES =====
    if (accion === 'listar_vendedores')   return resp({ ok:true, vendedores: obtenerVendedores() });
    if (accion === 'guardar_vendedores') {
      if (!validarAdmin(body.codigo_admin)) return resp({ ok:false, error:'No autorizado' });
      guardarVendedores(body.vendedores);
      return resp({ ok:true });
    }

    // ===== v0.7.0 — KV STORE (estado compartido multi-usuario) =====
    if (accion === 'kv_guardar') return resp(kvGuardar(body.pares || {}, body.codigo || ''));
    if (accion === 'kv_leer')    return resp({ ok:true, valores: kvLeerTodo() });

    // ===== v0.8.0 — CFDI XML en backend =====
    if (accion === 'cfdi_xml_guardar') return resp(cfdiXmlGuardar(body.docs || []));
    if (accion === 'cfdi_xml_get')     return resp(cfdiXmlGet(body.uuid || ''));
    if (accion === 'cfdi_xml_uuids')   return resp(cfdiXmlUuids());
    if (accion === 'cfdi_regenerar_timbres') {
      if (!validarAdmin(codigoSesion)) return resp({ ok:false, error:'No autorizado' });
      return resp(cfdiRegenerarTimbres(body.codigo));
    }

    // ===== v0.9.0 — FACTURAMA (timbrado directo) =====
    if (accion === 'facturama_guardar_cred') return resp(facturamaGuardarCredenciales(body.usuario, body.password, body.modo, body.codigo_admin));
    if (accion === 'facturama_estado')       return resp(facturamaEstado());
    if (accion === 'facturama_timbrar')      return resp(facturamaTimbrar(body.cfdi || {}));
    if (accion === 'facturama_cancelar')     return resp(facturamaCancelar(body.id, body.motivo));

    // ===== v0.9.7 — INVENTARIO AUTOMATICO (hooks antes del CRUD genérico) =====
    if (accion === 'erp_crear' && body.tabla === 'pedidos') {
      const r = erpCrear('pedidos', body.item || {});
      if (r.ok && r.item && !r.ya_existia) { try { pedidoApartar(r.item.id, body.codigo); } catch(e){} }
      return resp(r);
    }
    if (accion === 'erp_crear' && body.tabla === 'remisiones') {
      const r = erpCrear('remisiones', body.item || {});
      if (r.ok && r.item && !r.ya_existia) { try { remisionAplicar(r.item.id, body.codigo); } catch(e){} }
      return resp(r);
    }
    // v0.9.15 — cotización (aparta inventario) → pedido (venta)
    if (accion === 'erp_crear' && body.tabla === 'cotizaciones') {
      const r = erpCrear('cotizaciones', body.item || {});
      if (r.ok && r.item && !r.ya_existia) { try { cotizacionApartar(r.item.id, body.codigo); } catch(e){} }
      return resp(r);
    }
    if (accion === 'cotizacion_liberar')    return resp(cotizacionLiberar(body.id, body.codigo));
    if (accion === 'confirmar_cotizacion')  return resp(confirmarCotizacion(body.id, body.usuario || body.codigo));
    if (accion === 'activar_pedido')        return resp(activarPedido(body.id, body.usuario || body.codigo, true));
    if (accion === 'cancelar_pedido_venta') return resp(cancelarPedidoVenta(body.id, body.usuario || body.codigo, body.motivo || ''));
    // v0.9.9 — cancelar un pedido libera lo apartado (el pedido NO se borra; el ERP lo marca cancelado)
    if (accion === 'pedido_liberar')   return resp(pedidoLiberar(body.id, body.codigo));
    if (accion === 'erp_eliminar' && body.tabla === 'pedidos') {
      try { pedidoLiberar(body.id, body.codigo); } catch(e){}
      return resp(erpEliminar('pedidos', body.id));
    }
    if (accion === 'stock_disponible') return resp(stockDisponible());

    // ===== CRUD GENÉRICO =====
    if (accion === 'erp_listar'     && TABLAS[body.tabla]) return resp(erpListar(body.tabla));
    if (accion === 'erp_crear'      && TABLAS[body.tabla]) return resp(erpCrear(body.tabla, body.item || {}));
    if (accion === 'erp_bulk_crear' && TABLAS[body.tabla]) return resp(erpBulkCrear(body.tabla, body.items || []));
    if (accion === 'erp_borrar_prefijo') return resp(erpBorrarPorPrefijo(body.prefijo || ''));
    if (accion === 'erp_actualizar' && TABLAS[body.tabla]) return resp(erpActualizar(body.tabla, body.item || {}));
    if (accion === 'erp_eliminar'   && TABLAS[body.tabla]) return resp(erpEliminar(body.tabla, body.id));
    if (accion === 'erp_importar'   && TABLAS[body.tabla]) return resp(erpImportarBulk(body.tabla, body.items));

    // ===== INVENTARIO =====
    if (accion === 'registrar_mov_inventario') return resp(registrarMovInventario(body));
    if (accion === 'listar_movimientos_sku')   return resp(listarMovimientosSku(body.sku));

    // ===== COBRANZA / PAGOS =====
    if (accion === 'capturar_pago_cliente')    return resp(capturarPagoCliente(body));

    // ===== v0.3.0 — CONVERSIONES Y AFECTACIÓN =====
    if (accion === 'convertir_documento')      return resp(convertirDocumento(body.tabla_origen, body.id_origen, body.tabla_destino, body.usuario));
    if (accion === 'recibir_oc')               return resp(recibirOrdenCompra(body.id_oc, body.usuario));
    if (accion === 'confirmar_pedido')         return resp(confirmarPedido(body.id_pedido, body.usuario));
    if (accion === 'aplicar_inventario_doc')   return resp(aplicarInventarioDocumento(body.id_doc, body.tabla, body.tipo_mov, body.usuario));

    // ===== v0.4.0 — REPORTES =====
    if (accion === 'reporte_aging')            return resp(reporteAging());
    if (accion === 'reporte_estado_cuenta')    return resp(reporteEstadoCuenta(body.cliente));
    if (accion === 'reporte_pyl')              return resp(reportePyL(body.año));
    if (accion === 'reporte_top_clientes')     return resp(reporteTopClientes(body.año));
    if (accion === 'reporte_top_productos')    return resp(reporteTopProductos(body.año));
    if (accion === 'reporte_comisiones')       return resp(reporteComisiones(body.mes, body.año));
    if (accion === 'kardex_producto')          return resp(kardexProducto(body.sku));

    // ===== v0.5.0 — IMPORTACIONES =====
    if (accion === 'guardar_importacion')      return resp(guardarImportacion(body));
    if (accion === 'cerrar_importacion')       return resp(cerrarImportacion(body.id, body.usuario));
    if (accion === 'calcular_prorrateo')       return resp({ ok:true, items: calcularProrrateoImportacion(body.items || [], body.gastos_mxn, body.tc, body.base) });
    if (accion === 'margen_importacion')       return resp(reporteMargenImportacion(body.id));
    if (accion === 'guardar_tc')               return resp(guardarTC(body));
    if (accion === 'obtener_tc_reciente')      return resp(obtenerTCmasReciente(body.moneda));

    // ===== v0.6.0 — MULTI-ALMACÉN y CRM =====
    if (accion === 'transferir_inventario')    return resp(transferirInventario(body));
    if (accion === 'stock_por_almacen')        return resp(stockPorAlmacen());
    if (accion === 'ultima_compra')            return resp({ ok:true, ultima: ultimaCompraCliente(body.cliente) });
    if (accion === 'listar_cumpleaños')        return resp(listarCumpleaños());
    if (accion === 'mover_etapa_oportunidad')  return resp(moverEtapaOportunidad(body.id, body.etapa, body.usuario));
    if (accion === 'marcar_recordatorio')      return resp(marcarRecordatorio(body.id, body.completado, body.usuario));

    // ===== v0.9.2 — CONSOLIDACIÓN CRM (cobranza / pagos / aplazamientos / importaciones) =====
    if (accion === 'editar_pago_manual')       return resp(editarPagoManual(body));
    // CRUD genérico "corto" del CRM (tabla + accion). tabla: gastos|clientes|cobranza|ingresos.
    if (accion === 'crear'      && _tablaCRM(body.tabla)) return resp(erpCrear(_tablaCRM(body.tabla), body.item || {}));
    if (accion === 'actualizar' && _tablaCRM(body.tabla)) return resp(erpActualizar(_tablaCRM(body.tabla), body.item || {}));
    if (accion === 'eliminar'   && _tablaCRM(body.tabla)) return resp(erpEliminar(_tablaCRM(body.tabla), body.id)); // v0.9.9 marca, no borra
    // Cobranza / pedidos del CRM.
    if (accion === 'crear_pedido')             return resp(crmCrearPedido(body));
    if (accion === 'actualizar_pedido')        return resp(crmActualizarPedido(body.id, body.cambios || {}));
    if (accion === 'capturar_pago')            return resp(capturarPagoCliente(body));
    if (accion === 'obtener_pagos_doc')        return resp(crmObtenerPagosDoc(body.id_doc));
    // Aplazamientos de alertas del CRM.
    if (accion === 'listar_aplazamientos')     return resp(crmListarAplazamientos(body.codigo_usuario));
    if (accion === 'guardar_aplazamiento')     return resp(crmGuardarAplazamiento(body));
    if (accion === 'eliminar_aplazamiento')    return resp(crmEliminarAplazamiento(body.codigo_usuario, body.alerta_id));
    // Importaciones batch (upsert) del CRM.
    if (accion === 'importar_cobranza_batch')  return resp(crmImportarCobranzaBatch(body.items || []));
    if (accion === 'importar_ingresos_batch')  return resp(crmImportarIngresosBatch(body.items || []));
    if (accion === 'importar_gastos_batch')    return resp(crmImportarGastosBatch(body.items || []));
    // v0.9.6 — Upsert masivo generico sobre cualquier tabla del ERP (clave configurable, ej. 'sku')
    if (accion === 'erp_upsert_batch' && TABLAS[body.tabla]) return resp(_crmUpsertBatch(body.tabla, body.items || [], body.clave || 'id'));
    if (accion === 'importar_clientes_batch')  return resp(crmImportarClientesBatch(body.items || []));
    // v0.9.9 — mantenimiento destructivo desactivado
    if (accion === 'dedupe_cobranza')          return resp(crmDedupeCobranza(!!body.dry_run));
    if (accion === 'borrar_todo_cobranza')     return resp(crmBorrarTodo('cobranza'));
    if (accion === 'borrar_todo_ingresos')     return resp(crmBorrarTodo('ingresos'));

    return resp({ ok:false, error:'Acción desconocida: ' + accion });
  } catch(err) {
    return resp({ ok:false, error: err.toString() });
  }
}

function resp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
