// Service worker mínimo de la app de clientes (D-045): lo necesita el navegador para ofrecer
// "Instalar la app". No guarda nada en caché: cada pedido va a la red, así los estados de los
// pedidos siempre son los reales. Las notificaciones push se suman acá en el paso 6.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith: el navegador resuelve el pedido como siempre.
});
