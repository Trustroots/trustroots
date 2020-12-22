import questionModalTemplateUrl from '@/modules/core/client/views/push-notification-question-modal.client.view.html';

angular.module('core').factory('push', push);

/* @ngInject */
function push(
  firebaseMessaging,
  Authentication,
  messageCenterService,
  $http,
  $window,
  $uibModal,
  locker,
  $q,
) {
  const LOCKER_KEY = 'tr.push';

  const push = {
    isSupported: getIsSupported(),
    isBusy: false,
    isEnabled: loadEnabled(),
    isBlocked: getIsBlocked(),

    init() {
      if (firebaseMessaging.shouldInitialize) {
        return setup();
      } else {
        return $q.resolve();
      }
    },

    /**
     * Enable local browser push notifications
     */
    enable() {
      if (!push.isSupported) return $q.reject(new Error('push is unsupported'));
      saveEnabled(true);
      return enable();
    },

    /**
     * Disable local browser push notifications
     */
    disable() {
      if (!push.isSupported) return $q.reject(new Error('push is unsupported'));
      saveEnabled(false);
      return disable();
    },
  };

  const store = {
    token: null, // so we can remove it when needed
  };

  firebaseMessaging.onTokenRefresh(setup);

  firebaseMessaging.onMessage(function (payload) {
    // eslint-disable-next-line no-new
    new $window.Notification(payload.notification.title, {
      body: payload.notification.body,
    });
  });

  $window.onbeforeunload = clearServiceWorkersIfNeeded;

  return push;

  function getIsSupported() {
    return !!(
      $window.Notification &&
      $window.navigator.serviceWorker &&
      $window.PushManager
    );
  }

  function getIsBlocked() {
    return $window.Notification && $window.Notification.permission === 'denied';
  }

  function setup() {
    if (!push.isSupported) {
      push.isEnabled = false;
      saveEnabled(false);
      return $q.resolve();
    }
    // make sure user intention matches reality
    if (loadEnabled()) {
      return enable();
    } else {
      askUser();
      return disable();
    }
  }

  /**
   * Ask user if they want to turn push notifications on
   */
  function askUser() {
    const pushAskedKey = LOCKER_KEY + '.asked';

    // Do not ask if:
    // - locker isn't supported (we can't store status)
    // - we've asked already (stored with `locker`)
    // - no authenticated user
    if (
      !locker.supported() ||
      locker.get(pushAskedKey) ||
      !Authentication.user
    ) {
      return;
    }

    $uibModal.open({
      templateUrl: questionModalTemplateUrl,
      controller($scope, $uibModalInstance) {
        const vm = this;

        // Yes! Turn push notifications on
        vm.yes = function () {
          // Enable push notifications
          enable();

          // Close modal
          $uibModalInstance.dismiss();
        };

        // When modal is closed/dismissed
        $scope.$on('modal.closing', function () {
          // Store info that we've now asked and user reacted
          locker.put(pushAskedKey, 'yes');
        });
      },
      controllerAs: 'askPushNotificationsModal',
      animation: true,
    });
  }

  function loadEnabled() {
    return locker.supported() && locker.get(LOCKER_KEY) === 'on';
  }

  function saveEnabled(enabled) {
    if (locker.supported()) {
      if (enabled) {
        locker.put(LOCKER_KEY, 'on');
      } else {
        locker.forget(LOCKER_KEY);
      }
    }
    return enabled;
  }

  function receivedToken(token) {
    if (userHasToken(token)) {
      // token already registered on server
      return $q.resolve();
    } else {
      return addTokenToServer(token);
    }
  }

  function enable() {
    push.isBusy = true;
    return firebaseMessaging
      .getToken()
      .then(function (token) {
        store.token = token;
        if (token) {
          return receivedToken(token).then(function () {
            push.isEnabled = true;
            push.isBusy = false;
          });
        } else {
          // no token yet, have to ask user nicely
          return firebaseMessaging.requestPermission().then(enable);
        }
      })
      .catch(function (err) {
        if (
          err.code === 'messaging/notifications-blocked' ||
          err.code === 'messaging/permission-blocked'
        ) {
          push.isBlocked = true;
        }
        push.isBusy = false;
        return $q.reject(err || new Error('Unknown error'));
      });
  }

  function disable() {
    if (!store.token) return $q.resolve();
    push.isBusy = true;
    return firebaseMessaging
      .deleteToken(store.token)
      .then(function () {
        return removeTokenFromServer(store.token);
      })
      .then(function () {
        push.isBusy = false;
        store.token = null;
        push.isEnabled = false;
      })
      .catch(function (err) {
        push.isBusy = false;
        return $q.reject(err);
      });
  }

  function userHasToken(token) {
    return !!Authentication.user.pushRegistration.find(function (registration) {
      return registration.token === token;
    });
  }

  function addTokenToServer(token) {
    return $http
      .post('/api/users/push/registrations', { token, platform: 'web' })
      .then(function (res) {
        Authentication.user = res.data.user;
      })
      .catch(handleServerError);
  }

  function removeTokenFromServer(token) {
    return $http
      .delete('/api/users/push/registrations/' + token)
      .then(function (res) {
        Authentication.user = res.data.user;
      })
      .catch(handleServerError);
  }

  function handleServerError(response) {
    let errorMessage;
    if (response) {
      errorMessage =
        'Error: ' +
        ((response.data && response.data.message) || 'Something went wrong.');
    } else {
      errorMessage = 'Something went wrong.';
    }
    messageCenterService.add('danger', errorMessage);
    return $q.reject(new Error(errorMessage));
  }

  function clearServiceWorkersIfNeeded() {
    if (!push.isSupported) return;
    /*
      remove any service workers that are not needed
      we cannot do it before this as firebase throws a wobbly if it
      can't find the previous service worker
    */
    if (!loadEnabled()) {
      firebaseMessaging.removeServiceWorker();
    }
  }
}
