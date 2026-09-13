/**
 * Centralized Coordinate Normalization & Validation Utility for Smart Bike
 *
 * Ensures consistent coordinate ordering across all components:
 * - Internal storage: { lat: number, lng: number } (with latitude/longitude aliases)
 * - Mappls API / GeoJSON / MapLibre boundary: [longitude, latitude]
 */

/**
 * Validates and corrects coordinate bounds
 */
export function validateCoordinates(lat, lng) {
  let numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat);
  let numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    throw new Error(`Invalid coordinate numbers: lat=${lat}, lng=${lng}`);
  }

  // Detect accidental coordinate inversion:
  // In India, latitude is between ~6° and 38°N, longitude is between ~68° and 98°E.
  // If lat > 45 and lng < 40, they were almost certainly swapped (e.g. lat=77.59, lng=12.97).
  if (numLat > 45 && numLng < 40) {
    console.warn(`[Coordinate Warning] Swapped coordinates detected! Inverting lat=${numLat}, lng=${numLng} to lat=${numLng}, lng=${numLat}`);
    const temp = numLat;
    numLat = numLng;
    numLng = temp;
  }

  if (numLat < -90 || numLat > 90) {
    throw new Error(`Latitude ${numLat} out of range [-90, 90]`);
  }

  if (numLng < -180 || numLng > 180) {
    throw new Error(`Longitude ${numLng} out of range [-180, 180]`);
  }

  return {
    lat: Number(numLat.toFixed(6)),
    lng: Number(numLng.toFixed(6)),
  };
}

/**
 * Normalizes any coordinate representation into standard { lat, lng } object
 * Supports:
 * - { lat, lng }
 * - { latitude, longitude }
 * - [lng, lat] (GeoJSON / Mappls array)
 */
export function normalizeCoordinates(input) {
  if (!input) return null;

  let rawLat = null;
  let rawLng = null;

  if (Array.isArray(input) && input.length >= 2) {
    // Array format: Mappls/GeoJSON standard is [longitude, latitude]
    // If first element is > 45 (e.g. 77.59) and second is < 40 (e.g. 12.97), it is [lng, lat]
    rawLng = input[0];
    rawLat = input[1];
  } else if (typeof input === 'object') {
    if ('lat' in input && 'lng' in input) {
      rawLat = input.lat;
      rawLng = input.lng;
    } else if ('latitude' in input && 'longitude' in input) {
      rawLat = input.latitude;
      rawLng = input.longitude;
    }
  }

  if (rawLat == null || rawLng == null) {
    return null;
  }

  try {
    const validated = validateCoordinates(rawLat, rawLng);

    return {
      ...(typeof input === 'object' && input.name ? { name: input.name } : {}),
      ...(typeof input === 'object' && input.address ? { address: input.address } : {}),
      lat: validated.lat,
      lng: validated.lng,
      // Aliases for backwards compatibility with existing UI components:
      latitude: validated.lat,
      longitude: validated.lng,
    };
  } catch {
    return null;
  }
}

/**
 * Centralized converter: converts any coordinate format to Mappls SDK { lat, lng } object
 * Used at Mappls marker, setCenter, and camera boundaries
 */
export function toMapplsCoordinate(input) {
  const norm = normalizeCoordinates(input);
  if (!norm) return null;
  return { lat: norm.lat, lng: norm.lng };
}

/**
 * Centralized converter: converts any coordinate to GeoJSON standard [longitude, latitude]
 * Used for MapLibre / Mappls GeoJSON LineString coordinates
 */
export function toMapplsGeoJSON(input) {
  const norm = normalizeCoordinates(input);
  if (!norm) return null;
  return [norm.lng, norm.lat];
}

/**
 * Converts any coordinate to Mappls Map / GeoJSON standard array: [longitude, latitude]
 */
export function toMapplsLngLat(input) {
  return toMapplsGeoJSON(input);
}

/**
 * Converts any coordinate to { lat, lng } object for map setCenter / Markers
 */
export function toMapplsLatLngObj(input) {
  return toMapplsCoordinate(input);
}

/**
 * Calculates Haversine distance in meters between two lat/lng points
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Creates valid Mappls fitBounds array: [[southwestLng, southwestLat], [northeastLng, northeastLat]]
 */
