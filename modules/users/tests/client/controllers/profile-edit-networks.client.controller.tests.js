import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';
import { npubEncode } from 'nostr-tools/lib/cjs/nip19.js';

describe('ProfileEditNetworksController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let $http;
  let $httpBackend;
  let $window;
  let Authentication;
  let Users;
  let messageCenterService;
  let usersUpdateData;
  let usersUpdateError;
  let updateShouldError;

  beforeEach(function () {
    usersUpdateData = {
      _id: 'user-id',
      displayName: 'Trust Roots',
    };
    usersUpdateError = null;
    updateShouldError = false;

    $window = {
      nostr: undefined,
    };

    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };

    Authentication = {
      user: {
        _id: 'user-id',
        displayName: 'Trust Roots',
        additionalProvidersData: {
          google: { id: 'google-oauth', created: new Date().toISOString() },
        },
      },
    };

    Users = function UsersMock(user) {
      const model = {
        ...user,
        $update: jasmine
          .createSpy('$update')
          .and.callFake(function (successCallback, errorCallback) {
            if (updateShouldError) {
              errorCallback({
                data: {
                  message: usersUpdateError,
                },
              });
              return;
            }

            successCallback({ ...usersUpdateData });
          }),
        $delete: jasmine.createSpy('$delete').and.callFake(function () {
          return {
            then(success) {
              success({ message: 'Account removal started.' });
            },
          };
        }),
      };
      return model;
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$window', $window);
      $provide.value('Users', Users);
      $provide.value('Authentication', Authentication);
      $provide.value('messageCenterService', messageCenterService);
    });
  });

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$q_,
    _$http_,
    _$httpBackend_,
  ) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    $http = _$http_;
    $httpBackend = _$httpBackend_;
  }));

  function createController({ profileEdit } = {}) {
    const $scope = $rootScope.$new();

    if (profileEdit) {
      $scope.profileEdit = profileEdit;
    }

    spyOn($scope, '$emit').and.callThrough();

    const vm = $controller('ProfileEditNetworksController', {
      $scope,
      $http,
      $q,
      $window,
      Users,
      Authentication,
      messageCenterService,
    });

    $rootScope.$apply();
    return { vm, $scope };
  }

  it('does not attempt Nostr detection without window.nostr', function () {
    const { vm } = createController();

    expect(vm.nostrNip07Loading).toBe(false);
    expect(vm.nostrNip07SuggestedNpub).toBe('');
  });

  it('detects Nostr NIP-07 public key and marks loading state', function () {
    const publicKey = '11'.repeat(32);
    const deferred = $q.defer();
    $window.nostr = {
      getPublicKey: jasmine
        .createSpy('getPublicKey')
        .and.returnValue(deferred.promise),
    };

    const { vm } = createController();

    expect(vm.nostrNip07Loading).toBe(true);
    expect($window.nostr.getPublicKey).toHaveBeenCalled();

    deferred.resolve(publicKey);
    $rootScope.$apply();

    expect(vm.nostrNip07Loading).toBe(false);
    expect(vm.nostrNip07SuggestedNpub).toBe(npubEncode(publicKey));
  });

  it('marks loading false even if Nostr detection fails', function () {
    $window.nostr = {
      getPublicKey: jasmine
        .createSpy('getPublicKey')
        .and.returnValue($q.reject(new Error('No extension'))),
    };

    const { vm } = createController();

    $rootScope.$apply();

    expect(vm.nostrNip07Loading).toBe(false);
    expect(vm.nostrNip07SuggestedNpub).toBe('');
  });

  it('detects whether suggested Nostr npub differs from existing value', function () {
    const { vm } = createController();
    const detected = npubEncode('11'.repeat(32));

    vm.nostrNip07SuggestedNpub = detected;
    vm.user.nostrNpub = ` ${detected} `;
    expect(vm.hasNostrNip07Suggestion()).toBe(false);

    vm.user.nostrNpub = `${detected}changed`;
    expect(vm.hasNostrNip07Suggestion()).toBe(true);
  });

  it('applies suggested Nostr npub and marks profile edit dirty', function () {
    const { vm, $scope } = createController({
      profileEdit: {
        unsavedModifications: false,
      },
    });
    const detected = npubEncode('22'.repeat(32));

    vm.user.nostrNpub = '';
    vm.nostrNip07SuggestedNpub = detected;

    vm.applyNostrNip07Suggestion();

    expect(vm.user.nostrNpub).toBe(detected);
    expect($scope.profileEdit.unsavedModifications).toBe(true);
  });

  it('applies suggested Nostr npub without a parent profile form', function () {
    const { vm } = createController();
    const detected = npubEncode('44'.repeat(32));

    vm.user.nostrNpub = '';
    vm.nostrNip07SuggestedNpub = detected;

    vm.applyNostrNip07Suggestion();

    expect(vm.user.nostrNpub).toBe(detected);
  });

  it('does not apply suggested Nostr value when suggestion is identical', function () {
    const { vm, $scope } = createController({
      profileEdit: {
        unsavedModifications: false,
      },
    });

    const detected = npubEncode('33'.repeat(32));

    vm.nostrNip07SuggestedNpub = detected;
    vm.user.nostrNpub = ` ${detected.toUpperCase()} `;

    vm.applyNostrNip07Suggestion();

    expect($scope.profileEdit.unsavedModifications).toBe(false);
  });

  it('checks warmshowers id style with numeric strings', function () {
    const { vm } = createController();

    vm.user.extSitesWS = 'abc';
    expect(vm.isWarmshowersId()).toBe(false);

    vm.user.extSitesWS = '12345';
    expect(vm.isWarmshowersId()).toBe(true);
  });

  it('checks additional social network presence', function () {
    const { vm } = createController();

    vm.user.additionalProvidersData = {
      google: {
        id: 'google-oauth',
      },
    };

    expect(vm.hasConnectedAdditionalSocialAccounts()).toBeTruthy();
    expect(vm.isConnectedSocialAccount('google')).toBeTruthy();
    expect(vm.isConnectedSocialAccount('facebook')).toBeFalsy();
  });

  it('shows remove account success and emits user updated event', function () {
    const { vm, $scope } = createController();

    $httpBackend.expectDELETE('/api/users/accounts/google').respond(200, {
      ...Authentication.user,
      additionalProvidersData: {},
    });

    vm.removeUserSocialAccount('google');
    $httpBackend.flush();

    expect(vm.user).toEqual(
      jasmine.objectContaining({
        additionalProvidersData: {},
      }),
    );
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'success',
      'Succesfully disconnected from google',
    );
    expect($scope.$emit).toHaveBeenCalledWith('userUpdated');
  });

  it('reports remove account error from API response', function () {
    const { vm } = createController();

    $httpBackend.expectDELETE('/api/users/accounts/google').respond(500, {
      message: 'Not possible',
    });

    vm.removeUserSocialAccount('google');
    $httpBackend.flush();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Not possible',
      { timeout: 10000 },
    );
  });

  it('reports fallback remove account error when API omits a message', function () {
    const { vm } = createController();

    $httpBackend.expectDELETE('/api/users/accounts/google').respond(500, {});

    vm.removeUserSocialAccount('google');
    $httpBackend.flush();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Something went wrong. Try again or contact us to disconnect your profile.',
      { timeout: 10000 },
    );
  });

  it('updates user profile when validation passes', function () {
    const { vm } = createController();
    usersUpdateData = {
      ...usersUpdateData,
      extra: 'updated',
    };

    vm.updateUserProfile(true);

    expect(Authentication.user).toEqual(
      jasmine.objectContaining(usersUpdateData),
    );
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'success',
      'Hospitality networks updated.',
    );
    expect(Authentication.user.extra).toBe('updated');
  });

  it('adds error on invalid form submit', function () {
    const { vm } = createController();

    vm.updateUserProfile(false);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please fix errors from your profile and try again.',
      { timeout: 10000 },
    );
  });

  it('adds error on profile update failure', function () {
    const { vm } = createController();
    updateShouldError = true;
    usersUpdateError = 'Validation failed';

    vm.updateUserProfile(true);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Validation failed',
      { timeout: 10000 },
    );
  });

  it('adds fallback error on profile update failure without a message', function () {
    const { vm } = createController();
    updateShouldError = true;
    usersUpdateError = null;

    vm.updateUserProfile(true);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Something went wrong. Please try again!',
      { timeout: 10000 },
    );
  });
});
