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
- **v4.63 / app de vendedores v2.0 / servidor supabase-1.2 + v0.9.18 (3 nov 2026, decidido por Rafa)**: los vendedores usan la app NUEVA
  `vendedores.html` (instalable, `manifest-vendedores.webmanifest`): Inicio (vendido/cobrado del mes, te deben, comisión aprox. = % propio de lo cobrado),
  Cotizar (sube cotización con folio '' → el servidor pone C…; cliente nuevo queda a su nombre), Pedidos (estado y lo que falta, sumando los cobros de sus
  remisiones/facturas), Clientes (saldo, WhatsApp, 💵 Registrar pago) e Inventario (disponible = existencia − apartado; nunca costos).
  `crm.html` manda a cualquier sesión con rol vendedor a la app nueva (crm.html queda para la oficina, v1.9.22).
  El SERVIDOR (index.ts) filtra para rol vendedor: al entrar guarda en `nun_sesiones` rol/vend/todos(ver_todos_clientes)/cotiza(agregar_pedidos y no
  solo_consulta); solo tablas clientes/productos/cotizaciones/pedidos/facturas/remisiones/cobranza/ingresos/notascredito/pagosverificar; productos sin costo ni
  costo_factura; sin gastos ni kv; el que no ve a todos (Luis, Esteban) solo sus clientes (clientes.vendedor) y docs con su nombre; Edgar a todos.
  Escribe solo: erp_crear cotizaciones (si cotiza; el servidor pone vendedor/estatus enviada), clientes (a su nombre) y pagosverificar (estatus por_verificar);
  erp_upsert_batch solo para cancelar SU cotización enviada (el servidor libera lo apartado) o SU pago por verificar. Sesión sin rol guardado y no admin =
  "vuelve a entrar" una vez. Pago del vendedor = tabla `pagosverificar` (no toca Cobranza); en el ERP, Cobranza muestra "🔔 N pagos reportados" →
  ✅ Verificar y registrar (`nunPVVerificar`: capturar_pago_cliente con la cuenta/fecha elegidas + estatus verificado) o ✕ Rechazar (motivo). Nada se borra.
  Pruebas: `prueba_servidor_vendedores.js` (corre el index.ts real sin tipos con base y Google simulados), `prueba_vendedores_v200.js`, `prueba_v463_pagos_verificar.js`.
- v4.64 / app v2.0.1 / servidor supabase-1.3 (4 nov): con muchas lecturas al mismo tiempo una conexión del pooler se quedaba trabada (ClientRead) y colgaba
  las demás (la app no cargaba). Ahora: LECTURAS con límite de 20 s → pool nuevo y un reintento (`lectura()` en index.ts; las escrituras nunca se repiten);
  la app pide de 3 en 3 con límite de 40 s y pinta conforme llega. La app trae también lo de la anterior: Cobranza (con saldo/vencidos/pagados),
  Pagos y comisión por mes (tocar Cobrado/Comisión en Inicio) y Facturas/Remisiones en Pedidos.
- v4.65 (v4.66 en el letrero = junta con la v4.64 de costos hecha en otra sesión) / app v2.0.2 / servidor supabase-1.4 (4 nov): **avisos** de lo que suben los vendedores. ERP: campana con "N cotizaciones por confirmar" y
  "N pagos por verificar" (ya no avisa de Bind); cada minuto revisa cotizaciones/pagosverificar y si llega algo nuevo sale arriba (una vez; vistos en
  localStorage `nun_avisos_vistos`); lista de Cotizaciones dice "por confirmar"/"confirmada · pedido". **Push al teléfono**: campana → 📱 Activar
  (`nunPushActivar`; iPhone solo con el sistema instalado). Servidor: `supabase/functions/nun/push.js` (Web Push aes128gcm + VAPID con WebCrypto, sin
  librerías; verificado contra http_ece), llaves en nun_props `push_vapid`, suscripciones `push:<huella>` (oficina, no vendedores; las que ya no existen se
  marcan activo:false); al crear un vendedor una cotización o un pago por verificar manda el aviso (?ir=cotizaciones / ?ir=cobranza abre el ERP ahí; `sw.js`
  muestra el aviso). Las props `push%` no pasan a Codigo.gs. App: 📄 PDF de cotización/pedido/factura/remisión IGUAL al del ERP con `nun-pdf.js`
  (copia de imprimirDocumento; si cambias el PDF del ERP: `python3 herramientas/copiar_pdf.py`). Pruebas `prueba_v465_avisos.js` y push en `prueba_servidor_vendedores.js`.
