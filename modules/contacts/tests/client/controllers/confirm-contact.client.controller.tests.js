import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ContactConfirmController', function () {
  let $rootScope;
  let $controller;
  let $q;
  let Authentication;

  const user = {
    _id: 'user-id',
  };

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$rootScope_,
    _$controller_,
    _$q_,
    _Authentication_,
  ) {
    $rootScope = _$rootScope_;
    $controller = _$controller_;
    $q = _$q_;
    Authentication = _Authentication_;
    Authentication.user = user;
  }));

  function createController({
    contactOverrides = {},
    stateParams = { contactId: 'contact-id' },
  } = {}) {
    const contact = {
      confirmed: false,
      userTo: {
        _id: 'owner-id',
      },
      $promise: $q.resolve(),
      $update: jest.fn(),
      ...contactOverrides,
    };

    const vm = $controller('ContactConfirmController as vm', {
      $scope: $rootScope.$new(),
      $stateParams: stateParams,
      Authentication,
      contact,
    });

    $rootScope.$apply();
    return { contact, vm };
  }

  it('warns when no contact id is present in state params', function () {
    const { vm } = createController({
      contactOverrides: {
        userTo: {
          _id: 'user-id',
        },
      },
      stateParams: {},
    });

    expect(vm.error).toBe('Something went wrong. Try again.');
  });

  it('marks already confirmed contact as connected', function () {
    const { vm } = createController({
      contactOverrides: {
        confirmed: true,
      },
    });

    expect(vm.isConnected).toBe(true);
    expect(vm.success).toBe('You two are already connected. Great!');
  });

  it('warns user when they are not the target of confirmation', function () {
    Authentication.user = {
      _id: 'not-owners-id',
    };

    const { vm } = createController({
      contactOverrides: {
        confirmed: false,
        userTo: {
          _id: 'someone-else',
        },
      },
    });

    expect(vm.error).toBe('You must wait until they confirm your connection.');
  });

  it('handles missing confirmation request when loading fails', function () {
    const { vm } = createController({
      contactOverrides: {
        $promise: $q.reject({
          status: 404,
        }),
      },
    });

    expect(vm.isWrongCode).toBe(true);
    expect(vm.error).toBe(
      'Could not find contact request. Check the confirmation link from email or you might be logged in with wrong user?',
    );
  });

  it('handles generic errors while loading a confirmation request', function () {
    const { vm } = createController({
      contactOverrides: {
        $promise: $q.reject({
          status: 500,
        }),
      },
    });

    expect(vm.isWrongCode).toBe(true);
    expect(vm.error).toBe('Something went wrong. Try again.');
  });

  it('confirms contact on user request', function () {
    const { contact, vm } = createController({
      contactOverrides: {
        $update(successCallback) {
          successCallback();
        },
      },
    });

    vm.confirmContact();
    expect(contact.confirm).toBe(true);
    expect(vm.isLoading).toBe(false);
    expect(vm.isConnected).toBe(true);
    expect(vm.success).toBe('You two are now connected!');
  });

  it('shows an error if confirmation fails', function () {
    const { vm } = createController({
      contactOverrides: {
        $update(_, errorCallback) {
          errorCallback({});
        },
      },
    });

    vm.confirmContact();

    expect(vm.isLoading).toBe(false);
    expect(vm.error).toBe('Something went wrong. Try again.');
  });

  it('shows API error message if confirmation fails with one', function () {
    const { vm } = createController({
      contactOverrides: {
        $update(_, errorCallback) {
          errorCallback({
            data: {
              message: 'Confirmation expired.',
            },
          });
        },
      },
    });

    vm.confirmContact();

    expect(vm.isLoading).toBe(false);
    expect(vm.error).toBe('Confirmation expired.');
  });
});
