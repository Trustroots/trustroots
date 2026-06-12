import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ContactsListService', function () {
  let ContactsListService;
  let $httpBackend;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$httpBackend_,
    _$rootScope_,
    _ContactsListService_,
  ) {
    ContactsListService = _ContactsListService_;
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('fetches a contact list for a user id', function () {
    let resolved;

    ContactsListService.get({ listUserId: 'user-1' }).$promise.then(function (
      response,
    ) {
      resolved = response;
    });

    $httpBackend.expectGET('/api/contacts/user-1').respond(200, {
      _id: 'user-1',
      contacts: [],
    });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(resolved).toEqual(
      jasmine.objectContaining({
        _id: 'user-1',
      }),
    );
  });
});