- **App de vendedores v2.1 (4 nov): vive en `ventas/index.html`** (liga https://rlc-hash.github.io/nun-erp/ventas/) con SU PROPIO alcance de app
  (`ventas/manifest.webmanifest` id/start_url/scope "./", `ventas/sw.js`) [si GitHub Pages se traba ("in progress deployment" / un re-run que no sale de la fila),
  un push nuevo arranca otra publicación; revisar con gh api repos/rlc-hash/nun-erp/actions/runs; el 6 nov un deploy falló y su re-run se quedó en "queued": también se arregló con un push nuevo] e ícono BLANCO con logo negro (`ventas/icons/`, el del ERP invertido). Antes
  vendedores.html compartía el alcance "./" del ERP y el teléfono abría el ERP. `vendedores.html` y `crm.html` (v1.9.23) mandan a `ventas/`.
  Donde arriba dice vendedores.html / manifest-vendedores.webmanifest, ahora es ventas/index.html / ventas/manifest.webmanifest. El PDF usa `../nun-pdf.js`.
- v4.67 / app v2.1.1 / servidor supabase-1.5 (4 nov): Usuarios con columna **Sesiones** ("2 de 5" dispositivos) y 🚪 Cerrar sesión por usuario o
  🚪 Cerrar sesión de todos (menos tú): libera sus dispositivos (liberar_dispositivo) y `cerrar_sesiones` (servidor, solo admin) deja su sesión sin rol →
  su siguiente movimiento pide su código. App de vendedores: botón **Salir**. Prueba `prueba_v467_cerrar_sesiones.js`.
  ⚠ Al cambiar usuarios por API (actualizar_usuario / liberar_dispositivo) el usuario a cambiar va en `codigo` / `codigo_usuario` y el tuyo en
  `codigo_admin`: un ayudante que ponga tu código en `codigo` cambia TU usuario (pasó el 4 nov y se corrigió).
- v4.68 / app v2.1.2 (4 nov): Chrome del teléfono de Rafa tenía guardada una instalación vieja rota ("Ya se instaló esta app" y al abrir "No se pudo
  abrir la app"). Se cambió el `id` de los manifests (ERP `./?app=nun-erp-2` "NUN ERP"; ventas `./?app=nun-ventas-2` "NUN Ventas") y el link lleva ?v=
  para que Chrome los tome como apps nuevas. Si vuelve a pasar: subir el número del id.
  App v2.1.3: Ventas ya no está fijada en vertical (orientation any, como el ERP): en el Fold abierto la orientación fija puede impedir abrirla.
- v4.69 (4 nov): Capturar pago salía sin cuentas (las cuentas solo se pedían al abrir el sistema y esa vez no llegaron). Ahora si un cobro se abre con la
  lista vacía se vuelven a pedir y el selector se llena solo (`nunCuentasSiFaltan` / `nunCuentasRellenar`: pcCuenta, repCuenta, pfvCuenta); al tocar el
  logo se recargan con cargarCuentas (solo activas, sin repetir; ya no por erp_listar). Prueba `prueba_v469_cuentas.js`.
- v4.70 (5 nov): **ERP como app en dirección propia** https://rlc-hash.github.io/nun-app/ (repo `rlc-hash/nun-app`, archivos en `herramientas/app-erp/`):
  Chrome del teléfono de Rafa tenía registrada una app vieja con alcance /nun-erp/ y no dejaba instalar nada ahí. La página de nun-app NO copia el
  sistema: baja /nun-erp/index.html al abrir (con `<base href="/nun-erp/">`, su manifest y su sw.js con avisos push) → mismo sistema, datos y sesión.
  `window.NUN_PAGINA` hace que el aviso de versión nueva revise /nun-erp/ y en la app recargue en lugar de cambiar de dirección.
  Si se cambia herramientas/app-erp/, hay que subirlo también al repo nun-app.
  (5 nov) Rafa logró instalar el ERP desde /nun-erp/ directo; el repo nun-app NO se creó (queda listo en herramientas/app-erp por si hace falta).
  App de vendedores v2.1.4 se llama **NUN CRM** (manifest id ./?app=nun-crm-3).
  En /nun-erp/ventas/ Chrome NO deja instalar el CRM si el ERP ya está instalado (queda dentro de su alcance) → CRM en dirección propia
  https://rlc-hash.github.io/nun-crm/ (repo `rlc-hash/nun-crm`, archivos en `herramientas/app-crm/`, mismo esquema que app-erp: baja ventas/index.html al abrir).
  (6 nov) En /nun-crm/ Chrome del teléfono de Rafa decía "Ya se instaló esta app" aunque nunca se instaló → la app vive en **/nun-crm/app/**
  (manifest id ./?app=nun-crm-5, sw con alcance /nun-crm/app/); /nun-crm/ solo manda a app/. La liga para vendedores sigue siendo /nun-crm/.
  Para crear el repo/Pages Rafa lo hace a mano (Settings → Pages → main / root → Save); Claude no puede prender Pages por API.
- App de vendedores v2.1.5 (6 nov): el PDF de factura timbrada sale con QR del SAT y sellos (nun-pdf.js ahora trae también cfdiTimbreHTML/cfdiTimbreData;
  la app baja el XML con cfdi_xml_get al abrir la factura) y botón 📃 XML (comparte el archivo en el teléfono). Prueba `prueba_v215_crm_xml_qr.js`.
  v2.1.6: **💬 Enviar por WhatsApp** (`enviarWA`/`enviarWAYa`): el vendedor palomea PDF / XML / mensaje; al abrir la hoja se preparan los archivos
  (`pdfArchivo`: el HTML de imprimirDocumento en un iframe oculto → html2pdf.js 0.10.1 de cdnjs, cargado DENTRO del iframe con sus opciones creadas ahí;
  el QR se dibuja con qrcode-generator 1.4.4 de cdnjs porque la imagen de api.qrserver.com no se deja copiar; el logo SVG se pasa a <img> con su tamaño)
  y Enviar usa navigator.share (el teléfono pide tocar un botón: por eso se preparan antes). Solo mensaje = wa.me con el teléfono del cliente.
  En la compu baja los archivos y abre WhatsApp. Revisado con Playwright (PDF real, logo y QR bien).
  v2.1.7: Chrome en Android NO deja compartir archivos .xml (navigator.share da "Permission denied"; su lista permitida no trae xml) → se comparte
  solo el PDF (y mensaje) y el XML se guarda en Descargas ANTES de compartir (bajar no gasta el permiso de tocar); el vendedor lo adjunta con 📎 → Documento.
  El botón 📃 XML también solo baja el archivo.
  v2.1.8 (decidido por Rafa 6 nov): **Cotizar** muestra la lista del inventario a la vista (solo disponible > 0, activos) y se agrega con un toque
  (✓ N = ya en la cotización; el buscador filtra). Las piezas **INDIVIDUALES** (`esIndividual`: sku empieza con Z o la descripción dice INDIVIDUAL,
  ej. ZRL004…) NO se cotizan: solo sirven para facturar. Prueba `prueba_v218_cotizar_lista.js`.
  v2.1.9 (Rafa 9 nov): **carry on por SET de 6** (`pzSet`: categoría CARRY ON o sku RL0xxCO…): Inventario y Cotizar muestran sets ("31 sets (186 pz)",
  lista = precio × 6 "el set"); en la cotización el renglón va en sets con botón para partirlo en **Piezas** (`modoLinea`). Se GUARDA en piezas
  (cantidad × 6, precio ÷ 6; la descripción dice "· N sets de 6 pz") porque el inventario y lo apartado van en piezas. Maletas de set de 3
  (unidad 'juego') dicen "sets". La cotización arranca **sin IVA** (conIva false). Prueba `prueba_v219_carry_on_sets.js`.
- Productos RL009–RL012 (9 nov, datos cargados por Claude con autorización de Rafa): sets 3 pz `RL009N`… (unidad juego, clave SAT 53121502) y carry on
  `RL009CON`… (pieza, 53121503); color: PU púrpura, N, R rosa, PL plata, RD rosa dorado, LV lila, K caqui, AG azul gris, RJ rojo, OR oro rosa,
  AO azul oscuro, QG quartz gris, BC beige claro. Precio CON IVA (precio = con IVA, precio_factura = ÷1.16). Costos pendientes.
- v4.71 (6 nov, Rafa) **Estado de cuenta del cliente**: Cobranza → 📄 Estado de cuenta (y botón en "Pedidos (como tu Excel)" de la ficha) →
  `nunEstadoCuentaAbrir(cliId)`: eliges cliente (lista), palomeas pedidos (Todos / Solo los que deben / a mano) y documentos con saldo SIN pedido
  (cobros vivos que no usa ningún pedido; `nunPedidosExcelCalc` ahora regresa también `cobs`), con o sin detalle de productos y pagos recibidos
  (ingresos cuyo `factura` es el folio del pedido, de sus documentos o de sus cobros). PDF con la marca NUN (`nunECHTML`): Total · Pagado ·
  Saldo pendiente (con letra). Mismos números que la ficha. Prueba `prueba_v471_estado_cuenta.js`.
- v4.72 / app v2.1.10 (10 nov, Rafa): **quién subió la cotización** (`creado_por`; el servidor lo pone en las del CRM, el ERP pone el nombre de quien
  la captura): columna "Subió" en Cotizaciones del ERP y "subió X" en el CRM. Prueba `prueba_v472_quien_subio.js`.
- Contenedores RL009–RL012: los pedidos de contenedor se cargan como cotizaciones SIN IVA (precio de contenedor; si piden factura el IVA va dentro).
  Cuando un cliente se lleva un contenedor completo se le da entrada a ese contenedor y su cotización lo aparta (lo libre no cambia).
- Ingresos repetidos (limpiados 10 nov 2026, autorizado por Rafa): el cuadre cliente por cliente dejó Cobranza bien, pero en Ingresos seguían los
  pagos de Bind ("PAGO", a veces con el nombre del cliente escrito distinto) junto a los capturados en NUN ("cobro"). Regla: en cada documento los pagos
  vivos = Cobranza.cobrado; el que sobra → tipo DUPLICADO_BIND con comentario (nunca borrar; respetar el que coincide con un complemento timbrado).
  Ojo: el mismo cliente puede venir escrito distinto (comparar nombres parecidos), y también puede haber folios iguales de clientes distintos.
  Los 37 AJUSTE de 2025 "Ajuste histórico cuadre cobranza-bind" (cuenta Banco sin fecha) se pasaron a CANCELADO: cliente por cliente sus documentos
  ya estaban pagados con pagos reales. Resultado: pagos vivos = Cobranza.cobrado al centavo (ERP y CRM).
- v4.73 / app v2.1.11 (10 nov): ERP (`nunSepararIngresos`) y CRM (`ingresosValidos`) ya NO esconden por regla los pagos "ING-…" anteriores al corte
  de Bind (escondía pagos buenos); solo no cuentan los marcados CANCELADO/DUPLICADO. `_nunNumDoc` hace trim (el 2o folio de "F-V01 26, F-V01 2"
  no se reconocía). Prueba `prueba_v473_pagos_cuentan.js`. Auditoría con datos reales: Cobranza = pagos (ERP `nunCuadreIngresosCobranza` dif 0, CRM igual).
- v4.74 (10 nov): aviso rojo "El servidor no respondió: estás viendo la última copia…" en el teléfono → las listas se piden de 4 en 4
  (`nunTurnoLectura` en cargarTabla) y si alguna falla se reintenta sola a los 15 s, 30 s, 1 y 2 min (`nunReintentarListas`); el aviso se quita al llegar.
  Prueba `prueba_v474_reintento_listas.js`.
- v4.75 / app v2.1.12 (10 nov): el cliente de PRUEBA (RAFAEL LANIADO CATTAN, `_nunEsPrueba` / `esPrueba`) no cuenta en comisiones del ERP
  (`nunFilasComision`) ni en vendido / cobrado / te deben / comisión del CRM. Sus pagos de práctica se quedan como están. Prueba `prueba_v475_prueba_fuera.js`.
- v4.76 / servidor supabase-1.6 (11 nov, Rafa): **avisos a Rafa de lo que hace la oficina** (Yazmín u otro cuyo código no empieza con RAFA-/MASTER-NUN-):
  documento nuevo (erp_crear/convertir_documento de cotizaciones, pedidos, remisiones, facturas, notas de crédito, gastos), timbrar y cancelar ante el SAT, capturar_pago_cliente,
  confirmar cotización/pedido, cancelar pedido o documento (`avisoOficina` / `avisarRafa` en index.ts). Solo a suscripciones con `dueno:true` (se marca al activar
  con código de Rafa; el ERP vuelve a registrar solo una vez los equipos ya activados: `nunPushReRegistrar`, localStorage `nun_push_v476`) y nunca a quien lo hizo.
  Modo teléfono: las casillas (cantidad, precio) ya no se esconden como vacías en las tarjetas (`nunCelEtiquetar`). Pruebas `prueba_v476_avisos_oficina.js`, `prueba_v476_cel_casillas.js`.
- v4.77 / app v2.1.13 / servidor v0.9.19 (11 nov, Rafa): **🚚 Envío** = por dónde se manda la mercancía (fletera, paquetería, recoge). Columna nueva `envio` en
  cotizaciones/pedidos/remisiones/facturas (se crea sola). El vendedor la pone al cotizar (opcional; sugiere las ya usadas: `enviosUsados`); `confirmar_cotizacion`
  la pasa al pedido; en el ERP es un campo del documento (`dEnvio`, `nunEnviosUsados`), columna "Envío" en Cotizaciones/Pedidos y pasa del pedido a la remisión/factura
  (convertirDocConItems). Pruebas `prueba_v477_envio.js` (servidor), `prueba_v477_envio_erp.js`, `prueba_v2113_crm_envio.js`.
- v4.78 / app v2.1.14 (11 nov, Rafa): **carry on por CAJA en el documento**. El renglón se sigue guardando en PIEZAS (inventario, apartado, márgenes) con
  `pz_caja: 6`; el PDF (imprimirDocumento → `nunLineaCaja`, copiado a nun-pdf.js) y la app lo muestran como N cajas × precio de la caja con
  "caja de 6 pz (pieza $550.00)", mismo total. Si las piezas no completan cajas se ve en piezas. La app pone pz_caja al cotizar en sets. Se aplicó a
  C0004–C0008 y C0013 (totales iguales). Prueba `prueba_v478_carry_on_caja.js`.
- v4.79 / servidor supabase-1.7 (11 nov, Rafa): **📎 comprobantes de pago** (foto o PDF) en Cobranza: campo en Capturar pago (se sube después de registrar
  el pago; si falla, el pago queda y avisa), pestaña "📎 Comprobantes" del cobro (ver / subir más / cancelar solo admin) y 📎N junto al número en la lista
  (`nunCompSubir`, `nunCompPintar`, `nunCompMarcarLista`). Fotos se achican a JPEG ≤1600 px. Se guardan en la tabla `nun_archivos` (fuera de nun_hojas;
  base64, por `cobro_id`; nunca se borran: `cancelado`). Acciones del servidor `archivo_subir|listar|ver|conteo|cancelar` (solo oficina; cancelar solo admin).
  Pruebas `prueba_v479_comprobantes.js` (servidor) y `prueba_v479_comprobantes_erp.js` (Playwright).
  (11 nov) Yazmín: máx. dispositivos 5. ⚠ El ayudante api.py de Claude PISA `codigo` con su propio código: para acciones de usuarios llamar directo.
- v4.80 / app v2.1.15 / servidor supabase-1.8 (11 nov, Rafa): **carry on SIEMPRE por caja de 6**. Editor del ERP: Cant. = cajas y Precio = precio de la caja
  (se guarda en piezas con pz_caja: 6; `_docPz`, `_docCajaTxt`, `nunEsCarryOn`); al poner un SKU de carry on queda en cajas solo. App: dice "cajas" (antes "sets")
  y ya no se parte en piezas. Se puso pz_caja a C0015. **Foto del comprobante del vendedor**: al reportar un pago (`subirComprobante`, id `cmp_<pvId>`, después
  del pago; si falla, el pago queda y el botón reintenta sin duplicar); el servidor solo la acepta para SU pago por_verificar y la liga al cobro de ese pago
  (ref "Reportado por X · pv:<id>"); el aviso dice 📎. En el ERP "Pagos por verificar" trae 📎 Ver comprobante (`nunPVComprobantes`) y la pestaña Comprobantes
  marca el estatus del pago reportado. Pruebas `prueba_v480_comprobante_vendedor.js`, `prueba_v480_editor_cajas.js`, `prueba_v2115_crm_comprobante.js`.
- **v4.81 / app v2.1.16 (11 nov, Rafa: "olvídalo, por pieza está mejor")**: el carry on vuelve a ir **POR PIEZA** en editor, PDF y app. Lo de caja (v4.78/v4.80/
  v2.1.15) queda APAGADO con un interruptor: `NUN_CARRY_CAJA = false` (index.html; nunLineaCaja/_docPz/editor) y `CARRY_CAJA = false` (ventas/index.html, pzSet).
  Los renglones que ya traen `pz_caja: 6` se ven en piezas (el dato no estorba). Para volver a cajas: poner los dos en true (y copiar_pdf.py).
- v4.82 / servidor supabase-1.9 (11 nov, Rafa): (1) **lentitud**: la función se congela entre peticiones y al despertar reusaba conexiones que el pooler
  ya cerró → lecturas de 20–100 s (LECTURA_TRABADA / CONNECTION_DESTROYED en nun_log). Ahora `poolFresco()`: tras 4 s sin peticiones (y nada en curso) abre
  pool nuevo. Medir con nun_log (p90 por hora). (2) Los usuarios NO tienen nombre guardado: `nombreDe`/`prefijoNombre` usan nombre → vendedor_asignado →
  inicio del código en avisos y nun_log ("✅ <Nombre> confirmó la cotización C… → pedido P…"). (3) ERP: confirmar cotización/pedido ya no espera a bajar
  listas: pone al día lo que se ve con la respuesta (`nunAlDiaLocal`) y refresca en el fondo (`nunRefrescarFondo`); Estado de cuenta y Cuadrar por cliente
  abren al momento (`nunTablaLista`: solo esperan lo que no está bajado). (4) **Estado de cuenta** con el formato de Rafa (azul marino + franja naranja, Fecha
  de corte, Periodo, % cubierto, Detalle de pedidos con Días y Liquidado/Parcial/Pendiente, Historial de pagos; sin piezas por defecto) y en el teléfono se
  hace un PDF de verdad (`nunHtmlAPdf`, html2pdf 0.10.1 de cdnjs) con 📥 Guardar / 📤 Compartir. (5) Regla de Rafa: todo pedido debe estar en Cobranza (ya no
  se remisiona): un pedido parcial con solo parte facturada lleva un cobro `cob_<pedidoId>` (tipo Pedido, numero "PED <folio>") por lo que falta.
  Pruebas `prueba_v482_nombre_y_conexiones.js`, `prueba_v482_rapido.js`, `prueba_v471_estado_cuenta.js` (diseño nuevo).
- v4.83 (11 nov, Rafa): Estado de cuenta con buscador propio (en Android el datalist no mostraba la lista): se escribe parte del nombre y se toca el
  cliente (`nunECBuscar`/`nunECTomar`). Ficha: "Pedidos y saldo (según el sistema)" (antes "como tu Excel") con **💵 Pago** en cada pedido con saldo
  (`nunPagoDePedido`: abre Capturar pago del cobro del pedido con saldo más viejo). Rafa propone cobrar sobre el PEDIDO sin remisiones (pendiente que decida).
- v4.84 / app v2.1.17 (11 nov, Rafa): botón **📄 Estado de cuenta** en cada cliente de la lista de Clientes y arriba en su ficha. El diseño del estado de
  cuenta quedó aparte en `nunECHTMLDe(D)` (solo usa lo que recibe; copiado a nun-pdf.js junto con `nunLogoPDF` por copiar_pdf.py). La app de vendedores lo
  tiene en la hoja del cliente (`estadoCuenta`/`datosEC`: pedidos vivos con lo que falta según `cobrosDePedido`, cobros sueltos con saldo, pagos válidos;
  PDF con `htmlAPdf`) con 💬 Enviar por WhatsApp (navigator.share, el PDF se prepara antes) y 📥 Guardar. Prueba `prueba_v2117_crm_estado_cuenta.js`.
- v4.85 (11 nov, Rafa): Estado de cuenta del ERP (Cobranza/ficha) hace el PDF en compu y teléfono con **💬 Enviar por WhatsApp** (`nunECWhatsApp`: en el
  teléfono comparte el archivo; en la compu baja el PDF y abre wa.me con el teléfono del cliente y el saldo), 📥 Guardar y 🖨 Imprimir (compu).
  `nunHtmlAPdf` con límite de 25 s (si no sale: aviso + Imprimir). Prueba `prueba_v485_estado_cuenta_whatsapp.js` (Playwright, generador simulado).
- v4.86 / servidor supabase-2.0 (11 nov, Rafa): **el aviso abre ESE documento**. Las ligas de los avisos traen `?ir=<módulo>&id=…` (o `&folio=…` para
  facturas timbradas, `&pv=…` para pagos reportados): cotización nueva → la cotización; pago reportado → Pagos por verificar; confirmada → el pedido; pago
  registrado → el cobro; documento creado/cancelado → ese documento. `sw.js` pasa id/folio/pv en el mensaje; `nunIrA(m, {id, folio, pv})` lo abre y si la
  lista aún no llega espera/reintenta (30 s). Pruebas `prueba_v486_aviso_directo.js` (servidor) y `prueba_v486_abrir_aviso.js` (ERP).
- v4.87 / app v2.1.18 (11 nov, Rafa): listas de documentos del ERP y "Cotizaciones por confirmar"/Pedidos de la app: lo más reciente arriba = fecha (sin hora,
  `nunFecha10`) y el mismo día el número de folio más alto (`nunOrdenReciente` / `masReciente`). Prueba `prueba_v487_mas_reciente_arriba.js`.
- v4.88 / servidor v0.9.20 (11 nov, Rafa): (1) % de comisión sale solo según el vendedor (`vendedoresParaSelect`: EDGAR 6, LUIS 5, ESTEBAN 5, YADAH 5)
  aunque la cotización de la app venga con comision_pct '' (antes '' contaba como puesto y guardarDoc pedía el %). (2) "✅ Confirmar → Pedido" del editor
  hace `guardarDoc(…,{luegoConfirmar:true})`: guarda lo corregido y luego confirma. (3) Codigo.gs: erp_upsert_batch/erp_actualizar de una cotización
  'enviada' que cambia items_json libera lo apartado viejo y aparta lo nuevo (antes al corregir 36→6 y confirmar quedaban 30 apartadas). Se corrigió un
  apartado que había quedado de más por eso (comprometido = suma de cotizaciones enviadas). Pruebas `prueba_v488_corregir_apartado.js`, `prueba_v488_comision_y_confirmar.js`.
- **servidor supabase-2.1 (11 nov) — LAS TRABAS, causa real**: con 4+ peticiones a la vez postgres.js metía consultas en una conexión ocupada
  (pipelining) y el pooler de Supabase (modo transacción) se congelaba: 3 respondían en 1 s y las demás 20–40 s o fallaban (reproducido con 12 lecturas
  juntas: `rafaga`). Ahora `conCupo`: máximo 3 peticiones trabajando con la base a la vez (= max del pool), las demás esperan turno; lo que va a Google
  (A_GOOGLE) no ocupa turno; el registro en nun_log va dentro del turno. Resultado real: 12 y 20 lecturas juntas en ~1 s, sin fallas (antes hasta 41 s).
  Prueba `prueba_v489_turnos.js`. Si vuelve a haber trabas: medir con nun_log (ms>20000) y ráfagas por segundo.
- v4.89 (11 nov, Rafa: tocó el aviso y quedó en el Inicio): el destino del aviso (?ir=…) se guarda en sessionStorage `nun_ir_pendiente` y boot() lo abre
  (`nunIrPendiente`; antes se navegaba antes de arrancar y boot ponía #/dashboard). sw.js: con la app abierta manda mensaje y espera respuesta 1.5 s
  (MessageChannel); si no contesta (dormida) hace navigate(liga) o openWindow. Prueba `prueba_v489_aviso_al_arrancar.js`.
- v4.90 (12 nov, Rafa: seguía en el Inicio): sw.js solo manda mensaje si una ventana del ERP está A LA VISTA (visibilityState visible); si la app está
  en segundo plano o cerrada abre la LIGA del aviso con openWindow (Android/iPhone abren la app instalada ahí). Antes el mensaje iba a una ventana escondida
  (a veces una pestaña de Chrome) y al frente quedaba la app en el Inicio. Revisado en Chrome real (Playwright, liga y mensaje).
- App v2.1.19 / servidor supabase-2.2 (12 nov, Rafa): el vendedor **✏️ Edita su cotización** mientras está por confirmar (`editarCot` la carga en Cotizar;
  `guardarEdicionCot` manda erp_upsert_batch con SOLO cliente/subtotal/iva/total/sin_iva/envio/items_json/notas; mismo id y folio). El servidor (`revisarVend`)
  solo deja corregir la SUYA en estatus enviada, con productos válidos y cliente suyo (si no ve a todos); cotizacion_liberar ahora solo corre al CANCELAR
  (al corregir, Codigo.gs v0.9.20 ya ajusta lo apartado). Aviso a la oficina "✏️ X corrigió una cotización" con liga a ella.
  Pruebas `prueba_servidor_vendedores.js` (editar-cotizacion) y `prueba_v2119_crm_editar_cotizacion.js`.
- v4.91 (12 nov, Rafa: "Pedidos dice por cobrar 1.2 y deben más"): la pantalla Pedidos sumaba solo los pedidos nuevos con cobro propio (`nunSaldoPedido`)
  y contaba los duplicados como vigentes. Ahora `nunPedidosPorCobrar` (cliente por cliente con `nunPedidosExcelCalc`, cada cobro una vez, en caché) + cobros con
  saldo sin pedido = Por cobrar de Cobranza, con aviso ✓ cuadra / ⚠ diferencia; tarjetas propias (`nunPedidosKpisHTML`: vigentes, vendido, por cobrar, por entregar).
  Prueba `prueba_v491_pedidos_por_cobrar.js`.
- v4.92 (12 nov, Rafa: "WhatsApp del estado de cuenta no funciona en mi teléfono"): en simulación de teléfono con datos reales sí compartía; en su
  teléfono algo fallaba sin aviso. Ahora `nunECWhatsApp`: si navigator.share falla (no AbortError) o el navegador no comparte archivos → `nunECPlanB`:
  baja el PDF, dice el motivo (nombre y mensaje del error) y pone botón "💬 Abrir WhatsApp" (wa.me con teléfono del cliente) para adjuntarlo con 📎.
  Nombre del PDF sin acentos. Prueba `prueba_v485_estado_cuenta_whatsapp.js` (caso celNoDeja).
- v4.93 (12 nov, Rafa: "cuadra todo… facturado contra remisiones"): **⚖️ Cuadre general** (Pedidos y Cobranza; `nunCuadreGeneral`/`nunCuadreGeneralAbrir`):
  cada cobro vivo pertenece a UN pedido (como la ficha) o queda "sin pedido"; Vendido vs Cobranza con lista de pedidos que no cuadran (los que se compensan entre
  pedidos del mismo cliente por factura compartida van aparte) y cobros sin pedido; reparto del dinero de Cobranza: Facturado (factura o remisión ya facturada) /
  Solo remisión / Pedido sin documento. `nunPedidosExcelCalc`: factura/remisión a PÚBLICO EN GENERAL con pedido_origen = folio (único) de un pedido del cliente cuenta
  en ese pedido. Dato: R0005 borrador → entregada (pagada; su pedido P0034 no la contaba). Prueba `prueba_v493_cuadre_general.js`.
  (11 nov) Las publicaciones de Pages de v4.87 y v4.88 fallaron "at startup" (GitHub): se arregla con un push nuevo.
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
