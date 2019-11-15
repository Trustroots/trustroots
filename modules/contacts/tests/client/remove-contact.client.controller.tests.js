(function () {
  describe('ContactRemoveController', function () {
    // Initialize global variables
    var $templateCache,
        $httpBackend,
        Authentication,
        $rootScope,
        $scope,
        $uibModalInstance,
        messageCenterService,
        ContactRemoveController;

    var user1 = {
      _id: 'user1',
      displayName: 'User One'
    };

    var contactToRemove = {
      _id: 'contact1'
    };

    // Load the main application module
    beforeEach(module(AppConfig.appModuleName));

    beforeEach(inject(function (_$templateCache_, _$httpBackend_, _Authentication_, _$rootScope_, _messageCenterService_) {
      $templateCache = _$templateCache_;
      $httpBackend = _$httpBackend_;
      Authentication = _Authentication_;

      $rootScope = _$rootScope_;
      spyOn($rootScope, '$broadcast').and.callThrough();

      messageCenterService = _messageCenterService_;
      spyOn(messageCenterService, 'add').and.callThrough();

      $uibModalInstance = jasmine.createSpyObj('$uibModalInstance', ['close', 'dismiss']);

      $scope = $rootScope.$new();
      $scope.contactToRemove = contactToRemove;

      $templateCache.put('/modules/pages/views/home.client.view.html', '');
    }));

    afterEach(function () {
      $httpBackend.verifyNoOutstandingExpectation();
      $httpBackend.verifyNoOutstandingRequest();
    });

    describe('logged in', function () {

      beforeEach(function (done) {
        inject(function ($controller) {
          Authentication.user = user1;
          ContactRemoveController = $controller('ContactRemoveController', {
            $scope: $scope,
            $uibModalInstance: $uibModalInstance,
            messageCenterService: messageCenterService
          });
          done();
        });
      });

      it('sets the contact', function () {
        expect(ContactRemoveController.contact).toBe(contactToRemove);
      });

      it('can remove the contact', function () {
        $httpBackend.expect('DELETE', '/api/contact/' + contactToRemove._id).respond(200);
        expect(ContactRemoveController.removeContact).toBeDefined();
        ContactRemoveController.removeContact();
        $httpBackend.flush();
        expect($uibModalInstance.dismiss).toHaveBeenCalledWith('cancel');
        expect($rootScope.$broadcast).toHaveBeenCalledWith('contactRemoved', contactToRemove);
      });

      it('can be cancelled', function () {
        expect(ContactRemoveController.cancelContactRemoval).toBeDefined();
        ContactRemoveController.cancelContactRemoval();
        expect($uibModalInstance.dismiss).toHaveBeenCalledWith('cancel');
        expect($rootScope.$broadcast).not.toHaveBeenCalled();
      });

      it('handles backend errors gracefully', function () {
        $httpBackend.expect('DELETE', '/api/contact/' + contactToRemove._id).respond(400);
        ContactRemoveController.removeContact();
        $httpBackend.flush();
        expect($uibModalInstance.dismiss).toHaveBeenCalledWith('cancel');
        expect(messageCenterService.add).toHaveBeenCalledWith('danger', 'Oops! Something went wrong. Try again later.', { timeout: 7000 });
      });

    });

  });
}());
