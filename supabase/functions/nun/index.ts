// ============================================================
// NUN — servidor en Supabase (función "nun"). Reemplaza al Apps Script para todo lo que es guardar y leer datos.
// · Corre backend/Codigo.gs tal cual (copiado en codigo.js por supabase/publicar.py) sobre hojas guardadas en la tabla nun_hojas.
// · Lo que necesita a Google se le pasa a Google: entrar (login), usuarios y Facturama (timbrar/cancelar),
//   porque ahí viven los códigos de acceso y las credenciales del PAC. Así ninguna contraseña se copia.
// · Los cambios se hacen de uno en uno (candado en Postgres), y cada hoja guarda una copia de respaldo cada 2 horas
//   en nun_historial (nada se pierde).
// ============================================================
import postgres from 'npm:postgres@3.4.5';
import CODIGO from './codigo.js';
import { compilar, atender } from './emulador.js';
import { crearVapid, enviar } from './push.js'; // v4.65 avisos push

const VERSION = 'supabase-2.3'; // v4.63 vendedores: cada uno recibe solo lo suyo · v4.64 lecturas trabadas se cortan y reintentan
const GOOGLE = 'https://script.google.com/macros/s/AKfycbw9_MR7axRi0a6pHpLuKB-rRUgOc3UOfOwKil3eZMpjci8JbYTNc8A3U5-wzJZ-Dt2A/exec';
// v4.18 — conexiones: primero por el pooler de Supabase (modo transacción, aguanta muchas); si no conecta, directo con 1 conexión.
// Antes (max 4 directas por pedazo del servidor) se acabaron las 60 conexiones de la base al abrir la página (≈30 listas a la vez).
const DB_DIRECTA = Deno.env.get('SUPABASE_DB_URL')!;
function urlPooler(){
  try { const u = new URL(DB_DIRECTA); if (/pooler\.supabase\.com$/.test(u.hostname)) return DB_DIRECTA;
    const ref = (u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/) || [])[1] || 'vlqbzfotjltarelwenvu';
    if (u.username === 'postgres') u.username = 'postgres.' + ref;
    u.hostname = 'aws-0-us-east-2.pooler.supabase.com'; u.port = '6543'; return u.toString(); } catch(e){ return DB_DIRECTA; }
}
let MODO_DB = 'pooler';
let sql: any = postgres(urlPooler(), { max: 3, prepare: false, idle_timeout: 5, connect_timeout: 8 });
let _dbProbada: Promise<void> | null = null;
function dbLista(){
  if (!_dbProbada) _dbProbada = (async () => {
    try { await sql`select 1`; }
    catch(e){ try { await sql.end({ timeout: 1 }); } catch(_){} MODO_DB = 'directa'; sql = postgres(DB_DIRECTA, { max: 1, prepare: false, idle_timeout: 3, connect_timeout: 8 }); }
  })();
  return _dbProbada;
}
// v4.64 — una lectura que se traba (una conexión del pooler se quedó esperando) ya no cuelga a las demás: a los 20 s se corta,
// se abre un pool nuevo y se reintenta una vez. SOLO lecturas (una escritura nunca se repite: podría quedar doble).
function poolNuevo(){ return MODO_DB === 'directa' ? postgres(DB_DIRECTA, { max: 1, prepare: false, idle_timeout: 3, connect_timeout: 8 })
                                                   : postgres(urlPooler(), { max: 3, prepare: false, idle_timeout: 5, connect_timeout: 8 }); }
async function lectura<T>(f: () => Promise<T>, ms = 20000): Promise<T> {
  for (let i = 0; ; i++) {
    let t: any; const lim = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('LECTURA_TRABADA')), ms); });
    try { return await Promise.race([f(), lim]); }
    catch(e){
      if (!String(e).includes('LECTURA_TRABADA') || i >= 1) throw e;
      const viejo = sql; sql = poolNuevo(); viejo.end({ timeout: 1 }).catch(() => {});
    } finally { clearTimeout(t); }
  }
}
let _enVuelo = 0, _ultimoUso = 0;
function poolFresco(){ const ahora = Date.now(); if (_enVuelo === 0 && _ultimoUso && ahora - _ultimoUso > 4000) { const viejo = sql; sql = poolNuevo(); viejo.end({ timeout: 0 }).catch(() => {}); } _ultimoUso = ahora; } // v4.82
const esErrorConexion = (e: unknown) => /connection slots|too many (clients|connections)|ECONNRESET|CONNECT_TIMEOUT|CONNECTION_(CLOSED|ENDED|DESTROYED)|Max client connections|terminating connection/i.test(String(e));
// Reintenta lo que falló por falta de conexión (en ese punto no se guardó nada: la transacción no llegó a confirmarse).
async function conReintento<T>(f: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await f(); }
    catch(e){ if (i >= 4 || !esErrorConexion(e)) throw e; await new Promise(r => setTimeout(r, 250 * (i + 1) + Math.random() * 200)); }
  }
}
const fn = compilar(CODIGO);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (o: unknown, extra: Record<string,string> = {}) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

