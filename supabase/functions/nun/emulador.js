// ============================================================
// NUN en Supabase — corre backend/Codigo.gs SIN CAMBIOS, con una "hoja de Google" simulada en memoria.
// Cada hoja vive en la tabla nun_hojas (una fila por hoja, con todas sus celdas). El servidor carga solo las hojas
// que la acción usa; si el código pide una hoja que no cargó, se anota, se carga y la acción se vuelve a correr
// desde cero (nada se guarda hasta que la acción termina completa).
// Este archivo no usa nada de Deno ni de Node: lo usan el servidor (index.ts) y las pruebas (pruebas/).
// ============================================================
export class FaltaHoja extends Error { constructor(n){ super('FALTA_HOJA:' + n); this.hoja = n; } }

function vacia(v){ return v === '' || v === null || v === undefined; }

function hojaEmulada(st, nombre){
  const datos = () => {
    const h = st.hojas.get(nombre);
    if (!h) { st.faltan.add(nombre); throw new FaltaHoja(nombre); }
    return h;
  };
  const sucia = () => { datos().sucia = true; };
  const filas = () => datos().filas;
  const ultimaFila = () => { const f = filas(); let n = f.length; while (n > 1 && !(f[n-1] || []).some(x => !vacia(x))) n--; return n; };
  const ultimaCol = () => { const f = filas(); let w = 0; for (let i = 0; i < ultimaFila(); i++) { const r = f[i] || []; for (let j = r.length; j > w; j--) if (!vacia(r[j-1])) { w = j; break; } } return w; };
  const asegura = (n) => { const f = filas(); while (f.length < n) f.push([]); };
  const rango = (r, c, nr, nc) => {
    nr = nr || 1; nc = nc || 1;
    const rg = {
      getValues(){ const f = filas(), o = []; for (let i = 0; i < nr; i++){ const row = f[r-1+i] || [], x = []; for (let j = 0; j < nc; j++){ const v = row[c-1+j]; x.push(v === undefined || v === null ? '' : v); } o.push(x); } return o; },
      getValue(){ return rg.getValues()[0][0]; },
      setValues(v){ asegura(r - 1 + v.length); const f = filas(); for (let i = 0; i < v.length; i++){ const row = f[r-1+i]; for (let j = 0; j < v[i].length; j++){ while (row.length < c-1+j) row.push(''); row[c-1+j] = v[i][j]; } } sucia(); return rg; },
      setValue(v){ asegura(r); const row = filas()[r-1]; while (row.length < c-1) row.push(''); row[c-1] = v; sucia(); return rg; },
      clearContent(){ const f = filas(); for (let i = 0; i < nr; i++){ const row = f[r-1+i]; if (row) for (let j = 0; j < nc; j++) if (c-1+j < row.length) row[c-1+j] = ''; } sucia(); return rg; },
      setFontWeight(){ return rg; }, setBackground(){ return rg; }, setFontColor(){ return rg; }, setNumberFormat(){ return rg; },
      getNumRows(){ return nr; }, getNumColumns(){ return nc; }
    };
    return rg;
  };
  return {
    getName(){ return nombre; },
    getLastRow(){ return ultimaFila(); },
    getLastColumn(){ return ultimaCol(); },
    getMaxRows(){ return filas().length; },
    getDataRange(){ const n = ultimaFila(), w = ultimaCol(); if (!n || !w) return rango(1, 1, 1, 1); return rango(1, 1, n, w); },
    getRange(r, c, nr, nc){ return rango(r, c, nr, nc); },
    appendRow(arr){ const f = filas(); const n = ultimaFila(); f.splice(n, f.length - n); f.push(arr.slice()); sucia(); return this; },
    deleteRow(i){ filas().splice(i-1, 1); sucia(); },
    deleteRows(i, n){ filas().splice(i-1, n); sucia(); },
    setFrozenRows(){}, setColumnWidth(){}, autoResizeColumns(){}
  };
}

