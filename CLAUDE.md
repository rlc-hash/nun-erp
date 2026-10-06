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
- Backend: Google Apps Script. Su código está en `backend/Codigo.gs` (v0.9.12; el usuario RAFA- solo lo ve y cambia Rafa; sin códigos de acceso: el maestro va en
  Propiedades del script → `codigo_maestro`). Claude NO puede publicarlo: Rafa lo pega en el editor de Apps Script y hace
  Implementar → Administrar implementaciones → editar la activa (…Dt2A) → Versión nueva (la URL no cambia).
  Prueba: `node pruebas/prueba_backend_v099.js` (hoja simulada). Nunca usar el backend viejo `AKfycbz9oHW…`.
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
- ERP y app comparten localStorage `nun_cache_*` con formas distintas: aceptar `{items:[...]}` y arreglo.

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