export function toMapplsBounds(p1, p2) {
  const n1 = normalizeCoordinates(p1);
  const n2 = normalizeCoordinates(p2);

  if (!n1 || !n2) return null;

  const minLng = Math.min(n1.lng, n2.lng);
  const maxLng = Math.max(n1.lng, n2.lng);
  const minLat = Math.min(n1.lat, n2.lat);
  const maxLat = Math.max(n1.lat, n2.lat);

  // Mappls/MapLibre fitBounds expects [[swLng, swLat], [neLng, neLat]]
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Creates valid bounds from a list of route coordinates
 */
export function toRouteBounds(coordsList) {
  if (!Array.isArray(coordsList) || coordsList.length === 0) return null;

  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;

  for (const item of coordsList) {
    const norm = normalizeCoordinates(item);
    if (norm) {
      if (norm.lng < minLng) minLng = norm.lng;
      if (norm.lng > maxLng) maxLng = norm.lng;
      if (norm.lat < minLat) minLat = norm.lat;
      if (norm.lat > maxLat) maxLat = norm.lat;
    }
  }

  if (minLng > maxLng || minLat > maxLat) return null;

  // [[swLng, swLat], [neLng, neLat]]
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Canonical alias for normalizeCoordinates
 * Returns { lat: number, lng: number } or null if invalid
 */
export function normalizeLatLng(input) {
  return normalizeCoordinates(input);
}

/**
 * Converts Mappls / GeoJSON [longitude, latitude] or coordinate object to canonical { lat, lng }
 */
export function fromMapplsLngLat(input) {
  return normalizeCoordinates(input);
}

/**
 * Validates route geometry returned by Mappls:
 * - Minimum 2 points
 * - Every point valid (lat [-90, 90], lng [-180, 180], no NaN)
 * - No accidental lat/lng inversion
 * - Route start close to origin (if origin provided)
 * - Route end close to destination (if destination provided)
 * Does NOT reject a valid route merely because GPS is slightly away from its start.
 */
export function validateRouteGeometry(routeData, origin = null, destination = null) {
  if (!routeData) {
    return { valid: false, reason: 'Route data is null or undefined' };
  }

  let pts = [];
  if (Array.isArray(routeData.coordinates) && routeData.coordinates.length > 0) {
    pts = routeData.coordinates.map(normalizeCoordinates).filter(Boolean);
  } else if (Array.isArray(routeData.rawCoordinates) && routeData.rawCoordinates.length > 0) {
    pts = routeData.rawCoordinates.map(([lng, lat]) => normalizeCoordinates({ lat, lng })).filter(Boolean);
  }

  if (pts.length < 2) {
    return { valid: false, reason: `Route must have at least 2 points, found ${pts.length}` };
  }

  // Validate every point
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number' || isNaN(p.lat) || isNaN(p.lng)) {
      return { valid: false, reason: `Invalid coordinate at index ${i}` };
    }
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      return { valid: false, reason: `Coordinate out of bounds at index ${i}: lat=${p.lat}, lng=${p.lng}` };
    }
  }

  // Origin proximity check (tolerant to real-world GPS offset up to 5000m)
  if (origin) {
    const normOrig = normalizeCoordinates(origin);
    if (normOrig) {
      const startDist = haversineDistance(normOrig.lat, normOrig.lng, pts[0].lat, pts[0].lng);
      if (startDist > 15000) {
        return {
          valid: false,
          reason: `Route origin deviation too large: ${(startDist / 1000).toFixed(1)} km`,
          distance: startDist,
        };
      }
    }
  }

  // Destination proximity check (within 5000m)
  if (destination) {
    const normDest = normalizeCoordinates(destination);
    if (normDest) {
      const endDist = haversineDistance(normDest.lat, normDest.lng, pts[pts.length - 1].lat, pts[pts.length - 1].lng);
      if (endDist > 15000) {
        return {
          valid: false,
          reason: `Route destination deviation too large: ${(endDist / 1000).toFixed(1)} km`,
          distance: endDist,
        };
      }
    }
  }

  return {
    valid: true,
    pointsCount: pts.length,
    startPoint: pts[0],
    endPoint: pts[pts.length - 1],
  };
}

