// Latitudes must be between -90 and 90
export const ensureValidLat = lat => Math.min(Math.max(lat, -90), 90);

// Longitudes must be between -180 and 180
export const ensureValidLng = lng => Math.min(Math.max(lng, -180), 180);
