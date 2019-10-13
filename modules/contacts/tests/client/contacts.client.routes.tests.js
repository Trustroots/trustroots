(function () {
  'use strict';

  describe('Contact Route Tests', function () {
    // Initialize global variables
    var $httpBackend;

    // We can start by loading the main application module
    beforeEach(module(AppConfig.appModuleName));

    // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
    // This allows us to inject a service but then attach it to a variable
    // with the same name as the service.
    beforeEach(inject(function ($rootScope, _$httpBackend_) {
      $httpBackend = _$httpBackend_;
    }));

    describe('Route Config for add contact', function () {
      describe('Add contact Route', function () {
        var mainstate;
        beforeEach(inject(function ($state, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/contacts/views/add-contact.client.view.html', '');
          $httpBackend.when('GET', '/api/contact-by/123').respond(200, '');
          $httpBackend.expectGET('/api/contact-by/123');

          mainstate = $state.get('contactAdd');
        }));

        it('Should have the correct URL', function () {
          expect(mainstate.url).toEqual('/contact-add/:userId');
        });

        it('Should not be abstract', function () {
          expect(mainstate.abstract).toBe(undefined);
        });

        it('Should have templateUrl', function () {
          expect(mainstate.templateUrl).toBe('/modules/contacts/views/add-contact.client.view.html');
        });
      });

      describe('Handle Trailing Slash', function () {
        beforeEach(inject(function ($state, $rootScope, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/contacts/views/add-contact.client.view.html', '');
          $httpBackend.when('GET', '/api/contact-by/123').respond(200, '');
          $httpBackend.expectGET('/api/contact-by/123');
          $httpBackend.when('GET', '/api/users/mini/123').respond(200, '');
          $httpBackend.expectGET('/api/users/mini/123');

          $state.go('contactAdd', { userId: '123' });
          $rootScope.$digest();
        }));

        it('Should remove trailing slash', inject(function ($state, $location, $rootScope) {
          $location.path('/contact-add/123/');
          $rootScope.$digest();

          expect($location.path()).toBe('/contact-add/123');
        }));
      });

    });

    describe('Route Config for confirm contact', function () {
      describe('Confirm contact Route', function () {
        var mainstate;
        beforeEach(inject(function ($state, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/contacts/views/confirm-contact.client.view.html', '');

          mainstate = $state.get('contactConfirm');
        }));

        it('Should have the correct URL', function () {
          expect(mainstate.url).toEqual('/contact-confirm/:contactId');
        });

        it('Should not be abstract', function () {
          expect(mainstate.abstract).toBe(undefined);
        });

        it('Should have templateUrl', function () {
          expect(mainstate.templateUrl).toBe('/modules/contacts/views/confirm-contact.client.view.html');
        });
      });

      describe('Handle Trailing Slash', function () {
        beforeEach(inject(function ($state, $rootScope, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/contacts/views/confirm-contact.client.view.html', '');
          $httpBackend.when('GET', '/api/contact/123').respond(200, '');
          $httpBackend.expectGET('/api/contact/123');
          $httpBackend.when('GET', '/api/contact-by?contactId=123').respond(200, '');
          $httpBackend.expectGET('/api/contact-by?contactId=123');

          $state.go('contactConfirm', { contactId: '123' });
          $rootScope.$digest();
        }));

        it('Should remove trailing slash', inject(function ($state, $location, $rootScope) {
          $location.path('/contact-confirm/123/');
          $rootScope.$digest();

          expect($location.path()).toBe('/contact-confirm/123');
        }));
      });

    });


  });

}());
