import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('trConfirmPassword directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compileForm() {
    const scope = $rootScope.$new();
    scope.password = 'secret';
    scope.passwordRepeat = '';

    $compile(
      '<form name="form">' +
        '<input name="password" ng-model="password" />' +
        '<input name="confirmPassword" ng-model="passwordRepeat" tr-confirm-password="password" />' +
        '</form>',
    )(scope);
    scope.$digest();

    return { form: scope.form, scope };
  }

  it('validates when confirmation initially matches password', function () {
    const { form, scope } = compileForm();
    form.confirmPassword.$setViewValue('secret');

    scope.$apply();
    expect(form.confirmPassword.$valid).toBe(true);
  });

  it('invalidates when confirmation differs from password', function () {
    const { form, scope } = compileForm();
    form.confirmPassword.$setViewValue('not-secret');

    scope.$apply();
    expect(form.confirmPassword.$valid).toBe(false);
  });

  it('revalidates when comparison field changes', function () {
    const { form, scope } = compileForm();
    form.confirmPassword.$setViewValue('not-secret');
    scope.$apply();
    expect(form.confirmPassword.$valid).toBe(false);

    scope.password = 'not-secret';
    scope.$apply();

    expect(form.confirmPassword.$valid).toBe(true);
  });
});
