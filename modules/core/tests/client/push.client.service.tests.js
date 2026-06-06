import AppConfig from '@/modules/core/client/app/config';

/**
 * Push service
 */
describe('Push Service Tests', function () {
  let $httpBackend;
  let firebaseMessaging;
  let locker;
  let modalOpen;
  let modalOpenConfig;

  const firebase = createFirebaseMock();

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName, firebase.moduleName));

  beforeEach(function () {
    modalOpenConfig = null;
    modalOpen = jasmine
      .createSpy('uibModal.open')
      .and.callFake(function (config) {
        modalOpenConfig = config;
        return {};
      });

    angular.mock.module(function ($provide) {
      $provide.value('$uibModal', {
        open: modalOpen,
      });
    });
  });

  beforeEach(firebase.reset);

  const notifications = [];

  beforeEach(inject(function (
    _$httpBackend_,
    _locker_,
    $window,
    Authentication,
    _firebaseMessaging_,
  ) {
    $httpBackend = _$httpBackend_;
    locker = _locker_;
    firebaseMessaging = _firebaseMessaging_;
    Authentication.user = {
      pushRegistration: [],
    };
    notifications.length = 0;
    firebaseMessaging.shouldInitialize = false;

    if (!$window.navigator) {
      $window.navigator = {};
    }
    Object.defineProperty($window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: jasmine.createSpy('serviceWorker.register'),
      },
    });
    Object.defineProperty($window, 'PushManager', {
      configurable: true,
      value: {},
    });

    Object.defineProperty($window, 'Notification', {
      configurable: true,
      value(title, options) {
        notifications.push({ title, options });
      },
    });
  }));

  afterEach(function () {
    locker.clean();
  });

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('will save to server if enabled', inject(function (push, Authentication) {
    if (!push.isSupported) return;

    const token = 'mynicetoken';
    firebase.token = token;

    $httpBackend
      .expect('POST', '/api/users/push/registrations', {
        token,
        platform: 'web',
      })
      .respond(200, {
        user: {
          pushRegistration: [{ token, platform: 'web', created: Date.now() }],
        },
      });

    push.enable();

    $httpBackend.flush();
    expect(firebase.requestPermissionCalled).toBe(1);
    expect(firebase.permissionGranted).toBe(true);
    expect(Authentication.user.pushRegistration.length).toBe(1);
    expect(Authentication.user.pushRegistration[0].token).toBe(token);
    expect(locker.get('tr.push')).toBe('on');
  }));

  it('does not persist the enabled preference when storage is unsupported', inject(function (
    push,
    locker,
    Authentication,
  ) {
    if (!push.isSupported) return;

    const token = 'unsupported-storage-token';
    spyOn(locker, 'supported').and.returnValue(false);
    firebase.token = token;
    firebase.permissionGranted = true;

    $httpBackend
      .expect('POST', '/api/users/push/registrations', {
        token,
        platform: 'web',
      })
      .respond(200, {
        user: {
          pushRegistration: [{ token, platform: 'web' }],
        },
      });

    push.enable();

    $httpBackend.flush();
    expect(Authentication.user.pushRegistration[0].token).toBe(token);
    expect(locker.get('tr.push')).toBeUndefined();
  }));

  it('will save to server during initialization if on but not present', inject(function (
    push,
    Authentication,
  ) {
    if (!push.isSupported) return;

    const token = 'mynicetokenforinitializing';

    $httpBackend
      .expect('POST', '/api/users/push/registrations', {
        token,
        platform: 'web',
      })
      .respond(200, {
        user: {
          pushRegistration: [
            {
              token,
              platform: 'web',
              created: Date.now(),
            },
          ],
        },
      });

    // if we turn it on...
    locker.put('tr.push', 'on');
    firebase.permissionGranted = true;
    firebase.token = token;

    // .. and enable it to be initialized
    firebaseMessaging.shouldInitialize = true;

    // we will cause it to register on the server
    push.init();

    expect(Authentication.user.pushRegistration.length).toBe(0);

    $httpBackend.flush();

    expect(Authentication.user.pushRegistration.length).toBe(1);
    expect(Authentication.user.pushRegistration[0].token).toBe(token);
  }));

  it('registers refreshed tokens when saved preference is enabled', inject(function (
    push,
    locker,
    $rootScope,
    Authentication,
  ) {
    if (!push.isSupported) return;

    const token = 'refreshed-token';
    locker.put('tr.push', 'on');
    firebase.permissionGranted = true;
    firebase.token = token;

    $httpBackend
      .expect('POST', '/api/users/push/registrations', {
        token,
        platform: 'web',
      })
      .respond(200, {
        user: {
          pushRegistration: [{ token, platform: 'web' }],
        },
      });

    firebase.triggerOnTokenRefresh();
    $httpBackend.flush();
    $rootScope.$apply();

    expect(Authentication.user.pushRegistration[0].token).toBe(token);
    expect(push.isEnabled).toBe(true);
  }));

  it('can be disabled and will be removed from server', inject(function (
    push,
    Authentication,
    locker,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    const token = 'sometokenfordisabling';

    // Preregister it
    firebase.token = token;
    firebase.permissionGranted = true;
    Authentication.user.pushRegistration.push({
      token,
      platform: 'web',
    });

    expect(push.isEnabled).toBe(false);

    // first enable it ...

    push.enable();
    $rootScope.$apply();

    expect(firebase.requestPermissionCalled).toBe(0);
    expect(Authentication.user.pushRegistration.length).toBe(1);
    expect(locker.get('tr.push')).toBe('on');
    expect(push.isEnabled).toBe(true);

    // ... now disable it again

    $httpBackend
      .expect('DELETE', '/api/users/push/registrations/' + token)
      .respond(200, {
        user: {
          pushRegistration: [],
        },
      });

    push.disable();
    $httpBackend.flush();

    expect(Authentication.user.pushRegistration.length).toBe(0);
    expect(locker.get('tr.push')).toBeFalsy();
    expect(firebase.deletedTokens.length).toBe(1);
    expect(firebase.deletedTokens[0]).toBe(token);
    expect(push.isEnabled).toBe(false);
  }));

  it('resets busy state when Firebase delete token fails', function (done) {
    inject(function (push, Authentication, $rootScope) {
      if (!push.isSupported) return done();

      const token = 'delete-failure-token';
      firebase.token = token;
      firebase.permissionGranted = true;
      Authentication.user.pushRegistration.push({
        token,
        platform: 'web',
      });

      push.enable();
      $rootScope.$apply();
      expect(push.isEnabled).toBe(true);

      const deleteError = new Error('delete failed');
      firebase.deleteTokenError = deleteError;

      push.disable().catch(function (error) {
        expect(error).toBe(deleteError);
        expect(push.isBusy).toBe(false);
        expect(push.isEnabled).toBe(true);
        expect(firebase.deletedTokens).toEqual([token]);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('reports server errors when registering a token fails', function (done) {
    inject(function (push, $rootScope, messageCenterService) {
      if (!push.isSupported) return done();

      spyOn(messageCenterService, 'add').and.callThrough();
      firebase.token = 'server-rejected-token';
      firebase.permissionGranted = true;

      $httpBackend
        .expect('POST', '/api/users/push/registrations', {
          token: 'server-rejected-token',
          platform: 'web',
        })
        .respond(500, { message: 'Registration failed' });

      push.enable().catch(function (error) {
        expect(error.message).toBe('Error: Registration failed');
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Error: Registration failed',
        );
        expect(push.isBusy).toBe(false);
        done();
      });

      $httpBackend.flush();
      $rootScope.$apply();
    });
  });

  it('reports a generic error when token registration fails without a response', function (done) {
    inject(function (push, $http, $q, $rootScope, messageCenterService) {
      if (!push.isSupported) return done();

      spyOn($http, 'post').and.returnValue($q.reject());
      spyOn(messageCenterService, 'add').and.callThrough();
      firebase.token = 'network-failed-token';
      firebase.permissionGranted = true;

      push.enable().catch(function (error) {
        expect(error.message).toBe('Something went wrong.');
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Something went wrong.',
        );
        expect(push.isBusy).toBe(false);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('reports fallback server errors when unregistering a token fails', function (done) {
    inject(function (push, Authentication, $rootScope, messageCenterService) {
      if (!push.isSupported) return done();

      spyOn(messageCenterService, 'add').and.callThrough();
      const token = 'delete-server-error-token';
      firebase.token = token;
      firebase.permissionGranted = true;
      Authentication.user.pushRegistration.push({
        token,
        platform: 'web',
      });

      push.enable();
      $rootScope.$apply();

      $httpBackend
        .expect('DELETE', '/api/users/push/registrations/' + token)
        .respond(503, {});

      push.disable().catch(function (error) {
        expect(error.message).toBe('Error: Something went wrong.');
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Error: Something went wrong.',
        );
        expect(push.isBusy).toBe(false);
        done();
      });

      $httpBackend.flush();
      $rootScope.$apply();
    });
  });

  it('will not save to server if enabling and already registered', inject(function (
    push,
    Authentication,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    const token = 'sometoken';
    // Preregister it
    firebase.token = token;
    firebase.permissionGranted = true;
    Authentication.user.pushRegistration.push({
      token,
      platform: 'web',
    });
    push.enable();
    $rootScope.$apply();
    expect(firebase.requestPermissionCalled).toBe(0);
    expect(push.isEnabled).toBe(true);
    expect(locker.get('tr.push')).toBe('on');
  }));

  it('rejects unknown Firebase token failures with a default error', function (done) {
    inject(function (push, $rootScope) {
      if (!push.isSupported) return done();

      firebase.rejectTokenWithoutError = true;

      push.enable().catch(function (error) {
        expect(error.message).toBe('Unknown error');
        expect(push.isBusy).toBe(false);
        expect(push.isBlocked).toBe(false);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('resets busy state when requesting permission fails', function (done) {
    inject(function (push, $rootScope) {
      if (!push.isSupported) return done();

      const permissionError = new Error('permission request failed');
      firebase.requestPermissionError = permissionError;

      push.enable().catch(function (error) {
        expect(error).toBe(permissionError);
        expect(firebase.requestPermissionCalled).toBe(1);
        expect(push.isBusy).toBe(false);
        expect(push.isBlocked).toBe(false);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('rejects instead of retrying forever when no token is returned after permission', function (done) {
    inject(function (push, $rootScope) {
      if (!push.isSupported) return done();

      firebase.token = null;
      firebase.permissionGranted = false;

      push.enable().catch(function (error) {
        expect(error.message).toBe(
          'push token unavailable after permission request',
        );
        expect(firebase.requestPermissionCalled).toBe(1);
        expect(push.isBusy).toBe(false);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('should trigger a notification when a message is received', inject(function (
    push,
  ) {
    if (!push.isSupported) return;
    firebase.triggerOnMessage({
      notification: {
        title: 'foo',
        body: 'yay',
      },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].title).toBe('foo');
    expect(notifications[0].options.body).toBe('yay');
  }));

  it('asks user for consent when initialized and push is disabled', inject(function (
    push,
    locker,
    $rootScope,
    Authentication,
  ) {
    if (!push.isSupported) return;

    const modalInstance = {
      dismiss: jasmine.createSpy('modalInstance.dismiss'),
    };
    let modalClosingHandler;

    modalOpen.and.callFake(function (config) {
      modalOpenConfig = config;

      return {};
    });

    firebase.token = 'existing-token';
    firebase.permissionGranted = true;
    Authentication.user.pushRegistration.push({
      token: 'existing-token',
      platform: 'web',
    });
    locker.forget('tr.push');
    locker.forget('tr.push.asked');

    firebaseMessaging.shouldInitialize = true;
    push.init();
    $rootScope.$apply();

    expect(modalOpen).toHaveBeenCalledTimes(1);
    expect(modalOpenConfig).toEqual(
      jasmine.objectContaining({
        controllerAs: 'askPushNotificationsModal',
      }),
    );

    const fakeScope = {
      $on(eventName, callback) {
        if (eventName === 'modal.closing') {
          modalClosingHandler = callback;
        }
      },
    };
    const viewModel = {};
    const controller = modalOpenConfig.controller.at(-1);
    controller.call(viewModel, fakeScope, modalInstance);
    viewModel.yes();
    $rootScope.$apply();

    expect(modalInstance.dismiss).toHaveBeenCalled();
    expect(push.isEnabled).toBe(true);

    modalClosingHandler();
    expect(locker.get('tr.push.asked')).toBe('yes');
  }));

  it('disables saved preference on init and rejects actions when unsupported', function (done) {
    inject(function (push, locker, firebaseMessaging, $rootScope, $q) {
      push.isSupported = false;
      locker.put('tr.push', 'on');
      firebaseMessaging.shouldInitialize = true;

      push.init();
      $rootScope.$apply();

      expect(push.isEnabled).toBe(false);
      expect(locker.get('tr.push')).toBeFalsy();

      $q.all([
        push.enable().catch(function (error) {
          expect(error.message).toBe('push is unsupported');
        }),
        push.disable().catch(function (error) {
          expect(error.message).toBe('push is unsupported');
        }),
      ]).then(function () {
        done();
      }, done.fail);

      $rootScope.$apply();
    });
  });

  it('does not ask for consent again once user has already been asked', inject(function (
    push,
    locker,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    locker.put('tr.push.asked', 'yes');
    firebaseMessaging.shouldInitialize = true;

    push.init();
    $rootScope.$apply();

    expect(modalOpen).not.toHaveBeenCalled();
  }));

  it('does not ask for consent for unauthenticated users', inject(function (
    push,
    locker,
    Authentication,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    Authentication.user = null;
    locker.forget('tr.push');
    locker.forget('tr.push.asked');

    firebaseMessaging.shouldInitialize = true;
    push.init();
    $rootScope.$apply();

    expect(modalOpen).not.toHaveBeenCalled();
  }));

  it('does not try removing a token when disabling with no token in memory', inject(function (
    push,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    push.disable();
    $rootScope.$apply();

    expect(firebase.deletedTokens).toHaveLength(0);
  }));

  it('does nothing on init when firebase messaging is not set to initialize', inject(function (
    push,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    firebaseMessaging.shouldInitialize = false;
    push.init();
    $rootScope.$apply();

    expect(firebase.requestPermissionCalled).toBe(0);
    expect(firebase.deletedTokens).toHaveLength(0);
  }));

  it('requests permission and still registers token when token is initially unavailable', inject(function (
    push,
    locker,
    $rootScope,
    Authentication,
  ) {
    if (!push.isSupported) return;

    firebase.token = 'token-after-permission';
    firebase.permissionGranted = false;
    locker.put('tr.push', 'on');

    $httpBackend
      .expect('POST', '/api/users/push/registrations', {
        token: 'token-after-permission',
        platform: 'web',
      })
      .respond(200, {
        user: {
          pushRegistration: [
            { token: 'token-after-permission', platform: 'web' },
          ],
        },
      });

    firebaseMessaging.shouldInitialize = true;
    push.init();
    $rootScope.$apply();
    $httpBackend.flush();

    expect(firebase.requestPermissionCalled).toBe(1);
    expect(Authentication.user.pushRegistration[0].token).toBe(
      'token-after-permission',
    );
  }));

  it('does not show consent modal if lock state checks are unsupported', inject(function (
    push,
    locker,
    Authentication,
    $rootScope,
  ) {
    if (!push.isSupported) return;

    spyOn(locker, 'supported').and.returnValue(false);
    Authentication.user = {
      pushRegistration: [],
    };

    firebaseMessaging.shouldInitialize = true;
    push.init();
    $rootScope.$apply();

    expect(modalOpen).not.toHaveBeenCalled();
  }));

  it('marks push as blocked when permission is denied by the browser', function (done) {
    inject(function (push, $rootScope) {
      if (!push.isSupported) return done();

      const blockError = { code: 'messaging/permission-blocked' };
      firebase.tokenError = blockError;

      push.enable().catch(function (error) {
        expect(push.isBlocked).toBe(true);
        expect(error).toEqual(blockError);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('marks push as blocked when browser notifications are blocked', function (done) {
    inject(function (push, $rootScope) {
      if (!push.isSupported) return done();

      const blockError = { code: 'messaging/notifications-blocked' };
      firebase.tokenError = blockError;

      push.enable().catch(function (error) {
        expect(push.isBlocked).toBe(true);
        expect(error).toEqual(blockError);
        done();
      });

      $rootScope.$apply();
    });
  });

  it('removes service workers on unload when push is not enabled', inject(function (
    push,
    locker,
    $window,
  ) {
    if (!push.isSupported) return;

    locker.put('tr.push', 'off');
    $window.onbeforeunload();

    expect(firebase.removeServiceWorkerCalled).toBe(1);
  }));

  it('keeps service workers when push is enabled', inject(function (
    push,
    locker,
    $window,
  ) {
    if (!push.isSupported) return;

    locker.put('tr.push', 'on');
    $window.onbeforeunload();

    expect(firebase.removeServiceWorkerCalled).toBe(0);
  }));

  it('skips unload service worker cleanup when push is unsupported', inject(function (
    push,
    locker,
    $window,
  ) {
    push.isSupported = false;
    locker.put('tr.push', 'off');

    $window.onbeforeunload();

    expect(firebase.removeServiceWorkerCalled).toBe(0);
  }));
});

function createFirebaseMock() {
  const onMessageCallbacks = [];
  const onTokenRefreshCallbacks = [];

  const firebase = {
    deletedTokens: [],
    reset,
    moduleName: 'firebaseMessagingMock',

    triggerOnMessage() {
      const args = arguments;
      onMessageCallbacks.forEach(function (fn) {
        fn.apply(null, args);
      });
    },

    triggerOnTokenRefresh() {
      const args = arguments;
      onTokenRefreshCallbacks.forEach(function (fn) {
        fn.apply(null, args);
      });
    },
  };

  function reset() {
    onMessageCallbacks.length = 0;
    onTokenRefreshCallbacks.length = 0;
    firebase.token = null;
    firebase.permissionGranted = false;
    firebase.deletedTokens.length = 0;
    firebase.tokenError = null;
    firebase.requestPermissionError = null;
    firebase.rejectTokenWithoutError = false;
    firebase.deleteTokenError = null;
    firebase.requestPermissionCalled = 0;
    firebase.removeServiceWorkerCalled = 0;
  }

  angular
    .module(firebase.moduleName, [])

    // this will replace the real one
    .factory('firebaseMessaging', create);

  function create($q) {
    return {
      name: 'fcm-mock',
      shouldInitialize: false, // means core does not set it up for us
      getToken() {
        if (firebase.rejectTokenWithoutError) {
          return $q.reject();
        }
        if (firebase.tokenError) {
          return $q.reject(firebase.tokenError);
        }
        if (firebase.permissionGranted) {
          return $q.resolve(firebase.token);
        } else {
          return $q.resolve(null);
        }
      },
      requestPermission() {
        firebase.requestPermissionCalled++;
        if (firebase.requestPermissionError) {
          return $q.reject(firebase.requestPermissionError);
        }
        firebase.permissionGranted = true;
        return $q.resolve();
      },
      deleteToken(token) {
        firebase.deletedTokens.push(token);
        if (firebase.deleteTokenError) {
          return $q.reject(firebase.deleteTokenError);
        }
        return $q.resolve();
      },
      onTokenRefresh(fn) {
        onTokenRefreshCallbacks.push(fn);
      },
      onMessage(fn) {
        onMessageCallbacks.push(fn);
      },
      removeServiceWorker() {
        firebase.removeServiceWorkerCalled++;
      },
    };
  }

  return firebase;
}
