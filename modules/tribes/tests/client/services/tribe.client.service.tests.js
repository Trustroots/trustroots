import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('TribeService', function () {
  let TribeService;
  let $httpBackend;
  let $log;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$httpBackend_,
    _$log_,
    _$rootScope_,
    _TribeService_,
  ) {
    TribeService = _TribeService_;
    $httpBackend = _$httpBackend_;
    $log = _$log_;
    $rootScope = _$rootScope_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('resolves cached tribes and then fetches subsequent calls from API', function (done) {
    TribeService.fillCache({
      slug: 'circles',
      name: 'Circles',
    });

    TribeService.get({ tribeSlug: 'circles' }).then(function (tribe) {
      expect(tribe).toEqual(
        jasmine.objectContaining({
          slug: 'circles',
          name: 'Circles',
          $resolved: true,
        }),
      );
    });
    $rootScope.$apply();

    $httpBackend.expectGET('/api/tribes/circles').respond(200, {
      slug: 'circles',
      name: 'Circles API',
    });
    TribeService.get({ tribeSlug: 'circles' }).then(function (tribe) {
      expect(tribe).toEqual(
        jasmine.objectContaining({
          slug: 'circles',
          name: 'Circles API',
        }),
      );
      done();
    });
    $httpBackend.flush();
    $rootScope.$apply();
  });

  it('retries missing slug as a validation error', function (done) {
    const logSpy = spyOn($log, 'error');

    TribeService.get().then(done.fail, function () {
      expect(logSpy).toHaveBeenCalledWith('Missing tribeSlug');
      done();
    });

    $rootScope.$apply();
  });

  it('rejects API errors when tribe fetch fails', function (done) {
    $httpBackend.expectGET('/api/tribes/missing').respond(500);

    TribeService.get({ tribeSlug: 'missing' }).then(done.fail, function () {
      done();
    });

    $httpBackend.flush();
    $rootScope.$apply();
  });

  it('logs cache validation errors when tribe input is invalid', function () {
    const logSpy = spyOn($log, 'error');

    TribeService.fillCache({});

    expect(logSpy).toHaveBeenCalledWith('Missing tribe to cache.');
  });
});
