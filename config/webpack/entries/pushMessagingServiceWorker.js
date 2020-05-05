/* global FCM_SENDER_ID,importScripts */

/**
 *  This will not rebuild on change, so if you're doing development you might want to rebuild it manually:
 *  You can do this by running:
 *
 *      npm run webpack:service-worker
 *
 *  (additionally "npm run build" will build it)
 */

import firebase from 'firebase/app';
import 'firebase/messaging';

importScripts('/config/sw.js');

firebase.initializeApp({
  messagingSenderId: FCM_SENDER_ID,
});

const messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function (payload) {
  // not actually used, but without it here firefox does not receive messages...
  console.log('received payload', payload);
});

// Ensure new workers to replace old ones...
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting

/* eslint-disable no-undef */
/* `self` refers to Service Worker https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope */
self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
/* eslint-enable no-undef */
