/* sw.js — 홈 화면 앱용 서비스 워커
   · 페이지(문서)를 열 때만 관여한다: 항상 인터넷의 최신 내용을 먼저 받고, 끊겼을 때만 마지막으로 본 화면을 보여 준다.
   · 오디오북(mp3)·이미지·데이터 파일은 일절 가로채지 않는다.
     (예전에는 모든 요청을 가로채서, 폰 화면을 끄면 서비스 워커가 멈추며 스트리밍 중인 오디오북 소리가 끊겼다) */
var CACHE = 'sdl-v3';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.mode !== 'navigate' || r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;   /* 문서 이동 외에는 브라우저가 직접 처리 */
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(function (res) {
    if (res.ok && res.status === 200) { var c = res.clone(); caches.open(CACHE).then(function (ca) { ca.put(r, c); }); }
    return res;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); });
  }));
});
