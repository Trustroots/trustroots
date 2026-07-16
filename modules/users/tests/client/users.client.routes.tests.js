import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Users Route Tests', function () {
  // We can start by loading the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  let $state;
  let $rootScope;
  let $q;
  let $templateCache;
  let Authentication;
  let $injector;

  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  beforeEach(inject(function (
    _$state_,
    _$rootScope_,
    _$q_,
    _$templateCache_,
    _Authentication_,
    _$injector_,
  ) {
    $state = _$state_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    $templateCache = _$templateCache_;
    Authentication = _Authentication_;
    $injector = _$injector_;
  }));

  function resolveFromProfileState(name, locals) {
    const state = $state.get('profile');
    expect(state).toBeDefined();
    expect(state.resolve).toBeDefined();
    expect(state.resolve[name]).toBeDefined();
    return $injector.invoke(state.resolve[name], null, locals);
  }

  describe('Route config', function () {
    it('puts linked Nostroots settings before hospitality networks', function () {
      const template = $templateCache.get(
        '/modules/users/views/profile/profile-edit-networks.client.view.html',
      );

      expect(template).toContain('href=https://nos.trustroots.org');
      expect(template.indexOf('Nostroots')).toBeLessThan(
        template.indexOf('Other hospitality networks'),
      );
    });

    it('should set confirm-email route details', function () {
      const state = $state.get('confirm-email');

      expect(state.url).toEqual('/confirm-email/:token?signup');
      expect(state.controller).toBe('ConfirmEmailController');
      expect(state.requiresAuth).toBe(false);
      expect(state.data).toMatchObject({
        pageTitle: 'Confirm email',
      });
    });

    it('should set remove route details', function () {
      const state = $state.get('remove');

      expect(state.url).toEqual('/remove/:token');
      expect(state.controller).toBe('RemoveProfileController');
      expect(state.requiresAuth).toBe(true);
      expect(state.data).toMatchObject({
        pageTitle: 'Remove profile',
      });
    });

    it('should configure profile parent route as abstract', function () {
      const state = $state.get('profile');

      expect(state.url).toEqual('/profile/:username');
      expect(state.abstract).toBe(true);
      expect(state.requiresAuth).toBe(true);
      expect(state.controller).toBe('ProfileController');
    });

    it('should configure profile about sub-route', function () {
      const state = $state.get('profile.about');

      expect(state.url).toEqual('');
      expect(state.abstract).toBeUndefined();
      expect(state.noScrollingTop).toBe(true);
      expect(state.data).toMatchObject({
        pageTitle: 'Profile',
      });
    });
  });

  describe('Profile route resolve logic', function () {
    it('handles 404 profile requests by returning an empty resolved profile', inject(function () {
      const failProfile = { status: 404, data: {} };
      const profileService = {
        get: jasmine.createSpy('get').and.returnValue({
          $promise: $q.reject(failProfile),
        }),
      };

      const result = resolveFromProfileState('profile', {
        UserProfilesService: profileService,
        $stateParams: {
          username: 'missing',
        },
        $q,
      });

      let resolved;
      result.then(function (profile) {
        resolved = profile;
      });

      $rootScope.$apply();

      expect(profileService.get).toHaveBeenCalledWith({
        username: 'missing',
      });
      expect(resolved).toEqual(
        jasmine.objectContaining({
          $resolved: true,
          $promise: jasmine.any(Object),
        }),
      );
    }));

    it('rethrows non-404 profile errors', function (done) {
      const failProfile = { status: 500, data: { message: 'down' } };
      const profileService = {
        get: jasmine.createSpy('get').and.returnValue({
          $promise: $q.reject(failProfile),
        }),
      };

      const result = resolveFromProfileState('profile', {
        UserProfilesService: profileService,
        $stateParams: {
          username: 'member',
        },
        $q,
      });

      result.then(
        function () {
          done.fail('Expected profile resolve to reject');
        },
        function (error) {
          expect(error).toBe(failProfile);
          done();
        },
      );

      $rootScope.$apply();
    });

    it('skips profile contact lookup when profile has no id', function (done) {
      const ContactByService = {
        get: jasmine.createSpy('ContactByService.get'),
      };

      const result = resolveFromProfileState('contact', {
        ContactByService,
        profile: {
          $promise: $q.when({}),
        },
        Authentication,
      });

      result.then(function (resolved) {
        expect(resolved).toBeUndefined();
        expect(ContactByService.get).not.toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('skips profile contact lookup when viewing own profile', function (done) {
      const ContactByService = {
        get: jasmine.createSpy('ContactByService.get'),
      };
      Authentication.user = {
        _id: 'user-self',
      };

      const result = resolveFromProfileState('contact', {
        ContactByService,
        profile: {
          $promise: $q.when({
            _id: 'user-self',
          }),
        },
        Authentication,
      });

      result.then(function (resolved) {
        expect(resolved).toBeUndefined();
        expect(ContactByService.get).not.toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('loads profile contact for non-own profile user', function (done) {
      const ContactByService = {
        get: jasmine.createSpy('ContactByService.get').and.returnValue({
          _id: 'contact-link',
        }),
      };
      Authentication.user = {
        _id: 'viewer',
      };

      const result = resolveFromProfileState('contact', {
        ContactByService,
        profile: {
          $promise: $q.when({
            _id: 'other-user',
          }),
        },
        Authentication,
      });

      result.then(function (resolved) {
        expect(ContactByService.get).toHaveBeenCalledWith({
          userId: 'other-user',
        });
        expect(resolved).toEqual({ _id: 'contact-link' });
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('skips profile contact lookup when profile loading failed', function (done) {
      const ContactByService = {
        get: jasmine.createSpy('ContactByService.get'),
      };

      const result = resolveFromProfileState('contact', {
        ContactByService,
        profile: {
          $promise: $q.reject(new Error('profile failed')),
        },
        Authentication,
      });

      result.then(function (resolved) {
        expect(resolved).toBeUndefined();
        expect(ContactByService.get).not.toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('returns profile contacts list for resolved profile id', function (done) {
      const ContactsListService = {
        query: jasmine.createSpy('ContactsListService.query').and.returnValue([
          {
            _id: 'contact-1',
          },
        ]),
      };

      const result = resolveFromProfileState('contacts', {
        ContactsListService,
        profile: {
          $promise: $q.when({
            _id: 'member-id',
          }),
        },
      });

      result.then(function (resolved) {
        expect(ContactsListService.query).toHaveBeenCalledWith({
          listUserId: 'member-id',
        });
        expect(resolved).toEqual([{ _id: 'contact-1' }]);
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('skips contact list when profile has no id', function (done) {
      const ContactsListService = {
        query: jasmine.createSpy('ContactsListService.query'),
      };

      const result = resolveFromProfileState('contacts', {
        ContactsListService,
        profile: {
          $promise: $q.when({}),
        },
      });

      result.then(function (resolved) {
        expect(ContactsListService.query).not.toHaveBeenCalled();
        expect(resolved).toBeUndefined();
        done();
      }, done.fail);

      $rootScope.$apply();
    });
  });

  describe('Additional route coverage', function () {
    const routeDefinitions = [
      {
        name: 'welcome',
        url: '/welcome',
        template: '<welcome />',
        requiresAuth: true,
        footerHidden: true,
        pageTitle: 'Welcome',
      },
      {
        name: 'profile-edit',
        url: '/profile/edit',
        controller: 'ProfileEditController',
        controllerAs: 'profileEdit',
        abstract: true,
        templateUrl:
          '/modules/users/views/profile/profile-edit.client.view.html',
      },
      {
        name: 'profile-edit.about',
        url: '',
        templateUrl:
          '/modules/users/views/profile/profile-edit-about.client.view.html',
        requiresAuth: true,
        data: { pageTitle: 'Edit profile' },
        controller: 'ProfileEditAboutController',
        controllerAs: 'profileEditAbout',
      },
      {
        name: 'profile-edit.locations',
        url: '/locations',
        templateUrl:
          '/modules/users/views/profile/profile-edit-locations.client.view.html',
        requiresAuth: true,
        data: { pageTitle: 'Edit your locations' },
        controller: 'ProfileEditLocationsController',
        controllerAs: 'profileEditLocations',
      },
      {
        name: 'profile-edit.photo',
        url: '/photo',
        templateUrl:
          '/modules/users/views/profile/profile-edit-photo.client.view.html',
        requiresAuth: true,
        data: { pageTitle: 'Edit profile photo' },
        controller: 'ProfileEditPhotoController',
        controllerAs: 'profileEditPhoto',
      },
      {
        name: 'profile-edit.networks',
        url: '/networks',
        templateUrl:
          '/modules/users/views/profile/profile-edit-networks.client.view.html',
        requiresAuth: true,
        data: { pageTitle: 'Edit Profile networks' },
        controller: 'ProfileEditNetworksController',
        controllerAs: 'profileEditNetworks',
      },
      {
        name: 'profile-edit.account',
        url: '/account',
        templateUrl:
          '/modules/users/views/profile/profile-edit-account.client.view.html',
        requiresAuth: true,
        data: { pageTitle: 'Account' },
        controller: 'ProfileEditAccountController',
        controllerAs: 'profileEditAccount',
      },
      {
        name: 'profile.about',
        url: '',
        templateUrl:
          '/modules/users/views/profile/profile-view-about.client.view.html',
        requiresAuth: true,
        noScrollingTop: true,
        data: { pageTitle: 'Profile' },
      },
      {
        name: 'profile.accommodation',
        url: '/accommodation',
        templateUrl:
          '/modules/users/views/profile/profile-view-accommodation.client.view.html',
        requiresAuth: true,
        noScrollingTop: true,
        data: { pageTitle: 'Profile accommodation' },
      },
      {
        name: 'profile.overview',
        url: '/overview',
        templateUrl:
          '/modules/users/views/profile/profile-view-basics.client.view.html',
        requiresAuth: true,
        noScrollingTop: true,
        data: { pageTitle: 'Profile overview' },
      },
      {
        name: 'profile.contacts',
        url: '/contacts',
        template:
          '<contact-list onContactRemoved="profileCtrl.removeContact" appUser="app.user" contacts="profileCtrl.contacts"></contact-list>',
        requiresAuth: true,
        noScrollingTop: true,
        data: { pageTitle: 'Profile contacts' },
      },
      {
        name: 'signup',
        url: '/signup?tribe',
        templateUrl:
          '/modules/users/views/authentication/signup.client.view.html',
        requiresAuth: undefined,
        data: { pageTitle: 'Sign up' },
      },
      {
        name: 'signin',
        url: '/signin?continue',
        templateUrl:
          '/modules/users/views/authentication/signin.client.view.html',
        requiresAuth: undefined,
        data: { pageTitle: 'Sign in' },
      },
      {
        name: 'forgot',
        url: '/password/forgot?userhandle=',
        templateUrl:
          '/modules/users/views/password/forgot-password.client.view.html',
        data: { pageTitle: 'Reset password' },
      },
      {
        name: 'reset',
        url: '/password/reset/:token',
        templateUrl:
          '/modules/users/views/password/reset-password.client.view.html',
        data: { pageTitle: 'Reset password' },
      },
    ];

    routeDefinitions.forEach(function (definition) {
      it(`configures ${definition.name}`, function () {
        const state = $state.get(definition.name);

        expect(state).toBeDefined();
        expect(state.url).toBe(definition.url);
        if (definition.template !== undefined) {
          expect(state.template).toBe(definition.template);
        }
        if (definition.templateUrl !== undefined) {
          expect(state.templateUrl).toBe(definition.templateUrl);
        }
        if (definition.controller !== undefined) {
          expect(state.controller).toBe(definition.controller);
        }
        if (definition.controllerAs !== undefined) {
          expect(state.controllerAs).toBe(definition.controllerAs);
        }
        if (definition.abstract !== undefined) {
          expect(state.abstract).toBe(definition.abstract);
        }
        if (definition.requiresAuth !== undefined) {
          expect(state.requiresAuth).toBe(definition.requiresAuth);
        }
        if (definition.noScrollingTop !== undefined) {
          expect(state.noScrollingTop).toBe(definition.noScrollingTop);
        }
        if (definition.data) {
          expect(state.data).toMatchObject(definition.data);
        }
      });
    });

    it('resolves app settings in profile-edit sub-routes', function (done) {
      const state = $state.get('profile-edit.locations');
      const appSettings = { maxFileSize: 1024 };
      const SettingsService = {
        get: jasmine.createSpy('get').and.returnValue($q.when(appSettings)),
      };

      const result = $injector.invoke(state.resolve.appSettings, null, {
        SettingsService,
      });

      result.then(function (resolvedSettings) {
        expect(resolvedSettings).toEqual(appSettings);
        expect(SettingsService.get).toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('resolves app settings for profile route', function (done) {
      const state = $state.get('profile');
      const settings = { allowMap: true };
      const SettingsService = {
        get: jasmine.createSpy('get').and.returnValue($q.when(settings)),
      };

      const result = $injector.invoke(state.resolve.appSettings, null, {
        SettingsService,
      });

      result.then(function (resolvedSettings) {
        expect(resolvedSettings).toEqual(settings);
        expect(SettingsService.get).toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('loads profile edit photo settings through route resolve', function (done) {
      const state = $state.get('profile-edit.photo');
      const appSettings = { avatars: true };
      const SettingsService = {
        get: jasmine.createSpy('get').and.returnValue($q.when(appSettings)),
      };

      const result = $injector.invoke(state.resolve.appSettings, null, {
        SettingsService,
      });

      result.then(function (resolved) {
        expect(resolved).toEqual(appSettings);
        expect(SettingsService.get).toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });

    it('resolves app settings for signup route', function (done) {
      const state = $state.get('signup');
      const appSettings = { signupEnabled: true };
      const SettingsService = {
        get: jasmine.createSpy('get').and.returnValue($q.when(appSettings)),
      };

      const result = $injector.invoke(state.resolve.appSettings, null, {
        SettingsService,
      });

      result.then(function (resolved) {
        expect(resolved).toEqual(appSettings);
        expect(SettingsService.get).toHaveBeenCalled();
        done();
      }, done.fail);

      $rootScope.$apply();
    });
  });
});
