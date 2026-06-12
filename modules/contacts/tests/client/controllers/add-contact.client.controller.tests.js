import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ContactAddController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let $state;
  let $stateParams;
  let Contact;
  let friend;
  let existingContact;
  let Authentication;

  beforeEach(function () {
    friend = null;
    existingContact = null;

    $state = {
      go: jasmine.createSpy('go'),
      get: jasmine.createSpy('get').and.callFake(() => []),
    };
    $stateParams = {
      userId: 'friend-id',
    };
    Authentication = {
      user: {
        _id: 'user-id',
        displayName: 'Trust Roots',
      },
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$state', $state);
      $provide.value('$stateParams', $stateParams);
      $provide.value('Authentication', Authentication);
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_, _$q_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;

    Contact = jasmine.createSpy('Contact').and.callFake(function (values) {
      return {
        ...values,
        $save: jasmine.createSpy('$save'),
      };
    });
    Authentication = {
      user: {
        _id: 'user-id',
        displayName: 'Trust Roots',
      },
    };
  }));

  function createController() {
    const resolvedFriend = friend || {
      $promise: $q.resolve({
        _id: $stateParams.userId,
      }),
    };

    const resolvedExistingContact = existingContact || {
      $promise: $q.resolve(null),
    };

    const vm = $controller('ContactAddController', {
      $scope: $rootScope.$new(),
      $state,
      $stateParams,
      Contact,
      friend: resolvedFriend,
      existingContact: resolvedExistingContact,
      Authentication,
    });

    $rootScope.$apply();
    return vm;
  }

  it('redirects to profile if no user id is provided', function () {
    $stateParams.userId = null;

    const vm = createController();

    expect($state.go).toHaveBeenCalledWith('profile.about');
    expect(vm.isConnected).toBe(false);
    expect(vm.error).toBeUndefined();
  });

  it('marks contact connection as unavailable when adding self', function () {
    $stateParams.userId = 'user-id';

    const vm = createController();

    expect(vm.isConnected).toBe(true);
    expect(vm.error).toBe(
      'You cannot connect with yourself. That is just silly!',
    );
  });

  it('warns when friend user does not exist', function () {
    friend = {
      $promise: $q.reject(),
    };

    const vm = createController();

    expect(vm.isConnected).toBe(true);
    expect(vm.error).toBe('User does not exist.');
  });

  it('warns when contact already exists and is pending confirmation', function () {
    existingContact = {
      $promise: $q.resolve({
        confirmed: false,
      }),
    };

    const vm = createController();

    expect(vm.isConnected).toBe(true);
    expect(vm.success).toBe(
      'Connection already initiated; now it has to be confirmed.',
    );
  });

  it('marks a previously unknown contact as connected after add success', function () {
    friend = {
      $promise: $q.resolve({
        _id: 'friend-id',
      }),
    };
    const vm = createController();

    vm.contact.$save.and.callFake(function (onSuccess) {
      onSuccess();
    });

    vm.add();

    expect(vm.contact.$save).toHaveBeenCalled();
    expect(vm.isLoading).toBe(false);
    expect(vm.isConnected).toBe(true);
    expect(vm.success).toBe(
      'Done! We sent an email to your contact and he/she still needs to confirm it.',
    );
  });

  it('uses server response data when contact already exists with error code', function () {
    const vm = createController();

    vm.contact.$save.and.callFake(function (_onSuccess, onError) {
      onError({
        status: 409,
        data: {
          confirmed: false,
        },
      });
    });

    vm.add();

    expect(vm.isConnected).toBe(false);
    expect(vm.success).toBe(
      'Connection already initiated; now it has to be confirmed.',
    );
  });

  it('sets a generic error message on unexpected add errors', function () {
    const vm = createController();

    vm.contact.$save.and.callFake(function (_onSuccess, onError) {
      onError({
        status: 500,
        message: 'Server is down.',
      });
    });

    vm.add();

    expect(vm.isConnected).toBe(false);
    expect(vm.error).toBe('Server is down.');
  });

  it('uses the default error message when an unexpected add error has no message', function () {
    const vm = createController();

    vm.contact.$save.and.callFake(function (_onSuccess, onError) {
      onError({
        status: 500,
      });
    });

    vm.add();

    expect(vm.isConnected).toBe(false);
    expect(vm.isLoading).toBe(false);
    expect(vm.error).toBe('Something went wrong. Try again.');
  });
});
