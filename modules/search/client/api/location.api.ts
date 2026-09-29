import axios from '../../../core/client/api/http-client.js';

import { getMapBoxToken } from '@/modules/core/client/utils/map';
import {
  getBounds,
  getCenter,
  shortTitle,
  type MapBounds,
  type MapPoint,
} from '../utils/location';

interface LocationFeature {
  id: string;
  bbox?: Array<string | number>;
  center?: Array<string | number>;
  geometry?: { coordinates?: Array<string | number> };
  text?: string;
  context?: Array<{ id: string; text: string; short_code?: string }>;
  place_name?: string;
}

export async function fetchLocationSuggestions(query: string, types?: string) {
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

    return (data.features as LocationFeature[]).map(feature => ({
      ...feature,
      trTitle: shortTitle(feature),
    }));
  } catch {
    return [];
  }
}

export function locatePlace(
  feature: LocationFeature,
):
  | { data: MapBounds; type: 'bounds' }
  | { data: MapPoint; type: 'center' }
  | null {
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
