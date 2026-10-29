# Sistema NUN — instrucciones para Claude

ERP y app de vendedores de Comercializadora Casraf (marca NUN). Dueño: Rafa. Háblale en español mexicano,
directo y sin tecnicismos. El estado del negocio (saldos, pendientes, decisiones) está en el proyecto de
Claude "NUN ERP Y CRM" (TRASPASO_28sep2026.md e HISTORIAL_DE_VERSIONES.md), NO en este repo.
Este repo puede ser público: no escribas aquí datos de clientes, montos, RFC ni contraseñas.

## Reglas de Rafa (siempre)
- Antes de cambiar el sistema, pruébalo. Súbelo solo cuando funcione y dile qué cambió y cómo lo probaste.
- Cada cambio al código lleva versión nueva (v3.80, v3.81…) y se ve en el letrero de arriba:
  `<span class="rwd-version">v3.xx · Sistema NUN ✓</span>` en index.html. La app de vendedores (crm.html) va en v1.9.x.
- Nunca borres datos: se marcan como cancelados o duplicados.
- Antes de timbrar, cancelar ante el SAT o registrar pagos: pide confirmación.
- Rafa escribe sus contraseñas e inicios de sesión; tú no.
- Si algo no cuadra, di cuál está mal (sistema, Bind o su Excel) y por qué.
- No decidas por él ni rellenes datos que no dio: si falta un dato, márcalo como faltante.
- Todo lo que esté a nombre de RAFAEL LANIADO CATTAN es de prueba (Yazmín practica ahí para aprender la plataforma): no cuenta para decisiones del negocio.

## Estado de operación (actualizado 30 sep 2026)
- **Bind ya NO se usa desde el 29 sep 2026** (`NUN_BIND_APAGADO` en index.html). Todo se captura en NUN; lo que vino de Bind
  (ids `bind_…`) es historial y no se borra. Facturama se queda (es el PAC que timbra).
- Cuentas donde entra dinero: **BBVA** y **Efectivo** (falta confirmar con Rafa una tercera que mencionó).
- Inventario: solo se lleva para mercancía NUEVA (lo que había antes del corte no se cuenta).
- Crédito: no se bloquea a clientes vencidos. Precios: los vendedores ponen el que quieran.
- Rafa autorizó que Claude publique directo en main y opere GitHub.

## Archivos
- `index.html` — ERP completo (~800 KB, un solo archivo, JS en línea). Publicado en GitHub Pages:
  https://rlc-hash.github.io/nun-erp/ (tarda ~1 min en actualizarse después del push).
- `crm.html` — app de vendedores (misma base de datos). `importar.html` — importador de XML.
- Backend: Google Apps Script. Su código está en `backend/Codigo.gs` (v0.9.17: productos con costo_factura/precio_factura; v0.9.15: flujo cotización→pedido; bitácora/inventario guardan solo el inicio del código (RAFA-…), nunca el código completo; v0.9.14: erp_upsert_batch vacía un campo solo con item._vaciar=['campo'] — un '' normal se ignora; en Google ya NO se guarda, solo entrar/usuarios/Facturama/lecturas; en Supabase la propiedad `en_supabase=1` deja todo normal; el usuario RAFA- solo lo ve y cambia Rafa; sin códigos de acceso: el maestro va en
  Propiedades del script → `codigo_maestro`). Claude NO puede publicarlo: Rafa lo pega en el editor de Apps Script y hace
  Implementar → Administrar implementaciones → editar la activa (…Dt2A) → Versión nueva (la URL no cambia).
  Prueba: `node pruebas/prueba_backend_v099.js` (hoja simulada). Nunca usar el backend viejo `AKfycbz9oHW…`.
- **Servidor: Supabase desde el 6 oct 2026 (v4.11 / app v1.9.18)**, proyecto vlqbzfotjltarelwenvu (Ohio), función `nun`:
  https://vlqbzfotjltarelwenvu.supabase.co/functions/v1/nun. Corre `backend/Codigo.gs` SIN CAMBIOS sobre la tabla `nun_hojas`
  (una fila por hoja; `supabase/functions/nun/emulador.js`); respaldo de cada hoja cada 2 h en `nun_historial`; `nun_log` = tiempos.
  Entrar (login), usuarios y Facturama se le pasan a Google (ahí viven los códigos y las credenciales del PAC).
  La hoja de Google YA NO se actualiza: la verdad está en Supabase. Si cambias Codigo.gs: `python3 supabase/publicar.py`
  (y si toca login/usuarios/Facturama, Rafa también lo pega en Apps Script). Prueba: `node pruebas/prueba_supabase_emulador.js`.
  Desde v4.12 / app v1.9.19, si una página abierta es vieja sale un aviso para recargar (compara con la página publicada).
  `supabase/copiar_de_google.py` copió las hojas de Google (solo volver a usarlo con autorización de Rafa: reemplaza lo de Supabase).
