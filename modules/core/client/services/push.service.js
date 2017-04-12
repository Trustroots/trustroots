(function () {
  'use strict';

  angular
    .module('core')
    .factory('push', push);

  /* @ngInject */
  function push(
    Authentication,
    messageCenterService,
    $http,
    $window,
    $timeout,
    $cookies,
    $q) {

    var SENDER_ID = loadSenderId();
    var SERVICE_WORKER_PATH = '/push-messaging-sw.js';
    var SERVICE_WORKER_SCOPE = '/trustroots-push-messaging-scope';
    var COOKIE_KEY = 'tr.push';

    var firebase = $window.firebase;
    var messaging = null; // created in initMessaging

    var push = {
      isSupported: getIsSupported(),
      isBusy: false,
      isEnabled: loadEnabled(),
      isBlocked: getIsBlocked(),

      /**
      * Enable local browser push notifications
      */
      enable: function() {
        if (!push.isSupported) throw new Error('push is unsupported');
        saveEnabled(true);
        enable();
      },

      /**
      * Disable local browser push notifications
      */
      disable: function() {
        if (!push.isSupported) throw new Error('push is unsupported');
        saveEnabled(false);
        disable();
      }

    };

    var store = {
      token: null // so we can remove it when needed
    };

    $window.onbeforeunload = clearServiceWorkersIfNeeded;

    setup();

    return push;

    function getIsSupported() {
      return !!($window.Notification &&
                $window.navigator.serviceWorker &&
                $window.PushManager);
    }

    function getIsBlocked() {
      return $window.Notification && $window.Notification.permission === 'denied';
    }

    function setup() {
      if (!push.isSupported) {
        push.isEnabled = false;
        saveEnabled(false);
        return;
      }
      // make sure user intention matches reality
      if (loadEnabled()) {
        enable();
      } else {
        disable();
      }
    }

    function loadEnabled() {
      return $cookies.get(COOKIE_KEY) === 'on';
    }

    function saveEnabled(enabled) {
      if (enabled) {
        $cookies.put(COOKIE_KEY, 'on');
      } else {
        $cookies.remove(COOKIE_KEY);
      }
      return enabled;
    }

    function enable() {
      push.isBusy = true;
      initMessaging().then(function(messaging) {
        messaging.getToken()
          .then(function(token) {
            store.token = token;
            if (token) {
              if (userHasToken(token)) {
                // token already registered on server
                push.isEnabled = true;
                push.isBusy = false;
              } else {
                addTokenToServer(token).then(function() {
                  push.isEnabled = true;
                  push.isBusy = false;
                });
              }
            } else {
              // no token yet, have to ask user nicely
              messaging.requestPermission()
              .then(function() {
                // permission granted, have another go...
                enable();
              }).catch(handleMessagingError);
            }
          }).catch(handleMessagingError);
      });
    }

    function disable() {
      if (!messaging || !store.token) return;
      push.isBusy = true;
      return messaging.deleteToken(store.token).then(function() {
        return removeTokenFromServer(store.token);
      }).then(function() {
        push.isBusy = false;
        store.token = null;
        push.isEnabled = false;
      }).catch(function() {
        push.isBusy = false;
      });
    }

    function handleMessagingError(err) {
      // not sure I want to do this.. might be registered on server still?
      // might be registered in browser too...
      saveEnabled(false);
      push.isEnabled = false;

      if (err.code === 'messaging/notifications-blocked' ||
          err.code === 'messaging/permission-blocked') {
        push.isBlocked = true;
      }
    }

    function getOrCreateWorker() {
      return getServiceWorkers().then(function(workers) {
        if (workers.length === 0) {
          return $q.when($window.navigator.serviceWorker
            .register(SERVICE_WORKER_PATH, { scope: SERVICE_WORKER_SCOPE }));
        } else {
          return $q.resolve(workers[0]); // use first one available
        }
      });
    }

    function initMessaging() {
      if (messaging) return $q.resolve(messaging);

      return getOrCreateWorker().then(function(worker) {

        firebase.initializeApp({
          messagingSenderId: SENDER_ID
        });

        messaging = angularizeMessaging(firebase.messaging());

        messaging.useServiceWorker(worker);

        messaging.onTokenRefresh(setup);

        messaging.onMessage(function(payload) {
          // eslint-disable-next-line no-new
          new Notification(payload.notification.title, {
            body: payload.notification.body
          });
        });

        return messaging;
      });

    }

    function userHasToken(token) {
      return !!Authentication.user.pushRegistration.find(function(registration) {
        return registration.token === token;
      });
    }

    function addTokenToServer(token) {
      return $http.post('/api/users/push/registrations', { token: token, platform: 'web' })
        .then(function(res) {
          Authentication.user = res.data.user;
        }).catch(handleServerError);
    }

    function removeTokenFromServer(token) {
      return $http.delete('/api/users/push/registrations/' + token)
        .then(function(res) {
          Authentication.user = res.data.user;
        }).catch(handleServerError);
    }

    function handleServerError(response) {
      var errorMessage;
      if (response) {
        errorMessage = 'Error: ' + ((response.data && response.data.message) || 'Something went wrong.');
      } else {
        errorMessage = 'Something went wrong.';
      }
      messageCenterService.add('danger', errorMessage);
    }

    function getServiceWorkers() {
      return $q.when($window.navigator.serviceWorker.getRegistrations()).then(function(registrations) {
        var workers = [];
        registrations.forEach(function(worker) {
          if (worker.scope.endsWith(SERVICE_WORKER_SCOPE)) {
            workers.push(worker);
          }
        });
        return workers;
      });
    }

    function clearServiceWorkersIfNeeded() {
      if (!push.isSupported) return;
      /*
        remove any service workers that are not needed
        we cannot do it before this as firebase throws a wobbly if it
        can't find the previous service worker
      */
      if (!loadEnabled()) {
        getServiceWorkers().then(function(workers) {
          workers.forEach(function(worker) {
            worker.unregister();
          });
        });
      }
    }

    /**
    *  Make the firebase messaging client work with angular promises
    *  and the digest cycle.
    */
    function angularizeMessaging(messaging) {

      function wrapCallback(fn) {
        return function(callback) {
          fn.call(messaging, function() {
            var args = arguments;
            $timeout(function() {
              callback.apply(null, args);
            });
          });
        };
      }

      function wrapFunction(fn) {
        return function() {
          return $q.when(fn.apply(messaging, arguments));
        };
      }

      return {
        onTokenRefresh: wrapCallback(messaging.onTokenRefresh),
        onMessage: wrapCallback(messaging.onMessage),
        getToken: wrapFunction(messaging.getToken),
        requestPermission: wrapFunction(messaging.requestPermission),
        deleteToken: wrapFunction(messaging.deleteToken),
        useServiceWorker: messaging.useServiceWorker.bind(messaging)
      };
    }

    function loadSenderId() {
      // TODO: probably move to some config somewhere...
      var el = $window.document.querySelector('meta[property="fcm:sender_id"]');
      if (el && el.content) return el.content;
      if ($window.FCM_SENDER_ID) return $window.FCM_SENDER_ID;
      throw new Error('please set fcm senderId config!');
    }

  }

}());
