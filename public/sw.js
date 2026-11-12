/**
 * Bakery Calculator - Service Worker (v2.2.1-b4k3r5)
 * Offline-first caching with immediate skipWaiting, clients.claim and silent updates.
 * Excluye deliberadamente /api/* para delegar la persistencia dinámica a Cloudflare D1.
 * Soporta navegación Network-First con fallback a caché para permitir la reautenticación
 * nativa cuando vence la sesión de 24 horas en Cloudflare Zero Trust Access.
 */

const CACHE_NAME = 'bakery-calc-v2-b4k3r5';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './llms.txt',
  './css/styles.b4k3r5.css',
  './css/vendor/driver.css',
  './js/vendor/driver.iife.js',
  './js/app.b4k3r5.js',
  './js/db.b4k3r5.js',
  './js/engine.b4k3r5.js',
  './js/ui.b4k3r5.js',
  './js/theme.b4k3r5.js',
  './js/tour.b4k3r5.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore chrome-extension or external cross-origin requests outside scope
  if (url.origin !== self.location.origin) {
    return;
  }

  // Ignorar /api/* para que siempre vaya en vivo a Cloudflare Pages Functions y D1
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 1. Solicitudes de Navegación HTML (Documento principal): Network-First
  // Cuando vence la sesión de Cloudflare Access (24h), el navegador recibe un 302 y sigue
  // nativamente la redirección a la pantalla de login sin ser bloqueado por CORS.
  // Si no hay red (offline), sirve el index.html precacheado inmediatamente.
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

  // 2. Recursos estáticos inmutables versionados (JS, CSS, Imágenes): Cache-First
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
