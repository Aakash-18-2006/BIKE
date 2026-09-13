/**
 * Mappls Navigation Service for Smart Bike Mobile App
 *
 * Dedicated service for communicating with the official Mappls Routing / Directions API
 * using the two-wheeler (biking) profile, converting the response into a clean routeData
 * structure consumed by MapplsMobileMap.
 */

import {
  normalizeCoordinates,
  toMapplsCoordinate,
  toMapplsGeoJSON,
  toMapplsLngLat,
  toMapplsLatLngObj,
  toMapplsBounds,
  toRouteBounds,
} from '../utils/coordinates.js';

/**
 * Format error object safely without displaying "[object Object]"
 */
function formatServiceError(error) {
  if (!error) return 'Unknown Mappls routing error';
  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    return error.message || error.toString();
  }

  const parts = [];
  if (error.error_description) parts.push(`Description: ${error.error_description}`);
  if (error.error && typeof error.error === 'string') parts.push(`Error: ${error.error}`);
  if (error.msg) parts.push(`Message: ${error.msg}`);
  if (error.message) parts.push(`Message: ${error.message}`);
  if (error.error_code) parts.push(`Code: ${error.error_code}`);
  if (error.responsecode) parts.push(`Response Code: ${error.responsecode}`);
  if (error.statusText) parts.push(`Status Text: ${error.statusText}`);
  if (error.status) parts.push(`Status: ${error.status}`);

  if (parts.length > 0) return parts.join(' | ');

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Decodes standard encoded polyline strings (5-digit or 6-digit precision)
 * Returns array of [lng, lat] (GeoJSON standard order)
 */
export function decodePolyline(encoded, precision = 5) {
  if (!encoded || typeof encoded !== 'string') return [];
  const factor = Math.pow(10, precision);
  const coordinates = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([
      Number((lng / factor).toFixed(6)),
      Number((lat / factor).toFixed(6)),
    ]);
  }

  return coordinates;
}

/**
 * Generate human-friendly step instruction if Mappls does not provide one explicitly
 */
function buildStepInstruction(step) {
  if (step.instruction && typeof step.instruction === 'string' && step.instruction.trim()) {
    return step.instruction.trim();
  }

  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const roadName = step.name || step.ref || '';

  if (type === 'depart') {
    return roadName ? `Head ${modifier ? modifier + ' ' : ''}on ${roadName}` : 'Depart';
  }
  if (type === 'arrive') {
    return roadName ? `Arrive at destination on ${roadName}` : 'Arrive at destination';
  }
  if (type === 'turn') {
    const modText = modifier ? ` ${modifier}` : '';
    return roadName ? `Turn${modText} onto ${roadName}` : `Turn${modText}`;
  }
  if (type === 'new name' || type === 'continue') {
    return roadName ? `Continue onto ${roadName}` : 'Continue straight';
  }
  if (type === 'roundabout' || type === 'rotary') {
    return roadName ? `Enter roundabout and take exit for ${roadName}` : 'Enter roundabout';
  }
  if (modifier) {
    const capModifier = modifier.charAt(0).toUpperCase() + modifier.slice(1);
    return roadName ? `${capModifier} onto ${roadName}` : capModifier;
  }
  if (roadName) {
    return `Proceed on ${roadName}`;
  }

  return null;
}

/**
 * Normalizes an individual Mappls route step into a clean, consistent structure
 */
