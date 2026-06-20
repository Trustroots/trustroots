import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('trContact directive', function () {
  let $compile;
  let $rootScope;
  let Authentication;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Authentication', {
        user: {
          _id: 'current-user',
          displayName: 'Current User',
        },
      });
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_, _Authentication_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;
  }));

  function compile(overrides = {}, attrs = '') {
    const scope = $rootScope.$new();
    scope.contact = {
      _id: 'contact-1',
      displayName: 'Contact Name',
      userFrom: 'current-user',
      ...overrides,
    };
    scope.profileId = 'user-1';

    const element = $compile(
      `<div tr-contact="contact" tr-contact-profile-id="profileId" ${attrs}></div>`,
    )(scope);
    scope.$digest();

    return {
      element,
      scope,
      vm: element.isolateScope().contactCtrl,
    };
  }

  it('exposes contact and profile data and defaults avatar size', function () {
    const { vm, scope } = compile({ avatarSize: 'invalid' });

    expect(vm.contact).toBe(scope.contact);
    expect(vm.profileId).toBe(scope.profileId);
    expect(vm.avatarSize).toBe(128);
    expect(vm.user).toBe(Authentication.user);
    expect(vm.hideMeta).toBe(false);
  });

  it('maps optional flags from attributes', function () {
    const scope = $rootScope.$new();
    scope.shouldHideMeta = true;
    scope.contact = {
      _id: 'contact-1',
      displayName: 'Contact Name',
      userFrom: 'current-user',
    };
    scope.profileId = 'user-1';
    const element = $compile(
      '<div tr-contact="contact" tr-contact-profile-id="profileId" tr-contact-hide-meta="shouldHideMeta" tr-contact-avatar-size="96"></div>',
    )(scope);
    scope.$digest();

    const vm = element.isolateScope().contactCtrl;

    expect(vm.avatarSize).toBe('96');
    expect(vm.hideMeta).toBe(true);
  });

  it('keeps default avatar size when attribute is empty', function () {
    const { vm } = compile({}, 'tr-contact-avatar-size=""');
    expect(vm.avatarSize).toBe(128);
  });
});
