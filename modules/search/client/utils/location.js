export function getBoundsObject(
  northEastLat,
  northEastLng,
  southWestLat,
  southWestLng,
) {
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

export function getBounds(geolocation) {
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
      parseFloat(center[1]) + borderFromCenter,
      parseFloat(center[0]) - borderFromCenter,
      parseFloat(center[1]) - borderFromCenter,
      parseFloat(center[0]) + borderFromCenter,
    );
  }

  return getBoundsObject(
    parseFloat(geolocation.bbox[3]),
    parseFloat(geolocation.bbox[2]),
    parseFloat(geolocation.bbox[1]),
    parseFloat(geolocation.bbox[0]),
  );
}

export function getCenter(geolocation) {
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
    lng: parseFloat(coords[0]),
    lat: parseFloat(coords[1]),
  };
}

export function shortTitle(geolocation) {
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
