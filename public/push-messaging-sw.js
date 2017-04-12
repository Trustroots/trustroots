/* global importScripts firebase FCM_SENDER_ID */
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries
// are not available in the service worker.

importScripts('/lib/firebase/firebase-app.js');
importScripts('/lib/firebase/firebase-messaging.js');
importScripts('/config/sw.js');

firebase.initializeApp({
  'messagingSenderId': FCM_SENDER_ID
});

var messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function(payload) {
  // not actually used, but without it here firefox does not receive messages...
  console.log('received payload', payload);
});

// Ensure new workers to replace old ones...
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting

self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
