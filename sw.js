// v4.58 — Service worker mínimo para que el sistema se pueda INSTALAR como app (logo NUN, pantalla completa).
// No guarda nada en caché: todo se pide al servidor como siempre (así nunca se ve una versión vieja).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
