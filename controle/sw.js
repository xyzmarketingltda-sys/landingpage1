// XYZ Controle — avisos no aparelho do advogado (nova procuração assinada)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'XYZ Marketing', { body: d.corpo || '', icon: 'app-192.png', badge: 'app-192.png', data: { url: d.url || './' }, tag: 'xyz-' + Date.now() }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const j = l.find(c => c.url.startsWith(self.registration.scope)); return j ? j.focus() : self.clients.openWindow(url); }));
});
