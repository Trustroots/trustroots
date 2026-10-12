import axios from 'axios';

import {
  createOffer,
  deleteOffer,
  getOffers,
  getOffer,
  queryOffers,
  updateOffer,
} from '@/modules/offers/client/api/offers.api';
import type {
  CreateOfferRequest,
  OfferPayload,
  OfferReadPayload,
  OfferSearchFeatureCollection,
  UpdateOfferRequest,
} from '@/modules/offers/shared/offer';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeOffer(overrides: Partial<OfferPayload> = {}): OfferPayload {
  return {
    _id: 'offer-1',
    type: 'host',
    user: 'member-1',
    location: [12, 34],
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('offers api', () => {
  it('fetches offers by user and types', async () => {
    const offers: OfferPayload[] = [makeOffer()];
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
    const offer: OfferReadPayload = {
      ...makeOffer(),
      user: { _id: 'member-1', username: 'fictional-member' },
    };
    mockedAxios.get.mockResolvedValueOnce({ data: offer });

    await expect(getOffer('offer-1')).resolves.toBe(offer);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/offers/offer-1');
  });

  it('queries offers serializing the query into a URL', async () => {
    const offers: OfferSearchFeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };
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
    const response = { message: 'Offer saved.' };
    const payload: CreateOfferRequest = {
      type: 'meet',
      location: [12, 34],
    };
    mockedAxios.post.mockResolvedValueOnce({ data: response });

    await expect(createOffer(payload)).resolves.toBe(response);
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/offers', payload);
  });

  it('updates an offer', async () => {
    const response = { message: 'Offer updated.' };
    const payload: UpdateOfferRequest = { status: 'yes', location: [12, 34] };
    mockedAxios.put.mockResolvedValueOnce({ data: response });

    await expect(updateOffer('offer-1', payload)).resolves.toBe(response);
    expect(mockedAxios.put).toHaveBeenCalledWith(
      '/api/offers/offer-1',
      payload,
    );
  });

  it('deletes an offer', async () => {
    const response = { message: 'Offer removed.' };
    mockedAxios.delete.mockResolvedValueOnce({ data: response });

    await expect(deleteOffer('offer-1')).resolves.toBe(response);
    expect(mockedAxios.delete).toHaveBeenCalledWith('/api/offers/offer-1');
  });
});
