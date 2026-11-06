// NUN CRM en /nun-crm/ (copia de ventas/sw.js) — service worker propio solo para que se instale como app aparte del ERP.
// No guarda nada en caché: siempre se ve la versión publicada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
