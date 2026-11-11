// v4.58 — Service worker mínimo para que el sistema se pueda INSTALAR como app (logo NUN, pantalla completa).
// No guarda nada en caché: todo se pide al servidor como siempre (así nunca se ve una versión vieja).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
// v4.65 — avisos push (cotización nueva, pago reportado): se muestran aunque el sistema esté cerrado; al tocarlos abre el sistema ahí
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch(x){ d = { titulo: 'NUN', cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'NUN', { body: d.cuerpo || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || undefined, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.registration.scope) && !/vendedores\.html|\/ventas\//.test(x.url));
    if (w) { const q = new URL(url).searchParams; w.postMessage({ nunIr: q.get('ir') || '', id: q.get('id') || '', folio: q.get('folio') || '', pv: q.get('pv') || '' }); return w.focus(); } // v4.86 abre ESE documento
    return self.clients.openWindow(url);
  }));
});
