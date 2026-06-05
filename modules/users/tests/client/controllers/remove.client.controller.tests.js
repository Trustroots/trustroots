import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('RemoveProfileController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let Authentication;
  let messageCenterService;
  let Users;
  let removeProfilePromise;
  let resendProfilePromise;

  beforeEach(function () {
    messageCenterService = {
      add: jasmine.createSpy('add'),
    };

    removeProfilePromise = () => $q && $q.resolve();
    resendProfilePromise = () => $q && $q.resolve({ message: 'Success.' });

    Users = function UsersResource() {
      return {
        $delete: () => resendProfilePromise(),
      };
    };

    Users.deleteWithToken = function () {
      return removeProfilePromise();
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Users', Users);
      $provide.value('messageCenterService', messageCenterService);
      $provide.value('$stateParams', { token: 'remove-token' });
    });
  });

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$q_,
    _Authentication_,
  ) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    Authentication = _Authentication_;

    Authentication.user = {
      _id: 'user-1',
      email: 'user@example.com',
    };
  }));

  function createController() {
    const $scope = $rootScope.$new();

    return $controller('RemoveProfileController as removeProfile', {
      $scope,
      $stateParams: { token: 'remove-token' },
      Authentication,
      messageCenterService,
      Users,
    });
  }

  it('marks profile removal as success when deleteWithToken resolves', function () {
    removeProfilePromise = () => $q.resolve();
    const vm = createController();

    $rootScope.$apply();

    expect(vm.state).toBe('success');
    expect(messageCenterService.add).not.toHaveBeenCalled();
  });

  it('marks profile removal as failure when deleteWithToken rejects', function () {
    removeProfilePromise = () => $q.reject();
    const vm = createController();

    $rootScope.$apply();

    expect(vm.state).toBe('failure');
  });

  it('stores confirmation message when resend confirmation succeeds', function () {
    removeProfilePromise = () => $q.resolve();
    resendProfilePromise = () =>
      $q.resolve({ message: 'Removal initialized.' });

    const vm = createController();
    $rootScope.$apply();

    vm.resendConfirmation();
    $rootScope.$apply();

    expect(vm.resendConfirmationLoading).toBe(true);
    expect(vm.removeProfileInitialized).toBe('Removal initialized.');
    expect(messageCenterService.add).not.toHaveBeenCalled();
  });

  it('adds an error message when resend confirmation fails', function () {
    removeProfilePromise = () => $q.resolve();
    resendProfilePromise = () => $q.reject({ message: 'Nope' });

    const vm = createController();
    $rootScope.$apply();

    vm.resendConfirmation();
    $rootScope.$apply();

    expect(messageCenterService.add).toHaveBeenCalledWith('danger', 'Nope', {
      timeout: 10000,
    });
  });

  it('uses fallback error message when resend confirmation returns no message', function () {
    removeProfilePromise = () => $q.resolve();
    resendProfilePromise = () => $q.reject({});

    const vm = createController();
    $rootScope.$apply();

    vm.resendConfirmation();
    $rootScope.$apply();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Something went wrong while initializing profile removal, try again.',
      {
        timeout: 10000,
      },
    );
  });
});
