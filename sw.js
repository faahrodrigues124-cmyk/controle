// Guarda o app no aparelho para abrir rápido e funcionar sem internet.
// Ao mudar qualquer arquivo do app, aumente a VERSAO para os celulares baixarem a nova.
const VERSAO = 'controle-v4';
const ARQUIVOS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/calculo.js',
  './js/datas.js',
  './js/estado.js',
  './js/inicial.js',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/apple-touch-icon.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO && !n.startsWith('fontes')).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: guarda na primeira vez e reaproveita.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(caches.open('fontes').then(async (c) => {
      const salvo = await c.match(req);
      if (salvo) return salvo;
      const resp = await fetch(req);
      c.put(req, resp.clone());
      return resp;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // App: com internet busca a versão nova (até 3 s); sem internet usa a cópia guardada.
  ev.respondWith(caches.open(VERSAO).then(async (c) => {
    const rede = fetch(req, { cache: 'no-cache' }).then((resp) => { if (resp.ok) c.put(req, resp.clone()); return resp; });
    const limite = new Promise((ok) => setTimeout(ok, 3000));
    try {
      const resp = await Promise.race([rede, limite]);
      if (resp) return resp;
    } catch { /* sem internet */ }
    return (await c.match(req, { ignoreSearch: true })) || rede;
  }));
});
