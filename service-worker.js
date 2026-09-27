const CACHE_NAME = "preisscan-v0.7.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/styles.css",
  "./assets/icons/preisscan-app.png",
  "./assets/icons/preisscan-192.png",
  "./assets/icons/preisscan-512.png",
  "./assets/icons/preisscan-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./js/data.js",
  "./js/api.js",
  "./js/app.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if(url.origin !== self.location.origin){
    event.respondWith(fetch(event.request));
    return;
  }

  const isAppCode =
    event.request.mode === "navigate" ||
    /\.(?:html|js|css|webmanifest)$/i.test(url.pathname) ||
    url.pathname.endsWith("/");

  if(isAppCode){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if(response && response.status === 200){
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match(event.request)
          ) || (
            event.request.mode === "navigate"
              ? await caches.match("./index.html")
              : Response.error()
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if(cached) return cached;

        return fetch(event.request)
          .then(response => {
            if(response && response.status === 200){
              const copy = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, copy));
            }
            return response;
          });
      })
  );
});
