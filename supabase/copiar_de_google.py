# Copia TODAS las hojas del servidor de Google (Apps Script) a Supabase (tabla nun_hojas), tal cual. Autorizado por Rafa (6 oct 2026).
# Uso (desde la raíz del repo): python3 supabase/copiar_de_google.py [--solo tabla1,tabla2] [--probar]
# Necesita la variable NUN_CODIGO (código de un usuario activo) y la credencial de Supabase en el entorno.
# Antes de reemplazar una hoja en Supabase guarda su versión anterior en nun_historial (motivo 'antes de copiar de Google').
# Los códigos de acceso (hoja Usuarios) NO se copian: entrar sigue pasando por Google.
import json, os, re, ssl, sys, time, urllib.request
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = 'vlqbzfotjltarelwenvu'
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt')
GOOGLE = 'https://script.google.com/macros/s/AKfycbw9_MR7axRi0a6pHpLuKB-rRUgOc3UOfOwKil3eZMpjci8JbYTNc8A3U5-wzJZ-Dt2A/exec'
codigo = open(os.path.join(RAIZ, 'backend', 'Codigo.gs'), encoding='utf-8').read()
bloque = codigo[codigo.index('const TABLAS = {'):codigo.index('// PERMISOS DE USUARIO')]
TABLAS = {m.group(1): (m.group(2), re.findall(r"'([^']*)'", m.group(3))) for m in re.finditer(r"(\w+):\s*\{\s*nombre:'([^']+)',\s*cols:\[([^\]]*)\]", bloque)}

def google(body, intentos=6):
    body = dict(body, codigo=os.environ['NUN_CODIGO'])
    for i in range(intentos):
        try:
            req = urllib.request.Request(GOOGLE, data=json.dumps(body).encode(), headers={'Content-Type': 'text/plain;charset=utf-8'})
            j = json.loads(urllib.request.urlopen(req, timeout=240, context=ctx).read().decode())
            if j.get('ok') and isinstance(j.get('items'), list): return j
            raise Exception(str(j)[:120])
        except Exception as e:
            print('  reintento', i + 1, body.get('tabla'), str(e)[:100], flush=True); time.sleep(4 * (i + 1))
    raise Exception('Google no entregó ' + str(body.get('tabla')))

def sqlq(q):
    req = urllib.request.Request('https://api.supabase.com/v1/projects/%s/database/query' % REF, data=json.dumps({'query': q}).encode(), headers={'Content-Type': 'application/json'})
    for i in range(4):
        try: return json.loads(urllib.request.urlopen(req, context=ctx, timeout=300).read().decode())
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code < 500: raise Exception('SQL %s: %s' % (e.code, msg))
            time.sleep(3)
    raise Exception('Supabase no contestó')

def lit(s):
    assert '$nun$' not in s
    return '$nun$' + s + '$nun$'

solo = set(sys.argv[sys.argv.index('--solo') + 1].split(',')) if '--solo' in sys.argv else None
resumen = {}
for tabla, (nombre, cols) in TABLAS.items():
    if solo and tabla not in solo: continue
    if tabla == 'usuarios':
        filas = [cols]
    else:
        t0 = time.time(); items = google({'accion': 'erp_listar', 'tabla': tabla})['items']
        enc = list(items[0].keys()) if items else list(cols)
        for it in items:
            for k in it:
                if k not in enc: enc.append(k)
        filas = [enc] + [[('' if it.get(k) is None else it.get(k)) for k in enc] for it in items]
        print('%-18s %5d renglones  %.1fs' % (nombre, len(items), time.time() - t0), flush=True)
    resumen[nombre] = len(filas) - 1
    if '--probar' in sys.argv: continue
    # en partes de ~1.5 MB (Supabase no acepta peticiones muy grandes, ej. los XML de facturas)
    partes, act, tam = [], [], 0
    for f in filas:
        t = len(json.dumps(f, ensure_ascii=False))
        if act and tam + t > 1500000: partes.append(act); act, tam = [], 0
        act.append(f); tam += t
    if act: partes.append(act)
    sqlq("insert into nun_historial (nombre, filas, motivo) select nombre, filas, 'antes de copiar de Google' from nun_hojas where nombre = %s;" % lit(nombre) +
         "insert into nun_hojas (nombre, filas, version, actualizado) values (%s, %s::jsonb, 1, now()) on conflict (nombre) do update set filas = excluded.filas, version = nun_hojas.version + 1, actualizado = now();" % (lit(nombre), lit(json.dumps(partes[0], ensure_ascii=False))))
    for pz in partes[1:]:
        sqlq("update nun_hojas set filas = filas || %s::jsonb where nombre = %s;" % (lit(json.dumps(pz, ensure_ascii=False)), lit(nombre)))
    n = sqlq("select jsonb_array_length(filas) n from nun_hojas where nombre = %s" % lit(nombre))[0]['n']
    assert n == len(filas), (nombre, n, len(filas))
json.dump(resumen, open(os.path.join(os.environ.get('NUN_SALIDA', '.'), 'copia_resumen.json'), 'w'), ensure_ascii=False, indent=1)
print('LISTO', sum(resumen.values()), 'renglones en', len(resumen), 'hojas')
