import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Users Config', function () {
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  let $httpBackend;
  let $location;
  let $rootScope;
  let Authentication;

  beforeEach(inject(function (
    _$httpBackend_,
    _$location_,
    _$rootScope_,
    _Authentication_,
  ) {
    $httpBackend = _$httpBackend_;
    $location = _$location_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;
    $location.path('/');
  }));

  function flushApiRequest({
    url = '/api/example',
    status = 401,
    response = {},
  } = {}) {
    $httpBackend.expectGET(url).respond(status, response);
  }

  it('redirects unauthorized api errors to sign-in', inject(function ($http) {
    Authentication.user = {
      _id: 'user-id',
    };
    flushApiRequest();

    $http.get('/api/example').catch(() => {});
    $httpBackend.flush();
    $rootScope.$apply();

    expect(Authentication.user).toBeNull();
    expect($location.path()).toBe('/signin');
  }));

  it('does not redirect non-api errors to sign-in', inject(function ($http) {
    const authBefore = {
      _id: 'user-id',
    };
    Authentication.user = authBefore;
    const notApiUrl = '/public/health';
    flushApiRequest({
      url: notApiUrl,
      status: 401,
      response: { message: 'no-auth' },
    });

    $http.get(notApiUrl).catch(() => {});
    $httpBackend.flush();
    $rootScope.$apply();

    expect(Authentication.user).toEqual(authBefore);
    expect($location.path()).not.toBe('/signin');
  }));

  it('keeps unauthorized user context for api 403', inject(function ($http) {
    Authentication.user = {
      _id: 'user-id',
    };
    flushApiRequest({
      status: 403,
      url: '/api/forbidden',
    });

    $http.get('/api/forbidden').catch(() => {});
    $httpBackend.flush();
    $rootScope.$apply();

    expect(Authentication.user).toEqual({
      _id: 'user-id',
    });
    expect($location.path()).not.toBe('/signin');
  }));
});
