# Publica la función "nun" en Supabase. Uso (desde la raíz del repo): python3 supabase/publicar.py
# Copia backend/Codigo.gs a supabase/functions/nun/codigo.js y sube index.ts + emulador.js + codigo.js.
# La llave de Supabase la pone el entorno (credencial de API); nunca va en este archivo.
import json, os, ssl, sys, uuid, urllib.request
REF = 'vlqbzfotjltarelwenvu'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(RAIZ, 'supabase', 'functions', 'nun')
codigo = open(os.path.join(RAIZ, 'backend', 'Codigo.gs'), encoding='utf-8').read()
open(os.path.join(D, 'codigo.js'), 'w', encoding='utf-8').write('// Generado por supabase/publicar.py desde backend/Codigo.gs — no editar a mano\nexport default ' + json.dumps(codigo, ensure_ascii=False) + ';\n')
if '--solo-generar' in sys.argv: sys.exit(0)
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt')
b = '----nun' + uuid.uuid4().hex
partes = []
def parte(nombre, contenido, archivo=None, tipo='application/octet-stream'):
    h = 'Content-Disposition: form-data; name="%s"' % nombre + ('; filename="%s"' % archivo if archivo else '') + '\r\n'
    if archivo: h += 'Content-Type: %s\r\n' % tipo
    partes.append(('--' + b + '\r\n' + h + '\r\n').encode() + contenido + b'\r\n')
parte('metadata', json.dumps({'entrypoint_path': 'index.ts', 'name': 'nun', 'verify_jwt': False}).encode())
for f in ('index.ts', 'emulador.js', 'codigo.js'):
    parte('file', open(os.path.join(D, f), 'rb').read(), f, 'application/typescript' if f.endswith('.ts') else 'application/javascript')
data = b''.join(partes) + ('--' + b + '--\r\n').encode()
req = urllib.request.Request('https://api.supabase.com/v1/projects/%s/functions/deploy?slug=nun' % REF, data=data, method='POST',
                             headers={'Content-Type': 'multipart/form-data; boundary=' + b})
try:
    print(urllib.request.urlopen(req, context=ctx, timeout=300).read().decode()[:500])
except urllib.error.HTTPError as e:
    print('ERROR', e.code, e.read().decode()[:1500]); sys.exit(1)
