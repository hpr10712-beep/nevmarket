/* HaloKita - service worker untuk notifikasi sistem + balas langsung.
   Letakkan di folder yang sama dengan halokita.html (contoh: nevmarket.my.id/halokita-sw.js). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const appWins = async url => {
  const all = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  const mine = all.filter(c => c.url.startsWith(url));
  return mine.sort((a, b) => (b.focused ? 2 : b.visibilityState == 'visible' ? 1 : 0) - (a.focused ? 2 : a.visibilityState == 'visible' ? 1 : 0));
};

/* kirim pesan ke halaman dan tunggu hasilnya (true/false) */
const ask = (client, msg) => new Promise(res => {
  const ch = new MessageChannel(), to = setTimeout(() => res(null), 9000);
  ch.port1.onmessage = e => { clearTimeout(to); res(e.data); };
  try { client.postMessage(msg, [ch.port2]); } catch { clearTimeout(to); res(null); }
});

/* umpan balik singkat setelah membalas dari notifikasi */
const feedback = async (n, body) => {
  const tag = n.tag;
  await self.registration.showNotification(n.title, {
    body, tag, icon: n.icon, badge: n.badge, silent: true, renotify: false,
    timestamp: Date.now(), data: n.data
  });
  await new Promise(r => setTimeout(r, 3500));
  const list = await self.registration.getNotifications({tag});
  list.forEach(x => x.close());
};

self.addEventListener('notificationclick', e => {
  const n = e.notification, d = n.data || {}, uid = d.with, url = d.url || self.registration.scope;
  const act = e.action, text = (typeof e.reply == 'string' ? e.reply : '').trim();
  n.close();
  e.waitUntil((async () => {
    const wins = await appWins(url), app = wins[0];

    if (act == 'reply' && text) {
      if (app) {
        const ok = await ask(app, {t: 'hk-reply', with: uid, text});
        await feedback(n, ok ? 'Terkirim: ' + text : 'Balasan gagal terkirim. Ketuk untuk membuka HaloKita.');
      } else if (self.clients.openWindow) {
        await self.clients.openWindow(url + '?hkr=' + encodeURIComponent(uid) + '&t=' + encodeURIComponent(text));
      }
      return;
    }

    if (act == 'read') {
      if (app) app.postMessage({t: 'hk-read', with: uid});
      return;
    }

    /* ketuk notifikasi (atau tombol Balas tanpa kolom teks): buka obrolannya */
    if (app) {
      try { await app.focus(); } catch {}
      app.postMessage({t: 'hk-open', with: uid});
    } else if (self.clients.openWindow) {
      await self.clients.openWindow(url + '?hko=' + encodeURIComponent(uid));
    }
  })());
});
