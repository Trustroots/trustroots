import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

// Authentication controller Spec
describe('AuthenticationController', function () {
  // Initialize global variables
  let AuthenticationController;
  let $httpBackend;
  let $state;
  let $rootScope;
  let Authentication;
  let $analytics;
  let Facebook;
  let push;
  let trNativeAppBridge;
  let messageCenterService;

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(function () {
    $analytics = {
      setUsername: jasmine.createSpy('$analytics.setUsername'),
      eventTrack: jasmine.createSpy('$analytics.eventTrack'),
      settings: {
        pageTracking: {
          autoTrackFirstPage: false,
          autoTrackVirtualPages: false,
          autoBasePath: false,
          trackRelativePath: false,
          trackRoutes: false,
        },
      },
    };
    Facebook = {
      init: jasmine.createSpy('Facebook.init'),
    };
    push = {
      init: jasmine.createSpy('push.init'),
    };
    trNativeAppBridge = {
      signalAuthenticated: jasmine.createSpy(
        'trNativeAppBridge.signalAuthenticated',
      ),
    };
    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };

    angular.mock.module(function ($provide) {
      $provide.value('$analytics', $analytics);
      $provide.value('Facebook', Facebook);
      $provide.value('push', push);
      $provide.value('trNativeAppBridge', trNativeAppBridge);
      $provide.value('messageCenterService', messageCenterService);
    });
  });

  describe('Logged out user', function () {
    let $scope;
    const appSettings = {
      flashTimeout: 0,
    };

    // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
    // This allows us to inject a service but then attach it to a variable
    // with the same name as the service.
    beforeEach(inject(function (
      $controller,
      _$rootScope_,
      _$httpBackend_,
      _$state_,
      _Authentication_,
    ) {
      // Set a new global $scope
      $scope = _$rootScope_.$new();
      $rootScope = _$rootScope_;

      // Point global services to injected services
      $httpBackend = _$httpBackend_;
      $state = _$state_;
      spyOn($state, 'go');
      Authentication = _Authentication_;
      Authentication.user = null;

      // Initialize the Authentication controller
      AuthenticationController = $controller('AuthenticationController', {
        $scope,
        appSettings,
        $stateParams: {},
        $analytics,
        Facebook,
        push,
        trNativeAppBridge,
        messageCenterService,
      });

      $scope.vm = AuthenticationController;
    }));

    function mockViews() {
      $httpBackend
        .when('GET', '/modules/pages/views/home.client.view.html')
        .respond(200, '');
      $httpBackend
        .when('GET', '/modules/search/views/search.client.view.html')
        .respond(200, '');
      $httpBackend
        .when('GET', '/modules/search/views/search-map.client.view.html')
        .respond(200, '');
      $httpBackend
        .when('GET', '/modules/search/views/search-sidebar.client.view.html')
        .respond(200, '');
    }

    describe('AuthenticationController.signin()', function () {
      it('should login with a correct user and password', function () {
        // Test expected GET request
        mockViews();
        $httpBackend.when('POST', '/api/auth/signin').respond(200, {
          _id: 'Fred',
        });

        expect(AuthenticationController.isLoading).toBe(false);
        expect(AuthenticationController.authError).toBe(false);

        AuthenticationController.signin();
        expect(AuthenticationController.isLoading).toBe(true);
        $httpBackend.flush();

        // Test $scope value
        expect(Facebook.init).toHaveBeenCalled();
        expect(push.init).toHaveBeenCalled();
        expect(trNativeAppBridge.signalAuthenticated).toHaveBeenCalled();
        expect(Authentication.user).toEqual({ _id: 'Fred' });
        expect($analytics.setUsername).toHaveBeenCalledWith('Fred');
        expect($analytics.eventTrack).toHaveBeenCalledWith('login.success', {
          category: 'authentication',
          label: 'Login success',
        });
        expect($state.go).toHaveBeenCalledWith('search.map');
        expect(AuthenticationController.isLoading).toBe(false);
      });

      it('should fail to log in with nothing', function () {
        const facebookInitCalls = Facebook.init.calls.count();
        const pushInitCalls = push.init.calls.count();

        // Test expected POST request
        mockViews();
        $httpBackend.expectPOST('/api/auth/signin').respond(400, {
          message: 'Missing credentials',
        });

        AuthenticationController.signin();
        $httpBackend.flush();
        $scope.$digest();

        // Test $scope value
        expect(Authentication.user).toBeNull();
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Missing credentials',
        );
        expect($analytics.eventTrack).toHaveBeenCalledWith('login.failed', {
          category: 'authentication',
          label: 'Login failed',
        });
        expect(Facebook.init.calls.count()).toBe(facebookInitCalls);
        expect(push.init.calls.count()).toBe(pushInitCalls);
      });

      it('should use fallback message when signin response has no error', function () {
        const facebookInitCalls = Facebook.init.calls.count();
        const pushInitCalls = push.init.calls.count();

        // Test expected POST request
        mockViews();
        $httpBackend.expectPOST('/api/auth/signin').respond(400, {});

        AuthenticationController.signin();
        $httpBackend.flush();
        $scope.$digest();

        expect(AuthenticationController.authError).toBe(true);
        expect(AuthenticationController.isLoading).toBe(false);
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Something went wrong.',
        );
        expect($analytics.eventTrack).toHaveBeenCalledWith('login.failed', {
          category: 'authentication',
          label: 'Login failed',
        });
        expect(Facebook.init.calls.count()).toBe(facebookInitCalls);
        expect(push.init.calls.count()).toBe(pushInitCalls);
      });

      it('should redirect via stored signin target when continue param is set', function () {
        mockViews();
        $httpBackend.when('POST', '/api/auth/signin').respond(200, {
          _id: 'abc',
        });

        $rootScope.signinState = 'home';
        $rootScope.signinStateParams = { id: 'user-id' };

        // Re-create controller with continue set in state params
        inject(function ($controller) {
          AuthenticationController = $controller('AuthenticationController', {
            $scope,
            appSettings,
            $stateParams: {
              continue: true,
            },
            $analytics,
            Facebook,
            push,
            trNativeAppBridge,
            messageCenterService,
          });
        });

        AuthenticationController.signin();
        $httpBackend.flush();

        expect($state.go).toHaveBeenCalledWith('home', { id: 'user-id' });
        expect($rootScope.signinState).toBeUndefined();
        expect($rootScope.signinStateParams).toBeUndefined();
        expect(Authentication.user).toEqual({ _id: 'abc' });
        expect(push.init).toHaveBeenCalled();
        expect(trNativeAppBridge.signalAuthenticated).toHaveBeenCalled();
      });

      it('should redirect to search when continue param has no stored target', function () {
        mockViews();
        $httpBackend.when('POST', '/api/auth/signin').respond(200, {
          _id: 'abc',
        });

        delete $rootScope.signinState;
        delete $rootScope.signinStateParams;

        inject(function ($controller) {
          AuthenticationController = $controller('AuthenticationController', {
            $scope,
            appSettings,
            $stateParams: {
              continue: true,
            },
            $analytics,
            Facebook,
            push,
            trNativeAppBridge,
            messageCenterService,
          });
        });

        AuthenticationController.signin();
        $httpBackend.flush();

        expect($state.go).toHaveBeenCalledWith('search', {});
        expect(Authentication.user).toEqual({ _id: 'abc' });
      });
    });

    describe('Logged in user', function () {
      beforeEach(inject(function (
        $controller,
        $rootScope,
        _$state_,
        _Authentication_,
      ) {
        $scope = $rootScope.$new();

        $state = _$state_;
        $state.go = jasmine.createSpy().and.returnValue(true);

        // Mock logged in user
        _Authentication_.user = {
          username: 'test',
          roles: ['user'],
        };

        AuthenticationController = $controller('AuthenticationController', {
          $scope,
          appSettings,
          $analytics,
          Facebook,
          push,
          trNativeAppBridge,
          messageCenterService,
        });
      }));

      it('should be redirected to home', function () {
        expect($state.go).toHaveBeenCalledWith('search.map');
      });
    });
  });
});
