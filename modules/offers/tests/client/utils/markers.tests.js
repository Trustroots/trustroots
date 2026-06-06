import {
  getOfferHexColor,
  zoomToPixelMeters,
} from '@/modules/offers/client/utils/markers';

describe('offer marker utilities', () => {
  it('converts meters to pixels for a map zoom level', () => {
    expect(
      zoomToPixelMeters({ latitude: 0, meters: 1000, zoom: 10 }),
    ).toBeCloseTo(6.54, 1);
  });

  it('returns marker colors for offer types and statuses', () => {
    expect(getOfferHexColor({ offerType: 'host', offerStatus: 'yes' })).toBe(
      '#5cb85c',
    );
    expect(getOfferHexColor({ offerType: 'host', offerStatus: 'maybe' })).toBe(
      '#f0ad4e',
    );
    expect(getOfferHexColor({ offerType: 'host', offerStatus: 'no' })).toBe(
      '#d9534f',
    );
    expect(getOfferHexColor({ offerType: 'meet' })).toBe('#0081a1');
    expect(getOfferHexColor({ offerType: 'other' })).toBe('#000');
  });

  it('returns the default color when offer type is omitted', () => {
    expect(getOfferHexColor({})).toBe('#000');
  });
});
