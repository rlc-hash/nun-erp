// ============================================================
// NUN — avisos push (Web Push, RFC 8291 aes128gcm + VAPID RFC 8292) con WebCrypto, sin librerías.
// Lo usan index.ts (servidor) y pruebas/prueba_push.js. No usa nada de Deno ni de Node.
// ============================================================
const te = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const deb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const junta = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt, ikm, info, len){
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
// Llaves del servidor (VAPID): se crean una vez y se guardan (privada como JWK)
export async function crearVapid(){
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { publica: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), privada: JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)) };
}
// Cifra el mensaje para una suscripción (sub = { endpoint, keys: { p256dh, auth } })
export async function cifrar(sub, texto, salt){
  const ua = deb64u(sub.keys.p256dh), auth = deb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, compartido, junta(te.encode('WebPush: info\0'), ua, asPub), 32);
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, junta(te.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return junta(salt, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}
// Firma VAPID (JWT ES256) para el servicio de push del navegador
export async function firmaVapid(endpoint, vapid, contacto){
  const aud = new URL(endpoint).origin;
  const cab = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contacto })));
  const llave = await crypto.subtle.importKey('jwk', JSON.parse(vapid.privada), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, llave, te.encode(cab + '.' + cuerpo));
  return 'vapid t=' + cab + '.' + cuerpo + '.' + b64u(firma) + ', k=' + vapid.publica;
}
// Manda un aviso. Regresa el código HTTP (201 = entregado; 404/410 = la suscripción ya no existe)
export async function enviar(sub, datos, vapid, contacto, f = fetch){
  const cuerpo = await cifrar(sub, JSON.stringify(datos));
  const r = await f(sub.endpoint, { method: 'POST', body: cuerpo, headers: {
    'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high',
    Authorization: await firmaVapid(sub.endpoint, vapid, contacto) } });
  return r.status;
}
