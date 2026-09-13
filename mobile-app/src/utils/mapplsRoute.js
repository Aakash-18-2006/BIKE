/**
 * Mappls Routing Service for Smart Bike Mobile App
 * Official Mappls Route Advance API with two-wheeler (biking) profile
 */

import { normalizeCoordinates, toRouteBounds } from './coordinates.js';

/**
 * Mask API key for secure logging without exposing secret credentials
 * e.g., 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg' -> 'anpv...gbg'
 */
export function maskKey(key) {
  if (!key || typeof key !== 'string') return 'none';
  if (key.length <= 8) return `${key.substring(0, 2)}...${key.substring(key.length - 2)}`;
  return `${key.substring(0, 4)}...${key.substring(key.length - 3)}`;
}

/**
 * Format route errors safely without "[object Object]"
 */
export function formatRouteError(error) {
  if (!error) return 'Unknown error occurred while calculating route';
  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    return error.message || error.toString();
  }

  const parts = [];
  if (error.error && typeof error.error === 'string') parts.push(`Error: ${error.error}`);
  if (error.error_description) parts.push(`Description: ${error.error_description}`);
  if (error.msg) parts.push(`Message: ${error.msg}`);
  if (error.message) parts.push(`Message: ${error.message}`);
  if (error.error_code) parts.push(`Code: ${error.error_code}`);
  if (error.responsecode) parts.push(`Response Code: ${error.responsecode}`);
  if (error.status) parts.push(`Status: ${error.status}`);
  if (error.statusCode) parts.push(`Status: ${error.statusCode}`);

  if (parts.length > 0) return parts.join(' | ');

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Calculate route between origin and destination using Mappls Biking profile
 *
 * @param {Object} params
 * @param {{latitude: number, longitude: number}|{lat: number, lng: number}} params.origin
 * @param {{latitude: number, longitude: number}|{lat: number, lng: number}} params.destination
 * @param {string} [params.profile='biking'] - 'biking' (two-wheeler) or 'driving'
 * @param {string} [params.apiKey]
 * @returns {Promise<Object>} Route details including coordinates, distance, and duration
 */
