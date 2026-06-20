import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('TribesService', function () {
  let $httpBackend;
  let TribesService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$httpBackend_, _TribesService_) {
    $httpBackend = _$httpBackend_;
    TribesService = _TribesService_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('queries tribes with default page size', function () {
    const tribes = TribesService.query();

    expect(tribes.$resolved).toBe(false);

    $httpBackend.expectGET('/api/tribes?limit=150').respond(200, [
      { slug: 'circles', name: 'Circles' },
      { slug: 'music', name: 'Music' },
    ]);
    $httpBackend.flush();

    expect(tribes.$resolved).toBe(true);
    expect(tribes.length).toBe(2);
    expect(tribes.map(item => ({ slug: item.slug, name: item.name }))).toEqual([
      { slug: 'circles', name: 'Circles' },
      { slug: 'music', name: 'Music' },
    ]);
  });

  it('allows overriding the limit query parameter', function () {
    const tribes = TribesService.query({ limit: 10 });

    $httpBackend
      .expectGET('/api/tribes?limit=10')
      .respond(200, [{ slug: 'local', name: 'Local' }]);
    $httpBackend.flush();

    expect(tribes.length).toBe(1);
    expect(tribes[0]).toEqual(
      jasmine.objectContaining({
        slug: 'local',
        name: 'Local',
      }),
    );
  });
});
