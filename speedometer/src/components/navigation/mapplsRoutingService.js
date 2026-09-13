/**
 * Mappls Routing Service for Smart Bike TFT Cluster
 * 
 * Handles:
 * 1. Mappls Route Advanced REST API integration with two-wheeler ('biking') profile.
 * 2. Extraction and normalization of route geometry, distance, duration, ETA, and turn-by-turn steps.
 * 3. Route deviation calculation for automatic rerouting.
 * 4. Graceful fallbacks when offline or credentials are unavailable.
 */

// Haversine distance in meters between two lat/lng points
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
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

// Distance from point P to line segment VW in meters
function distToSegment(pLat, pLng, vLat, vLng, wLat, wLng) {
  const l2 = (wLat - vLat) ** 2 + (wLng - vLng) ** 2;
  if (l2 === 0) return getDistanceMeters(pLat, pLng, vLat, vLng);
  let t = ((pLat - vLat) * (wLat - vLat) + (pLng - vLng) * (wLng - vLng)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projLat = vLat + t * (wLat - vLat);
  const projLng = vLng + t * (wLng - vLng);
  return getDistanceMeters(pLat, pLng, projLat, projLng);
}

/**
 * Checks if vehicle has deviated significantly from the active polyline.
 * 
 * @param {Object} currentLoc - { lat, lng }
 * @param {Array} polyline - Array of { lat, lng }
 * @param {number} thresholdMeters - Deviation limit before triggering reroute (default 80m)
 * @returns {boolean}
 */
export function isOffRoute(currentLoc, polyline, thresholdMeters = 80) {
  if (!currentLoc || !Array.isArray(polyline) || polyline.length < 2) return false;
  const { lat, lng } = currentLoc;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const v = polyline[i];
    const w = polyline[i + 1];
    const d = distToSegment(lat, lng, v.lat, v.lng, w.lat, w.lng);
    if (d < minDistance) minDistance = d;
  }

  return minDistance > thresholdMeters;
}

/**
 * Normalizes Mappls maneuver into TFT action enum
 */
export function mapManeuverAction(type = '', modifier = '', instruction = '') {
  const t = String(type).toLowerCase();
  const m = String(modifier).toLowerCase();
  const instr = String(instruction).toLowerCase();

  if (t === 'arrive' || instr.includes('destination') || instr.includes('arrived')) {
    return 'ARRIVED';
  }
  if (t.includes('roundabout') || instr.includes('roundabout')) {
    return 'ROUNDABOUT';
  }
  if (m.includes('u-turn') || m.includes('uturn') || instr.includes('u-turn')) {
    return 'UTURN';
  }
  if (m.includes('slight left') || instr.includes('slight left') || instr.includes('bear left')) {
    return 'SLIGHT_LEFT';
  }
  if (m.includes('slight right') || instr.includes('slight right') || instr.includes('bear right')) {
    return 'SLIGHT_RIGHT';
  }
  if (m.includes('left') || instr.includes('turn left')) {
    return 'LEFT';
  }
  if (m.includes('right') || instr.includes('turn right')) {
    return 'RIGHT';
  }
  if (t === 'continue' || t === 'depart' || m.includes('straight') || instr.includes('straight') || instr.includes('continue')) {
    return 'STRAIGHT';
  }
  return 'STRAIGHT';
}

/**
 * Formats seconds into HH:MM ETA based on current time
 */
export function formatETAFromDuration(durationSeconds = 0) {
  const now = new Date();
  const etaDate = new Date(now.getTime() + durationSeconds * 1000);
  let hours = etaDate.getHours();
  const minutes = String(etaDate.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formats distance in meters into readable string
 */
export function formatDistance(meters = 0) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Decodes Encoded Polyline algorithm (5 or 6 digit precision)
 */
export function decodePolyline(encoded, precision = 5) {
  if (!encoded || typeof encoded !== 'string') return [];
  const factor = Math.pow(10, precision);
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      lat: lat / factor,
      lng: lng / factor,
    });
  }

  return coordinates;
}

