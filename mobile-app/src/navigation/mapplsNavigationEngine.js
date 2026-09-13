/**
 * Mappls Real-Time Navigation Engine for Smart Bike
 *
 * Dedicated pure navigation calculations built on top of official Mappls bike routes.
 * Handles:
 * - Nearest point on route projection
 * - Real-route remaining distance and progress calculation
 * - Step/maneuver detection and distance-to-turn tracking
 * - Hysteresis-based off-route detection (preventing jitter)
 * - Confirmation-based destination arrival detection
 * - Formatted distances and durations
 */

import { normalizeCoordinates, validateRouteGeometry } from '../utils/coordinates.js';

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates
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
 * Projects a point onto a line segment [A, B] and computes distance, fraction, and projected point.
 */
export function projectPointOnSegment(latP, lngP, latA, lngA, latB, lngB) {
  const midLat = ((latA + latB) / 2) * (Math.PI / 180);
  const xB = (lngB - lngA) * (Math.PI / 180) * 6371000 * Math.cos(midLat);
  const yB = (latB - latA) * (Math.PI / 180) * 6371000;
  const xP = (lngP - lngA) * (Math.PI / 180) * 6371000 * Math.cos(midLat);
  const yP = (latP - latA) * (Math.PI / 180) * 6371000;

  const l2 = xB * xB + yB * yB;
  let t = 0;
  if (l2 > 0) {
    t = Math.max(0, Math.min(1, (xP * xB + yP * yB) / l2));
  }

  const projLat = latA + t * (latB - latA);
  const projLng = lngA + t * (lngB - lngA);
  const distance = haversineDistance(latP, lngP, projLat, projLng);

  return {
    distance,
    fraction: t,
    projectedPoint: { lat: projLat, lng: projLng },
  };
}

/**
 * Normalizes any route coordinates container (rawCoordinates [[lng, lat]] or coordinates [{lat, lng}])
 * into an array of { lat, lng } points.
 */
export function extractPointsList(routeData) {
  if (!routeData) return [];

  if (Array.isArray(routeData.coordinates) && routeData.coordinates.length > 0) {
    return routeData.coordinates.map((pt) => {
      const n = normalizeCoordinates(pt);
      return n ? { lat: n.lat, lng: n.lng } : null;
    }).filter(Boolean);
  }

  if (Array.isArray(routeData.rawCoordinates) && routeData.rawCoordinates.length > 0) {
    return routeData.rawCoordinates.map(([lng, lat]) => ({ lat, lng }));
  }

  return [];
}

/**
 * A. Finds the nearest point on the route polyline.
 *
 * @param {{lat: number, lng: number}} currentLocation
 * @param {Array} routeCoords - Array of route points ({lat, lng} or [lng, lat])
 * @returns {{nearestPoint: {lat: number, lng: number}, distanceFromRoute: number, segmentIndex: number, fraction: number, fractionalIndex: number}}
 */
export function findNearestPointOnRoute(currentLocation, routeCoords) {
  const normLoc = normalizeCoordinates(currentLocation);
  if (!normLoc) {
    return {
      nearestPoint: null,
      distanceFromRoute: 0,
      segmentIndex: 0,
      fraction: 0,
      fractionalIndex: 0,
    };
  }

  let pts = [];
  if (Array.isArray(routeCoords)) {
    if (routeCoords.length > 0 && Array.isArray(routeCoords[0])) {
      pts = routeCoords.map(([lng, lat]) => ({ lat, lng }));
    } else {
      pts = routeCoords.map((p) => {
        const n = normalizeCoordinates(p);
        return n ? { lat: n.lat, lng: n.lng } : null;
      }).filter(Boolean);
    }
  }

  if (pts.length < 2) {
    const single = pts[0] || normLoc;
    return {
      nearestPoint: single,
      distanceFromRoute: haversineDistance(normLoc.lat, normLoc.lng, single.lat, single.lng),
      segmentIndex: 0,
      fraction: 0,
      fractionalIndex: 0,
    };
  }

  let minDistance = Infinity;
  let bestSegment = 0;
  let bestFraction = 0;
  let bestProjectedPoint = pts[0];

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const proj = projectPointOnSegment(normLoc.lat, normLoc.lng, p1.lat, p1.lng, p2.lat, p2.lng);

    if (proj.distance < minDistance) {
      minDistance = proj.distance;
      bestSegment = i;
      bestFraction = proj.fraction;
      bestProjectedPoint = proj.projectedPoint;
    }
  }

  return {
    nearestPoint: bestProjectedPoint,
    distanceFromRoute: Number(minDistance.toFixed(1)),
    segmentIndex: bestSegment,
    fraction: bestFraction,
    fractionalIndex: Number((bestSegment + bestFraction).toFixed(3)),
  };
}

