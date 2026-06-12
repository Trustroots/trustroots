import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('trContactRemove directive', function () {
  let $compile;
  let $rootScope;
  let $uibModal;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $uibModal = {
        open: jasmine.createSpy('open'),
      };
      $provide.value('$uibModal', $uibModal);
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile() {
    const scope = $rootScope.$new();
    scope.contactToRemove = { _id: 'contact-1', name: 'Contact Name' };
    const element = $compile(
      '<button tr-contact-remove="contactToRemove" id="removeButton">Remove</button>',
    )(scope);
    scope.$digest();

    return {
      element,
      scope,
    };
  }

  it('opens the remove modal with the directive scope', function () {
    const { element } = compile();

    element.triggerHandler('click');

    expect($uibModal.open).toHaveBeenCalledTimes(1);
    expect($uibModal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        scope: jasmine.objectContaining({
          contactToRemove: {
            _id: 'contact-1',
            name: 'Contact Name',
          },
        }),
      }),
    );
    expect($uibModal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        templateUrl: expect.stringContaining(
          'remove-contact.client.modal.html',
        ),
        controller: 'ContactRemoveController',
        controllerAs: 'removeContactModal',
      }),
    );
  });

  it('does not open the modal before click', function () {
    compile();
    expect($uibModal.open).not.toHaveBeenCalled();
  });
});
