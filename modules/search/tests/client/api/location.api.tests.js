import axios from 'axios';

import { getMapBoxToken } from '@/modules/core/client/utils/map';
import {
  fetchLocationSuggestions,
  locatePlace,
} from '@/modules/search/client/api/location.api';
import { getBounds, getCenter } from '@/modules/search/client/utils/location';

jest.mock('axios');
jest.mock('@/modules/core/client/utils/map', () => ({
  getMapBoxToken: jest.fn(),
}));
jest.mock('@/modules/search/client/utils/location', () => ({
  getBounds: jest.fn(),
  getCenter: jest.fn(),
  shortTitle: jest.fn(feature => feature.text || feature.place_name || ''),
}));

describe('location api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when the token or query is missing', async () => {
    getMapBoxToken.mockReturnValue(null);

    await expect(fetchLocationSuggestions('Paris')).resolves.toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('returns mapped suggestions when Mapbox responds with features', async () => {
    getMapBoxToken.mockReturnValue('mapbox-token');
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        features: [
          { id: 'place-1', text: 'Paris', place_name: 'Paris, France' },
        ],
      },
    });

    await expect(fetchLocationSuggestions('Paris', 'place')).resolves.toEqual([
      {
        id: 'place-1',
        place_name: 'Paris, France',
        text: 'Paris',
        trTitle: 'Paris',
      },
    ]);

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.mapbox.com/geocoding/v5/mapbox.places/Paris.json',
      {
        params: {
          access_token: 'mapbox-token',
          language: 'en',
          types: 'place',
        },
      },
    );
  });

  it('returns an empty list when the Mapbox request fails', async () => {
    getMapBoxToken.mockReturnValue('mapbox-token');
    axios.get.mockRejectedValue(new Error('Network error'));

    await expect(fetchLocationSuggestions('Paris')).resolves.toEqual([]);
  });

  it('returns an empty list for unsuccessful or empty Mapbox responses', async () => {
    getMapBoxToken.mockReturnValue('mapbox-token');
    axios.get.mockResolvedValueOnce({ status: 500, data: { features: [] } });
    await expect(fetchLocationSuggestions('Paris')).resolves.toEqual([]);

    axios.get.mockResolvedValueOnce({ status: 200, data: {} });
    await expect(fetchLocationSuggestions('Paris')).resolves.toEqual([]);
  });

  it('locates a place using bounds when available', () => {
    const bounds = {
      northEast: { lat: 1, lng: 2 },
      southWest: { lat: 0, lng: 1 },
    };
    getBounds.mockReturnValue(bounds);
    getCenter.mockReturnValue(false);

    expect(locatePlace({ id: 'place-1' })).toEqual({
      data: bounds,
      type: 'bounds',
    });
  });

  it('locates a place using centre coordinates when bounds are unavailable', () => {
    const center = { lat: 48.8, lng: 2.3 };
    getBounds.mockReturnValue(false);
    getCenter.mockReturnValue(center);

    expect(locatePlace({ id: 'place-1' })).toEqual({
      data: center,
      type: 'center',
    });
  });

  it('returns null when neither bounds nor centre are available', () => {
    getBounds.mockReturnValue(false);
    getCenter.mockReturnValue(false);

    expect(locatePlace({ id: 'place-1' })).toBeNull();
  });
});
