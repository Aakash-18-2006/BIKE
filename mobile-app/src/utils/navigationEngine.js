/**
 * Turn-by-Turn Navigation Engine for Smart Bike Companion App
 * Parses Mappls route steps, calculates distance to maneuvers, advances steps,
 * and monitors off-route telemetry without hardcoded mocks.
 */

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
 * Computes shortest distance in meters from a point to a line segment
 */
function pointToSegmentDistance(lat, lng, latA, lngA, latB, lngB) {
  const midLat = ((latA + latB) / 2) * (Math.PI / 180);
  const xB = (lngB - lngA) * (Math.PI / 180) * 6371000 * Math.cos(midLat);
  const yB = (latB - latA) * (Math.PI / 180) * 6371000;
  const xP = (lng - lngA) * (Math.PI / 180) * 6371000 * Math.cos(midLat);
  const yP = (lat - latA) * (Math.PI / 180) * 6371000;

  const l2 = xB * xB + yB * yB;
  if (l2 === 0) return Math.hypot(xP, yP);

  const t = Math.max(0, Math.min(1, (xP * xB + yP * yB) / l2));
  return Math.hypot(xP - t * xB, yP - t * yB);
}

/**
 * Computes shortest distance in meters from current GPS to the route polyline
 */
export function pointToPolylineDistance(point, coordinates) {
  if (!point || !Array.isArray(coordinates) || coordinates.length < 2) return 0;

  let minDistance = Infinity;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const dist = pointToSegmentDistance(point.latitude, point.longitude, p1.lat, p1.lng, p2.lat, p2.lng);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance === Infinity ? 0 : minDistance;
}

/**
 * Formats distance with sensible rounding
 */
export function formatNavDistance(meters) {
  if (meters == null || isNaN(meters)) return '0 m';
  if (meters < 50) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats duration in minutes / hours
 */
export function formatNavDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '1 min';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
  }
  return `${mins} min`;
}

/**
 * Parses official Mappls route steps into structured maneuvers
 */
export function parseRouteSteps(rawSteps) {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return [];

  return rawSteps.map((s, idx) => {
    const type = s.maneuver?.type || 'turn';
    const modifier = s.maneuver?.modifier || '';
    const loc = s.maneuver?.location;
    const latitude = loc && loc.length >= 2 ? loc[1] : 0;
    const longitude = loc && loc.length >= 2 ? loc[0] : 0;
    const roadName = s.name || s.ref || '';

    let instruction = '';
    let icon = '↑';
    let turnDirection = 'straight';

    if (type === 'depart') {
      instruction = roadName ? `Head towards ${roadName}` : 'Depart on route';
      icon = '🧭';
      turnDirection = 'depart';
    } else if (type === 'arrive') {
      instruction = 'Arrive at destination';
      icon = '🏁';
      turnDirection = 'arrive';
    } else if (type === 'roundabout') {
      instruction = roadName ? `Enter roundabout towards ${roadName}` : 'Enter roundabout';
      icon = '🔄';
      turnDirection = 'roundabout';
    } else if (type === 'fork') {
      instruction = modifier
        ? `Keep ${modifier} at fork${roadName ? ' onto ' + roadName : ''}`
        : `Stay on route at fork`;
      icon = modifier?.includes('left') ? '↖' : '↗';
      turnDirection = modifier?.includes('left') ? 'slight left' : 'slight right';
    } else if (type === 'merge') {
      instruction = modifier
        ? `Merge ${modifier}${roadName ? ' onto ' + roadName : ''}`
        : `Merge onto ${roadName || 'road'}`;
      icon = modifier?.includes('left') ? '↖' : '↗';
      turnDirection = modifier?.includes('left') ? 'slight left' : 'slight right';
    } else if (type === 'turn') {
      if (modifier === 'left') {
        instruction = `Turn left${roadName ? ' onto ' + roadName : ''}`;
        icon = '↰';
        turnDirection = 'left';
      } else if (modifier === 'right') {
        instruction = `Turn right${roadName ? ' onto ' + roadName : ''}`;
        icon = '↱';
        turnDirection = 'right';
      } else if (modifier === 'sharp left') {
        instruction = `Sharp left${roadName ? ' onto ' + roadName : ''}`;
        icon = '⮌';
        turnDirection = 'sharp left';
      } else if (modifier === 'sharp right') {
        instruction = `Sharp right${roadName ? ' onto ' + roadName : ''}`;
        icon = '⮍';
        turnDirection = 'sharp right';
      } else if (modifier === 'slight left') {
        instruction = `Slight left${roadName ? ' onto ' + roadName : ''}`;
        icon = '↖';
        turnDirection = 'slight left';
      } else if (modifier === 'slight right') {
        instruction = `Slight right${roadName ? ' onto ' + roadName : ''}`;
        icon = '↗';
        turnDirection = 'slight right';
      } else if (modifier === 'uturn') {
        instruction = `Make a U-turn${roadName ? ' onto ' + roadName : ''}`;
        icon = '↩';
        turnDirection = 'uturn';
      } else {
        instruction = `Turn${modifier ? ' ' + modifier : ''}${roadName ? ' onto ' + roadName : ''}`;
        icon = '↱';
        turnDirection = modifier || 'turn';
      }
    } else if (type === 'continue') {
      instruction = modifier && modifier !== 'straight'
        ? `Continue ${modifier}${roadName ? ' on ' + roadName : ''}`
        : `Continue straight${roadName ? ' on ' + roadName : ''}`;
      icon = modifier?.includes('left') ? '↖' : modifier?.includes('right') ? '↗' : '↑';
      turnDirection = modifier || 'straight';
    } else {
      instruction = `${type} ${modifier}${roadName ? ' onto ' + roadName : ''}`.trim();
      icon = '↑';
      turnDirection = modifier || type;
    }

    return {
      index: idx,
      maneuverType: type,
      modifier,
      turnDirection,
      location: { latitude, longitude },
      roadName,
      distance: s.distance || 0,
      duration: s.duration || 0,
      instruction,
      icon,
    };
  });
}

