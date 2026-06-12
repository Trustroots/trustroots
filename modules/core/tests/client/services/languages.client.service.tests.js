import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/services/languages.client.service';

describe('Languages service', function () {
  let $httpBackend;
  let Languages;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$httpBackend_, _$rootScope_, _Languages_) {
    $httpBackend = _$httpBackend_;
    Languages = _Languages_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('loads languages as objects by default', function (done) {
    const payload = {
      eng: 'English',
      fin: 'Suomi',
    };
    $httpBackend.expectGET('/api/languages').respond(200, payload);

    Languages.get().then(languages => {
      expect(languages.eng).toBe('English');
      expect(languages.fin).toBe('Suomi');
      expect(languages.$promise).toBeDefined();
      expect(languages.$resolved).toBe(true);
      done();
    }, done.fail);

    $httpBackend.flush();
  });

  it('loads languages as arrays when requested', function (done) {
    const payload = {
      eng: 'English',
      fin: 'Suomi',
    };
    $httpBackend.expectGET('/api/languages').respond(200, payload);

    Languages.get('array').then(languages => {
      const normalized = languages.filter(
        language => !language.key.startsWith('$'),
      );
      expect(normalized).toEqual([
        { key: 'eng', name: 'English' },
        { key: 'fin', name: 'Suomi' },
      ]);
      done();
    }, done.fail);

    $httpBackend.flush();
  });

  it('returns rejected promise when request fails', function (done) {
    $httpBackend.expectGET('/api/languages').respond(503, {
      error: 'temporary',
    });

    Languages.get().then(done.fail, reason => {
      expect(reason).toBeUndefined();
      done();
    });

    $httpBackend.flush();
  });
});
