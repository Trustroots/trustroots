import axios from 'axios';

import {
  createOffer,
  deleteOffer,
  getOffers,
  getOffer,
  queryOffers,
  updateOffer,
  type Offer,
} from '@/modules/offers/client/api/offers.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('offers api', () => {
  it('fetches offers by user and types', async () => {
    const offers: Offer[] = [{ _id: 'offer-1' }];
    mockedAxios.get.mockResolvedValueOnce({ data: offers });

    await expect(getOffers('user-1', ['host'])).resolves.toBe(offers);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/offers-by/user-1', {
      params: { types: ['host'] },
    });
  });

  it('passes request options through to the shared client', async () => {
    const controller = new AbortController();
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    await getOffers('user-1', ['host'], {
      signal: controller.signal,
      timeout: 45000,
    });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/offers-by/user-1', {
      params: { types: ['host'] },
      signal: controller.signal,
      timeout: 45000,
    });
  });

  it('returns an empty array when the user has no offers (404)', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(getOffers('user-1', ['host'])).resolves.toEqual([]);
  });

  it('rethrows non-404 errors when fetching offers', async () => {
    const error = { response: { status: 500 } };
    mockedAxios.get.mockRejectedValueOnce(error);

    await expect(getOffers('user-1', ['host'])).rejects.toBe(error);
  });

  it('fetches a single offer by id', async () => {
    const offer: Offer = { _id: 'offer-1' };
    mockedAxios.get.mockResolvedValueOnce({ data: offer });

    await expect(getOffer('offer-1')).resolves.toBe(offer);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/offers/offer-1');
  });

  it('queries offers serializing the query into a URL', async () => {
    const offers: Offer[] = [{ _id: 'offer-1', type: 'host' }];
    mockedAxios.get.mockResolvedValueOnce({ data: offers });

    await expect(
      queryOffers({ northEastLat: '1', type: 'host' }),
    ).resolves.toBe(offers);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/offers?northEastLat=1&type=host',
    );
  });

  it('queries offers with no arguments', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    await expect(queryOffers()).resolves.toEqual([]);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/offers?');
  });

  it('omits undefined query values when serializing offer filters', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    await expect(
      queryOffers({ type: 'host', optionalFilter: undefined }),
    ).resolves.toEqual([]);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/offers?type=host');
  });

  it('creates an offer', async () => {
    const offer: Offer = { _id: 'offer-1', type: 'meet' };
    mockedAxios.post.mockResolvedValueOnce({ data: offer });

    await expect(createOffer({ type: 'meet' })).resolves.toBe(offer);
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/offers', {
      type: 'meet',
    });
  });

  it('updates an offer', async () => {
    const offer: Offer = { _id: 'offer-1', type: 'host' };
    mockedAxios.put.mockResolvedValueOnce({ data: offer });

    await expect(updateOffer('offer-1', { status: 'yes' })).resolves.toBe(
      offer,
    );
    expect(mockedAxios.put).toHaveBeenCalledWith('/api/offers/offer-1', {
      status: 'yes',
    });
  });

  it('deletes an offer', async () => {
    mockedAxios.delete.mockResolvedValueOnce({ data: { ok: true } });

    await expect(deleteOffer('offer-1')).resolves.toEqual({ ok: true });
    expect(mockedAxios.delete).toHaveBeenCalledWith('/api/offers/offer-1');
  });
});
