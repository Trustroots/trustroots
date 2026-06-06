import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileEditTribesController', function () {
  let $controller;
  let $rootScope;
  let Authentication;
  let messageCenterService;
  let Users;
  let usersUpdateResult;
  let usersUpdateError;

  const initialUser = {
    _id: 'user-1',
    username: 'traveller',
    email: 'traveller@example.org',
    tribes: [],
  };

  beforeEach(function () {
    usersUpdateResult = {
      ...initialUser,
      tribes: ['tribe-1'],
    };
    usersUpdateError = null;

    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };

    Users = function UsersMock(user) {
      const model = {
        ...user,
      };

      model.$update = jasmine
        .createSpy('$update')
        .and.callFake(function (_success, error) {
          if (usersUpdateError !== null) {
            error({
              data: { message: usersUpdateError },
            });
          } else {
            _success(usersUpdateResult);
          }
        });

      return model;
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Users', Users);
      $provide.value('messageCenterService', messageCenterService);
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_, _Authentication_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;
  }));

  function createController() {
    const $scope = $rootScope.$new();
    spyOn($scope, '$emit').and.callThrough();
    Authentication.user = { ...initialUser };

    return {
      vm: $controller('ProfileEditTribesController', {
        $scope,
        Authentication,
      }),
      $scope,
    };
  }

  it('keeps initial tribe selection in editable user object', function () {
    const { vm } = createController();

    expect(vm.user._id).toBe('user-1');
    expect(vm.user.tribes).toEqual([]);
    expect(vm.updateUserProfile).toEqual(jasmine.any(Function));
  });

  it('invokes $update when tribe selection is valid', function () {
    const { vm } = createController();
    vm.user.tribes = ['tribe-1', 'tribe-2'];

    vm.updateUserProfile(true);

    expect(vm.user.$update).toHaveBeenCalled();
    expect(Authentication.user).toEqual(usersUpdateResult);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'success',
      'Profile updated.',
    );
    expect(messageCenterService.add).not.toHaveBeenCalledWith(
      'danger',
      jasmine.any(String),
      jasmine.any(Object),
    );
  });

  it('adds a warning message when update fails', function () {
    const { vm } = createController();
    usersUpdateError = 'Invalid tribe data';

    vm.updateUserProfile(true);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Invalid tribe data',
      { timeout: 10000 },
    );
  });

  it('adds a generic warning when update failure omits a message', function () {
    const { vm } = createController();
    usersUpdateError = '';

    vm.updateUserProfile(true);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Something went wrong. Please try again!',
      { timeout: 10000 },
    );
  });

  it('adds a warning message when form is invalid', function () {
    const { vm } = createController();

    vm.updateUserProfile(false);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please fix errors from your profile and try again.',
      { timeout: 10000 },
    );
  });
});
