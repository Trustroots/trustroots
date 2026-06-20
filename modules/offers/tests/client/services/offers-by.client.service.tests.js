import AppConfig from '@/modules/core/client/app/config';
import '@/modules/offers/client/offers.client.module';

describe('OffersByService', function () {
  let OffersByService;
  let $httpBackend;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_OffersByService_, _$httpBackend_) {
    OffersByService = _OffersByService_;
    $httpBackend = _$httpBackend_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('queries offers for a provided user id', function (done) {
    const response = [
      {
        _id: 'offer-1',
        type: 'host',
      },
    ];

    $httpBackend.expectGET('/api/offers-by/user-1').respond(200, response);

    const offers = OffersByService.query({ userId: 'user-1' });
    offers.$promise.then(function (result) {
      expect(result).toEqual(jasmine.arrayContaining(response));
      done();
    }, done.fail);

    $httpBackend.flush();
  });
});