function normalizeRouteStep(step) {
  if (!step || typeof step !== 'object') return null;

  // Extract or decode step geometry
  let stepGeojsonCoords = [];
  if (step.geometry) {
    if (typeof step.geometry === 'string') {
      stepGeojsonCoords = decodePolyline(step.geometry, 5);
      if (stepGeojsonCoords.length > 0 && Math.abs(stepGeojsonCoords[0][0]) < 10) {
        stepGeojsonCoords = decodePolyline(step.geometry, 6);
      }
    } else if (Array.isArray(step.geometry.coordinates)) {
      stepGeojsonCoords = step.geometry.coordinates;
    }
  }

  // Determine start and end coordinates
  let startCoord = null;
  let endCoord = null;

  if (stepGeojsonCoords.length > 0) {
    const firstPt = stepGeojsonCoords[0];
    const lastPt = stepGeojsonCoords[stepGeojsonCoords.length - 1];
    startCoord = { lat: firstPt[1], lng: firstPt[0] };
    endCoord = { lat: lastPt[1], lng: lastPt[0] };
  } else if (Array.isArray(step.maneuver?.location) && step.maneuver.location.length >= 2) {
    startCoord = {
      lat: step.maneuver.location[1],
      lng: step.maneuver.location[0],
    };
  }

  const maneuverObj = step.maneuver ? {
    type: step.maneuver.type || null,
    modifier: step.maneuver.modifier || null,
    bearingBefore: step.maneuver.bearing_before != null ? step.maneuver.bearing_before : null,
    bearingAfter: step.maneuver.bearing_after != null ? step.maneuver.bearing_after : null,
    location: Array.isArray(step.maneuver.location) ? step.maneuver.location : null,
  } : null;

  return {
    instruction: buildStepInstruction(step),
    maneuver: maneuverObj,
    maneuverType: step.maneuver?.type || null,
    modifier: step.maneuver?.modifier || null,
    roadName: step.name || step.ref || null,
    distance: typeof step.distance === 'number' ? step.distance : (parseFloat(step.distance) || 0),
    duration: typeof step.duration === 'number' ? step.duration : (parseFloat(step.duration) || 0),
    geometry: step.geometry || (stepGeojsonCoords.length > 0 ? { type: 'LineString', coordinates: stepGeojsonCoords } : null),
    start: startCoord,
    end: endCoord,
    intersections: Array.isArray(step.intersections) ? step.intersections : [],
  };
}

/**
 * Audits actual Mappls response capabilities for lanes, junctions, and traffic.
 */
export function auditRouteCapabilities(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return { hasLaneInfo: false, hasJunctionInfo: false, hasTrafficInfo: false };
  }
  const route = rawResponse.routes?.[0];
  const leg = route?.legs?.[0];
  const steps = leg?.steps || [];

  let hasLaneInfo = false;
  let hasJunctionInfo = false;
  let hasTrafficInfo = false;

  for (const step of steps) {
    if (Array.isArray(step.intersections) && step.intersections.length > 0) {
      hasJunctionInfo = true;
      if (step.intersections.some((i) => Array.isArray(i.lanes) && i.lanes.length > 0)) {
        hasLaneInfo = true;
      }
    }
    if (Array.isArray(step.lanes) && step.lanes.length > 0) {
      hasLaneInfo = true;
    }
  }

  if (
    route?.traffic ||
    leg?.traffic ||
    leg?.annotation?.congestion ||
    route?.duration_typical != null ||
    leg?.duration_typical != null ||
    route?.duration_in_traffic != null
  ) {
    hasTrafficInfo = true;
  }

  return {
    hasLaneInfo,
    hasJunctionInfo,
    hasTrafficInfo,
  };
}

/**
 * Extracts and decodes the complete route coordinates from Mappls route object
 * Returns array of [lng, lat] in GeoJSON ordering
 */
function extractRouteCoordinates(route) {
  let rawCoords = [];

  if (route.geometry) {
    if (typeof route.geometry === 'string') {
      let decoded = decodePolyline(route.geometry, 5);
      // Precision 6 fallback if coordinates look abnormally scaled
      if (decoded.length > 0 && Math.abs(decoded[0][0]) < 10) {
        decoded = decodePolyline(route.geometry, 6);
      }
      rawCoords = decoded;
    } else if (Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0) {
      rawCoords = route.geometry.coordinates;
    }
  }

  // If top-level geometry is absent, assemble from individual steps
  if (rawCoords.length === 0 && Array.isArray(route.legs?.[0]?.steps)) {
    const assembled = [];
    route.legs[0].steps.forEach((step) => {
      let pts = [];
      if (typeof step.geometry === 'string') {
        pts = decodePolyline(step.geometry, 5);
      } else if (Array.isArray(step.geometry?.coordinates)) {
        pts = step.geometry.coordinates;
      }
      pts.forEach((pt) => {
        if (
          assembled.length === 0 ||
          Math.abs(assembled[assembled.length - 1][0] - pt[0]) > 1e-7 ||
          Math.abs(assembled[assembled.length - 1][1] - pt[1]) > 1e-7
        ) {
          assembled.push(pt);
        }
      });
    });
    rawCoords = assembled;
  }

  // Safety check: ensure [lng, lat] order for India (lng ~68-98, lat ~6-38)
  if (rawCoords.length > 0 && rawCoords[0][1] > 45 && rawCoords[0][0] < 40) {
    rawCoords = rawCoords.map(([a, b]) => [b, a]);
  }

  return rawCoords;
}

