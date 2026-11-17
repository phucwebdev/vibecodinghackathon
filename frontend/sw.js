/* Lưu sẵn tệp của app để mở được khi mất mạng. Có mạng thì luôn lấy bản mới nhất. */
var CACHE = 'the-thanh-vien-v5';
var FILES = ['./', 'index.html', 'css/style.css', 'css/loyalty.css', 'css/motion.css', 'css/mobile.css', 'css/desktop.css',
  'js/ui.js', 'js/app.js', 'data/seed.js', 'vendor/qrcode.js', 'vendor/html5-qrcode.min.js', 'vendor/xlsx.mini.min.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.ok && new URL(e.request.url).origin === location.origin) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
