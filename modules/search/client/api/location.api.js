import axios from 'axios';

import { getMapBoxToken } from '@/modules/core/client/utils/map';
import { getBounds, getCenter, shortTitle } from '../utils/location';

export async function fetchLocationSuggestions(query, types) {
  const token = getMapBoxToken();

  if (!token || query == null || query.length <= 1) {
    return [];
  }

  try {
    const { data, status } = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query,
      )}.json`,
      {
        params: {
          access_token: token,
          language: 'en',
          ...(types ? { types } : {}),
        },
      },
    );

    if (status !== 200 || !data?.features?.length) {
      return [];
    }

    return data.features.map(feature => ({
      ...feature,
      trTitle: shortTitle(feature),
    }));
  } catch {
    return [];
  }
}

export function locatePlace(feature) {
  const bounds = getBounds(feature);
  const center = getCenter(feature);

  if (bounds) {
    return { data: bounds, type: 'bounds' };
  }

  if (center) {
    return { data: center, type: 'center' };
  }

  return null;
}