export async function calculateMapplsRoute({
  origin,
  destination,
  profile = 'biking',
  apiKey,
}) {
  const key = apiKey || import.meta.env.VITE_MAPPLS_API_KEY;

  const normOrigin = normalizeCoordinates(origin);
  const normDest = normalizeCoordinates(destination);

  if (!normOrigin) {
    throw new Error('Invalid or missing current GPS origin coordinates');
  }

  if (!normDest) {
    throw new Error('Invalid or missing destination coordinates');
  }

  const originLng = normOrigin.lng;
  const originLat = normOrigin.lat;
  const destLng = normDest.lng;
  const destLat = normDest.lat;

  // Development debug logs required by user prompt:
  console.log(`[MAP DEBUG] Current: ${normOrigin.lat}, ${normOrigin.lng}`);
  console.log(`[MAP DEBUG] Destination: ${normDest.lat}, ${normDest.lng}`);
  console.log(`[MAP DEBUG] Route start: [${originLng}, ${originLat}]`);
  console.log(`[MAP DEBUG] Route end: [${destLng}, ${destLat}]`);

  console.log('[Mappls Route] Request started');
  console.log(
    `[Mappls Route] Calculating from [${originLng}, ${originLat}] to [${destLng}, ${destLat}] with profile: ${profile}`
  );
  console.log(`[Mappls Route] Credential loaded: ${maskKey(key)} (from import.meta.env.VITE_MAPPLS_API_KEY)`);

  // 1. Primary: Use backend proxy to ensure CORS-free, secure execution
  const proxyUrl = `/api/navigation/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}&profile=${profile}`;

  try {
    const res = await fetch(proxyUrl);
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !data.success) {
      const errMsg = data ? formatRouteError(data) : `Server responded with HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    const route = data.route;
    if (!route || !Array.isArray(route.coordinates) || route.coordinates.length === 0) {
      throw new Error('No valid route geometry found in Mappls response');
    }

    // Ensure bounds are strictly [[swLng, swLat], [neLng, neLat]]
    if (!route.bounds || !Array.isArray(route.bounds)) {
      route.bounds = toRouteBounds(route.coordinates);
    }

    console.log('[Mappls Route] Route received');
    console.log(`[Mappls Route] Distance: ${route.distanceFormatted}`);
    console.log(`[Mappls Route] Duration: ${route.durationFormatted}`);
    console.log('[Mappls Route] Geometry received');

    return route;
  } catch (proxyErr) {
    // If backend proxy failed, log and check direct Mappls API call as fallback
    console.warn('[Mappls Route] Proxy route call warning, attempting direct call:', formatRouteError(proxyErr));

    if (key && key !== 'your_mappls_static_key_here') {
      try {
        const directUrl = `https://route.mappls.com/route/direction/route_adv/${profile}/${originLng},${originLat};${destLng},${destLat}?steps=true&overview=full&geometries=geojson&access_token=${key}`;
        const maskedDirectUrl = `https://route.mappls.com/route/direction/route_adv/${profile}/${originLng},${originLat};${destLng},${destLat}?steps=true&overview=full&geometries=geojson&access_token=${maskKey(key)}`;
        console.log(`[Mappls Route] Direct request URL: ${maskedDirectUrl}`);

        const directRes = await fetch(directUrl);
        const directData = await directRes.json().catch(() => null);

        if (!directRes.ok || !directData) {
          throw new Error(directData ? formatRouteError(directData) : `Direct Mappls route HTTP ${directRes.status}`);
        }

        if (!directData.routes || directData.routes.length === 0) {
          throw new Error('No route found between given coordinates');
        }

        const r = directData.routes[0];
        const distM = r.distance || 0;
        const durS = r.duration || 0;

        function decodePolyline(str, precision = 5) {
          if (!str || typeof str !== 'string') return [];
          const factor = Math.pow(10, precision);
          const coordinates = [];
          let index = 0, len = str.length;
          let lat = 0, lng = 0;

          while (index < len) {
            let b, shift = 0, result = 0;
            do {
              b = str.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
              b = str.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            coordinates.push([lng / factor, lat / factor]);
          }
          return coordinates;
        }

        let rawCoords = [];
        let geometryType = 'Unknown';

        if (r.geometry) {
          if (typeof r.geometry === 'string') {
            geometryType = 'EncodedPolyline';
            let decoded = decodePolyline(r.geometry, 5);
            if (decoded.length > 0 && Math.abs(decoded[0][0]) < 10) {
              decoded = decodePolyline(r.geometry, 6);
            }
            rawCoords = decoded;
          } else if (Array.isArray(r.geometry.coordinates) && r.geometry.coordinates.length > 0) {
            geometryType = r.geometry.type || 'LineString';
            rawCoords = r.geometry.coordinates;
          }
        }

        if (rawCoords.length === 0 && Array.isArray(r.legs?.[0]?.steps)) {
          geometryType = 'StepGeometries';
          const stepPts = [];
          r.legs[0].steps.forEach((step) => {
            let pts = [];
            if (typeof step.geometry === 'string') {
              pts = decodePolyline(step.geometry, 5);
            } else if (Array.isArray(step.geometry?.coordinates)) {
              pts = step.geometry.coordinates;
            }
            pts.forEach((pt) => {
              if (stepPts.length === 0 || 
                  Math.abs(stepPts[stepPts.length - 1][0] - pt[0]) > 1e-7 || 
                  Math.abs(stepPts[stepPts.length - 1][1] - pt[1]) > 1e-7) {
                stepPts.push(pt);
              }
            });
          });
          rawCoords = stepPts;
        }

        if (rawCoords.length > 0 && rawCoords[0][1] > 45 && rawCoords[0][0] < 40) {
          rawCoords = rawCoords.map(([a, b]) => [b, a]);
        }

        const coords = rawCoords.map((pt) => ({ lat: pt[1], lng: pt[0] }));

        const distanceFormatted = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`;
        const durationFormatted = durS >= 3600
          ? `${Math.floor(durS / 3600)} hr ${Math.round((durS % 3600) / 60)} min`
          : `${Math.max(1, Math.round(durS / 60))} min`;

        const fallbackRoute = {
          distanceMeters: distM,
          distanceKm: (distM / 1000).toFixed(1),
          distanceFormatted,
          durationSeconds: durS,
          durationMinutes: Math.round(durS / 60),
          durationFormatted,
          profile,
          summary: r.legs?.[0]?.summary || '',
          geometryType,
          coordinates: coords,
          rawCoordinates: rawCoords,
          steps: r.legs?.[0]?.steps || [],
          // [[swLng, swLat], [neLng, neLat]]
          bounds: toRouteBounds(coords),
        };

        console.log('[Mappls Route] Route received');
        console.log(`[Mappls Route] Distance: ${fallbackRoute.distanceFormatted}`);
        console.log(`[Mappls Route] Duration: ${fallbackRoute.durationFormatted}`);
        console.log('[Mappls Route] Geometry received');

        return fallbackRoute;
      } catch (directErr) {
        console.error('[Mappls Route] Direct request failed:', formatRouteError(directErr));
        throw new Error(formatRouteError(proxyErr.message || directErr));
      }
    }

    throw new Error(formatRouteError(proxyErr));
  }
}
