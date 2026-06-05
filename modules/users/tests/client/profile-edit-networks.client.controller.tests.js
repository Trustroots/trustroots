import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileEditNetworksController', function () {
  let $controller;
  let $q;
  let $rootScope;
  let Authentication;
  let messageCenterService;

  const validHex =
    '0000000000000000000000000000000000000000000000000000000000000000';
  const validNpub =
    'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
  const differentNpub =
    'npub1zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygse4sl3h';

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$controller_,
    _$q_,
    _$rootScope_,
    _Authentication_,
    _messageCenterService_,
  ) {
    $controller = _$controller_;
    $q = _$q_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;
    messageCenterService = _messageCenterService_;
  }));

  function createController(user, $window = {}) {
    const $scope = $rootScope.$new();
    $scope.profileEdit = {
      unsavedModifications: false,
    };
    Authentication.user = user;

    const controller = $controller('ProfileEditNetworksController', {
      $scope,
      $window,
      messageCenterService,
    });

    return {
      $scope,
      controller,
    };
  }

  function flushNip07() {
    $rootScope.$digest();
    $rootScope.$digest();
  }

  it('does not suggest an npub when NIP-07 is unavailable', function () {
    const { controller } = createController({
      _id: 'user',
      nostrNpub: '',
    });

    expect(controller.nostrNip07SuggestedNpub).toBe('');
    expect(controller.hasNostrNip07Suggestion()).toBeFalsy();
  });

  it('stores an encoded npub suggestion from NIP-07', function () {
    const $window = {
      nostr: {
        getPublicKey: jasmine
          .createSpy('getPublicKey')
          .and.returnValue($q.resolve(validHex)),
      },
    };

    const { controller } = createController(
      {
        _id: 'user',
        nostrNpub: '',
      },
      $window,
    );
    flushNip07();

    expect($window.nostr.getPublicKey).toHaveBeenCalled();
    expect(controller.nostrNip07SuggestedNpub).toBe(validNpub);
    expect(controller.hasNostrNip07Suggestion()).toBeTruthy();
  });

  it('flags loading and offers "use" copy while resolving an empty field', function () {
    const $window = {
      nostr: {
        getPublicKey: jasmine
          .createSpy('getPublicKey')
          .and.returnValue($q.resolve(validHex)),
      },
    };

    const { controller } = createController(
      {
        _id: 'user',
        nostrNpub: '',
      },
      $window,
    );

    expect(controller.nostrNip07Loading).toBe(true);

    flushNip07();

    expect(controller.nostrNip07Loading).toBe(false);
    expect(controller.nostrNip07SuggestionButtonText()).toBe('Use this npub');
  });

  it('applies an empty-field suggestion and marks the profile as modified', function () {
    const $window = {
      nostr: {
        getPublicKey: jasmine
          .createSpy('getPublicKey')
          .and.returnValue($q.resolve(validHex)),
      },
    };

    const { $scope, controller } = createController(
      {
        _id: 'user',
        nostrNpub: '',
      },
      $window,
    );
    flushNip07();

    controller.applyNostrNip07Suggestion();

    expect(controller.user.nostrNpub).toBe(validNpub);
    expect($scope.profileEdit.unsavedModifications).toBe(true);
  });

  it('does not show a suggestion when the stored npub already matches NIP-07', function () {
    const $window = {
      nostr: {
        getPublicKey: jasmine
          .createSpy('getPublicKey')
          .and.returnValue($q.resolve(validHex)),
      },
    };

    const { controller } = createController(
      {
        _id: 'user',
        nostrNpub: validNpub,
      },
      $window,
    );
    flushNip07();

    expect(controller.nostrNip07SuggestedNpub).toBe(validNpub);
    expect(controller.hasNostrNip07Suggestion()).toBeFalsy();
  });

  it('shows a replacement suggestion when the stored npub differs from NIP-07', function () {
    const $window = {
      nostr: {
        getPublicKey: jasmine
          .createSpy('getPublicKey')
          .and.returnValue($q.resolve(validHex)),
      },
    };

    const { controller } = createController(
      {
        _id: 'user',
        nostrNpub: differentNpub,
      },
      $window,
    );
    flushNip07();

    expect(controller.nostrNip07SuggestedNpub).toBe(validNpub);
    expect(controller.hasNostrNip07Suggestion()).toBeTruthy();
    expect(controller.nostrNip07SuggestionButtonText()).toBe(
      'Replace with this npub',
    );
  });

  it('stays quiet when NIP-07 public key access fails', function () {
    const $window = {
      nostr: {
        getPublicKey: jasmine
          .createSpy('getPublicKey')
          .and.returnValue($q.reject(new Error('denied'))),
      },
    };

    const { controller } = createController(
      {
        _id: 'user',
        nostrNpub: '',
      },
      $window,
    );
    flushNip07();

    expect(controller.nostrNip07Loading).toBe(false);
    expect(controller.nostrNip07SuggestedNpub).toBe('');
    expect(controller.hasNostrNip07Suggestion()).toBeFalsy();
    expect(controller.user.nostrNpub).toBe('');
  });
});
