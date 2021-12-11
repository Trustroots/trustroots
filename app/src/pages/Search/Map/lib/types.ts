export type Location = {
    lat: number;
    lng: number;
    zoom: number;
}

export type LocationBounds = {
    northEast: Location,
    southWest: Location,
}

export type WebMercatorViewportOptions = {
    // Map state
    width: number;
    height: number;
    latitude?: number;
    longitude?: number;
    position?: number[];
    zoom?: number;
    pitch?: number;
    bearing?: number;
    altitude?: number;
    fovy?: number;
    nearZMultiplier?: number;
    farZMultiplier?: number;
  };

export type LocationBoundsParams = {
    northEastLat: number,
    northEastLng: number,
    southWestLat: number,
    southWestLng: number,
}