- `pruebas/` — pruebas con jsdom y backend simulado. Correr desde la raíz del repo:
  `for f in pruebas/*.js; do node $f; done` (requiere `npm i jsdom`). Cada una imprime un JSON; revisar que no haya "error".
  `NUN_INDEX=otra/ruta/index.html node pruebas/prueba_v379.js` prueba otra copia.

## Cómo trabajar un cambio
1. Edita index.html (busca por nombre de función; los bloques nuevos llevan comentario `// v3.xx`).
2. `node --check` a cada bloque `<script>` (extráelos a archivos .js).
3. Prueba nueva en `pruebas/` para lo que cambiaste + corre todas las anteriores (deben dar lo mismo salvo la versión).
4. Sube la versión del letrero, commit ("Sistema NUN v3.xx: …"), push a main.
5. Espera ~1 min y verifica en línea con `?v=3xx` en la URL. Al final, actualiza el historial y el traspaso del proyecto.

## Backend (acciones de `api({accion, ...})`)
erp_listar(tabla) · erp_upsert_batch(tabla, items:[{id, campos}]) = actualiza SOLO los campos enviados ·
erp_crear · erp_actualizar (fila completa) · convertir_documento · capturar_pago_cliente (cobranza + ingresos + pagos) ·
facturama_timbrar(cfdi) (Facturama API Web, PRODUCCIÓN) · facturama_cancelar · facturama_estado ·
cfdi_xml_get(uuid) / cfdi_xml_guardar · bind_proxy · listar_cuentas · obtener_empresa.
- El backend TIRA columnas que no existen en la hoja (ej. facturama_id): esos datos van en `notas`.
- Para cambios de datos: simula primero en memoria, luego `erp_upsert_batch` solo con los campos que cambian.

## Trampas conocidas
- Google Sheets guarda fechas como ISO con hora (`2026-09-07T06:00:00.000Z`) y quita el 0 inicial del CP (06020 → 6020;
  al facturar se rellena con padStart(5)). Fechas sin hora se leen a mediodía local para no recorrer el día.
- `fmtFecha` muestra año ("29 sep 26"). Los campos `<input type=date>` necesitan `substring(0,10)`.
- Redondeo SAT: por renglón `base = round2(cant*pu - desc)`, `iva = round2(base*16%)`, totales = sumas (`nunCalcLinea`, `nunCalcDoc`).
- IVA solo 16% o 0%.
- UUIDs: Facturama los da en minúsculas, Bind en mayúsculas; `cfdi_xml_get` se prueba con ambas.
- `convertir_documento` del servidor crea el documento SIN productos y con su propio folio (FAC-2026-…): el sistema
  copia productos y renombra el cobro (v3.78/v3.79).
- Las hojas de Google EmpresaConfig y Cuentas tenían columnas con nombre repetido: `erp_listar` las daba vacías y la copia a Supabase
  (6 oct) perdió RFC/CP de la empresa y tipo/activa de cuentas. Reparado el 8 oct desde `obtener_empresa`/`listar_cuentas`.
- ERP y app comparten localStorage `nun_cache_*` con formas distintas: aceptar `{items:[...]}` y arreglo.

## Flujo de venta (desde v4.14 / app v1.9.20 / servidor v0.9.15, decidido por Rafa el 7 oct 2026)
- El vendedor (app) solo sube **cotizaciones** (folio C0001, estatus enviada): apartan inventario (stock_comprometido).
- Rafa o Yazmín: **✅ Confirmar → Pedido** (`confirmar_cotizacion`): nace el pedido (P…, confirmado), se libera lo apartado, se
  descuenta el inventario (MovInventario salida) y nace UN cobro en Cobranza: id `cob_<pedidoId>`, tipo `Pedido`, `factura_origen` = id del pedido.
  Ese pedido es la venta del mes (tablero) y cuenta para comisiones por lo cobrado.
