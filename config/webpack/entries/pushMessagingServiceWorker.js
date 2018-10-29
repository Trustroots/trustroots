/* global FCM_SENDER_ID */

import firebase from 'firebase/app';
import 'firebase/messaging';

firebase.initializeApp({
  'messagingSenderId': FCM_SENDER_ID
});

var messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function (payload) {
  // not actually used, but without it here firefox does not receive messages...
  console.log('received payload', payload);
});

// Ensure new workers to replace old ones...
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
