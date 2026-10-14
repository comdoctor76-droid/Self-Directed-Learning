/* sw.js — 홈 화면 앱용 서비스 워커
   · 항상 인터넷의 최신 내용을 먼저 받고(network-first), 끊겼을 때만 마지막으로 본 내용을 보여 준다.
   · 사이트 내용이 예전 것으로 굳는 일은 없다. */
var CACHE = 'sdl-v2';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(function (res) {
    if (res.ok) { var c = res.clone(); caches.open(CACHE).then(function (ca) { ca.put(r, c); }); }
    return res;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); });
  }));
});
