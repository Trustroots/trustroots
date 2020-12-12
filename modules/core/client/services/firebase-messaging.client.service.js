angular.module('core').factory('firebaseMessaging', firebaseMessaging);

/* @ngInject */
function firebaseMessaging($window, $q, $timeout, SettingsService) {
  const appSettings = SettingsService.get();

  const SENDER_ID = appSettings && appSettings.fcmSenderId;
  const SERVICE_WORKER_PATH = '/push-messaging-sw.js';
  const SERVICE_WORKER_SCOPE = '/trustroots-push-messaging-scope';

  const firebase = require('firebase/app');
  require('firebase/messaging');
  let _messaging = null; // set in initMessaging()
  const onTokenRefreshCallbacks = [];
  const onMessageCallbacks = [];

  const firebaseMessaging = {
    name: 'fcm',
    shouldInitialize: !!SENDER_ID,
    getToken,
    requestPermission,
    deleteToken,
    onTokenRefresh,
    onMessage,
    removeServiceWorker,
  };

  function getToken() {
    return initMessaging().then(function (messaging) {
      return messaging.getToken();
    });
  }

  function requestPermission() {
    return initMessaging().then(function (messaging) {
      return messaging.requestPermission();
    });
  }

  function deleteToken(token) {
    return initMessaging().then(function (messaging) {
      return messaging.deleteToken(token);
    });
  }

  function onTokenRefresh(fn) {
    onTokenRefreshCallbacks.push(fn);
  }

  function onMessage(fn) {
    onMessageCallbacks.push(fn);
  }

  function removeServiceWorker() {
    return getServiceWorkers().then(function (workers) {
      workers.forEach(function (worker) {
        worker.unregister();
      });
    });
  }

  function getServiceWorkers() {
    return $q
      .when($window.navigator.serviceWorker.getRegistrations())
      .then(function (registrations) {
        return registrations.filter(function (worker) {
          return worker.scope.endsWith(SERVICE_WORKER_SCOPE);
        });
      });
  }

  function getOrCreateWorker() {
    return getServiceWorkers().then(function (workers) {
      if (workers.length === 0) {
        return $q.when(
          $window.navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
            scope: SERVICE_WORKER_SCOPE,
          }),
        );
      } else {
        return $q.resolve(workers[0]); // use first one available
      }
    });
  }

  function initMessaging() {
    if (!firebaseMessaging.shouldInitialize) {
      return $q.reject(
        new Error(
          'firebaseMessaging is not available, ensure fcm.senderId is set in config',
        ),
      );
    }

    if (_messaging) return $q.resolve(_messaging);

    return getOrCreateWorker().then(function (worker) {
      // got initialized since call to create worker...
      if (_messaging) return _messaging;

      firebase.initializeApp({
        messagingSenderId: SENDER_ID,
      });

      _messaging = angularize(firebase.messaging());

      _messaging.useServiceWorker(worker);

      _messaging.onTokenRefresh(function () {
        const args = arguments;
        onTokenRefreshCallbacks.forEach(function (fn) {
          fn.apply(null, args);
        });
      });

      _messaging.onMessage(function () {
        const args = arguments;
        onMessageCallbacks.forEach(function (fn) {
          fn.apply(null, args);
        });
      });

      return _messaging;
    });
  }

  /**
   *  Make the firebase messaging client work with angular promises
   *  and the digest cycle.
   */
  function angularize(messaging) {
    function wrapCallback(fn) {
      return function (callback) {
        fn.call(messaging, function () {
          const args = arguments;
          $timeout(function () {
            callback.apply(null, args);
          });
        });
      };
    }

    function wrapFunction(fn) {
      return function () {
        return $q.when(fn.apply(messaging, arguments));
      };
    }

    return {
      onTokenRefresh: wrapCallback(messaging.onTokenRefresh),
      onMessage: wrapCallback(messaging.onMessage),
      getToken: wrapFunction(messaging.getToken),
      requestPermission: wrapFunction(messaging.requestPermission),
      deleteToken: wrapFunction(messaging.deleteToken),
      useServiceWorker: messaging.useServiceWorker.bind(messaging),
    };
  }

  return firebaseMessaging;
}
