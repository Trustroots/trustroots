import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ContactsListController', function () {
  let $rootScope;
  let $controller;
  let vm;
  let contacts;

  beforeEach(function () {
    contacts = [{ _id: 'c1' }, { _id: 'c2' }];
    angular.mock.module(AppConfig.appModuleName);
  });

  beforeEach(inject(function (_$rootScope_, _$controller_) {
    $rootScope = _$rootScope_;
    $controller = _$controller_;

    spyOn($rootScope, '$broadcast').and.callThrough();
    const $scope = $rootScope.$new();
    $scope.profileCtrl = {
      contacts,
    };

    $rootScope.$broadcast.calls.reset();
    vm = $controller('ContactsListController as vm', {
      $scope,
    });
  }));

  it('exposes profile contacts to the view model', () => {
    expect(vm.contacts).toEqual(contacts);
  });

  it('broadcasts removed contact for consumers', function () {
    vm.broadcastRemoveContact(contacts[0]);
    const [eventName, payload] = $rootScope.$broadcast.calls.argsFor(0);
    expect(eventName).toBe('contactRemoved');
    expect(payload).toMatchObject({ _id: 'c1' });
  });

  it('removes a matching contact when parent emits contactRemoved', () => {
    $rootScope.$broadcast('contactRemoved', contacts[1]);

    expect(vm.contacts).toEqual([{ _id: 'c1' }]);
  });

  it('ignores contact removal for unknown contacts', function () {
    const missing = { _id: 'ghost' };
    $rootScope.$broadcast('contactRemoved', missing);

    expect(vm.contacts).toEqual(contacts);
  });
});
