// Service worker de la app de clientes (D-045, D-068). Lo necesita el navegador para ofrecer
// "Instalar la app" y para recibir las notificaciones. No guarda nada en caché: cada pedido va a
// la red, así los estados de los pedidos siempre son los reales.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith: el navegador resuelve el pedido como siempre.
});

// Solo se abren pantallas de la propia app: nunca una dirección de afuera.
const safePath = (url) => (typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/");

// Notificación push (D-068): la manda el sistema cuando hay un mensaje nuevo o un aviso de un pedido.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Via Vinilo";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: safePath(data.url) },
    }),
  );
});

// Al tocar la notificación se abre la app en la pantalla que corresponde.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
