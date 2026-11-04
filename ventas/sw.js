// App de vendedores v2.1 — service worker propio (alcance /ventas/) solo para que se instale como app aparte del ERP.
// No guarda nada en caché: siempre se ve la versión publicada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
