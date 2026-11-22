/* Daily Expense Assistant service worker: call notifications (web push) + offline fallback.
   Plain JS on purpose — it is served as-is from /sw.js. */

const CACHE = 'expense-shell-v6';
const PRECACHE = [
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/badge-96.png',
  '/icons/call-banner.png',
  '/icons/call-icon.png',
  '/icons/action-answer.png',
  '/icons/action-decline.png',
];
const RING_VIBRATION = [800, 400, 800, 400, 800, 400, 800];
// An incoming call re-alerts (sound + vibration) like a phone ringing, until answered or dismissed
const RING_REPEAT_MS = 6000;
const RING_FOR_MS = 30000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

// Network-first for page loads; show the offline page when there is no connection.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});

const windowClients = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true });

const broadcast = async message => {
  for (const client of await windowClients()) client.postMessage(message);
};

const appIsVisible = async () => (await windowClients()).some(client => client.visibilityState === 'visible');

/**
 * Call-style notification (as close to a WhatsApp call as the web allows): caller as the title,
 * a large call banner image so it expands like a call card, green/red Answer/Decline actions,
 * and repeated alerts every few seconds so it keeps ringing instead of buzzing once.
 */
const ringIncomingCall = async data => {
  const tag = `call-${data.callId}`;
  const options = {
    body: 'Incoming voice call',
    // Green phone, like a phone's incoming-call notification
    icon: '/icons/call-icon.png',
    badge: '/icons/badge-96.png',
    image: '/icons/call-banner.png',
    tag,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: RING_VIBRATION,
    actions: [
      { action: 'answer', title: 'Answer', icon: '/icons/action-answer.png' },
      { action: 'decline', title: 'Decline', icon: '/icons/action-decline.png' },
    ],
    data: { url: data.url || '/dashboard', callId: data.callId },
  };

  const startedAt = Date.now();
  await self.registration.showNotification('Expense Assistant', { ...options, timestamp: startedAt });
  while (Date.now() - startedAt < RING_FOR_MS) {
    await sleep(RING_REPEAT_MS);
    // Stop once it was answered, declined, dismissed or ended, or the app came to the front
    const stillRinging = (await self.registration.getNotifications({ tag })).length > 0;
    if (!stillRinging || (await appIsVisible())) return;
    await self.registration.showNotification('Expense Assistant', { ...options, timestamp: startedAt });
  }
};

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { type: 'test', title: 'Daily Expense Assistant', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    (async () => {
      if (data.type === 'call_ended') {
        const notifications = await self.registration.getNotifications({ tag: `call-${data.callId}` });
        notifications.forEach(notification => notification.close());
        await broadcast({ type: 'call_ended', callId: data.callId });
        return;
      }

      if (data.type === 'incoming_call') {
        // An open, visible app already rings on screen; just tell it to refresh.
        await broadcast({ type: 'incoming_call', callId: data.callId });
        if (await appIsVisible()) return;
        await ringIncomingCall(data);
        return;
      }

      await self.registration.showNotification(data.title || 'Daily Expense Assistant', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: 'test',
        data: { url: data.url || '/dashboard' },
      });
    })()
  );
});

self.addEventListener('notificationclick', event => {
  const { url = '/dashboard', callId } = event.notification.data || {};
  event.notification.close();

  event.waitUntil(
    (async () => {
      if (event.action === 'decline' && callId) {
        // Same-origin request: the session cookie identifies the user
        await fetch(`/api/calls/${callId}/end`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'declined' }),
        }).catch(() => undefined);
        await broadcast({ type: 'call_ended', callId });
        return;
      }

      // Like a phone: "Answer" opens the call screen already talking; tapping the notification
      // itself opens the full-screen call still ringing, so the user can answer or decline there.
      const answer = event.action === 'answer';
      const target = callId && answer ? `${url}${url.includes('?') ? '&' : '?'}answer=1` : url;
      const clients = await windowClients();
      const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'open_call', callId, answer });
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
