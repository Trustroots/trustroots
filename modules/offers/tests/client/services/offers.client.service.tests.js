import '@/modules/offers/client/offers.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('OffersService', function () {
  let OffersService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_OffersService_) {
    OffersService = _OffersService_;
  }));

  it('calls $update for existing offers', function () {
    const offer = new OffersService({
      _id: 'offer-1',
      type: 'host',
    });
    offer.$update = jest.fn(() => 'updated');
    offer.$save = jest.fn(() => 'saved');

    expect(offer.createOrUpdate()).toBe('updated');
    expect(offer.$update).toHaveBeenCalled();
    expect(offer.$save).not.toHaveBeenCalled();
  });

  it('calls $save when creating new offers', function () {
    const offer = new OffersService({
      type: 'host',
    });
    offer.$update = jest.fn(() => 'updated');
    offer.$save = jest.fn(() => 'saved');

    expect(offer.createOrUpdate()).toBe('saved');
    expect(offer.$save).toHaveBeenCalled();
    expect(offer.$update).not.toHaveBeenCalled();
  });
});
