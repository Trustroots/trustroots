import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Contact service', function () {
  let $httpBackend;
  let $rootScope;
  let Contact;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$httpBackend_, _$rootScope_, _Contact_) {
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    Contact = _Contact_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('loads contact by id', function () {
    let resolved;

    Contact.get({ contactId: 'contact-1' }).$promise.then(function (response) {
      resolved = response;
    });

    $httpBackend.expectGET('/api/contact/contact-1').respond(200, {
      _id: 'contact-1',
    });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(resolved).toEqual(
      jasmine.objectContaining({
        _id: 'contact-1',
      }),
    );
  });

  it('updates contact by id', function () {
    let resolved;

    Contact.update(
      { contactId: 'contact-1' },
      { displayName: 'Bobby' },
    ).$promise.then(function (response) {
      resolved = response;
    });

    $httpBackend.expectPUT('/api/contact/contact-1').respond(200, {
      _id: 'contact-1',
      displayName: 'Bobby',
    });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(resolved).toEqual(
      jasmine.objectContaining({
        _id: 'contact-1',
        displayName: 'Bobby',
      }),
    );
  });

  it('deletes contact by id', function () {
    let resolved;

    Contact.delete({ contactId: 'contact-1' }).$promise.then(function (
      response,
    ) {
      resolved = response;
    });

    $httpBackend.expectDELETE('/api/contact/contact-1').respond(200, {
      deleted: true,
    });
    $httpBackend.flush();
    $rootScope.$apply();

    expect(resolved).toMatchObject({ deleted: true });
  });
});
