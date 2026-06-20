import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ConfirmEmailController', function () {
  let $controller;
  let $httpBackend;
  let $rootScope;
  let $state;
  let $stateParams;
  let Authentication;

  const validToken = `${'0'.repeat(40)}68656c6c6f`; // hex for "hello"

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$controller_,
    _$httpBackend_,
    _$rootScope_,
    _$state_,
    _$stateParams_,
    _Authentication_,
  ) {
    $controller = _$controller_;
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    $state = _$state_;
    $stateParams = _$stateParams_;
    Authentication = _Authentication_;
    spyOn($state, 'go').and.returnValue(true);
    spyOn($rootScope, '$broadcast').and.callThrough();
  }));

  function createController(token, signup = false) {
    $stateParams.token = token;
    if (signup) {
      $stateParams.signup = true;
    } else {
      delete $stateParams.signup;
    }

    return $controller('ConfirmEmailController', {
      $state,
      $stateParams,
      Authentication,
      $rootScope,
    });
  }

  it('decodes an email address from a long token', function () {
    const controller = createController(validToken, true);

    expect(controller.email).toBe('hello');
    expect(controller.signup).toBe(true);
  });

  it('does not decode when the token is too short', function () {
    const controller = createController('short-token');
    expect(controller.email).toBe(null);
  });

  it('confirms and redirects when profile is made public', function () {
    const controller = createController(validToken);

    $httpBackend
      .expect('POST', `/api/auth/confirm-email/${validToken}`)
      .respond(200, {
        user: {
          _id: 'u1',
          email: 'a@b.com',
        },
        profileMadePublic: true,
      });

    controller.confirmEmail();
    $httpBackend.flush();

    expect(Authentication.user._id).toBe('u1');
    expect($rootScope.$broadcast).toHaveBeenCalledWith('userUpdated');
    expect($state.go).toHaveBeenCalledWith('welcome');
    expect(controller.success).toBeNull();
    expect(controller.isLoading).toBe(false);
  });

  it('confirms and shows success when profile was already public', function () {
    const controller = createController(validToken);

    $httpBackend
      .expect('POST', `/api/auth/confirm-email/${validToken}`)
      .respond(200, {
        user: {
          _id: 'u1',
          email: 'a@b.com',
        },
        profileMadePublic: false,
      });

    controller.confirmEmail();
    $httpBackend.flush();

    expect(controller.success).toBe(true);
    expect(controller.error).toBeNull();
    expect($state.go).not.toHaveBeenCalled();
  });

  it('sets error on confirm failure', function () {
    const controller = createController(validToken);

    $httpBackend
      .expect('POST', `/api/auth/confirm-email/${validToken}`)
      .respond(500, {
        message: 'Token invalid',
      });

    controller.confirmEmail();
    $httpBackend.flush();

    expect(controller.error).toBe(true);
    expect(controller.success).toBeNull();
    expect(controller.isLoading).toBe(false);
  });
});