// Acciones que atiende Google (códigos de acceso y credenciales de Facturama viven allá)
const A_GOOGLE = /^(login|liberar_dispositivo|listar_usuarios|crear_usuario|actualizar_usuario|eliminar_usuario|facturama_guardar_cred|facturama_estado|facturama_timbrar|facturama_cancelar)$/;
// Acciones que solo leen (no toman el candado; si alguna llegara a escribir, se repite con candado)
const A_LECTURA = /^(erp_listar|listar_|obtener_|cfdi_xml_get|cfdi_xml_uuids|kv_leer|reporte_|kardex_|stock_|ultima_compra|calcular_prorrateo|margen_importacion|version)/;
// Acciones que revisan si eres administrador
const A_ADMIN = /^(inicializar|guardar_empresa|guardar_cuentas|guardar_vendedores|listar_bitacora|cfdi_regenerar_timbres)$/;
const aprendidas = new Map<string, string[]>();   // qué hojas usó cada acción la última vez (para cargarlas de una)

async function sha(s: string){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
const norm = (c: unknown) => String(c || '').toUpperCase().trim();
// v4.82 — los usuarios no tienen nombre guardado: se usa el nombre, si no su vendedor asignado, si no el inicio del código (YAZMIN-… → Yazmin). Nunca el código completo.
const prefijoNombre = (c: unknown) => { const p = String(c || '').trim().split(/[-_\s0-9]/)[0]; return p.length >= 2 ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''; };
const nombreDe = (nombre: unknown, codigo: unknown, extra?: unknown) => String(nombre || extra || prefijoNombre(codigo) || '').slice(0, 60);

async function google(body: Record<string, unknown>, intentos = 3){
  let ultimo = '';
  for (let i = 0; i < intentos; i++){
    try {
      const r = await fetch(GOOGLE, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
      const t = await r.text();
      const j = JSON.parse(t);
      if (j && j.mensaje && /backend/.test(String(j.mensaje)) && body.accion) throw new Error('saludo');   // Google contestó sin hacer la acción
      return j;
    } catch(e){ ultimo = String(e); await new Promise(res => setTimeout(res, 1500 * (i + 1))); }
  }
  return { ok: false, error: 'Google no contestó (' + ultimo.substring(0, 80) + '). Reintenta.' };
}

// ¿Es un código activo? Se pregunta a Google una vez y se recuerda 6 horas.
async function sesion(c: string, necesitaAdmin: boolean){
  if (!c) return { ok: false, admin: false, nombre: '' };
  const h = await sha(c);
  const [s] = await sql`select admin, nombre, hasta > now() as vigente, hasta, rol, vend, todos, cotiza from nun_sesiones where h = ${h}`;
  let ok = !!(s && s.vigente), admin = !!(s && s.admin);
  if (!ok || (necesitaAdmin && s && s.admin === null)){
    const v = await google({ accion: 'listar_cuentas', codigo: c });
    if (v && v.ok) ok = true;
    else if (v && v.requiere_login) ok = false;
    else ok = !!s;   // Google caído: se acepta un código que ya era bueno
    if (ok && (necesitaAdmin || !s)){
      const a = necesitaAdmin ? await google({ accion: 'listar_bitacora', codigo_admin: c, filtros: { limite: 1 } }) : null;
      admin = a ? !!(a && a.ok) : admin;
    }
    if (ok) await sql`insert into nun_sesiones (h, admin, hasta) values (${h}, ${necesitaAdmin ? admin : (s ? s.admin : null)}, now() + interval '6 hours')
                      on conflict (h) do update set admin = excluded.admin, hasta = excluded.hasta`;
  }
  // v4.63 — sesión sin rol guardado y que no es administrador: que vuelva a entrar una vez (así se sabe si es vendedor)
  if (ok && s && !s.rol && s.admin !== true) return { ok: false, admin: false, nombre: s.nombre || '', relogin: true };
  return { ok, admin, nombre: (s && s.nombre) || '', rol: (s && s.rol) || '', vend: (s && s.vend) || '', todos: !!(s && s.todos), cotiza: !!(s && s.cotiza) };
}

// ============================================================
// v4.63 — VENDEDORES: cada uno recibe solo lo suyo (decidido por Rafa, 3 nov 2026)
// · Solo estas tablas; sin costos; sin gastos ni kv. El que no ve a todos (ver_todos_clientes) solo ve sus clientes
//   (clientes.vendedor) y los documentos con su nombre. Escribe solo: cotizaciones (si puede cotizar), clientes nuevos
//   y pagos por verificar (los confirma Rafa o Yazmín en el sistema).
// ============================================================
const T_VEND = new Set(['clientes','productos','cotizaciones','pedidos','facturas','remisiones','cobranza','ingresos','notascredito','pagosverificar']);
const A_VEND = /^(erp_listar|listar_cuentas|listar_vendedores|obtener_empresa|cfdi_xml_get|version|ping|erp_crear|erp_upsert_batch)$/;
const nCli = (x: unknown) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/S\.?\s*A\.?\s*DE\s*C\.?\s*V\.?/g, '').replace(/[^A-Z0-9]/g, '');
const SIN_COSTOS = ['costo', 'costo_factura'];
async function misClientes(se: any, m: Map<string, any>){
  const b = { accion: 'erp_listar', tabla: 'clientes', codigo: se.codigo };
  const j = JSON.parse(await lectura(() => ejecutar('post', JSON.stringify(b), b, m, false)));
  return (j.items || []).filter((c: any) => norm(c.vendedor) === se.vend);
}
async function filtrarVend(tabla: string, items: any[], se: any, m: Map<string, any>){
  if (tabla === 'productos') return items.map(p => { const q = { ...p }; SIN_COSTOS.forEach(k => delete q[k]); return q; });
  if (se.todos) return items;
  const cl = await misClientes(se, m);
  if (tabla === 'clientes') return cl;
  const mios = new Set(cl.map((c: any) => nCli(c.razon_social)));
  return items.filter(r => norm(r.vendedor) === se.vend || mios.has(nCli(r.cliente || r.contraparte)));
}
// ============================================================
// v4.65 — AVISOS PUSH a la oficina (Rafa, Yadah, Yazmín) cuando un vendedor sube una cotización o reporta un pago.
// Las suscripciones viven en nun_props ('push:<huella>' → { sub, nombre, equipo, activo }); las llaves VAPID también ('push_vapid').
// ============================================================
const CONTACTO_PUSH = 'https://rlc-hash.github.io/nun-erp/';
let _vapid: any = null;
async function vapid(){
  if (_vapid) return _vapid;
  const [r] = await sql`select v from nun_props where k = 'push_vapid'`;
  if (r) return (_vapid = JSON.parse(r.v));
  const nueva = await crearVapid();
  await sql`insert into nun_props (k, v) values ('push_vapid', ${JSON.stringify(nueva)}) on conflict (k) do nothing`;
  const [r2] = await sql`select v from nun_props where k = 'push_vapid'`;
  return (_vapid = JSON.parse(r2.v));
}
async function avisar(datos: any, soloK?: string){
  const V = await vapid();
  const rows = soloK ? await sql`select k, v from nun_props where k = ${soloK}` : await sql`select k, v from nun_props where k like 'push:%'`;
  let ok = 0;
  await Promise.all(rows.map(async (r: any) => {
    let x: any; try { x = JSON.parse(r.v); } catch(e){ return; }
    if (!x || x.activo === false || !x.sub) return;
    try {
      const st = await enviar(x.sub, datos, V, CONTACTO_PUSH);
      if (st >= 200 && st < 300) ok++;
      else if (st === 404 || st === 410) { x.activo = false; x.baja = new Date().toISOString(); await sql`update nun_props set v = ${JSON.stringify(x)} where k = ${r.k}`; } // ya no existe: se marca, no se borra
    } catch(e){}
  }));
  return ok;
}
// v4.76 (Rafa 11 nov) — lo que hace la oficina (Yazmín u otro que no sea Rafa) le llega a Rafa al teléfono:
// documentos nuevos, timbrar/cancelar ante el SAT, pagos registrados, confirmar cotizaciones, cancelar pedidos.
// Solo a los equipos de Rafa (suscripción con dueno:true = código RAFA-/MASTER-NUN-) y nunca a quien lo hizo.
const esRafa = (c: string) => /^(RAFA-|MASTER-NUN-)/.test(norm(c));
const NOMBRE_DOC: Record<string, string> = { cotizaciones: 'la cotización', pedidos: 'el pedido', remisiones: 'la remisión', facturas: 'la factura', notascredito: 'la nota de crédito', gastos: 'el gasto' };
function avisoOficina(body: any, j: any, quien: string){
  if (!j || !j.ok || j.ya_existia || esRafa(body.codigo || body.codigo_usuario || '')) return null;
  const q = (quien || 'Alguien de la oficina').split(' ')[0], a = body.accion, t = String(body.tabla || '');
  const ir = (m: string, extra?: Record<string, unknown>) => './?ir=' + m + Object.entries(extra || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => '&' + k + '=' + encodeURIComponent(String(v))).join(''); // v4.86 abre ESE documento
  if (a === 'erp_crear' && NOMBRE_DOC[t]){ const it = j.item || body.item || {};
    return { titulo: '📄 ' + q + ' creó ' + NOMBRE_DOC[t] + ' ' + (it.folio || ''), cuerpo: (it.cliente || it.proveedor || it.concepto || '') + (it.total || it.monto ? ' · ' + pesos(it.total || it.monto) : ''), url: ir(t, { id: it.id }), tag: 'of_' + (it.id || Date.now()) }; }
  if (a === 'convertir_documento' && NOMBRE_DOC[String(body.tabla_destino)])
    return { titulo: '📄 ' + q + ' creó ' + NOMBRE_DOC[String(body.tabla_destino)] + ' ' + (j.folio || ''), cuerpo: 'Desde ' + (NOMBRE_DOC[String(body.tabla_origen)] || 'otro documento'), url: ir(String(body.tabla_destino), { id: j.nuevoId }), tag: 'of_' + (j.nuevoId || Date.now()) };
  if (a === 'facturama_timbrar'){ const c = body.cfdi || {}; const tipo = c.CfdiType === 'P' ? 'complemento de pago' : c.CfdiType === 'E' ? 'nota de crédito' : 'factura';
    return { titulo: '🧾 ' + q + ' timbró ' + tipo + ' ' + (c.Serie || '') + (j.folio || c.Folio || ''), cuerpo: ((c.Receiver && c.Receiver.Name) || '') + (j.total ? ' · ' + pesos(j.total) : ''), url: c.CfdiType === 'P' ? ir('cobranza') : ir(c.CfdiType === 'E' ? 'notascredito' : 'facturas', { folio: (c.Serie || '') + (j.folio || c.Folio || '') }), tag: 'tim_' + (j.uuid || Date.now()) }; }
  if (a === 'facturama_cancelar') return { titulo: '⚠️ ' + q + ' canceló un CFDI ante el SAT', cuerpo: String(body.uuid || body.id || ''), url: ir('facturas'), tag: 'can_' + (body.uuid || body.id || Date.now()) };
  if (a === 'capturar_pago_cliente') return { titulo: '💵 ' + q + ' registró un pago de ' + pesos(body.monto), cuerpo: [body.cuenta, String(body.fecha || '').slice(0, 10), String(body.notas || '').slice(0, 80)].filter(Boolean).join(' · '), url: ir('cobranza', { id: body.id_doc }), tag: 'pago_' + body.id_doc + '_' + body.monto };
  if (a === 'confirmar_cotizacion') return { titulo: '✅ ' + q + ' confirmó la cotización ' + ((j.pedido && j.pedido.cotizacion_origen) || '') + ' → pedido ' + ((j.pedido && j.pedido.folio) || ''), cuerpo: (j.pedido && ((j.pedido.cliente || '') + ' · ' + pesos(j.pedido.total))) || '', url: ir('pedidos', { id: j.pedido && j.pedido.id }), tag: 'conf_' + body.id };
  if (a === 'activar_pedido') return { titulo: '✅ ' + q + ' confirmó un pedido', cuerpo: (j.pedido && (j.pedido.folio + ' · ' + (j.pedido.cliente || '') + ' · ' + pesos(j.pedido.total))) || '', url: ir('pedidos', { id: body.id }), tag: 'act_' + body.id };
  if (a === 'cancelar_pedido_venta') return { titulo: '✕ ' + q + ' canceló un pedido', cuerpo: String(body.motivo || ''), url: ir('pedidos', { id: body.id }), tag: 'cped_' + body.id };
  if (a === 'erp_upsert_batch' && NOMBRE_DOC[t]){ const n = (body.items || []).filter((i: any) => /cancel/i.test(String(i && i.estatus || ''))).length;
    if (n) return { titulo: '✕ ' + q + ' canceló ' + (n > 1 ? n + ' documentos (' + t + ')' : NOMBRE_DOC[t]), cuerpo: (body.items || []).slice(0, 3).map((i: any) => i.id).join(', '), url: ir(t, { id: n === 1 ? ((body.items || []).find((i: any) => /cancel/i.test(String(i && i.estatus || ''))) || {}).id : '' }), tag: 'cdoc_' + Date.now() }; }
  return null;
}
async function avisarRafa(datos: any, quienCodigo: string){
  const h = quienCodigo ? (await sha(norm(quienCodigo))).slice(0, 12) : '';
  const rows = (await sql`select k, v from nun_props where k like 'push:%'`).filter((r: any) => { try { const x = JSON.parse(r.v); return x.dueno === true && x.codigo_h !== h; } catch(e){ return false; } });
  let n = 0; for (const r of rows) n += await avisar(datos, r.k); return n;
}
function enSegundoPlano(p: Promise<unknown>){ try { (globalThis as any).EdgeRuntime.waitUntil(p.catch(() => {})); } catch(e){ p.catch(() => {}); } }
const pesos = (n: unknown) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Revisa (y ajusta) lo que un vendedor quiere hacer. Regresa un error o null.
async function revisarVend(body: any, se: any, m: Map<string, any>){
  const a = String(body.accion || ''), t = String(body.tabla || '');
  if (!A_VEND.test(a)) return 'Eso no está permitido desde la app de vendedores';
  if (a === 'erp_listar' && !T_VEND.has(t)) return 'Tabla no disponible';
  if (a === 'erp_crear'){
    const it = body.item = { ...(body.item || {}) }; delete it._vaciar; delete it._sin_inventario;
    if (t === 'cotizaciones'){
      if (!se.cotiza) return 'Tu usuario no puede subir cotizaciones (pídeselo a Rafa)';
      it.vendedor = se.vend; it.estatus = 'enviada'; it.creado_por = se.nombre || se.vend;
    } else if (t === 'clientes'){ it.vendedor = se.vend; }
    else if (t === 'pagosverificar'){
      if (!(+it.monto > 0)) return 'El monto debe ser mayor a $0';
      it.vendedor = se.vend; it.estatus = 'por_verificar'; it.creado_por = se.nombre || se.vend;
      delete it.verificado_por; delete it.verificado_fecha; delete it.ingreso_id;
    } else return 'Eso no está permitido desde la app de vendedores';
    return null;
  }
  if (a === 'erp_upsert_batch'){
    // solo cancelar o CORREGIR (v4.91) una cotización propia que aún no se confirma, o cancelar un pago suyo que aún no se verifica
    if (t !== 'cotizaciones' && t !== 'pagosverificar') return 'Eso no está permitido desde la app de vendedores';
    const items = Array.isArray(body.items) ? body.items : [];
    const b = { accion: 'erp_listar', tabla: t, codigo: se.codigo };
    const rows = JSON.parse(await lectura(() => ejecutar('post', JSON.stringify(b), b, m, false))).items || [];
    for (const it of items){
      const r = rows.find((x: any) => String(x.id) === String(it && it.id));
      if (!r || norm(r.vendedor) !== se.vend) return 'Solo puedes cambiar lo tuyo';
      const ks = Object.keys(it).filter(k => k !== 'id');
      // v4.91 (Rafa 12 nov) — el vendedor puede CORREGIR su cotización mientras no se confirme (productos, cantidades, precios, cliente, envío, notas).
      // El servidor (Codigo.gs v0.9.20) libera lo apartado viejo y aparta lo nuevo. Nunca cambia folio, fecha, vendedor ni estatus.
      const EDITABLE = ['cliente', 'subtotal', 'iva', 'total', 'sin_iva', 'envio', 'items_json', 'notas'];
      if (t === 'cotizaciones' && r.estatus !== 'enviada') return 'Esa cotización ya se confirmó o se canceló: ya no se puede cambiar';
      if (t === 'cotizaciones' && it.estatus !== undefined && (it.estatus !== 'cancelada' || ks.some(k => !['estatus', 'notas'].includes(k)))) return 'Solo puedes cancelar una cotización que aún no se confirma';
      if (t === 'cotizaciones' && it.estatus === undefined){
        if (!ks.length || ks.some(k => !EDITABLE.includes(k))) return 'Eso no se puede cambiar desde la app';
        if (it.items_json !== undefined){ let l: any; try { l = JSON.parse(String(it.items_json)); } catch(e){}
          if (!Array.isArray(l) || !l.length || l.some((x: any) => !x || !x.sku || !(+x.cantidad > 0) || !(+x.precio_unitario >= 0))) return 'Revisa los productos de la cotización'; }
        if (it.cliente !== undefined && !se.todos && nCli(it.cliente) !== nCli(r.cliente) && !(await misClientes(se, m)).some((c: any) => nCli(c.razon_social) === nCli(it.cliente))) return 'Ese cliente no es tuyo';
      }
      if (t === 'pagosverificar' && (r.estatus !== 'por_verificar' || it.estatus !== 'cancelado' || ks.some(k => !['estatus', 'motivo'].includes(k)))) return 'Solo puedes cancelar un pago que aún no se verifica';
    }
    return null;
  }
  return null;
}

async function cargar(db: any, nombres: string[]){
  const rows = await db`select nombre, filas from nun_hojas where nombre in ${db(nombres)}`;
  return new Map(rows.map((r: any) => [r.nombre, r.filas]));
}

async function guardar(db: any, r: any){
  for (const s of r.sucias){
    await db`insert into nun_historial (nombre, filas, motivo)
             select nombre, filas, 'antes de cambios' from nun_hojas
             where nombre = ${s.nombre} and not exists (select 1 from nun_historial where nombre = ${s.nombre} and fecha > now() - interval '2 hours')`;
    await db`insert into nun_hojas (nombre, filas, version, actualizado) values (${s.nombre}, ${db.json(s.filas)}, 1, now())
             on conflict (nombre) do update set filas = excluded.filas, version = nun_hojas.version + 1, actualizado = now()`;
  }
  if (r.props) for (const [k, v] of Object.entries(r.props)) await db`insert into nun_props (k, v) values (${k}, ${String(v)}) on conflict (k) do update set v = excluded.v`;
}

async function ejecutar(tipo: 'post'|'get', payload: string|Record<string,string>, body: any, codigos: Map<string, {ok:boolean, admin:boolean}>, conCandado: boolean){
  const accion = tipo === 'get' ? 'GET' : String(body.accion || '');
  const clave = accion + ':' + (tipo === 'get' ? (payload as any).tabla : (body.tabla || ''));
  const correrCon = async (db: any) => {
    const ex = (await db`select nombre from nun_hojas`).map((x: any) => x.nombre);
    const props = Object.fromEntries((await db`select k, v from nun_props where k not like 'push%'`).map((x: any) => [x.k, x.v]));
    const r = await atender({ fn, existentes: ex, props, cargar: (ns: string[]) => cargar(db, ns), tipo, payload,
      sesion: (c: unknown) => !!(codigos.get(norm(c)) || {}).ok, admin: (c: unknown) => !!(codigos.get(norm(c)) || {}).admin,
      precarga: aprendidas.get(clave) || [] });
    aprendidas.set(clave, r.hojas);
    return r;
  };
  if (!conCandado){
    const r = await correrCon(sql);
    if (!r.sucias.length && !r.props) return r.texto;
  }
  return await sql.begin(async (tx: any) => {
    await tx`select pg_advisory_xact_lock(4242)`;
    const r = await correrCon(tx);
    await guardar(tx, r);
    return r.texto;
  });
}

// v4.89 (11 nov) — LAS TRABAS: con 4 o más peticiones al mismo tiempo, postgres.js metía consultas en una conexión ocupada (pipelining) y el pooler
// de Supabase (modo transacción) se congelaba: 3 respondían en 1 s y las demás tardaban 20–40 s o fallaban (reproducido con 12 lecturas juntas).
// Ahora cada petición espera su TURNO: como máximo 3 a la vez (= las conexiones del pool); las demás esperan milisegundos en fila.
const CUPO = 3; const _cupo = { n: 0, fila: [] as Array<() => void> };
async function conCupo<T>(f: () => Promise<T>): Promise<T> {
  if (_cupo.n >= CUPO) await new Promise<void>(ok => _cupo.fila.push(ok));
  _cupo.n++;
  try { return await f(); } finally { _cupo.n--; const sig = _cupo.fila.shift(); if (sig) sig(); }
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  // lo que va a Google (entrar, usuarios, Facturama) tarda segundos sin usar la base: no ocupa turno
  let vaAGoogle = false; if (req.method === 'POST') { try { const m = (await req.clone().text()).match(/"accion"\s*:\s*"([a-z_]+)"/); vaAGoogle = !!(m && A_GOOGLE.test(m[1])); } catch(e){} }
  return vaAGoogle ? atenderPeticion(req) : conCupo(() => atenderPeticion(req));
});
async function atenderPeticion(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  await dbLista();
  poolFresco(); _enVuelo++; // v4.82
  const t0 = Date.now();
  let accion = '', ok = true, err = '', quien = '';
  try {
    const url = new URL(req.url);
    if (req.method === 'GET'){
      const p = Object.fromEntries(url.searchParams.entries());
      accion = 'GET ' + (p.tabla || '');
      if (!p.tabla) return json({ ok: true, mensaje: 'NUN ERP backend ' + VERSION, db: MODO_DB });
      const c = norm(p.codigo), m = new Map(); if (c) m.set(c, await conReintento(() => sesion(c, false)));
      const se = { ...(m.get(c) || {}), codigo: c }; quien = nombreDe(se.nombre, c);
      if (se.relogin) return json({ ok: false, error: 'AUTH: vuelve a entrar con tu código', requiere_login: true });
      if (se.ok && se.rol === 'vendedor'){ // v4.63
        if (!T_VEND.has(String(p.tabla))) return json({ ok: false, error: 'Tabla no disponible' });
        const j = JSON.parse(await lectura(() => conReintento(() => ejecutar('get', p, null, m, false))));
        if (j.ok){ const f = await filtrarVend(String(p.tabla), j.data || j.items || [], se, m); j.data = f; j.items = f; }
        return json(j);
      }
      return json(await lectura(() => conReintento(() => ejecutar('get', p, null, m, false))));
    }
    let texto = await req.text();
    let body: any; try { body = JSON.parse(texto); } catch(e){ return json({ ok: false, error: 'Petición inválida' }); }
    accion = String(body.accion || '');
    // en el registro: también qué tabla y qué documentos (para saber quién cambió qué y cuándo)
    const _det = (body.tabla ? ' ' + body.tabla : '') + (Array.isArray(body.items) ? ' ' + body.items.slice(0, 4).map((i: any) => String((i && i.id) || '').slice(0, 26)).join(',') : (body.item && body.item.id) ? ' ' + String(body.item.id).slice(0, 26) : body.id ? ' ' + String(body.id).slice(0, 26) : body.id_doc ? ' ' + String(body.id_doc).slice(0, 26) : body.id_origen ? ' ' + String(body.id_origen).slice(0, 26) : '');
    if (A_GOOGLE.test(accion)){
      // timbrar/cancelar NO se reintentan (no timbrar dos veces); lo demás sí
      const r = await google(body, /^facturama_(timbrar|cancelar)$/.test(accion) ? 1 : 3);
      if (accion === 'login' && r && r.ok){
        const c = norm(body.codigo), rol = String((r.usuario && r.usuario.rol) || '').toLowerCase();
        const nom = nombreDe(r.usuario && r.usuario.nombre, c, r.usuario && r.usuario.vendedor_asignado);
        const pm = (r.permisos && typeof r.permisos === 'object') ? r.permisos : {}; // v4.63
        const vend = norm((r.usuario && r.usuario.vendedor_asignado) || nom), todos = !!pm.ver_todos_clientes, cotiza = !!pm.agregar_pedidos && !pm.solo_consulta;
        await sql`insert into nun_sesiones (h, admin, nombre, hasta, rol, vend, todos, cotiza) values (${await sha(c)}, ${rol === 'admin'}, ${nom}, now() + interval '6 hours', ${rol || 'sin_rol'}, ${vend}, ${todos}, ${cotiza})
                  on conflict (h) do update set admin = excluded.admin, nombre = excluded.nombre, hasta = excluded.hasta, rol = excluded.rol, vend = excluded.vend, todos = excluded.todos, cotiza = excluded.cotiza`;
        quien = nom;
      }
      ok = !!(r && r.ok); if (!ok) err = String(r && r.error || '').substring(0, 200);
      if (!quien) quien = String(body._quien || '').slice(0, 60) || prefijoNombre(body.codigo);
      if (/^facturama_(timbrar|cancelar)$/.test(accion)){ const av = avisoOficina(body, r, quien); if (av) enSegundoPlano(avisarRafa(av, norm(body.codigo))); } // v4.76
      return json(r);
    }
    // v4.16 — quién y cuándo cambió un documento (solo administradores)
    if (accion === 'historial_doc') {
      const c = norm(body.codigo), se = await sesion(c, true); quien = se.nombre || String(body._quien || '').slice(0, 60) || prefijoNombre(c);
      if (!se.ok || !se.admin) return json({ ok: false, error: 'Solo administradores' });
      const k = String(body.id || '').slice(0, 26); if (!k) return json({ ok: false, error: 'Falta el documento' });
      const rows = await sql`select to_char(fecha at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS') as fecha, accion, coalesce(quien, '') as quien, ok
                             from nun_log where accion like ${'% ' + k + '%'} or accion like ${'%,' + k + '%'} order by id desc limit 100`;
      return json({ ok: true, cambios: rows });
    }
    const necesitaAdmin = A_ADMIN.test(accion);
    const m = new Map();
    for (const c of new Set([body.codigo, body.codigo_usuario, body.codigo_admin].map(norm).filter(Boolean))) m.set(c, await conReintento(() => sesion(c, necesitaAdmin)));
    const _c = norm(body.codigo || body.codigo_usuario || body.codigo_admin), se = { ...(m.get(_c) || {}), codigo: _c };
    quien = se.nombre || String(body._quien || '').slice(0, 60) || prefijoNombre(_c); se.nombre = se.nombre || quien;
    if ([...m.values()].some((x: any) => x.relogin)) return json({ ok: false, error: 'AUTH: vuelve a entrar con tu código', requiere_login: true }); // v4.63
    // v4.67 — cerrar la sesión de otros (Rafa): su siguiente movimiento le pide volver a entrar con su código
    if (accion === 'cerrar_sesiones'){
      if (!se.ok || se.admin !== true) return json({ ok: false, error: 'Solo administradores' });
      const cods = (Array.isArray(body.codigos) ? body.codigos : []).map(norm).filter((c: string) => c && c !== se.codigo);
      let n = 0;
      for (const c of cods){ const r = await sql`update nun_sesiones set rol = null, admin = null, hasta = now() where h = ${await sha(c)}`; n += (r && r.count) || 0; }
      return json({ ok: true, cerradas: n });
    }
    // v4.65 — avisos push: solo la oficina (no vendedores) se suscribe
    if (/^push_(clave|suscribir|probar|quitar)$/.test(accion)){
      if (!se.ok || se.rol === 'vendedor') return json({ ok: false, error: 'Solo la oficina recibe avisos' });
      if (accion === 'push_clave') return json({ ok: true, clave: (await vapid()).publica });
      const sub = body.sub || {};
      if (accion === 'push_suscribir'){
        if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ ok: false, error: 'Suscripción incompleta' });
        const k = 'push:' + (await sha(String(sub.endpoint))).slice(0, 32);
        await sql`insert into nun_props (k, v) values (${k}, ${JSON.stringify({ sub, nombre: se.nombre || '', equipo: String(body.equipo || '').slice(0, 60), activo: true, alta: new Date().toISOString(), codigo_h: (await sha(se.codigo)).slice(0, 12), dueno: esRafa(se.codigo) })})
                  on conflict (k) do update set v = excluded.v`;
        return json({ ok: true, k });
      }
      const h = (await sha(se.codigo)).slice(0, 12); // solo las de este código
      const propios = (await sql`select k, v from nun_props where k like 'push:%'`).filter((r: any) => { try { return JSON.parse(r.v).codigo_h === h; } catch(e){ return false; } });
      if (accion === 'push_probar'){ let n = 0; for (const r of propios) n += await avisar({ titulo: '🔔 Avisos de NUN activados', cuerpo: 'Así te va a llegar cuando un vendedor suba una cotización o reporte un pago' + (esRafa(se.codigo) ? ', y cuando la oficina haga facturas, pagos, timbres o cancelaciones.' : '.'), url: './?ir=cotizaciones', tag: 'prueba' }, r.k); return json({ ok: true, enviados: n }); }
      for (const r of propios){ const x = JSON.parse(r.v); x.activo = false; await sql`update nun_props set v = ${JSON.stringify(x)} where k = ${r.k}`; }
      return json({ ok: true });
    }
    // v4.79 — comprobantes de pago (foto/PDF) de Cobranza: solo la oficina; se guardan aparte (nun_archivos) y nunca se borran (se cancelan)
    if (/^archivo_(subir|listar|ver|cancelar|conteo)$/.test(accion)){
      if (!se.ok) return json({ ok: false, error: 'AUTH: vuelve a entrar con tu código', requiere_login: true });
      if (se.rol === 'vendedor'){
        // v4.80 — el vendedor solo sube la foto de SU pago reportado (por verificar); se liga al cobro de ese pago
        if (accion !== 'archivo_subir') return json({ ok: false, error: 'Solo la oficina ve los comprobantes' });
        const b = { accion: 'erp_listar', tabla: 'pagosverificar', codigo: se.codigo };
        const rows = JSON.parse(await lectura(() => ejecutar('post', JSON.stringify(b), b, m, false))).items || [];
        const pv = rows.find((x: any) => String(x.id) === String(body.pv_id || ''));
        if (!pv || norm(pv.vendedor) !== se.vend) return json({ ok: false, error: 'Solo puedes subir el comprobante de un pago tuyo' });
        if (pv.estatus !== 'por_verificar') return json({ ok: false, error: 'Ese pago ya se revisó' });
        body.cobro_id = String(pv.cobro_id || ''); body.ref = 'Reportado por ' + se.vend + ' · ' + (pv.forma || '') + ' ' + pesos(pv.monto) + ' · pv:' + pv.id;
      }
      if (accion === 'archivo_subir'){
        const id = String(body.id || '').slice(0, 80), cob = String(body.cobro_id || '').slice(0, 120), datos = String(body.datos || '');
        const mime = String(body.mime || '').slice(0, 60);
        if (!id || !cob || !datos) return json({ ok: false, error: 'Falta el archivo o el cobro' });
        if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime)) return json({ ok: false, error: 'Solo fotos o PDF' });
        if (datos.length > 8_000_000) return json({ ok: false, error: 'El archivo es muy grande (máx. ~6 MB)' });
        if (!/^[A-Za-z0-9+/=]+$/.test(datos)) return json({ ok: false, error: 'Archivo inválido' });
        const r = await sql`insert into nun_archivos (id, cobro_id, ref, nombre, mime, tam, datos, quien) values (${id}, ${cob}, ${String(body.ref || '').slice(0, 300)}, ${String(body.nombre || '').slice(0, 120)}, ${mime}, ${Math.round(datos.length * 3 / 4)}, ${datos}, ${quien})
                            on conflict (id) do nothing`;
        accion += ' ' + cob.slice(0, 26);
        return json({ ok: true, id, ya_existia: !(r && r.count) });
      }
      if (accion === 'archivo_listar'){
        const rows = await sql`select id, cobro_id, ref, nombre, mime, tam, quien, creado, cancelado from nun_archivos where cobro_id = ${String(body.cobro_id || '')} order by creado`;
        return json({ ok: true, items: rows });
      }
      if (accion === 'archivo_conteo'){
        const rows = await sql`select cobro_id, count(*)::int as n from nun_archivos where not cancelado group by cobro_id`;
        return json({ ok: true, conteo: Object.fromEntries(rows.map((x: any) => [x.cobro_id, x.n])) });
      }
      if (accion === 'archivo_ver'){
        const [x] = await sql`select id, nombre, mime, datos, cancelado from nun_archivos where id = ${String(body.id || '')}`;
        return json(x ? { ok: true, ...x } : { ok: false, error: 'No encontré el comprobante' });
      }
      if (se.admin !== true) return json({ ok: false, error: 'Solo un administrador cancela comprobantes' });
      const r = await sql`update nun_archivos set cancelado = true where id = ${String(body.id || '')}`; accion += ' ' + String(body.id || '').slice(0, 26);
      return json({ ok: true, cancelados: (r && r.count) || 0 });
    }
    // v2.3 (12 nov) — pago reportado desde la app por alguien de la oficina: si no trae estatus queda "por verificar" (antes quedaba en blanco y no salía en ningún lado)
    if (se.ok && se.rol !== 'vendedor' && accion === 'erp_crear' && body.tabla === 'pagosverificar' && body.item && !body.item.estatus) { body.item = { ...body.item, estatus: 'por_verificar' }; texto = JSON.stringify(body); }
    if (se.ok && se.rol === 'vendedor'){ // v4.63
      const e = await revisarVend(body, se, m);
      if (e){ ok = false; err = e; return json({ ok: false, error: e }); }
      const _f = () => conReintento(() => ejecutar('post', JSON.stringify(body), body, m, !A_LECTURA.test(accion)));
      const out = A_LECTURA.test(accion) ? await lectura(_f) : await _f();
      if (!A_LECTURA.test(accion)) accion += _det;
      const j = JSON.parse(out); ok = !!j.ok; if (!ok) err = String(j.error || '').substring(0, 200);
      // cotización cancelada por el vendedor: se libera lo que apartó (una sola vez: ya no está "enviada")
      if (j.ok && body.accion === 'erp_upsert_batch' && body.tabla === 'cotizaciones')
        for (const it of (body.items || []).filter((i: any) => /cancel/i.test(String(i && i.estatus || '')))){ /* v4.91 solo al cancelar (corregir ya ajusta lo apartado en Codigo.gs) */ const b = { accion: 'cotizacion_liberar', id: it.id, codigo: se.codigo }; try { await ejecutar('post', JSON.stringify(b), b, m, true); } catch(e){} }
      if (body.accion === 'erp_listar' && j.ok && Array.isArray(j.items)) j.items = await filtrarVend(String(body.tabla), j.items, se, m);
      // v4.65 — aviso a la oficina (sin esperar: el vendedor no se queda esperando)
      if (j.ok && !j.ya_existia && body.accion === 'erp_crear' && body.tabla === 'cotizaciones'){ const it = j.item || body.item;
        enSegundoPlano(avisar({ titulo: '🧾 Cotización nueva ' + (it.folio || '') + ' · ' + se.vend, cuerpo: (it.cliente || '') + ' · ' + pesos(it.total) + ' · tócala para confirmarla', url: './?ir=cotizaciones&id=' + encodeURIComponent(String(it.id || '')), tag: 'cot_' + it.id })); }
      // v4.91 — el vendedor corrigió su cotización: aviso a la oficina con liga a esa cotización
      if (j.ok && se.rol === 'vendedor' && body.accion === 'erp_upsert_batch' && body.tabla === 'cotizaciones')
        for (const it of (body.items || []).filter((i: any) => i && i.estatus === undefined))
          enSegundoPlano(avisar({ titulo: '✏️ ' + se.vend + ' corrigió una cotización', cuerpo: (it.cliente ? it.cliente + ' · ' : '') + (it.total !== undefined ? pesos(it.total) + ' · ' : '') + 'tócala para revisarla',
            url: './?ir=cotizaciones&id=' + encodeURIComponent(String(it.id || '')), tag: 'cot_' + it.id }));
      if (j.ok && !j.ya_existia && body.accion === 'erp_crear' && body.tabla === 'pagosverificar'){ const it = j.item || body.item;
        enSegundoPlano(avisar({ titulo: '💵 ' + se.vend + ' reportó un pago' + ((body.item || {}).con_comprobante ? ' 📎' : ''), cuerpo: (it.cliente || '') + ' · ' + pesos(it.monto) + ' · por verificar' + ((body.item || {}).con_comprobante ? ' · con foto del comprobante' : ''), url: './?ir=cobranza&pv=' + encodeURIComponent(String(it.id || '')), tag: 'pv_' + it.id })); }
      return json(j);
    }
    const _f = () => conReintento(() => ejecutar('post', texto, body, m, !A_LECTURA.test(accion)));
    const out = A_LECTURA.test(accion) ? await lectura(_f) : await _f(); // v4.64
    if (!A_LECTURA.test(accion)) accion += _det;
    try { const j = JSON.parse(out); ok = !!j.ok; if (!ok) err = String(j.error || '').substring(0, 200);
      const av = avisoOficina(body, j, quien); if (av) enSegundoPlano(avisarRafa(av, _c)); } catch(e){} // v4.76 aviso a Rafa de lo que hace la oficina
    return json(out);
  } catch(e){
    ok = false; err = String(e).substring(0, 300);
    return json({ ok: false, error: 'Error del servidor: ' + err });
  } finally {
    _enVuelo = Math.max(0, _enVuelo - 1); _ultimoUso = Date.now(); // v4.82
    const ms = Date.now() - t0;
    try { await sql`insert into nun_log (accion, ms, ok, error, quien) values (${accion}, ${ms}, ${ok}, ${err}, ${quien})`; } catch(e){} // v4.89 dentro de su turno
  }
}
