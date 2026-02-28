importScripts("./uv.bundle.js");
importScripts("./uv.config.js");
importScripts("./uv.sw.js");

const sw = new UVServiceWorker();
self.addEventListener("fetch", (event) => event.respondWith(sw.fetch(event)));
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