// Prepara los "servicios de Google" para una corrida. st = { hojas:Map(nombre→{filas,sucia}), existen:Set, faltan:Set, props:{}, propsSucias, sesion(c)→bool, admin(c)→bool }
export function entorno(st){
  const ss = {
    getSheetByName(n){ return st.existen.has(n) ? hojaEmulada(st, n) : null; },
    insertSheet(n){ st.existen.add(n); st.hojas.set(n, { filas: [], sucia: true, nueva: true }); return hojaEmulada(st, n); },
    getSheets(){ return [...st.existen].map(n => hojaEmulada(st, n)); }
  };
  const nada = () => {};
  return {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, flush: nada },
    LockService: { getScriptLock: () => ({ waitLock: nada, tryLock: () => true, releaseLock: nada, hasLock: () => true }) },
    // Sin memoria intermedia: Supabase ya es rápido y así nunca se ve una lista vieja.
    CacheService: { getScriptCache: () => ({ get: () => null, getAll: () => ({}), put: nada, putAll: nada, remove: nada, removeAll: nada }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (st.props[k] === undefined ? null : st.props[k]),
      setProperty: (k, v) => { st.props[k] = String(v); st.propsSucias = true; },
      deleteProperty: k => { delete st.props[k]; st.propsSucias = true; },
      getProperties: () => Object.assign({}, st.props) }) },
    ContentService: { createTextOutput: t => ({ t, setMimeType(){ return this; } }), MimeType: { JSON: 'json', TEXT: 'text' } },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: nada, newTrigger: () => { throw new Error('Sin activadores en Supabase'); } },
    Utilities: {
      base64Encode: s => btoa(unescape(encodeURIComponent(String(s)))),
      base64Decode: s => Array.from(atob(String(s)), ch => ch.charCodeAt(0)),
      newBlob: b => ({ getDataAsString: () => decodeURIComponent(escape(String.fromCharCode(...b))) }),
      sleep: nada, getUuid: () => crypto.randomUUID()
    },
    UrlFetchApp: { fetch(){ throw new Error('Esta acción se atiende en Google (no desde Supabase)'); } },
    Logger: { log: nada },
    __sesion: c => st.sesion(c), __admin: c => st.admin(c)
  };
}

const GLOBALES = ['SpreadsheetApp','LockService','CacheService','PropertiesService','ContentService','ScriptApp','Utilities','UrlFetchApp','Logger'];
// Compila Codigo.gs una sola vez. Cada llamada a la función que regresa crea un mundo nuevo (variables y todo).
export function compilar(codigo){
  const cuerpo = 'const {' + GLOBALES.join(',') + '} = __env;\n' + codigo +
    '\n;validarSesion = function(c){ return __env.__sesion(c) ? { ok:true } : { ok:false, error:"Código de usuario inválido o inactivo" }; };' +
    '\nvalidarAdmin = function(c){ return !!__env.__admin(c); };' +
    '\nreturn { doPost, doGet, TABLAS, VERSION_ERP };';
  return new Function('__env', cuerpo);
}

// Corre una petición. tipo 'post' (payload = texto JSON) o 'get' (payload = parámetros). Regresa el texto de respuesta.
export function correr(fn, st, tipo, payload){
  st.faltan = new Set();
  const g = fn(entorno(st));
  const r = tipo === 'get' ? g.doGet({ parameter: payload || {} }) : g.doPost({ postData: { contents: payload } });
  return r && r.t !== undefined ? r.t : JSON.stringify(r);
}

// Hojas que usa cada tabla (para precargar y no tener que volver a correr)
export function nombreHoja(fn, tabla){ try { const g = fn(entorno({ hojas:new Map(), existen:new Set(), faltan:new Set(), props:{} , sesion:()=>false, admin:()=>false })); const d = g.TABLAS[tabla]; return d ? d.nombre : null; } catch(e){ return null; } }

// Corre la petición cargando las hojas que hagan falta. cargar(nombres) → Promise<Map(nombre → filas)>.
// Regresa { texto, sucias:[{nombre, filas}], props (si cambiaron), corridas, hojas:[nombres usados] }.
export async function atender({ fn, cargar, existentes, props, sesion, admin, tipo, payload, precarga }){
  const ex0 = new Set(existentes);
  const st = { hojas: new Map(), existen: new Set(ex0), faltan: new Set(), props: Object.assign({}, props), propsSucias: false, sesion, admin };
  const base = new Map();   // copia limpia de lo cargado, para volver a correr desde cero
  const pedir = async (nombres) => {
    const q = [...nombres].filter(n => ex0.has(n) && !base.has(n));
    if (!q.length) return;
    const m = await cargar(q);
    for (const n of q) base.set(n, JSON.stringify(m.get(n) || []));
  };
  await pedir(precarga || []);
  for (let corrida = 1; corrida <= 12; corrida++){
    st.hojas = new Map(); st.existen = new Set(ex0); st.props = Object.assign({}, props); st.propsSucias = false;
    for (const [n, txt] of base) st.hojas.set(n, { filas: JSON.parse(txt), sucia: false });
    let texto;
    try { texto = correr(fn, st, tipo, payload); }
    catch(e){ if (!(e instanceof FaltaHoja) && !st.faltan.size) throw e; }
    if (st.faltan.size){ await pedir(st.faltan); continue; }
    const sucias = [];
    for (const [n, h] of st.hojas) if (h.sucia){
      const f = h.filas.map(r => (r || []).map(v => v === undefined || v === null ? '' : (v instanceof Date ? v.toISOString() : v)));
      let k = f.length; while (k > 1 && !f[k-1].some(x => x !== '')) k--; f.length = k;   // sin renglones vacíos al final
      sucias.push({ nombre: n, filas: f });
    }
    return { texto, sucias, props: st.propsSucias ? st.props : null, corridas: corrida, hojas: [...base.keys()] };
  }
  throw new Error('Demasiadas hojas pedidas: ' + [...st.faltan].join(',') + ' existen=' + [...st.existen].join(','));
}
