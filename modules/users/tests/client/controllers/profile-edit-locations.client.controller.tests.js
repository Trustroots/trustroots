import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileEditLocationsController', function () {
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
  };

  beforeEach(function () {
    usersUpdateResult = {
      ...initialUser,
      city: 'Helsinki',
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
          if (usersUpdateError) {
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
      vm: $controller('ProfileEditLocationsController', {
        $scope,
        Authentication,
      }),
      $scope,
    };
  }

  it('keeps form fields on controller init', function () {
    const { vm } = createController();

    expect(vm.user._id).toBe('user-1');
    expect(vm.updateUserProfile).toEqual(jasmine.any(Function));
  });

  it('updates fields through Users resource when form is valid', function () {
    const { vm } = createController();
    vm.user.city = 'Helsinki';
    vm.updateUserProfile(true);

    expect(vm.user.$update).toHaveBeenCalled();
    expect(Authentication.user).toEqual(usersUpdateResult);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'success',
      'Profile updated.',
    );
  });

  it('shows profile validation message when form is invalid', function () {
    const { vm } = createController();

    vm.updateUserProfile(false);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please fix errors from your profile and try again.',
      { timeout: 10000 },
    );
  });

  it('shows API error message for location update failures', function () {
    const { vm } = createController();
    usersUpdateError = 'Nope';

    vm.updateUserProfile(true);

    expect(messageCenterService.add).toHaveBeenCalledWith('danger', 'Nope', {
      timeout: 10000,
    });
  });
});
