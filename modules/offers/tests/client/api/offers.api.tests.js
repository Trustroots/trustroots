import axios from 'axios';

import {
  getOffers,
  getOffer,
  queryOffers,
} from '@/modules/offers/client/api/offers.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('offers api', () => {
  it('fetches offers by user and types', async () => {
    const offers = [{ _id: 'offer-1' }];
    axios.get.mockResolvedValueOnce({ data: offers });

    await expect(getOffers('user-1', ['host'])).resolves.toBe(offers);
    expect(axios.get).toHaveBeenCalledWith('api/offers-by/user-1', {
      params: { types: ['host'] },
    });
  });

  it('returns an empty array when the user has no offers (404)', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(getOffers('user-1', ['host'])).resolves.toEqual([]);
  });

  it('rethrows non-404 errors when fetching offers', async () => {
    const error = { response: { status: 500 } };
    axios.get.mockRejectedValueOnce(error);

    await expect(getOffers('user-1', ['host'])).rejects.toBe(error);
  });

  it('fetches a single offer by id', async () => {
    const offer = { _id: 'offer-1' };
    axios.get.mockResolvedValueOnce({ data: offer });

    await expect(getOffer('offer-1')).resolves.toBe(offer);
    expect(axios.get).toHaveBeenCalledWith('/api/offers/offer-1');
  });

  it('queries offers serializing the query into a URL', async () => {
    const offers = [{ _id: 'offer-1', type: 'host' }];
    axios.get.mockResolvedValueOnce({ data: offers });

    await expect(
      queryOffers({ northEastLat: '1', type: 'host' }),
    ).resolves.toBe(offers);
    expect(axios.get).toHaveBeenCalledWith(
      '/api/offers?northEastLat=1&type=host',
    );
  });

  it('queries offers with no arguments', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    await expect(queryOffers()).resolves.toEqual([]);
    expect(axios.get).toHaveBeenCalledWith('/api/offers?');
  });
});
