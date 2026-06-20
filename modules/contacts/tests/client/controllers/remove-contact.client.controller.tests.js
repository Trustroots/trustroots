import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ContactRemoveController', function () {
  let $controller;
  let $rootScope;
  let $scope;
  let $uibModalInstance;
  let Contact;
  let ContactDelete;
  let messageCenterService;
  let Authentication;
  let contactToRemove;

  beforeEach(function () {
    $uibModalInstance = {
      dismiss: jasmine.createSpy('dismiss'),
    };

    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };

    Authentication = {
      user: {
        _id: 'user-id',
      },
    };

    ContactDelete = jasmine.createSpy('Contact.delete');
    Contact = {
      delete: ContactDelete,
    };

    contactToRemove = {
      _id: 'contact-id',
      confirmed: false,
      userFrom: 'user-id',
      userTo: 'other-id',
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$uibModalInstance', $uibModalInstance);
      $provide.value('Authentication', Authentication);
      $provide.value('Contact', Contact);
      $provide.value('messageCenterService', messageCenterService);
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $scope = $rootScope.$new();
  }));

  function createController() {
    $scope.contactToRemove = contactToRemove;
    spyOn($rootScope, '$broadcast');

    const vm = $controller('ContactRemoveController', {
      $scope,
      $uibModalInstance,
      $rootScope,
      messageCenterService,
      Contact,
      Authentication,
      contactToRemove,
    });

    return vm;
  }

  it('uses revoke request wording when cancelling own pending request', function () {
    const vm = createController();

    expect(vm.labelConfirm).toBe('Yes, revoke request');
    expect(vm.labelTitle).toBe('Revoke contact request?');
    expect(vm.labelTime).toBe('Requested');
  });

  it('uses decline request wording when declining incoming request', function () {
    contactToRemove.userFrom = 'other-user';
    contactToRemove.userTo = 'user-id';

    const vm = createController();

    expect(vm.labelConfirm).toBe('Yes, decline request');
    expect(vm.labelTitle).toBe('Decline contact request?');
    expect(vm.labelTime).toBe('Requested');
  });

  it('uses remove contact wording for confirmed connections', function () {
    contactToRemove.confirmed = true;

    const vm = createController();

    expect(vm.labelConfirm).toBe('Yes, remove contact');
    expect(vm.labelTitle).toBe('Remove contact?');
    expect(vm.labelTime).toBe('Connected since');
  });

  it('removes contact and notifies the parent scope', function () {
    ContactDelete.and.callFake(function (_params, onSuccess) {
      onSuccess();
    });

    const vm = createController();

    vm.removeContact();

    expect(vm.isLoading).toBe(true);
    expect(ContactDelete).toHaveBeenCalledWith(
      {
        contactId: 'contact-id',
      },
      jasmine.any(Function),
      jasmine.any(Function),
    );
    expect($rootScope.$broadcast).toHaveBeenCalledWith(
      'contactRemoved',
      contactToRemove,
    );
    expect($uibModalInstance.dismiss).toHaveBeenCalledWith('cancel');
  });

  it('shows error notification when deleting contact fails', function () {
    ContactDelete.and.callFake(function (_params, _onSuccess, onError) {
      onError();
    });

    const vm = createController();

    vm.removeContact();

    expect(vm.isLoading).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Oops! Something went wrong. Try again later.',
      { timeout: 7000 },
    );
  });

  it('cancels modal close without deleting', function () {
    const vm = createController();

    vm.cancelContactRemoval();

    expect($uibModalInstance.dismiss).toHaveBeenCalledWith('cancel');
  });
});
