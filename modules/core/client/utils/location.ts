export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapBounds {
  northEast: MapPoint;
  southWest: MapPoint;
}

export interface CitySearch {
  name: string;
  bounds: MapBounds;
  centre: MapPoint;
}

export interface Geolocation {
  bbox?: Array<string | number>;
  center?: Array<string | number>;
  geometry?: { coordinates?: Array<string | number> };
  text?: string;
  context?: Array<{ id: string; text: string; short_code?: string }>;
  place_name?: string;
}

export function getBoundsObject(
  northEastLat: number,
  northEastLng: number,
  southWestLat: number,
  southWestLng: number,
): MapBounds {
  return {
    northEast: {
      lat: northEastLat,
      lng: northEastLng,
    },
    southWest: {
      lat: southWestLat,
      lng: southWestLng,
    },
  };
}

export function getBounds(geolocation?: Geolocation | null): MapBounds | false {
  if (
    !geolocation ||
    !geolocation.bbox ||
    !Array.isArray(geolocation.bbox) ||
    geolocation.bbox.length !== 4
  ) {
    const center = geolocation?.center;

    if (
      !geolocation ||
      !center ||
      !Array.isArray(center) ||
      center.length !== 2
    ) {
      return false;
    }

    const borderFromCenter = 0.002;

    return getBoundsObject(
      Number(center[1]) + borderFromCenter,
      Number(center[0]) + borderFromCenter,
      Number(center[1]) - borderFromCenter,
      Number(center[0]) - borderFromCenter,
    );
  }

  return getBoundsObject(
    Number(geolocation.bbox[3]),
    Number(geolocation.bbox[2]),
    Number(geolocation.bbox[1]),
    Number(geolocation.bbox[0]),
  );
}

export function getCenter(geolocation?: Geolocation | null): MapPoint | false {
  let coords;

  if (geolocation?.center) {
    coords = geolocation.center;
  } else if (geolocation?.geometry?.coordinates) {
    coords = geolocation.geometry.coordinates;
  }

  if (!coords || !Array.isArray(coords) || coords.length !== 2) {
    return false;
  }

  return {
    lng: Number(coords[0]),
    lat: Number(coords[1]),
  };
}

export function getCitySearch(
  feature: Geolocation & { id: string; trTitle?: string },
): CitySearch | undefined {
  if (!feature.id.startsWith('place.') || !feature.trTitle) return undefined;

  const centre = getCenter(feature);
  if (!centre || !Number.isFinite(centre.lat) || !Number.isFinite(centre.lng)) {
    return undefined;
  }

  // The geocoder can return a centre without an extent. Use an area of
  // roughly 22 km across in that case, regardless of the map zoom.
  const longitudeMargin =
    0.1 / Math.max(0.1, Math.cos((centre.lat * Math.PI) / 180));
  const bounds =
    (feature.bbox && getBounds(feature)) ||
    getBoundsObject(
      Math.min(90, centre.lat + 0.1),
      Math.min(180, centre.lng + longitudeMargin),
      Math.max(-90, centre.lat - 0.1),
      Math.max(-180, centre.lng - longitudeMargin),
    );

  return { name: feature.trTitle, bounds, centre };
}

export function shortTitle(geolocation: Geolocation): string {
  let title = '';

  if (geolocation.text) {
    title = geolocation.text;

    if (geolocation.context) {
      for (const context of geolocation.context) {
        if (context.id.substring(0, 6) === 'place.') {
          title += `, ${context.text}`;
        } else if (context.id.substring(0, 8) === 'country.') {
          title += `, ${context.text}`;

          if (context.short_code === 'us' && geolocation.place_name) {
            title = geolocation.place_name;
          }
        }
      }
    }
  } else if (geolocation.place_name) {
    title = geolocation.place_name;
  }

  return title;
}