/**
 * Calculates a bike (two-wheeler) route between origin and destination using the official Mappls routing service.
 *
 * @param {{lat: number, lng: number}} origin - Starting GPS coordinates
 * @param {{lat: number, lng: number}} destination - Ending GPS coordinates
 * @returns {Promise<{success: boolean, routeData?: object, rawResponse?: object, error?: string}>}
 */
export async function calculateBikeRoute(origin, destination) {
  // 1. Validate & normalize input coordinates
  let normOrigin = null;
  let normDest = null;
  try {
    normOrigin = normalizeCoordinates(origin);
    normDest = normalizeCoordinates(destination);
  } catch (coordErr) {
    return {
      success: false,
      error: coordErr?.message || 'Invalid or malformed coordinates',
    };
  }

  if (!normOrigin || isNaN(normOrigin.lat) || isNaN(normOrigin.lng)) {
    return {
      success: false,
      error: 'Invalid or missing origin coordinates',
    };
  }

  if (!normDest || isNaN(normDest.lat) || isNaN(normDest.lng)) {
    return {
      success: false,
      error: 'Invalid or missing destination coordinates',
    };
  }

  // 2. Log according to required format
  console.log('[MAPPLS ROUTING] Calculating bike route');
  console.log(`[MAPPLS ROUTING] Origin: ${normOrigin.lat}, ${normOrigin.lng}`);
  console.log(`[MAPPLS ROUTING] Destination: ${normDest.lat}, ${normDest.lng}`);
  console.log('[MAPPLS ROUTING] Requesting official Mappls bike route');

  // 3. Retrieve Mappls API key from environment variable
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPPLS_API_KEY)
    || (typeof process !== 'undefined' && process.env?.VITE_MAPPLS_API_KEY);
  if (!apiKey) {
    return {
      success: false,
      error: 'Missing Mappls API key. Please define VITE_MAPPLS_API_KEY in your environment configuration.',
    };
  }

  const originLng = normOrigin.lng;
  const originLat = normOrigin.lat;
  const destLng = normDest.lng;
  const destLat = normDest.lat;

  // 4. Construct official Mappls routing endpoint URLs
  // Official Mappls Route Advance API with two-wheeler (biking) profile
  const primaryDirectUrl = `https://route.mappls.com/route/direction/route_adv/biking/${originLng},${originLat};${destLng},${destLat}?steps=true&overview=full&geometries=geojson&access_token=${apiKey}`;
  const alternativeDirectUrl = `https://apis.mappls.com/advancedmaps/v1/${apiKey}/route_adv/biking/${originLng},${originLat};${destLng},${destLat}?steps=true&overview=full&geometries=geojson`;
  const backendProxyUrl = `/api/navigation/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}&profile=biking`;

  let responseData = null;
  let lastError = null;

  // Helper to fetch and parse JSON safely
  const tryFetchRoute = async (url) => {
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const errDetail = data ? formatServiceError(data) : `HTTP status ${res.status}`;
      throw new Error(errDetail);
    }
    return data;
  };

  // 5. Execute routing request:
  // First attempt: Direct official Mappls routing service
  try {
    responseData = await tryFetchRoute(primaryDirectUrl);
  } catch (directErr) {
    lastError = directErr;
    console.warn('[MAPPLS ROUTING] Direct route service notice, checking fallback options:', formatServiceError(directErr));

    // Second attempt: Alternative official Mappls REST endpoint
    try {
      responseData = await tryFetchRoute(alternativeDirectUrl);
      lastError = null;
    } catch (altErr) {
      lastError = altErr;

      // Third attempt: Backend proxy fallback (avoids browser CORS restrictions in local dev)
      try {
        const proxyData = await tryFetchRoute(backendProxyUrl);
        if (proxyData && proxyData.success && proxyData.route) {
          // Backend proxy provides parsed route or raw data
          responseData = proxyData.raw || {
            code: 'Ok',
            routes: [
              {
                distance: proxyData.route.distanceMeters,
                duration: proxyData.route.durationSeconds,
                geometry: {
                  type: 'LineString',
                  coordinates: proxyData.route.rawCoordinates,
                },
                legs: [
                  {
                    distance: proxyData.route.distanceMeters,
                    duration: proxyData.route.durationSeconds,
                    steps: proxyData.route.steps || [],
                  },
                ],
              },
            ],
          };
          lastError = null;
        } else if (proxyData && Array.isArray(proxyData.routes) && proxyData.routes.length > 0) {
          responseData = proxyData;
          lastError = null;
        } else if (proxyData?.error) {
          throw new Error(formatServiceError(proxyData.error));
        }
      } catch (proxyErr) {
        lastError = proxyErr;
      }
    }
  }

  if (!responseData) {
    return {
      success: false,
      error: formatServiceError(lastError) || 'Failed to obtain route from Mappls routing service',
    };
  }

  // 6. Validate response structure
  if (!responseData.routes || !Array.isArray(responseData.routes) || responseData.routes.length === 0) {
    const errorMsg = responseData.error_description || responseData.message || responseData.msg || 'No route found between the specified coordinates';
    return {
      success: false,
      error: errorMsg,
    };
  }

  const route = responseData.routes[0];
  const totalDistance = typeof route.distance === 'number' ? route.distance : (parseFloat(route.distance) || 0);
  const totalDuration = typeof route.duration === 'number' ? route.duration : (parseFloat(route.duration) || 0);

  // 7. Extract complete unsimplified route geometry
  const rawCoordinates = extractRouteCoordinates(route);
  if (rawCoordinates.length === 0) {
    return {
      success: false,
      error: 'Mappls routing service returned a route with no valid geometry coordinates',
    };
  }

  // 8. Convert to both formats expected across the app
  // rawCoordinates: GeoJSON [lng, lat]
  // coordinates: application standard { lat, lng }
  const coordinates = rawCoordinates.map(([lng, lat]) => ({ lat, lng }));

  // 9. Compute bounds [[swLng, swLat], [neLng, neLat]]
  const bounds = toRouteBounds(rawCoordinates) || (function calculateBounds(pts) {
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    for (const [lng, lat] of pts) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return [[minLng, minLat], [maxLng, maxLat]];
  })(rawCoordinates);

  // 10. Normalize turn-by-turn steps
  const rawSteps = route.legs?.[0]?.steps || [];
  const normalizedSteps = rawSteps.map(normalizeRouteStep).filter(Boolean);

  // 11. Required debug logging
  console.log('[MAPPLS ROUTING] Route received');
  console.log(`[MAPPLS ROUTING] Route points: ${rawCoordinates.length}`);
  console.log(`[MAPPLS ROUTING] Distance: ${totalDistance} m`);
  console.log(`[MAPPLS ROUTING] Duration: ${totalDuration} s`);
  console.log(`[MAPPLS ROUTING] Steps: ${normalizedSteps.length}`);

  const distanceFormatted = totalDistance >= 1000
    ? `${(totalDistance / 1000).toFixed(1)} km`
    : `${Math.round(totalDistance)} m`;
  const durationFormatted = totalDuration >= 3600
    ? `${Math.floor(totalDuration / 3600)} hr ${Math.round((totalDuration % 3600) / 60)} min`
    : `${Math.max(1, Math.round(totalDuration / 60))} min`;

  // 12. Return consistent result
  return {
    success: true,
    routeData: {
      coordinates,
      rawCoordinates,
      geometryType: 'LineString',
      bounds,
      distance: totalDistance,
      duration: totalDuration,
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      distanceFormatted,
      durationFormatted,
      summary: route.legs?.[0]?.summary || '',
      steps: normalizedSteps,
      capabilities: auditRouteCapabilities(responseData),
    },
    rawResponse: responseData,
  };
}

export default {
  calculateBikeRoute,
  decodePolyline,
  auditRouteCapabilities,
};
