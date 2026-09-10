// Service Worker — SD Móveis Projetados
// Cache básico "app shell" + estratégia network-first com fallback para cache (funciona offline)

const CACHE_NAME = "sd-moveis-cache-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// Instala o SW e guarda o "app shell" em cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Remove caches antigos ao ativar uma nova versão
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: tenta rede primeiro, cai pro cache se offline
self.addEventListener("fetch", (event) => {
  // Não interceptar chamadas de API/Supabase — sempre precisam ser em tempo real
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/functions/") ||
    event.request.url.includes("supabase.co") ||
    event.request.url.includes("api.groq.com") ||
    event.request.url.includes("googleapis.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/index.html"))
      )
  );
});
