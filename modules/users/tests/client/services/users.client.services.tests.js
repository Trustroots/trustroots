import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Users service', function () {
  let $httpBackend;
  let $rootScope;
  let Users;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$httpBackend_, _$rootScope_, _Users_) {
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    Users = _Users_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('deletes users by token through the remove endpoint', function () {
    let resolvedResponse;

    Users.deleteWithToken('remove-token').then(function (response) {
      resolvedResponse = response;
    });

    $httpBackend.expectDELETE('/api/users/remove/remove-token').respond(200, {
      message: 'ok',
    });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(resolvedResponse).toEqual(
      jasmine.objectContaining({
        message: 'ok',
      }),
    );
  });

  it('updates users through the default resource endpoint', function () {
    let promiseError;
    const user = new Users({
      _id: 'user-1',
      displayName: 'Alice',
    });

    user.$update().catch(function () {
      promiseError = true;
    });

    $httpBackend.expectPUT('/api/users').respond(200, {
      _id: 'user-1',
      displayName: 'Alice',
    });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(promiseError).toBeUndefined();
  });

  it('deletes users through the default resource endpoint', function () {
    let resolved;

    const user = new Users({
      _id: 'user-1',
    });

    user.$delete().then(function (response) {
      resolved = response;
    });

    $httpBackend.expectDELETE('/api/users').respond(200, { removed: true });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(resolved).toMatchObject({ removed: true });
  });
});
