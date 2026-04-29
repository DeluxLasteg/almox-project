const CACHE_NAME = "almox-shell-v7";
const APP_SHELL_FILES = [
    "./",
    "./index.html",
    "./itens.html",
    "./style.CSS",
    "./theme.CSS",
    "./theme.js",
    "./app.js",
    "./index.js",
    "./items.js",
    "./manifest.webmanifest",
    "./icons/app-icon.svg",
    "./icons/app-icon-maskable.svg",
    "./icons/app-icon-192.png",
    "./icons/app-icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_FILES))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    if (event.request.mode === "navigate") {
        event.respondWith(responderNavegacao(event.request));
        return;
    }

    event.respondWith(responderRecurso(event.request));
});

async function responderNavegacao(request) {
    try {
        const respostaRede = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, respostaRede.clone());
        return respostaRede;
    } catch (error) {
        const respostaCache = await caches.match(request);
        if (respostaCache) {
            return respostaCache;
        }

        return caches.match("./index.html");
    }
}

async function responderRecurso(request) {
    try {
        const respostaRede = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, respostaRede.clone());
        return respostaRede;
    } catch (error) {
        const respostaCache = await caches.match(request);
        if (respostaCache) {
            return respostaCache;
        }

        return new Response("Recurso indisponivel offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
    }
}
