import AppConfig from '@/modules/core/client/app/config';

/**
 * Push service
 */
describe('Push Service Tests', function () {
  let $httpBackend;
  let firebaseMessaging;
  let locker;

  const firebase = createFirebaseMock();

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName, firebase.moduleName));

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
    $window.Notification = function (title, options) {
      notifications.push({ title, options });
    };
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
        if (firebase.permissionGranted) {
          return $q.resolve(firebase.token);
        } else {
          return $q.resolve(null);
        }
      },
      requestPermission() {
        firebase.permissionGranted = true;
        firebase.requestPermissionCalled++;
        return $q.resolve();
      },
      deleteToken(token) {
        firebase.deletedTokens.push(token);
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
