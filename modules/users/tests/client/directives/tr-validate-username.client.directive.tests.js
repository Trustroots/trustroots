import AppConfig from '@/modules/core/client/app/config';
import '@/modules/users/client/directives/tr-validate-username.client.directive';

describe('trValidateUsername directive', function () {
  let $compile;
  let $q;
  let $rootScope;
  let $timeout;
  let SignupValidation;

  beforeEach(function () {
    SignupValidation = {
      post: jasmine.createSpy('SignupValidation.post'),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('SignupValidation', SignupValidation);
    });
  });

  beforeEach(inject(function (_$compile_, _$q_, _$rootScope_, _$timeout_) {
    $compile = _$compile_;
    $q = _$q_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
  }));

  function compileTemplate(sourceAttribute, attributes = 'minlength="4"') {
    const scope = $rootScope.$new();
    scope.username = 'existing-username';

    $compile(
      `<form name="form"><input name="username" ng-model="username" tr-validate-username="${
        sourceAttribute || ''
      }" ${attributes}></form>`,
    )(scope);
    scope.$digest();

    return {
      field: scope.form.username,
      scope,
    };
  }

  it('does not trigger validation when value is shorter than minlength', function () {
    const { field } = compileTemplate();

    field.$setViewValue('abc');
    $rootScope.$digest();

    expect(SignupValidation.post).not.toHaveBeenCalled();
    expect(field.$pending).toBeUndefined();
  });

  it('does not trigger validation when username is empty', function () {
    const { field } = compileTemplate();

    field.$setViewValue('');
    $rootScope.$digest();

    expect(SignupValidation.post).not.toHaveBeenCalled();
    expect(field.$pending).toBeUndefined();
  });

  it('skips remote validation when matching an initial username', function () {
    const { field } = compileTemplate('{{ username }}');

    SignupValidation.post.and.returnValue({
      $promise: $q.resolve({ valid: false }),
    });

    field.$setViewValue('existing-username');
    $rootScope.$digest();
    $timeout.flush(1000);
    $rootScope.$digest();

    expect(SignupValidation.post).not.toHaveBeenCalled();
    expect(field.$error.username).toBeUndefined();
  });

  it('uses a one-character minimum when minlength is omitted', function () {
    const { field } = compileTemplate('', '');

    SignupValidation.post.and.returnValue({
      $promise: $q.resolve({ valid: true }),
    });

    field.$setViewValue('a');
    $rootScope.$digest();
    $timeout.flush(1000);
    $rootScope.$digest();

    expect(SignupValidation.post).toHaveBeenCalledWith({
      username: 'a',
    });
    expect(field.$error.username).toBeFalsy();
  });

  it('flags usernames that the server rejects', function () {
    const { field } = compileTemplate();

    SignupValidation.post.and.returnValue({
      $promise: $q.resolve({ valid: false }),
    });

    field.$setViewValue('takenusername');
    $rootScope.$digest();
    $timeout.flush(1000);
    $rootScope.$digest();

    expect(SignupValidation.post).toHaveBeenCalledWith({
      username: 'takenusername',
    });
    expect(field.$error.username).toBe(true);
  });

  it('stores the server validation message on the model', function () {
    const { field } = compileTemplate();

    SignupValidation.post.and.returnValue({
      $promise: $q.resolve({
        valid: false,
        message: 'Username is not available.',
      }),
    });

    field.$setViewValue('nostr');
    $rootScope.$digest();
    $timeout.flush(1000);
    $rootScope.$digest();

    expect(field.$usernameValidationMessage).toBe('Username is not available.');
    expect(field.$error.username).toBe(true);
  });

  it('accepts valid usernames returned by the server', function () {
    const { field } = compileTemplate();

    SignupValidation.post.and.returnValue({
      $promise: $q.resolve({ valid: true }),
    });

    field.$setViewValue('valid-username');
    $rootScope.$digest();
    $timeout.flush(1000);
    $rootScope.$digest();

    expect(SignupValidation.post).toHaveBeenCalledWith({
      username: 'valid-username',
    });
    expect(field.$error.username).toBeFalsy();
  });

  it('treats remote validation errors as valid', function () {
    const { field } = compileTemplate();

    SignupValidation.post.and.returnValue({
      $promise: {
        then(resolve, reject) {
          reject();
        },
      },
    });

    field.$setViewValue('network-username');
    $rootScope.$digest();
    $timeout.flush(1000);
    $rootScope.$digest();

    expect(field.$error.username).toBeFalsy();
  });
});