- Si piden factura: **🧾 Hacer factura** desde el pedido; la factura NO crea cobro: lleva en notas `Cobro en P0001 (id cob_…)` y se cobra en el del pedido.
- Las remisiones ya no se usan (quedan como historial). Pedido capturado directo en borrador → **✅ Confirmar pedido** (`activar_pedido`).
- Cancelar un pedido-venta: `cancelar_pedido_venta` (no si tiene pagos o factura viva); cancela su cobro y regresa el inventario.
- Lo anterior (Bind, remisiones y facturas con su propio cobro) se queda igual.
- **v4.41 (19 oct 2026, Rafa): se cierra todo con remisiones** hasta que arranquen los vendedores. Un pedido confirmado (con su cobro `cob_<pedidoId>`)
  SÍ lleva 📦 Hacer remisión: si la remisión es por todo, el cobro del pedido PASA a la remisión (numero = folio R, tipo Remisión, factura_origen = id de la
  remisión, y sus ingresos cambian `factura` al folio R); si es parcial, se resta del cobro del pedido y la remisión lleva su cobro. Va con `_sin_inventario`
  (el inventario ya salió al confirmar).
- v4.42: documento VIGENTE (factura/remisión) sin cobro vivo sale en "Falta cuadrar" de la ficha con ＋ Crear cobro / ↺ Reactivar cobro
  (`nunDocsSinCobro`, `nunArreglarCobro`). Ojo: si se cambia una factura de cancelada a timbrada a mano, su cobro NO se arregla solo.
- v4.43 pedido con nota `[revisado` sale "cerrado ✓". v4.44 ficha: tabla "Pedidos (como tu Excel)" Total · Pagado · Falta (`nunPedidosExcelCalc`):
  Falta = pendiente de los cobros del pedido (de sus docs, su cobro propio y cobros manuales con `[pedido 1224]` en la descripción). Factura en 2 pedidos
  (`pedido_origen` "1194, 1113") = "comparte factura"; su saldo cuenta en el primero.
- v4.46 factura de VARIAS remisiones (`pedido_origen` "R0022, REM 317, R0023", sin cobro propio): 💵 Registrar pago abre un reparto
  (`nunPagoFacturaVarias`) que registra el pago en el cobro de cada remisión (monto por renglón con `pedido` "… (R0022)"; si no, la más vieja
  primero). Su saldo = total − ingresos con "Pago de la factura FT…".
- v4.48/v4.49 **Cotizador y márgenes** (menú, permiso ver_financieros), como el Excel de Rafa: una tarjeta por producto (MOQ, costo China USD,
  arancel aprox. 1.15/1.25, TC, flete/maniobras/pedimento real/otros cada uno en USD o MXN, margen). Calcula mientras escribe (no redibuja).
  DOS precios: SIN factura = costo China × (arancel + 16% IVA) + gastos ÷ MOQ ÷ (1 − margen), sin IVA; CON factura = sin ese IVA ÷ (1 − margen) y
  + 16% al final. Con pedimento real: IVA que se aparta = 16% del valor China en pesos, se resta al pedimento para el precio con factura.
  kv `nun_costeos` (v:2, `filas`; los v4.48 se migran con `nunCosteoMigrar`), se archivan, no se borran; borrador en localStorage `nun_costeo_borrador`.
  📦 pasa a Productos: costo/precio = sin factura, costo_factura/precio_factura = con factura sin IVA (columnas nuevas, servidor v0.9.17).
  Márgenes reales por pieza (ganancia total ÷ venta total, sin IVA; doc con IVA usa costo_factura). Calculadora con y sin factura.
  En el teléfono el encabezado esconde el buscador para que quepan los botones. Prueba `prueba_v449_cotizador.js`.
- v4.51 **Teléfono**: bloque CSS `v4.51` (≤880px): la página nunca más ancha que la pantalla (si no, el celular agranda todo y el encabezado/fichas
  se ven corridos), acciones del título y filtros se acomodan, tablas se deslizan con el folio fijo, KPIs en 2 columnas, fichas a pantalla completa con
  pestañas deslizables; tocar fuera del menú lo cierra. Revisión con Playwright 390px de todos los módulos (ancho = 390).
