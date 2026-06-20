const CACHE = 'mis-finanzas-v14';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// Install: pre-cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => null)));
    }).then(async () => {
      // Si todavía no hay ningún cliente controlado, es la primera instalación —
      // activamos directo. Si ya hay clientes (significa que es una actualización
      // sobre una versión anterior), esperamos a que el usuario confirme.
      const clients = await self.clients.matchAll();
      if (clients.length === 0) self.skipWaiting();
    })
  );
});

// Escucha el mensaje del botón "Actualizar ahora" en la app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first para assets, network-first para API calls
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google APIs: siempre network
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('accounts.google.com')) {
    return;
  }

  // Cache first para assets estáticos
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback offline para navegación
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Background sync (cuando vuelve internet)
self.addEventListener('sync', e => {
  if (e.tag === 'sync-drive') {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_READY' }));
      })
    );
  }
});
