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
  // v4.90 (Rafa: seguía quedando en el Inicio) — solo si el sistema está A LA VISTA se le avisa qué abrir (mensaje con respuesta).
  // Si está en segundo plano o cerrado se abre la LIGA del aviso: en Android/iPhone eso abre la app instalada directo en el documento
  // (antes se le mandaba el mensaje a una ventana escondida —a veces una pestaña de Chrome— y al frente quedaba la app en el Inicio).
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async ws => {
    ws = ws.filter(x => x.url.startsWith(self.registration.scope) && !/vendedores\.html|\/ventas\//.test(x.url));
    const q = new URL(url).searchParams;
    const v = ws.find(x => x.visibilityState === 'visible') || ws.find(x => x.focused);
    if (v && q.get('ir')) {
      const ok = await new Promise(res => { try { const ch = new MessageChannel(); ch.port1.onmessage = () => res(true);
        v.postMessage({ nunIr: q.get('ir') || '', id: q.get('id') || '', folio: q.get('folio') || '', pv: q.get('pv') || '' }, [ch.port2]); setTimeout(() => res(false), 1500); } catch(x){ res(false); } });
      if (ok) { try { await v.focus(); } catch(x){} return; }
    }
    try { await self.clients.openWindow(url); return; } catch(x){}
    const w = v || ws[0]; if (!w) return;
    try { if (w.navigate) await w.navigate(url); } catch(x){}
    try { await w.focus(); } catch(x){}
  }));
});