- v4.52 botón **📱/💻** arriba (`nunCambiarModo`, localStorage `nun_modo`; sin elegir = teléfono si la pantalla ≤880): modo teléfono (`body.modo-cel`) = tablas
  `.dt` como tarjetas (`nunCelEtiquetar` pone `data-l` con el título de la columna; MutationObserver), barra abajo Inicio/Cobranza/Clientes/Pedidos/Más;
  modo compu en el teléfono = viewport 1280 (se ve como en la computadora). Prueba `prueba_v452_modo_cel.js`.
- v4.53 **Adquisición de mercancía** (menú, ver_financieros): solicitud mensual de factura de compra a Calix (CFDI G01, PPD, forma 99, cliente Casraf)
  con las facturas timbradas del mes (se quitan/agregan, ej. del 30 sep). Precio = el de referencia si existe (v4.54: no se mueve; SF003/SF004 1478);
  si es modelo nuevo, promedio ponderado vendido × 0.80 redondeado. Carry on y piezas Z = 53121503 (kv `nun_adquisicion`: proveedor, precios, historial). ML/Amazon se suma con los demás con los mismos precios (v4.55). Claves SAT YH 24111514 · Z/INDIVIDUAL 53121503 ·
  RL/SF 53121502. v4.56: sugiere las timbradas de los últimos días del mes anterior (＋ con un toque) y lo agregado/quitado
  se guarda por mes (`meses` en el kv). Avisos antes de pedirla. Excel con el formato de su SOLICITUD DE FACTURA (ExcelJS de cdnjs). Prueba `prueba_v453_adquisicion.js`.
- v4.57 Menú: ⭐ Favoritos (Clientes, Productos, Pedidos, Facturas, Remisiones, Cobranza; localStorage `nun_favoritos` para cambiarlos) y 🕘 Recientes
  (últimos 3 que abrió, `nun_uso_mod`), sección **Contabilidad** (Estados Financieros, Resultados por mes, Cotizador, Adquisición), **Herramientas**
  (Cuadre Excel, Importar CFDI). Botones de Bind escondidos por CSS (`button[onclick*="Bind"]`, `rwdSync`, `.rwd-sync-bar`). En el teléfono el menú
  solo se cierra al cambiar de pantalla (antes un refresco lo cerraba). Adquisición: modelo nuevo = 80% del precio MÁS BAJO y al guardar queda como
  referencia; sugerencias = 2 últimos días con facturas; solicitudes del historial se cancelan (no se borran). Prueba `prueba_v457_menu.js`.
- v4.58 **App instalable** con el logo NUN: `manifest.webmanifest` + `icons/` (192, 512, maskable 512, apple-touch-icon 180, del mismo trazo del logo)
  y `sw.js` mínimo SIN caché (solo para que Chrome la instale; nunca sirve versiones viejas). Antes el manifest era data:URL con "NUN" en texto y
  Chrome hacía acceso directo con su insignia. Instalar: Chrome ⋮ → Instalar app / Agregar a pantalla principal. Prueba `prueba_v458_app.js`.
- v4.59 Tarjetas del modo teléfono compactas: `tr` en grid de 2 columnas (título arriba, dato con su etiqueta chica), título = nombre (razón social/cliente)
  si la 1a columna es RFC/SKU/fecha (esa va chiquita como `cel-sub`), se ocultan vacíos y lo que repite el nombre (`cel-vacio`); ≥560px = 2 tarjetas por fila.
- v4.60 Tocar el **logo NUN** = actualizar (`nunActualizarTodo`): si hay versión publicada más nueva recarga con ?v=…; si no, vuelve a bajar las tablas
  y el kv y redibuja. Factura de remisiones (pedido_origen "R…, REM …") se ve en "Pedidos (como tu Excel)" en el pedido de cada remisión (solo
  mostrar: no suma cobros; marca borrador). Prueba `prueba_v460_actualizar_y_factura_en_pedido.js`.
- v4.61 Lista de Facturas: estatus dice **timbrada** (+ **pagada** si ya no debe) en vez de "activa". Pago de factura PUE de varias remisiones: la fecha
  sale igual a la de la factura y la cuenta BBVA ya seleccionada (se puede cambiar). Prueba en `prueba_v446_pago_factura_varias.js`.
- v4.62 Cobro encontrado SOLO por folio (`nunCobroDeDoc`, `nunSaldoDocBase`) cuenta solo si es del mismo cliente o de su grupo (`nunCobroMismoCli`):
  folios de NUN chocaban con los de Bind de otro cliente y la factura salía pagada. Al timbrar una PUE con saldo pregunta si registrar su pago. Prueba `prueba_v462_pue_folio.js`.
