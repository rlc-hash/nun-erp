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

const VERSION = 'supabase-1.0';
const GOOGLE = 'https://script.google.com/macros/s/AKfycbw9_MR7axRi0a6pHpLuKB-rRUgOc3UOfOwKil3eZMpjci8JbYTNc8A3U5-wzJZ-Dt2A/exec';
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 4, prepare: false, idle_timeout: 20 });
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
  if (!c) return { ok: false, admin: false };
  const h = await sha(c);
  const [s] = await sql`select admin, hasta > now() as vigente, hasta from nun_sesiones where h = ${h}`;
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
  return { ok, admin };
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
    const props = Object.fromEntries((await db`select k, v from nun_props`).map((x: any) => [x.k, x.v]));
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const t0 = Date.now();
  let accion = '', ok = true, err = '';
  try {
    const url = new URL(req.url);
    if (req.method === 'GET'){
      const p = Object.fromEntries(url.searchParams.entries());
      accion = 'GET ' + (p.tabla || '');
      if (!p.tabla) return json({ ok: true, mensaje: 'NUN ERP backend ' + VERSION });
      const c = norm(p.codigo), m = new Map(); if (c) m.set(c, await sesion(c, false));
      return json(await ejecutar('get', p, null, m, false));
    }
    const texto = await req.text();
    let body: any; try { body = JSON.parse(texto); } catch(e){ return json({ ok: false, error: 'Petición inválida' }); }
    accion = String(body.accion || '');
    if (A_GOOGLE.test(accion)){
      // timbrar/cancelar NO se reintentan (no timbrar dos veces); lo demás sí
      const r = await google(body, /^facturama_(timbrar|cancelar)$/.test(accion) ? 1 : 3);
      if (accion === 'login' && r && r.ok){
        const c = norm(body.codigo), rol = String((r.usuario && r.usuario.rol) || '').toLowerCase();
        await sql`insert into nun_sesiones (h, admin, hasta) values (${await sha(c)}, ${rol === 'admin'}, now() + interval '6 hours')
                  on conflict (h) do update set admin = excluded.admin, hasta = excluded.hasta`;
      }
      ok = !!(r && r.ok); if (!ok) err = String(r && r.error || '').substring(0, 200);
      return json(r);
    }
    const necesitaAdmin = A_ADMIN.test(accion);
    const m = new Map();
    for (const c of new Set([body.codigo, body.codigo_usuario, body.codigo_admin].map(norm).filter(Boolean))) m.set(c, await sesion(c, necesitaAdmin));
    const out = await ejecutar('post', texto, body, m, !A_LECTURA.test(accion));
    try { const j = JSON.parse(out); ok = !!j.ok; if (!ok) err = String(j.error || '').substring(0, 200); } catch(e){}
    return json(out);
  } catch(e){
    ok = false; err = String(e).substring(0, 300);
    return json({ ok: false, error: 'Error del servidor: ' + err });
  } finally {
    const ms = Date.now() - t0;
    sql`insert into nun_log (accion, ms, ok, error) values (${accion}, ${ms}, ${ok}, ${err})`.catch(() => {});
  }
});
