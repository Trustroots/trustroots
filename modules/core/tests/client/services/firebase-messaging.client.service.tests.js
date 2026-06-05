import AppConfig from '@/modules/core/client/app/config';

let mockedMessaging;

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  messaging: () => mockedMessaging,
}));

jest.mock('firebase/messaging', () => ({}));

describe('Firebase Messaging service', function () {
  let $rootScope;
  let $timeout;
  let firebaseMessaging;
  let settings;
  let getRegistrations;
  let register;

  function createMessagingMock({ token = 'generated-token' } = {}) {
    return {
      onTokenRefresh: jest.fn(),
      onMessage: jest.fn(),
      getToken: jest.fn().mockReturnValue(token),
      requestPermission: jest.fn().mockReturnValue(),
      deleteToken: jest.fn().mockReturnValue(),
      useServiceWorker: jest.fn(),
    };
  }

  function createServiceWorker(scope) {
    return {
      scope,
      unregister: jest.fn(),
    };
  }

  function bootstrap({
    fcmSenderId = 'test-sender-id',
    registrations = [],
    token = 'generated-token',
    registerValue = createServiceWorker('/trustroots-push-messaging-scope'),
  } = {}) {
    mockedMessaging = createMessagingMock({ token });
    settings = {
      fcmSenderId,
    };

    const serviceWorker = {
      getRegistrations: jest.fn().mockReturnValue(registrations),
      register: jest.fn().mockReturnValue(registerValue),
    };
    const Notification = jest.fn();

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$window', {
        Notification,
        PushManager: {},
        navigator: {
          serviceWorker,
        },
      });

      $provide.value('SettingsService', {
        get() {
          return settings;
        },
      });
    });

    inject(function (_$rootScope_, _$timeout_, _firebaseMessaging_) {
      $rootScope = _$rootScope_;
      $timeout = _$timeout_;
      firebaseMessaging = _firebaseMessaging_;
      getRegistrations = serviceWorker.getRegistrations;
      register = serviceWorker.register;
    });

    return {
      registerValue,
    };
  }

  function flushAsync() {
    for (let i = 0; i < 3; i++) {
      $rootScope.$apply();
    }
  }

  it('rejects calls when fcm senderId is not configured', function (done) {
    bootstrap({ fcmSenderId: '' });
    expect(firebaseMessaging.shouldInitialize).toBe(false);

    firebaseMessaging.getToken().then(
      () => {
        done(
          new Error('Expected getToken to reject when sender ID is missing'),
        );
      },
      error => {
        expect(error.message).toBe(
          'firebaseMessaging is not available, ensure fcm.senderId is set in config',
        );
        done();
      },
    );

    flushAsync();
  });

  it('creates a new service worker when none exists', function (done) {
    const registerValue = createServiceWorker(
      '/trustroots-push-messaging-scope',
    );
    bootstrap({ registrations: [], registerValue });
    expect(firebaseMessaging.shouldInitialize).toBe(true);

    firebaseMessaging.getToken().then(() => {
      expect(mockedMessaging.getToken).toHaveReturnedWith('generated-token');
      expect(getRegistrations).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledWith('/push-messaging-sw.js', {
        scope: '/trustroots-push-messaging-scope',
      });
      expect(mockedMessaging.useServiceWorker).toHaveBeenCalledWith(
        registerValue,
      );
      done();
    }, done);

    flushAsync();
  });

  it('uses existing service worker when one already exists', function (done) {
    const existingWorker = createServiceWorker(
      '/trustroots-push-messaging-scope',
    );
    const ignoredWorker = createServiceWorker('/other');
    bootstrap({
      registrations: [ignoredWorker, existingWorker],
    });
    expect(firebaseMessaging.shouldInitialize).toBe(true);

    firebaseMessaging.getToken().then(() => {
      expect(getRegistrations).toHaveBeenCalledTimes(1);
      expect(register).not.toHaveBeenCalled();
      expect(mockedMessaging.useServiceWorker).toHaveBeenCalledWith(
        existingWorker,
      );
      done();
    }, done);

    flushAsync();
  });

  it('forwards token refresh events to registered listeners', function (done) {
    const listener = jest.fn();
    bootstrap();
    firebaseMessaging.onTokenRefresh(listener);

    firebaseMessaging.getToken().then(() => {
      const refreshSpy = mockedMessaging.onTokenRefresh.mock.calls[0][0];
      refreshSpy('refresh-token');
    }, done);

    flushAsync();

    $timeout.flush();
    expect(listener).toHaveBeenCalledWith('refresh-token');
    done();
  });

  it('forwards message events to registered listeners', function (done) {
    const listener = jest.fn();
    const payload = {
      notification: {
        title: 'hi',
      },
    };

    bootstrap();
    firebaseMessaging.onMessage(listener);

    firebaseMessaging.getToken().then(() => {
      const messageSpy = mockedMessaging.onMessage.mock.calls[0][0];
      messageSpy(payload);
    }, done);
    flushAsync();

    $timeout.flush();
    expect(listener).toHaveBeenCalledWith(payload);
    done();
  });

  it('unregisters matching service workers when requested', function (done) {
    const matchingWorker = createServiceWorker(
      '/trustroots-push-messaging-scope',
    );
    bootstrap({ registrations: [matchingWorker] });

    firebaseMessaging.removeServiceWorker().then(() => {
      expect(getRegistrations).toHaveBeenCalledTimes(1);
      expect(matchingWorker.unregister).toHaveBeenCalledTimes(1);
      done();
    }, done);

    flushAsync();
  });

  it('delegates permission requests and deletions to messaging instance', function () {
    bootstrap();

    firebaseMessaging.requestPermission();
    flushAsync();
    firebaseMessaging.deleteToken('user-token');
    flushAsync();

    expect(mockedMessaging.requestPermission).toHaveBeenCalledTimes(1);
    expect(mockedMessaging.deleteToken).toHaveBeenCalledWith('user-token');
  });
});