- v4.38 Pagos de la ficha con estatus y botón Cancelar · v4.39 el cliente de factura no suma doble (cuenta en el principal) · v4.40 la ficha se pone al día sola.

## Cuadre de clientes (v4.20–v4.29, 12 oct 2026)
- Mismo cliente = NOMBRE COMPLETO igual (`nunCliNorm`: sin acentos/puntos/espacios dobles/"S.A. de C.V."). Error de 1–2 letras
  o nombre cortado se acepta para ligar (`nunMismoCliente`) pero la ficha lo AVISA y no lo cuenta. Antes bastaban 2 palabras y se mezclaban clientes.
- Ficha del cliente: Documentos con filtros, "🧩 Falta cuadrar" (de `nunCuadreCalc`), ✕ Cancelar pedido (solo dueño), 📦 Crear pedido
  (venta directa: `ped_vd_<id doc>`, sin cobro ni inventario). Cliente de factura (kv `nun_relaciones_clientes`): botones 🤝.
- Folio de pedido repetido de Bind: siempre gana el pedido vivo sobre el cancelado (ligas, cadena, auditoría).
- Saldo < $1 en Cobranza = pagado (centavos de Bind). Complementos de Bind en notas: `REP BIND-145 uuid=… monto=… fecha=… parc=… sant=…`.
- 📦 Hacer remisión (v4.30): solo pedidos viejos SIN cobro propio (no borrador). Si el pedido es de Bind, la remisión y el pedido de venta
  directa van con `item._sin_inventario=true` (servidor v0.9.16: erp_crear no aparta ni descuenta). Los del flujo nuevo no llevan remisión.
- Estatus del pedido se sube solo al ligar (`nunPedidosAlDia`: confirmado → entregado → facturado, solo si está surtido completo).

## Convenciones de datos
- Folios NUN: Pedido P0001, Remisión R0001, Factura FT0001 (Serie FT), complemento de pago CP0001 (Serie CP),
  nota de crédito NC0001 (Serie NC, CFDI de Egreso ligado a la factura con relación 01 — la serie NC debe existir en Facturama).
  Los de Bind: numéricos, V01…, A… Las series FT y CP existen en Facturama (Lugar de Expedición → Principal → Series).
- Ligas: `pedido_origen` de remisión/factura = folio del pedido; factura de remisión = "REM 322" o "R0001".
  Cobranza `numero` = folio (remisiones de Bind "V01"+folio); `factura_origen` = id del documento.
  Notas de crédito: `documento_origen` = folio de factura o "V01"+remisión.
- Complementos de pago en `notas` de la factura: `REP CP0001 uuid=… monto=… fecha=AAAA-MM-DD parc=N sant=SALDO_ANTERIOR`
  (sant desde v3.81; para facturas timbradas en Bind el saldo anterior y la parcialidad los confirma Rafa).
- Vendedor siempre en MAYÚSCULAS (EDGAR, LUIS, ESTEBAN, YADAH, RAFA, CASA). RAFA y CASA = 0% de comisión COMO VENDEDOR;
  aparte, RAFA y YADAH cobran 4% de socio sobre TODO lo cobrado (confirmado por Rafa, 30 sep 2026).
- Documento a nombre de CASA cuyo cliente tiene vendedor en el catálogo: la comisión de lo cobrado es del vendedor del catálogo
  (confirmado por Rafa). No debería haber casos así: el botón "🔎 CASA con vendedor" en Comisiones los lista para corregirlos.
- Dueños (Gastos, borrar pagos, etc.) se reconocen por cómo EMPIEZA el código de acceso: `RAFA-`, `YADAH-`, `MASTER-NUN-`.
  Nunca escribir códigos de acceso completos en el código ni en este repo.
- Ingresos con tipo CANCELADO_BIND o DUPLICADO_BIND no cuentan.

## Funciones clave (index.html)
abrirDoc · guardarDoc · convertirDocConItems · nunFacturarRemision · facturaTimbrar / facturaDatosTimbrado /
facturaTimbradoConfirmar · nunAbrirComplementoPago · nunRelDoc · nunPanelDoc · nunRelacionadosHTML · nunArchivosHTML ·
nunPdfREP · nunPdfDoc · imprimirDocumento · nunSaldoDoc · nunCobroDeDoc · afterRenderCobranza · abrirDetalleCliente.