/**
 * Calls Mappls Route Advanced REST API using the two-wheeler 'biking' profile.
 * 
 * Endpoint:
 * https://apis.mappls.com/advancedmaps/v1/{key}/route_adv/biking/{startLng},{startLat};{destLng},{destLat}?steps=true&geometries=geojson&overview=full
 * 
 * @param {Object} params
 * @param {Object} params.origin - { lat, lng }
 * @param {Object} params.destination - { lat, lng }
 * @param {string} params.apiKey - Mappls Static Key
 * @returns {Promise<Object|null>} Normalized route data or null
 */
export async function fetchMapplsBikingRoute({ origin, destination, apiKey }) {
  if (!apiKey || !origin || !destination) {
    return null;
  }

  const startLat = Number(origin.lat);
  const startLng = Number(origin.lng);
  const destLat = Number(destination.lat);
  const destLng = Number(destination.lng);

  if (!Number.isFinite(startLat) || !Number.isFinite(startLng) || !Number.isFinite(destLat) || !Number.isFinite(destLng)) {
    return null;
  }

  // Mappls coordinate order: {longitude},{latitude};{longitude},{latitude}
  const coordsPath = `${startLng.toFixed(6)},${startLat.toFixed(6)};${destLng.toFixed(6)},${destLat.toFixed(6)}`;
  const url = `https://apis.mappls.com/advancedmaps/v1/${encodeURIComponent(apiKey)}/route_adv/biking/${coordsPath}?steps=true&geometries=geojson&overview=full`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Mappls Route API error: HTTP ${res.status} - ${errText}`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error('Mappls Route API returned no routes');
    }

    const route = data.routes[0];
    const totalDistanceMeters = Number(route.distance) || 0;
    const totalDurationSeconds = Number(route.duration) || 0;
    const distanceKm = Number((totalDistanceMeters / 1000).toFixed(1));
    const etaFormatted = formatETAFromDuration(totalDurationSeconds);

    // Extract polyline path
    let polylinePath = [];
    if (route.geometry?.coordinates && Array.isArray(route.geometry.coordinates)) {
      // GeoJSON coordinates format: [lng, lat]
      polylinePath = route.geometry.coordinates.map(([lng, lat]) => ({
        lat: Number(lat),
        lng: Number(lng),
      }));
    } else if (typeof route.geometry === 'string') {
      polylinePath = decodePolyline(route.geometry, 5);
    }

    if (polylinePath.length === 0) {
      polylinePath = [
        { lat: startLat, lng: startLng },
        { lat: destLat, lng: destLng },
      ];
    }

    // Extract turn maneuvers & navigation steps
    const firstLeg = route.legs?.[0] || {};
    const steps = firstLeg.steps || [];

    let nextTurn = {
      instruction: 'Continue on current road',
      distanceMeters: Math.round(totalDistanceMeters),
      distanceFormatted: formatDistance(totalDistanceMeters),
      streetName: destination.name || 'Destination',
      action: 'STRAIGHT',
    };

    if (steps.length > 0) {
      // Find the upcoming relevant maneuver
      const activeStep = steps.find((s) => s.distance > 5) || steps[0];
      const maneuver = activeStep.maneuver || {};
      const action = mapManeuverAction(maneuver.type, maneuver.modifier, maneuver.instruction);
      const stepDistance = Math.round(activeStep.distance || 0);

      nextTurn = {
        instruction: maneuver.instruction || activeStep.name || 'Follow route',
        distanceMeters: stepDistance,
        distanceFormatted: formatDistance(stepDistance),
        streetName: activeStep.name || destination.name || 'Upcoming Road',
        action,
      };
    }

    return {
      success: true,
      totalDistanceKm: distanceKm,
      remainingDistanceKm: distanceKm,
      eta: etaFormatted,
      estimatedMinutes: Math.round(totalDurationSeconds / 60),
      polyline: polylinePath,
      nextTurn,
      steps: steps.map((s) => ({
        instruction: s.maneuver?.instruction || s.name || 'Follow route',
        distanceMeters: Math.round(s.distance || 0),
        streetName: s.name || '',
        action: mapManeuverAction(s.maneuver?.type, s.maneuver?.modifier, s.maneuver?.instruction),
      })),
    };
  } catch (err) {
    console.warn('[Mappls Router]', err.message);
    return null;
  }
}