/**
 * B. Calculates remaining route distance along the actual Mappls route geometry.
 *
 * @param {{lat: number, lng: number}} currentLocation
 * @param {Array} routeCoords
 * @param {Object} [nearestInfo] - Cached result from findNearestPointOnRoute
 * @returns {number} Distance in meters along the route
 */
export function calculateRemainingDistance(currentLocation, routeCoords, nearestInfo = null) {
  let pts = [];
  if (Array.isArray(routeCoords)) {
    if (routeCoords.length > 0 && Array.isArray(routeCoords[0])) {
      pts = routeCoords.map(([lng, lat]) => ({ lat, lng }));
    } else {
      pts = routeCoords.map((p) => {
        const n = normalizeCoordinates(p);
        return n ? { lat: n.lat, lng: n.lng } : null;
      }).filter(Boolean);
    }
  }

  if (pts.length === 0) return 0;
  if (pts.length === 1) {
    const norm = normalizeCoordinates(currentLocation);
    return norm ? haversineDistance(norm.lat, norm.lng, pts[0].lat, pts[0].lng) : 0;
  }

  const nearest = nearestInfo || findNearestPointOnRoute(currentLocation, pts);
  const segIdx = nearest.segmentIndex;
  const proj = nearest.nearestPoint || pts[segIdx];

  // 1. Distance from projected point to the end of its segment
  let remaining = haversineDistance(proj.lat, proj.lng, pts[segIdx + 1].lat, pts[segIdx + 1].lng);

  // 2. Sum of all subsequent segments along actual geometry
  for (let i = segIdx + 1; i < pts.length - 1; i++) {
    remaining += haversineDistance(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
  }

  return Number(remaining.toFixed(1));
}

/**
 * Calculates total route distance along the actual polyline geometry.
 */
export function calculateTotalRouteDistance(routeCoords) {
  let pts = [];
  if (Array.isArray(routeCoords)) {
    if (routeCoords.length > 0 && Array.isArray(routeCoords[0])) {
      pts = routeCoords.map(([lng, lat]) => ({ lat, lng }));
    } else {
      pts = routeCoords.map((p) => {
        const n = normalizeCoordinates(p);
        return n ? { lat: n.lat, lng: n.lng } : null;
      }).filter(Boolean);
    }
  }

  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += haversineDistance(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
  }
  return total;
}

/**
 * C. Determines current route progress percentage: 0 -> 100.
 *
 * @param {{lat: number, lng: number}} currentLocation
 * @param {Array} routeCoords
 * @param {Object} [nearestInfo]
 * @param {number} [totalDistanceOverride]
 * @returns {number} Progress percentage from 0 to 100
 */
export function calculateRouteProgress(currentLocation, routeCoords, nearestInfo = null, totalDistanceOverride = null) {
  const remaining = calculateRemainingDistance(currentLocation, routeCoords, nearestInfo);
  const total = totalDistanceOverride || calculateTotalRouteDistance(routeCoords);

  if (total <= 0) return 0;
  const traveled = Math.max(0, total - remaining);
  const percentage = (traveled / total) * 100;
  return Number(Math.min(100, Math.max(0, percentage)).toFixed(1));
}

/**
 * Formats distance in meters into human-readable string.
 * Examples: "850 m", "1.2 km", "5.7 km"
 */
export function formatNavDistance(meters) {
  if (meters == null || isNaN(meters)) return '0 m';
  const m = Math.max(0, Math.round(meters));
  if (m < 50) return `${m} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Formats duration in seconds into human-readable string.
 * Examples: "4 min", "12 min", "1 hr 5 min"
 */
export function formatNavDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '1 min';
  const totalMins = Math.max(1, Math.round(seconds / 60));
  if (totalMins >= 60) {
    const hrs = Math.floor(totalMins / 60);
    const remMins = totalMins % 60;
    return remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
  }
  return `${totalMins} min`;
}

/**
 * Resolves a clean directional maneuver name and icon for motorcycle display.
 */
export function resolveManeuverVisuals(type, modifier) {
  const t = String(type || '').toLowerCase();
  const m = String(modifier || '').toLowerCase();

  if (t === 'depart') return { text: 'DEPART', icon: '🧭', turnDirection: 'depart' };
  if (t === 'arrive') return { text: 'ARRIVE', icon: '🏁', turnDirection: 'arrive' };
  if (t === 'roundabout' || t === 'rotary') return { text: 'ROUNDABOUT', icon: '🔄', turnDirection: 'roundabout' };
  if (t === 'uturn' || m === 'uturn') return { text: 'U-TURN', icon: '↩', turnDirection: 'uturn' };

  if (m.includes('sharp left')) return { text: 'SHARP LEFT', icon: '⮌', turnDirection: 'sharp left' };
  if (m.includes('sharp right')) return { text: 'SHARP RIGHT', icon: '⮍', turnDirection: 'sharp right' };
  if (m.includes('slight left')) return { text: 'SLIGHT LEFT', icon: '↖', turnDirection: 'slight left' };
  if (m.includes('slight right')) return { text: 'SLIGHT RIGHT', icon: '↗', turnDirection: 'slight right' };
  if (m.includes('left')) return { text: 'TURN LEFT', icon: '↰', turnDirection: 'left' };
  if (m.includes('right')) return { text: 'TURN RIGHT', icon: '↱', turnDirection: 'right' };
  if (m.includes('straight') || t === 'continue') return { text: 'CONTINUE', icon: '↑', turnDirection: 'straight' };

  return { text: (t || 'CONTINUE').toUpperCase(), icon: '↑', turnDirection: m || t || 'straight' };
}

/**
 * Normalizes Mappls maneuver into standardized Step 4 uppercase constants:
 * TURN_LEFT, TURN_RIGHT, SLIGHT_LEFT, SLIGHT_RIGHT, STRAIGHT, U_TURN, ROUNDABOUT, MERGE, EXIT, ARRIVE, CONTINUE
 */
export function normalizeManeuver(type, modifier) {
  const t = String(type || '').toLowerCase().trim();
  const m = String(modifier || '').toLowerCase().trim();

  if (t === 'arrive') return 'ARRIVE';
  if (t === 'roundabout' || t === 'rotary') return 'ROUNDABOUT';
  if (t === 'uturn' || m.includes('uturn') || m.includes('u-turn')) return 'U_TURN';
  if (t === 'merge') return 'MERGE';
  if (t === 'exit' || t === 'off ramp' || t === 'fork') return 'EXIT';

  if (m.includes('slight left')) return 'SLIGHT_LEFT';
  if (m.includes('slight right')) return 'SLIGHT_RIGHT';
  if (m.includes('sharp left') || m.includes('left')) return 'TURN_LEFT';
  if (m.includes('sharp right') || m.includes('right')) return 'TURN_RIGHT';

  if (m.includes('straight') || t === 'straight') return 'STRAIGHT';
  if (t === 'continue' || m.includes('continue')) return 'CONTINUE';

  return 'CONTINUE';
}

/**
 * Determines navigation guidance band based on distance to maneuver:
 * > 200m: NORMAL
 * <= 200m: APPROACHING
 * <= 100m: SOON
 * <= 50m: IMMEDIATE
 * <= 15m: NOW
 */
export function getGuidanceBand(distanceToManeuver) {
  const d = Math.max(0, Math.round(distanceToManeuver || 0));
  if (d <= 15) return 'NOW';
  if (d <= 50) return 'IMMEDIATE';
  if (d <= 100) return 'SOON';
  if (d <= 200) return 'APPROACHING';
  return 'NORMAL';
}

/**
 * Calculates distance along the actual polyline geometry from current position to target maneuver.
 * Prevents Euclidean short-circuiting over curved roads and eliminates GPS lateral jitter jumps.
 */
export function calculateDistanceAlongRoute(currentLocation, targetCoord, routeCoords, nearestInfo = null) {
  const normLoc = normalizeCoordinates(currentLocation);
  const normTarget = normalizeCoordinates(targetCoord);
  if (!normLoc || !normTarget) return 0;

  let pts = [];
  if (Array.isArray(routeCoords)) {
    if (routeCoords.length > 0 && Array.isArray(routeCoords[0])) {
      pts = routeCoords.map(([lng, lat]) => ({ lat, lng }));
    } else {
      pts = routeCoords.map((p) => {
        const n = normalizeCoordinates(p);
        return n ? { lat: n.lat, lng: n.lng } : null;
      }).filter(Boolean);
    }
  }

  if (pts.length < 2) {
    return Number(haversineDistance(normLoc.lat, normLoc.lng, normTarget.lat, normTarget.lng).toFixed(1));
  }

  const startNearest = nearestInfo || findNearestPointOnRoute(normLoc, pts);
  const targetNearest = findNearestPointOnRoute(normTarget, pts);

  // If rider has passed the maneuver or is on the same segment
  if (startNearest.segmentIndex > targetNearest.segmentIndex) {
    return 0;
  }

  if (startNearest.segmentIndex === targetNearest.segmentIndex) {
    if (startNearest.fraction >= targetNearest.fraction) {
      return 0;
    }
    return Number(haversineDistance(
      startNearest.nearestPoint.lat,
      startNearest.nearestPoint.lng,
      targetNearest.nearestPoint.lat,
      targetNearest.nearestPoint.lng
    ).toFixed(1));
  }

  // startNearest.segmentIndex < targetNearest.segmentIndex
  // 1. Distance from start projection to end of start segment
  let totalDist = haversineDistance(
    startNearest.nearestPoint.lat,
    startNearest.nearestPoint.lng,
    pts[startNearest.segmentIndex + 1].lat,
    pts[startNearest.segmentIndex + 1].lng
  );

  // 2. Full length of intermediate segments
  for (let i = startNearest.segmentIndex + 1; i < targetNearest.segmentIndex; i++) {
    totalDist += haversineDistance(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
  }

  // 3. Distance from start of target segment to target projection
  totalDist += haversineDistance(
    pts[targetNearest.segmentIndex].lat,
    pts[targetNearest.segmentIndex].lng,
    targetNearest.nearestPoint.lat,
    targetNearest.nearestPoint.lng
  );

  // If rider is approaching before the route start, add approach distance to projected point
  const distToProj = haversineDistance(normLoc.lat, normLoc.lng, startNearest.nearestPoint.lat, startNearest.nearestPoint.lng);
  if (startNearest.segmentIndex === 0 && startNearest.fraction === 0 && distToProj > 15) {
    totalDist += distToProj;
  }

  return Number(totalDist.toFixed(1));
}

/**
 * D. Determines the next Mappls maneuver and distance to it.
 *
 * @param {{lat: number, lng: number}} currentLocation
 * @param {Array} steps - Normalized steps from routeData.steps
 * @param {Array} routeCoords - Route geometry points
 * @param {number} currentStepIndex - Active step index
 * @param {Object} [nearestInfo]
 * @param {number} [stepArrivalThreshold=35]
 */
export function determineNextManeuver(
  currentLocation,
  steps,
  routeCoords,
  currentStepIndex = 0,
  nearestInfo = null,
  stepArrivalThreshold = 8
) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return {
      instruction: 'Follow highlighted route',
      maneuverType: 'continue',
      modifier: 'straight',
      roadName: '',
      distanceToManeuver: 0,
      distanceToManeuverFormatted: '0 m',
      stepIndex: 0,
      stepAdvanced: false,
      turnDirection: 'straight',
      icon: '↑',
      currentStep: null,
      nextStep: null,
    };
  }

  let activeIndex = Math.min(Math.max(0, currentStepIndex), steps.length - 1);
  let step = steps[activeIndex];
  const normLoc = normalizeCoordinates(currentLocation);

  // Target coordinates for this step maneuver
  const targetLat = step.start?.lat ?? (Array.isArray(step.maneuver?.location) ? step.maneuver.location[1] : null);
  const targetLng = step.start?.lng ?? (Array.isArray(step.maneuver?.location) ? step.maneuver.location[0] : null);

  let distanceToTurn = 0;
  if (normLoc && targetLat != null && targetLng != null) {
    if (Array.isArray(routeCoords) && routeCoords.length >= 2) {
      distanceToTurn = calculateDistanceAlongRoute(
        normLoc,
        { lat: targetLat, lng: targetLng },
        routeCoords,
        nearestInfo
      );
    } else {
      distanceToTurn = haversineDistance(normLoc.lat, normLoc.lng, targetLat, targetLng);
    }
  } else {
    distanceToTurn = typeof step.distance === 'number' ? step.distance : 0;
  }

  // Step advancement check: advance when rider has crossed within arrival threshold
  let stepAdvanced = false;
  if (activeIndex < steps.length - 1 && distanceToTurn < stepArrivalThreshold) {
    activeIndex += 1;
    step = steps[activeIndex];
    stepAdvanced = true;

    const newTargetLat = step.start?.lat ?? (Array.isArray(step.maneuver?.location) ? step.maneuver.location[1] : null);
    const newTargetLng = step.start?.lng ?? (Array.isArray(step.maneuver?.location) ? step.maneuver.location[0] : null);
    if (normLoc && newTargetLat != null && newTargetLng != null) {
      if (Array.isArray(routeCoords) && routeCoords.length >= 2) {
        distanceToTurn = calculateDistanceAlongRoute(
          normLoc,
          { lat: newTargetLat, lng: newTargetLng },
          routeCoords,
          nearestInfo
        );
      } else {
        distanceToTurn = haversineDistance(normLoc.lat, normLoc.lng, newTargetLat, newTargetLng);
      }
    } else {
      distanceToTurn = typeof step.distance === 'number' ? step.distance : 0;
    }
  }

  const nextStepObj = activeIndex + 1 < steps.length ? steps[activeIndex + 1] : null;
  const visuals = resolveManeuverVisuals(step.maneuverType || step.maneuver?.type, step.modifier || step.maneuver?.modifier);
  const normalizedManeuver = normalizeManeuver(step.maneuverType || step.maneuver?.type, step.modifier || step.maneuver?.modifier);
  const guidanceBand = getGuidanceBand(distanceToTurn);

  return {
    instruction: step.instruction || `${visuals.text} ${step.roadName ? 'onto ' + step.roadName : ''}`.trim(),
    maneuverType: step.maneuverType || step.maneuver?.type || 'turn',
    modifier: step.modifier || step.maneuver?.modifier || '',
    roadName: step.roadName || '',
    distanceToManeuver: Math.round(distanceToTurn),
    distanceToManeuverFormatted: formatNavDistance(distanceToTurn),
    stepIndex: activeIndex,
    stepAdvanced,
    turnDirection: visuals.turnDirection,
    normalizedManeuver,
    guidanceBand,
    icon: visuals.icon,
    currentStep: {
      ...step,
      instruction: step.instruction || visuals.text,
      turnDirection: visuals.turnDirection,
      normalizedManeuver,
      icon: visuals.icon,
    },
    nextStep: nextStepObj ? {
      ...nextStepObj,
      turnDirection: resolveManeuverVisuals(nextStepObj.maneuverType, nextStepObj.modifier).turnDirection,
      normalizedManeuver: normalizeManeuver(nextStepObj.maneuverType, nextStepObj.modifier),
    } : null,
  };
}

/**
 * Checks off-route status with hysteresis confirmation.
 * Threshold: 25 meters.
 * Requires requiredCount (default 2) consecutive readings to confirm OFF_ROUTE.
 *
 * @param {{lat: number, lng: number}} currentLocation
 * @param {Array} routeCoords
 * @param {number} currentOffRouteCount
 * @param {number} [threshold=25]
 * @param {number} [requiredCount=2]
 */
export function checkOffRouteStatus(
  currentLocation,
  routeCoords,
  currentOffRouteCount = 0,
  threshold = 25,
  requiredCount = 2
) {
  const nearest = findNearestPointOnRoute(currentLocation, routeCoords);
  const dist = nearest.distanceFromRoute;

  if (dist > threshold) {
    const newCount = currentOffRouteCount + 1;
    const isOffRoute = newCount >= requiredCount;
    return {
      isOffRoute,
      isCandidate: true,
      distanceFromRoute: dist,
      offRouteCount: newCount,
      nearestInfo: nearest,
    };
  }

  return {
    isOffRoute: false,
    isCandidate: false,
    distanceFromRoute: dist,
    offRouteCount: 0,
    nearestInfo: nearest,
  };
}

/**
 * Checks destination arrival with hysteresis confirmation.
 * Threshold: 30 meters.
 * Requires requiredCount (default 2) consecutive readings to confirm ARRIVED.
 *
 * @param {{lat: number, lng: number}} currentLocation
 * @param {{lat: number, lng: number}} destination
 * @param {number} currentArrivalCount
 * @param {number} [threshold=30]
 * @param {number} [requiredCount=2]
 */
export function checkArrivalStatus(
  currentLocation,
  destination,
  currentArrivalCount = 0,
  threshold = 30,
  requiredCount = 2
) {
  const normLoc = normalizeCoordinates(currentLocation);
  const normDest = normalizeCoordinates(destination);

  if (!normLoc || !normDest) {
    return {
      isArrived: false,
      distanceToDestination: Infinity,
      arrivalCount: 0,
    };
  }

  const dist = haversineDistance(normLoc.lat, normLoc.lng, normDest.lat, normDest.lng);

  if (dist <= threshold) {
    const newCount = currentArrivalCount + 1;
    return {
      isArrived: newCount >= requiredCount,
      distanceToDestination: Number(dist.toFixed(1)),
      arrivalCount: newCount,
    };
  }

  return {
    isArrived: false,
    distanceToDestination: Number(dist.toFixed(1)),
    arrivalCount: 0,
  };
}

/**
 * Maps OSRM / Mappls lane indication string to standardized maneuver action
 */
export function mapIndicationToManeuver(indication) {
  const ind = String(indication || '').toLowerCase().trim();
  if (ind.includes('slight left')) return 'SLIGHT_LEFT';
  if (ind.includes('slight right')) return 'SLIGHT_RIGHT';
  if (ind.includes('sharp left')) return 'TURN_LEFT';
  if (ind.includes('sharp right')) return 'TURN_RIGHT';
  if (ind.includes('left')) return 'TURN_LEFT';
  if (ind.includes('right')) return 'TURN_RIGHT';
  if (ind.includes('uturn') || ind.includes('u-turn') || ind.includes('u_turn')) return 'U_TURN';
  if (ind.includes('roundabout') || ind.includes('rotary')) return 'ROUNDABOUT';
  if (ind.includes('straight')) return 'STRAIGHT';
  return 'STRAIGHT';
}

/**
 * Extracts normalized Lane Assistance structure from active route step if available
 */
export function extractLaneAssist(step) {
  if (!step || !Array.isArray(step.intersections)) {
    return { available: false };
  }

  const interWithLanes = step.intersections.find((i) => Array.isArray(i.lanes) && i.lanes.length > 0);
  if (!interWithLanes || !Array.isArray(interWithLanes.lanes) || interWithLanes.lanes.length === 0) {
    return { available: false };
  }

  const rawLanes = interWithLanes.lanes;
  let recommendedIdx = rawLanes.findIndex((l) => l.valid === true || l.active === true);
  if (recommendedIdx === -1) recommendedIdx = 0;

  return {
    available: true,
    recommendedLane: recommendedIdx,
    totalLanes: rawLanes.length,
    lanes: rawLanes.map((l, idx) => ({
      index: idx,
      allowedManeuvers: (Array.isArray(l.indications) && l.indications.length > 0 ? l.indications : ['straight']).map(mapIndicationToManeuver),
      recommended: Boolean(l.valid || l.active || idx === recommendedIdx),
      validIndication: l.valid_indication || null,
    })),
  };
}

/**
 * Extracts normalized Junction / Intersection schematic info from active route step if available and approaching
 */
export function extractJunctionInfo(step, distanceToManeuver, guidanceBand) {
  if (!step || !Array.isArray(step.intersections) || step.intersections.length === 0) {
    return { available: false };
  }

  // Only display junction view when rider is within approaching distance (<=200m or approaching bands)
  const isApproaching = distanceToManeuver <= 200 || ['APPROACHING', 'SOON', 'IMMEDIATE', 'NOW'].includes(guidanceBand);
  if (!isApproaching) {
    return { available: false };
  }

  // Prefer intersection with multiple bearings and road connections
  const inter = step.intersections.find((i) => Array.isArray(i.bearings) && i.bearings.length >= 2) || step.intersections[0];
  if (!inter || !Array.isArray(inter.bearings) || inter.bearings.length < 2) {
    return { available: false };
  }

  const inIdx = Number.isInteger(inter.in) ? inter.in : null;
  const outIdx = Number.isInteger(inter.out) ? inter.out : null;

  return {
    available: true,
    bearings: inter.bearings,
    inIndex: inIdx,
    outIndex: outIdx,
    inBearing: inIdx != null ? inter.bearings[inIdx] : null,
    outBearing: outIdx != null ? inter.bearings[outIdx] : null,
    entry: Array.isArray(inter.entry) ? inter.entry : [],
    distanceToJunction: distanceToManeuver,
    maneuver: normalizeManeuver(step.maneuverType, step.modifier),
    currentRoad: step.currentRoad || '',
    nextRoad: step.roadName || '',
  };
}

/**
 * Extracts traffic congestion status from route data if available from Mappls
 */
export function extractTrafficInfo(routeData, rawResponse) {
  const route = rawResponse?.routes?.[0];
  const leg = route?.legs?.[0];

  const congestion = leg?.annotation?.congestion || route?.traffic;
  const durationTypical = route?.duration_typical || leg?.duration_typical;
  const durationNormal = route?.duration || leg?.duration;

  if (congestion || (durationTypical && durationNormal && durationTypical > durationNormal)) {
    let level = 'LOW';
    if (congestion === 'heavy' || congestion === 'severe') level = 'SEVERE';
    else if (congestion === 'moderate') level = 'MODERATE';
    else if (durationTypical && durationNormal && durationTypical - durationNormal > 180) level = 'HIGH';

    const delay = Math.max(0, (durationTypical || durationNormal) - durationNormal);
    return {
      available: true,
      level,
      delaySeconds: Math.round(delay),
      delayFormatted: delay >= 60 ? `${Math.round(delay / 60)} min` : `${Math.round(delay)} s`,
    };
  }

  return {
    available: false,
  };
}

/**
 * Main Navigation Engine Processor:
 * Processes latest GPS update, computes real-time route progress, remaining distance/duration,
 * next maneuver, off-route hysteresis, and arrival detection.
 *
 * @param {Object} params
 * @param {{latitude: number, longitude: number}|{lat: number, lng: number}} params.currentLocation
 * @param {Object} params.destination
 * @param {Object} params.routeData
 * @param {number} [params.currentStepIndex=0]
 * @param {number} [params.offRouteCount=0]
 * @param {number} [params.arrivalCount=0]
 * @param {boolean} [params.isRerouting=false]
 * @param {boolean} [params.isNavigating=true]
 * @param {number} [params.offRouteThreshold=25]
 * @param {number} [params.arrivalThreshold=30]
 * @returns {Object} Complete real-time navigation state
 */
export function processNavigationTick({
  currentLocation,
  destination,
  routeData,
  currentStepIndex = 0,
  offRouteCount = 0,
  arrivalCount = 0,
  prevProgress = 0,
  isRerouting = false,
  isNavigating = true,
  offRouteThreshold = 25,
  arrivalThreshold = 30,
}) {
  const normLoc = normalizeCoordinates(currentLocation);
  const normDest = normalizeCoordinates(destination);

  if (!routeData || !normLoc || !normDest) {
    return {
      isNavigating: Boolean(isNavigating),
      navigationStatus: isRerouting ? 'REROUTING' : 'IDLE',
      currentLocation: normLoc,
      destination: normDest,
      distanceRemaining: 0,
      distanceRemainingFormatted: '0 m',
      durationRemaining: 0,
      durationRemainingFormatted: '0 min',
      progress: 0,
      currentStepIndex: 0,
      totalSteps: 0,
      nextInstruction: '',
      nextManeuver: 'CONTINUE',
      nextRoadName: '',
      distanceToManeuver: 0,
      distanceToManeuverFormatted: '0 m',
      offRoute: false,
      offRouteDistance: 0,
      offRouteCount: 0,
      isRerouting: Boolean(isRerouting),
      arrived: false,
      arrivalCount: 0,
      guidanceBand: 'NORMAL',
      laneAssist: { available: false },
      junctionInfo: { available: false },
      trafficInfo: { available: false },
      navigationGuidance: {
        currentStepIndex: 0,
        totalSteps: 0,
        nextInstruction: '',
        nextManeuver: 'CONTINUE',
        nextRoadName: '',
        distanceToManeuver: 0,
        distanceToManeuverFormatted: '0 m',
        remainingDistance: 0,
        remainingDistanceFormatted: '0 m',
        remainingDuration: 0,
        remainingDurationFormatted: '0 min',
        progress: 0,
        navigationStatus: isRerouting ? 'REROUTING' : 'IDLE',
        offRoute: false,
        isRerouting: Boolean(isRerouting),
        arrived: false,
        guidanceBand: 'NORMAL',
        laneAssist: { available: false },
        junctionInfo: { available: false },
        trafficInfo: { available: false },
      },
    };
  }

  const pts = extractPointsList(routeData);
  const totalSteps = Array.isArray(routeData.steps) ? routeData.steps.length : 0;

  // 1. Check Arrival Confirmation
  const arrival = checkArrivalStatus(normLoc, normDest, arrivalCount, arrivalThreshold, 2);
  if (arrival.isArrived) {
    const arrivalStepIdx = totalSteps > 0 ? totalSteps - 1 : 0;
    const arrivalGuidance = {
      currentStepIndex: arrivalStepIdx,
      totalSteps,
      nextInstruction: 'You have arrived at your destination',
      nextManeuver: 'ARRIVE',
      nextRoadName: destination?.name || destination?.address || '',
      distanceToManeuver: 0,
      distanceToManeuverFormatted: '0 m',
      remainingDistance: 0,
      remainingDistanceFormatted: '0 m',
      remainingDuration: 0,
      remainingDurationFormatted: '0 min',
      progress: 100,
      navigationStatus: 'ARRIVED',
      offRoute: false,
      isRerouting: false,
      arrived: true,
      guidanceBand: 'ARRIVED',
      laneAssist: { available: false },
      junctionInfo: { available: false },
      trafficInfo: { available: false },
    };

    return {
      isNavigating: false,
      navigationStatus: 'ARRIVED',
      currentLocation: normLoc,
      destination: normDest,
      distanceRemaining: 0,
      distanceRemainingFormatted: '0 m',
      durationRemaining: 0,
      durationRemainingFormatted: '0 min',
      progress: 100,
      currentStepIndex: arrivalStepIdx,
      totalSteps,
      nextInstruction: 'You have arrived at your destination',
      nextManeuver: 'ARRIVE',
      nextRoadName: destination?.name || destination?.address || '',
      distanceToManeuver: 0,
      distanceToManeuverFormatted: '0 m',
      offRoute: false,
      offRouteDistance: 0,
      offRouteCount: 0,
      isRerouting: false,
      arrived: true,
      arrivalCount: arrival.arrivalCount,
      guidanceBand: 'ARRIVED',
      laneAssist: { available: false },
      junctionInfo: { available: false },
      trafficInfo: { available: false },
      navigationGuidance: arrivalGuidance,
      // Compatibility aliases
      activeStepIndex: arrivalStepIdx,
      distanceToNextTurn: 0,
      distanceToNextTurnFormatted: '0 m',
      remainingDistance: 0,
      remainingDistanceFormatted: '0 m',
      eta: '0 min',
      etaMinutes: 0,
      isDestinationReached: true,
      isOffRoute: false,
      currentStep: {
        instruction: 'Arrived at destination',
        turnDirection: 'arrive',
        normalizedManeuver: 'ARRIVE',
        roadName: destination?.name || '',
      },
      nextStep: null,
      stepAdvanced: false,
    };
  }

  // 2. Off-Route Check with Hysteresis
  const offRoute = checkOffRouteStatus(normLoc, pts, offRouteCount, offRouteThreshold, 2);

  // 3. Nearest Point and Progress on Actual Mappls Geometry
  const nearestInfo = offRoute.nearestInfo || findNearestPointOnRoute(normLoc, pts);
  const remainingDistance = calculateRemainingDistance(normLoc, pts, nearestInfo);
  const totalDistance = routeData.distance || calculateTotalRouteDistance(pts) || 1;
  let progress = calculateRouteProgress(normLoc, pts, nearestInfo, totalDistance);

  // Enforce monotonicity: tiny GPS noise must not make progress decrease along same route
  if (!isRerouting && !offRoute.isOffRoute && prevProgress > 0 && progress < prevProgress) {
    progress = prevProgress;
  }
  progress = Math.max(0, Math.min(100, progress));

  // 4. Remaining Duration (ETA based on Mappls route duration)
  const totalDuration = routeData.duration || 60;
  const durationRatio = Math.max(0, Math.min(1, remainingDistance / totalDistance));
  const remainingDuration = Math.round(totalDuration * durationRatio);

  // 5. Determine Next Maneuver from Mappls Steps
  const maneuver = determineNextManeuver(
    normLoc,
    routeData.steps || [],
    pts,
    currentStepIndex,
    nearestInfo
  );

  let navStatus = 'NAVIGATING';
  if (isRerouting) {
    navStatus = 'REROUTING';
  } else if (offRoute.isOffRoute) {
    navStatus = 'OFF_ROUTE';
  }

  const distanceRemainingFormatted = formatNavDistance(remainingDistance);
  const durationRemainingFormatted = formatNavDuration(remainingDuration);

  const activeStep = routeData.steps?.[maneuver.stepIndex] || maneuver.currentStep || null;
  const laneAssist = extractLaneAssist(activeStep);
  const junctionInfo = extractJunctionInfo(activeStep, maneuver.distanceToManeuver, maneuver.guidanceBand);
  const trafficInfo = extractTrafficInfo(routeData, routeData.rawResponse);

  const navigationGuidance = {
    currentStepIndex: maneuver.stepIndex,
    totalSteps,
    nextInstruction: maneuver.instruction,
    nextManeuver: maneuver.normalizedManeuver,
    nextRoadName: maneuver.roadName || '',
    distanceToManeuver: maneuver.distanceToManeuver,
    distanceToManeuverFormatted: maneuver.distanceToManeuverFormatted,
    remainingDistance: Math.round(remainingDistance),
    remainingDistanceFormatted: distanceRemainingFormatted,
    remainingDuration: remainingDuration,
    remainingDurationFormatted: durationRemainingFormatted,
    progress,
    navigationStatus: navStatus,
    offRoute: offRoute.isOffRoute,
    isRerouting: Boolean(isRerouting),
    arrived: false,
    guidanceBand: maneuver.guidanceBand,
    laneAssist,
    junctionInfo,
    trafficInfo,
  };

  return {
    isNavigating: true,
    navigationStatus: navStatus,
    currentLocation: normLoc,
    destination: normDest,
    distanceRemaining: Math.round(remainingDistance),
    distanceRemainingFormatted,
    durationRemaining: remainingDuration,
    durationRemainingFormatted,
    progress,
    currentStepIndex: maneuver.stepIndex,
    totalSteps,
    nextInstruction: maneuver.instruction,
    nextManeuver: maneuver.normalizedManeuver,
    nextRoadName: maneuver.roadName || '',
    distanceToManeuver: maneuver.distanceToManeuver,
    distanceToManeuverFormatted: maneuver.distanceToManeuverFormatted,
    guidanceBand: maneuver.guidanceBand,
    laneAssist,
    junctionInfo,
    trafficInfo,
    offRoute: offRoute.isOffRoute,
    offRouteDistance: offRoute.distanceFromRoute,
    offRouteCount: offRoute.offRouteCount,
    isRerouting: Boolean(isRerouting),
    arrived: false,
    arrivalCount: arrival.arrivalCount,
    nearestPointOnRoute: nearestInfo.nearestPoint,
    currentStep: maneuver.currentStep,
    nextStep: maneuver.nextStep,
    stepAdvanced: maneuver.stepAdvanced,
    navigationGuidance,

    // Backward-compatibility properties consumed by voiceNavigation & TFT dispatcher
    activeStepIndex: maneuver.stepIndex,
    distanceToNextTurn: maneuver.distanceToManeuver,
    distanceToNextTurnFormatted: maneuver.distanceToManeuverFormatted,
    remainingDistance: Math.round(remainingDistance),
    remainingDistanceFormatted: distanceRemainingFormatted,
    eta: durationRemainingFormatted,
    etaMinutes: Math.max(1, Math.round(remainingDuration / 60)),
    isDestinationReached: false,
    isOffRoute: offRoute.isOffRoute,
  };
}

export default {
  haversineDistance,
  projectPointOnSegment,
  extractPointsList,
  findNearestPointOnRoute,
  calculateRemainingDistance,
  calculateTotalRouteDistance,
  calculateRouteProgress,
  calculateDistanceAlongRoute,
  validateRouteGeometry,
  formatNavDistance,
  formatNavDuration,
  resolveManeuverVisuals,
  normalizeManeuver,
  getGuidanceBand,
  determineNextManeuver,
  checkOffRouteStatus,
  checkArrivalStatus,
  processNavigationTick,
  mapIndicationToManeuver,
  extractLaneAssist,
  extractJunctionInfo,
  extractTrafficInfo,
};