/**
 * Computes active navigation state and updates step advancement
 *
 * @param {Object} params
 * @param {{latitude: number, longitude: number}} params.currentLocation
 * @param {Object} params.destination
 * @param {Object} params.route
 * @param {number} params.currentStepIndex
 * @param {number} [params.stepArrivalThreshold=35] - Arrival tolerance in meters
 * @param {number} [params.offRouteThreshold=70] - Distance in meters before off-route trigger
 */
export function computeNavigationTelemetry({
  currentLocation,
  destination,
  route,
  currentStepIndex = 0,
  stepArrivalThreshold = 35,
  offRouteThreshold = 70,
}) {
  if (!route || !Array.isArray(route.steps) || route.steps.length === 0) {
    return {
      isNavigating: false,
      currentLocation,
      destination,
      route,
      currentStep: null,
      nextStep: null,
      distanceToNextTurn: 0,
      distanceToNextTurnFormatted: '0 m',
      remainingDistance: 0,
      remainingDistanceFormatted: '0 m',
      eta: '0 min',
      etaMinutes: 0,
      isDestinationReached: false,
      isOffRoute: false,
      offRouteDistance: 0,
      activeStepIndex: 0,
    };
  }

  const steps = parseRouteSteps(route.steps);
  let activeIndex = Math.min(Math.max(0, currentStepIndex), steps.length - 1);

  // Determine current and next steps
  let currentStep = steps[activeIndex];
  let nextStep = activeIndex + 1 < steps.length ? steps[activeIndex + 1] : null;

  // 1. Calculate distance from user to current step maneuver
  const targetLat = currentStep.location.latitude || destination.latitude;
  const targetLng = currentStep.location.longitude || destination.longitude;

  let distanceToTurn = currentLocation
    ? haversineDistance(currentLocation.latitude, currentLocation.longitude, targetLat, targetLng)
    : currentStep.distance;

  // 2. Check if user reached destination
  const distanceToFinalDest = currentLocation && destination
    ? haversineDistance(currentLocation.latitude, currentLocation.longitude, destination.latitude, destination.longitude)
    : 100;

  const isDestinationReached =
    (activeIndex >= steps.length - 1 && distanceToTurn <= stepArrivalThreshold) ||
    distanceToFinalDest <= stepArrivalThreshold ||
    currentStep.maneuverType === 'arrive';

  // 3. Step advancement check (if within arrival tolerance of step maneuver and not at destination)
  let stepAdvanced = false;
  if (!isDestinationReached && distanceToTurn <= stepArrivalThreshold && activeIndex + 1 < steps.length) {
    activeIndex += 1;
    currentStep = steps[activeIndex];
    nextStep = activeIndex + 1 < steps.length ? steps[activeIndex + 1] : null;
    stepAdvanced = true;

    // Recalculate distance to newly advanced step
    const newTargetLat = currentStep.location.latitude || destination.latitude;
    const newTargetLng = currentStep.location.longitude || destination.longitude;
    distanceToTurn = currentLocation
      ? haversineDistance(currentLocation.latitude, currentLocation.longitude, newTargetLat, newTargetLng)
      : currentStep.distance;
  }

  // 4. Calculate total remaining distance
  let remainingMeters = distanceToTurn;
  for (let i = activeIndex + 1; i < steps.length; i++) {
    remainingMeters += steps[i].distance;
  }

  // 5. Calculate remaining ETA
  const totalMeters = route.distanceMeters || remainingMeters || 1;
  const totalDurationSeconds = route.durationSeconds || 60;
  const progressRatio = Math.max(0, Math.min(1, remainingMeters / totalMeters));
  const remainingSeconds = totalDurationSeconds * progressRatio;
  const etaFormatted = formatNavDuration(remainingSeconds);
  const etaMinutes = Math.max(1, Math.round(remainingSeconds / 60));

  // 6. Check off-route detection against route coordinates
  let isOffRoute = false;
  let offRouteDistance = 0;
  if (currentLocation && Array.isArray(route.coordinates) && route.coordinates.length > 1) {
    offRouteDistance = pointToPolylineDistance(currentLocation, route.coordinates);
    if (offRouteDistance > offRouteThreshold && !isDestinationReached) {
      isOffRoute = true;
    }
  }

  return {
    isNavigating: true,
    currentLocation,
    destination,
    route,
    currentStep,
    nextStep,
    distanceToNextTurn: Math.round(distanceToTurn),
    distanceToNextTurnFormatted: formatNavDistance(distanceToTurn),
    remainingDistance: Math.round(remainingMeters),
    remainingDistanceFormatted: formatNavDistance(remainingMeters),
    eta: etaFormatted,
    etaMinutes,
    isDestinationReached,
    isOffRoute,
    offRouteDistance: Math.round(offRouteDistance),
    activeStepIndex: activeIndex,
    stepAdvanced,
    // Clean data structure prepared for future TFT / telemetry transmission:
    telemetryPacket: {
      type: 'navigation_update',
      maneuver: currentStep.turnDirection,
      instruction: currentStep.instruction,
      roadName: currentStep.roadName || '',
      distanceToTurn: Math.round(distanceToTurn),
      remainingDistance: Math.round(remainingMeters),
      etaMinutes,
      isDestinationReached,
      isOffRoute,
    },
  };
}
