import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('SignupValidation service', function () {
  let $httpBackend;
  let SignupValidation;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$httpBackend_, _SignupValidation_) {
    $httpBackend = _$httpBackend_;
    SignupValidation = _SignupValidation_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('posts signup payload through the post action', function (done) {
    const payload = { email: 'alice@example.org', username: 'alice' };

    SignupValidation.post({}, payload).$promise.then(function (response) {
      expect(response).toEqual(jasmine.objectContaining({ ok: true }));
      done();
    }, done.fail);

    $httpBackend.expectPOST('/api/auth/signup/validate', payload).respond(200, {
      ok: true,
    });
    $httpBackend.flush();
  });

  it('propagates server validation errors', function (done) {
    const payload = { email: 'bad', username: 'bad-user' };

    SignupValidation.post({}, payload).$promise.then(
      done.fail,
      function (error) {
        expect(error.status).toBe(400);
        expect(error.data).toEqual(
          jasmine.objectContaining({ error: 'Bad payload' }),
        );
        done();
      },
    );

    $httpBackend.expectPOST('/api/auth/signup/validate', payload).respond(400, {
      error: 'Bad payload',
    });
    $httpBackend.flush();
  });
});
