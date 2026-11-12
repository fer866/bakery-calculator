/**
 * Bakery Calculator - Service Worker (v2.3.0-b4k3r6)
 * Ciclo de vida PWA estándar: instalación en segundo plano, aviso de actualización
 * al usuario y activación inmediata mediante skipWaiting y clients.claim.
 * Excluye deliberadamente /api/* para delegar la persistencia dinámica a Cloudflare D1.
 * Soporta navegación Network-First con fallback a caché para permitir la reautenticación
 * nativa cuando vence la sesión de 24 horas en Cloudflare Zero Trust Access.
 */

const CACHE_NAME = 'bakery-calc-v2-b4k3r6';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './llms.txt',
  './css/styles.b4k3r6.css',
  './css/vendor/driver.css',
  './js/vendor/driver.iife.js',
  './js/app.b4k3r6.js',
  './js/db.b4k3r6.js',
  './js/engine.b4k3r6.js',
  './js/ui.b4k3r6.js',
  './js/theme.b4k3r6.js',
  './js/tour.b4k3r6.js'
];

// 1. Instalación: Precaché de activos sin forzar skipWaiting automático
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// 2. Mensajería: Activación controlada cuando el usuario pulsa "Actualizar"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 3. Activación: Tomar control de clientes y limpiar versiones antiguas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// 4. Fetch Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignorar extensiones de Chrome o dominios externos fuera de origen
  if (url.origin !== self.location.origin) {
    return;
  }

  // Ignorar /api/* para que siempre vaya en vivo a Cloudflare Pages Functions y D1
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // A. Solicitudes de Navegación HTML (Documento principal): Network-First con fallback offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('./index.html', responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // B. Recursos estáticos inmutables versionados (JS, CSS, Imágenes): Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Fallback silencioso si no está en caché y está offline
        });
    })
  );
});
