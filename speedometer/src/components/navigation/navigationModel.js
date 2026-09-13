/**
 * Navigation Data Model & Mobile App Interface for Smart Bike TFT
 * 
 * Prepares real-time data flow for:
 * 1. Mappls (MapmyIndia) Navigation Engine with Biking / Two-Wheeler Routing
 * 2. Mobile Companion App sync via WebSocket / BLE / REST ('navigation_update' event)
 * 3. Fallback mock navigation data centered around Bengaluru and MG Road
 * 
 * NOTE ON SECURITY:
 * Use VITE_MAPPLS_API_KEY from environment variables.
 * Never embed backend or server secret credentials in the client-side bundle.
 */

export const SAMPLE_NAVIGATION_DATA = {
  active: true,
  status: 'NAVIGATING', // 'IDLE' | 'NAVIGATING' | 'REROUTING' | 'ARRIVED'
  currentLocation: {
    lat: 12.9716,
    lng: 77.5946,
    heading: 82, // heading in degrees (0 = North, 90 = East, 180 = South, 270 = West)
    headingDeg: 82,
    city: 'Bengaluru',
    area: 'Kasturba Road / Cubbon Park',
  },
  destination: {
    lat: 12.9756,
    lng: 77.6066,
    name: 'MG Road',
    address: 'Mahatma Gandhi Road, Bengaluru, Karnataka 560001',
  },
  nextTurn: {
    instruction: 'Turn right onto MG Road',
    distanceMeters: 450,
    streetName: 'MG Road',
    action: 'RIGHT', // 'RIGHT' | 'LEFT' | 'STRAIGHT' | 'SLIGHT_RIGHT' | 'SLIGHT_LEFT' | 'UTURN'
    distanceFormatted: '450 m',
  },
  remainingDistanceKm: 8.4,
  eta: '12:48',
  route: {
    totalDistanceKm: 8.4,
    distanceRemainingKm: 8.4,
    distanceRemainingFormatted: '8.4 km',
    eta: '12:48',
    estimatedMinutes: 18,
    speedLimitKm: 60,
    trafficLevel: 'LIGHT', // 'LIGHT' | 'MODERATE' | 'HEAVY'
    polyline: [
      { lat: 12.9716, lng: 77.5946, name: 'Start: Kasturba Road' },
      { lat: 12.9725, lng: 77.5980, name: 'Queens Road Junction' },
      { lat: 12.9738, lng: 77.6015, name: 'Anil Kumble Circle' },
      { lat: 12.9750, lng: 77.6045, name: 'Brigade Road Intersection' },
      { lat: 12.9756, lng: 77.6066, name: 'Destination: MG Road' },
    ],
  },
  gps: {
    fixType: '3D_FIX',
    satellites: 12,
    accuracyMeters: 2.1,
    connected: true,
  },
};

/**
 * Maps any maneuver string or instruction to high-contrast TFT vector action
 */
export function mapManeuverToAction(maneuver, instruction = '') {
  const m = String(maneuver || '').toLowerCase().trim();
  const ins = String(instruction || '').toLowerCase();

  if (m === 'arrive' || m === 'arrived' || ins.includes('arrive')) return 'ARRIVED';
  if (m.includes('uturn') || m.includes('u_turn') || m.includes('u-turn') || ins.includes('u-turn') || ins.includes('uturn')) return 'UTURN';
  if (m.includes('roundabout') || ins.includes('roundabout')) return 'ROUNDABOUT';
  if (m.includes('merge') || ins.includes('merge')) return 'MERGE';
  if (m.includes('exit') || ins.includes('exit') || m.includes('off ramp')) return 'EXIT';
  if (m === 'slight right' || m === 'slight_right' || ins.includes('slight right')) return 'SLIGHT_RIGHT';
  if (m === 'slight left' || m === 'slight_left' || ins.includes('slight left')) return 'SLIGHT_LEFT';
  if (m.includes('sharp right') || m === 'sharp_right' || ins.includes('sharp right')) return 'RIGHT';
  if (m.includes('sharp left') || m === 'sharp_left' || ins.includes('sharp left')) return 'LEFT';
  if (m.includes('right') || ins.includes('right')) return 'RIGHT';
  if (m.includes('left') || ins.includes('left')) return 'LEFT';
  if (m.includes('straight') || m.includes('depart') || ins.includes('continue') || ins.includes('straight')) return 'STRAIGHT';

  return 'STRAIGHT';
}

// Hardware Connection States for physical / embedded cluster
export const TFT_HARDWARE_CONNECTION_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
};

/**
 * Validates latitude and longitude ranges.
 * Rejects NaN, Infinity, and impossible coordinates.
 */
export function isValidCoordinate(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
         typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * Strips invalid strings, 'undefined', 'null', '[object Object]' to protect physical display.
 */
export function sanitizeText(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (s === '' || s === 'undefined' || s === 'null' || s === '[object Object]') return fallback;
  return s;
}

/**
 * Rejects NaN and Infinity, returning fallback number.
 */
export function sanitizeNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// Stateful session & sequence tracking on TFT receiver side
let tftActiveSessionId = null;
let tftLatestSequence = 0;
let tftLatestTimestamp = 0;
const tftSupersededSessions = new Set();

export function resetTftSessionTracking() {
  tftActiveSessionId = null;
  tftLatestSequence = 0;
  tftLatestTimestamp = 0;
  tftSupersededSessions.clear();
}

export function getTftSessionState() {
  return {
    activeSessionId: tftActiveSessionId,
    latestSequence: tftLatestSequence,
    latestTimestamp: tftLatestTimestamp,
    supersededSessions: Array.from(tftSupersededSessions),
  };
}

/**
 * Normalizes incoming navigation payloads from mobile app or WebSocket
 * into a consistent, robust schema for the TFT display.
 * 
 * Supports both flattened mobile updates and nested objects.
 */
export function normalizeNavigationUpdate(payload, prev = SAMPLE_NAVIGATION_DATA) {
  if (!payload || typeof payload !== 'object') return prev;

  const sessionId = payload.navigationSessionId;
  const seq = Number.isFinite(payload.sequence) ? payload.sequence : null;

  // Stale Packet & Session Protection (Steps 8 & 9 Hardware Reliability)
  if (sessionId) {
    // Malformed packet check: non-finite sequence or timestamp when explicit session given
    if (payload.sequence !== undefined && !Number.isFinite(payload.sequence)) {
      console.warn(`[TFT HW] REJECT malformed sequence in packet for session ${sessionId}:`, payload.sequence);
      return prev;
    }
    if (payload.timestamp !== undefined && !Number.isFinite(payload.timestamp)) {
      console.warn(`[TFT HW] REJECT malformed timestamp in packet for session ${sessionId}:`, payload.timestamp);
      return prev;
    }

    if (tftSupersededSessions.has(sessionId)) {
      console.warn(`[TFT] REJECT old navigation session: ${sessionId}`);
      return prev;
    }

    if (tftActiveSessionId && sessionId !== tftActiveSessionId) {
      // New destination / new navigation session supersedes the old one!
      tftSupersededSessions.add(tftActiveSessionId);
      tftActiveSessionId = sessionId;
      tftLatestSequence = seq != null ? seq : 0;
      tftLatestTimestamp = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();
      console.log(`[TFT] ACCEPT new session: ${sessionId} seq=${tftLatestSequence}`);
      // Clear out old route state for new session
      prev = {
        ...prev,
        route: {
          ...prev.route,
          geometry: [],
          polyline: [],
          totalSteps: 0,
        },
        nextTurn: {
          ...prev.nextTurn,
          laneAssist: { available: false },
          junctionInfo: { available: false },
        },
      };
    } else if (!tftActiveSessionId) {
      tftActiveSessionId = sessionId;
      tftLatestSequence = seq != null ? seq : 0;
      tftLatestTimestamp = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();
      console.log(`[TFT] ACCEPT initial session: ${sessionId} seq=${tftLatestSequence}`);
    } else {
      // Same active session: verify sequence
      if (seq != null) {
        if (seq <= tftLatestSequence) {
          console.warn(`[TFT] REJECT stale packet session=${sessionId} seq=${seq} <= latest=${tftLatestSequence}`);
          return prev;
        }
        tftLatestSequence = seq;
        tftLatestTimestamp = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();
        console.log(`[TFT] ACCEPT packet session=${sessionId} seq=${seq}`);
      }
    }
  }

  const currentLoc = payload.currentLocation || payload.current || {};
  const candLat = Number(currentLoc.lat ?? currentLoc.latitude ?? payload.lat);
  const candLng = Number(currentLoc.lng ?? currentLoc.longitude ?? payload.lng);
  const validCurrentCoord = isValidCoordinate(candLat, candLng);
  const lat = validCurrentCoord ? candLat : prev.currentLocation.lat;
  const lng = validCurrentCoord ? candLng : prev.currentLocation.lng;

  const candHeading = Number(currentLoc.heading ?? currentLoc.headingDeg ?? payload.heading ?? payload.headingDeg);
  const heading = Number.isFinite(candHeading) ? candHeading : prev.currentLocation.heading;

  const dest = payload.destination || {};
  const candDestLat = Number(dest.lat ?? dest.latitude ?? payload.destLat);
  const candDestLng = Number(dest.lng ?? dest.longitude ?? payload.destLng);
  const validDestCoord = isValidCoordinate(candDestLat, candDestLng);
  const destLat = validDestCoord ? candDestLat : prev.destination.lat;
  const destLng = validDestCoord ? candDestLng : prev.destination.lng;
  const destName = sanitizeText(dest.name || payload.destinationName || prev.destination.name, 'Destination');

  let active = prev.active;
  let status = prev.status;
  const isArrived = Boolean(payload.isDestinationReached || payload.maneuver === 'arrived');

  if (isArrived) {
    status = 'ARRIVED';
    active = false;
  } else if (payload.isNavigating !== undefined) {
    active = Boolean(payload.isNavigating);
    status = active ? 'NAVIGATING' : 'IDLE';
  } else if (payload.active !== undefined) {
    active = Boolean(payload.active);
  }
  if (payload.navigationStatus) {
    status = payload.navigationStatus;
  } else if (payload.status) {
    status = payload.status;
  }

  // Handle explicit STOPPED lifecycle status
  const isStopped = status === 'STOPPED' || (payload.isNavigating === false && !isArrived && status !== 'ARRIVED');
  if (isStopped) {
    return {
      ...prev,
      active: false,
      isNavigating: false,
      status: 'IDLE',
      navigationStatus: 'STOPPED',
      isRerouting: false,
      isDestinationReached: false,
      arrived: false,
      stepIndex: 0,
      currentLocation: {
        ...prev.currentLocation,
        ...currentLoc,
        lat,
        lng,
        heading,
        headingDeg: heading,
        city: sanitizeText(currentLoc.city || prev.currentLocation.city, 'Bengaluru'),
        area: sanitizeText(currentLoc.area || prev.currentLocation.area, ''),
      },
      destination: {
        ...prev.destination,
        name: '',
        lat: null,
        lng: null,
      },
      nextTurn: {
        ...prev.nextTurn,
        instruction: '',
        distanceMeters: 0,
        distanceFormatted: '--',
        streetName: '',
        action: 'STRAIGHT',
        laneAssist: { available: false },
        junctionInfo: { available: false },
      },
      trafficInfo: { available: false },
      remainingDistanceKm: 0,
      eta: '--',
      route: {
        ...prev.route,
        distanceRemainingKm: 0,
        distanceRemainingFormatted: '--',
        eta: '--',
        geometry: [],
        polyline: [],
        totalSteps: 0,
      },
      gps: {
        ...prev.gps,
        ...(payload.gps || {}),
      },
    };
  }

  const nextTurn = payload.nextTurn || {};
  let instruction = '';
  let streetName = '';
  let action = 'STRAIGHT';
  let distanceMeters = 0;
  let distanceFormatted = '--';
  let remainingKm = 0;
  let remainingFormatted = '--';
  let etaFormatted = '--';
  let routeGeom = [];
  let totalSteps = 0;
  let stepIndex = 0;

  if (status === 'ARRIVED') {
    instruction = 'Destination reached';
    streetName = destName || 'Destination';
    action = 'ARRIVED';
    distanceMeters = 0;
    distanceFormatted = '0 m';
    remainingKm = 0;
    remainingFormatted = '0 km';
    etaFormatted = 'Arrived';
    routeGeom = [];
    totalSteps = 0;
    stepIndex = 0;
  } else if (active) {
    distanceMeters = Number.isFinite(payload.distanceToTurn)
      ? payload.distanceToTurn
      : (Number.isFinite(nextTurn.distanceMeters)
        ? nextTurn.distanceMeters
        : (Number.isFinite(payload.distanceMeters) ? payload.distanceMeters : (prev.nextTurn?.distanceMeters ?? 0)));

    distanceMeters = sanitizeNumber(distanceMeters, 0);
    distanceFormatted = sanitizeText(nextTurn.distanceFormatted, distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters)} m`);
    instruction = sanitizeText(payload.instruction || nextTurn.instruction || prev.nextTurn?.instruction, '');
    streetName = sanitizeText(payload.roadName || nextTurn.streetName || payload.streetName || prev.nextTurn?.streetName, '');
    action = mapManeuverToAction(payload.maneuver || nextTurn.action, instruction);

    if (Number.isFinite(payload.remainingDistance)) {
      remainingKm = Number((payload.remainingDistance / 1000).toFixed(1));
      remainingFormatted = payload.remainingDistance >= 1000
        ? `${(payload.remainingDistance / 1000).toFixed(1)} km`
        : `${Math.round(payload.remainingDistance)} m`;
    } else if (Number.isFinite(payload.remainingDistanceKm)) {
      remainingKm = payload.remainingDistanceKm;
      remainingFormatted = `${remainingKm} km`;
    } else if (payload.route?.distanceRemainingKm !== undefined && Number.isFinite(payload.route.distanceRemainingKm)) {
      remainingKm = payload.route.distanceRemainingKm;
      remainingFormatted = `${remainingKm} km`;
    } else {
      remainingKm = sanitizeNumber(prev.remainingDistanceKm, 0);
      remainingFormatted = `${remainingKm} km`;
    }
    remainingKm = sanitizeNumber(remainingKm, 0);

    if (payload.etaMinutes !== undefined) {
      const mins = Number(payload.etaMinutes);
      if (Number.isFinite(mins)) {
        if (mins >= 60) {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          etaFormatted = m > 0 ? `${h}h ${m}m` : `${h}h`;
        } else {
          etaFormatted = `${mins} min`;
        }
      }
    } else if (payload.eta) {
      etaFormatted = sanitizeText(payload.eta, '--');
    } else if (payload.route?.eta) {
      etaFormatted = sanitizeText(payload.route.eta, '--');
    } else {
      etaFormatted = sanitizeText(prev.eta, '--');
    }

    routeGeom = Array.isArray(payload.route?.geometry)
      ? payload.route.geometry
      : (Array.isArray(payload.route?.polyline)
        ? payload.route.polyline.map((p) => [p.lng, p.lat])
        : (prev.route?.geometry || []));

    // Preserve previous route geometry during rerouting if none provided
    if (status === 'REROUTING' && (!routeGeom || routeGeom.length === 0)) {
      routeGeom = prev.route?.geometry || [];
    }

    totalSteps = Number.isFinite(payload.totalSteps)
      ? payload.totalSteps
      : (prev.route?.totalSteps || 0);

    stepIndex = Number.isFinite(payload.stepIndex)
      ? payload.stepIndex
      : (prev.stepIndex || 0);

    // If GPS is lost, preserve existing navigation progress and guidance info
    if (status === 'GPS_LOST') {
      if (!instruction) instruction = prev.nextTurn?.instruction || '';
      if (!streetName) streetName = prev.nextTurn?.streetName || '';
      if (distanceMeters === 0 && prev.nextTurn?.distanceMeters) {
        distanceMeters = prev.nextTurn.distanceMeters;
        distanceFormatted = prev.nextTurn.distanceFormatted;
      }
    }
  } else {
    // Stopped / Idle
    instruction = '';
    streetName = '';
    action = 'STRAIGHT';
    distanceMeters = 0;
    distanceFormatted = '--';
    remainingKm = 0;
    remainingFormatted = '--';
    etaFormatted = '--';
    routeGeom = [];
    totalSteps = 0;
    stepIndex = 0;
  }

  return {
    ...prev,
    active,
    isNavigating: active,
    status,
    navigationStatus: status,
    isRerouting: Boolean(payload.isRerouting || status === 'REROUTING'),
    isDestinationReached: Boolean(isArrived || status === 'ARRIVED'),
    arrived: Boolean(isArrived || status === 'ARRIVED'),
    stepIndex,
    currentLocation: {
      ...prev.currentLocation,
      ...currentLoc,
      lat,
      lng,
      heading,
      headingDeg: heading,
      city: currentLoc.city || prev.currentLocation.city,
      area: currentLoc.area || prev.currentLocation.area,
    },
    destination: {
      ...prev.destination,
      ...dest,
      lat: destLat,
      lng: destLng,
      name: destName,
    },
    nextTurn: {
      ...prev.nextTurn,
      ...nextTurn,
      instruction,
      distanceMeters,
      distanceFormatted,
      streetName,
      action,
      laneAssist: payload.laneAssist || nextTurn.laneAssist || (status === 'ARRIVED' || !active ? { available: false } : prev.nextTurn?.laneAssist || { available: false }),
      junctionInfo: payload.junctionInfo || nextTurn.junctionInfo || (status === 'ARRIVED' || !active ? { available: false } : prev.nextTurn?.junctionInfo || { available: false }),
    },
    trafficInfo: payload.trafficInfo || prev.trafficInfo || { available: false },
    remainingDistanceKm: remainingKm,
    eta: etaFormatted,
    route: {
      ...prev.route,
      ...(payload.route || {}),
      distanceRemainingKm: remainingKm,
      distanceRemainingFormatted: remainingFormatted,
      eta: etaFormatted,
      geometry: routeGeom,
      totalSteps,
      polyline: Array.isArray(payload.route?.polyline) ? payload.route.polyline : prev.route.polyline,
    },
    gps: {
      ...prev.gps,
      ...(payload.gps || {}),
    },
  };
}

/**
 * Mobile App Receiver Interface:
 * Call this function whenever a WebSocket message, BLE packet, or API request arrives from the smartphone.
 * 
 * @param {Object} rawPayload - Data payload from mobile app
 * @param {Function} setNavigationState - State dispatcher (setNavigationState)
 */
export function processMobileNavigationUpdate(rawPayload, setNavigationState) {
  if (typeof setNavigationState !== 'function') {
    console.error('[TFT Nav] setNavigationState function is required to process mobile navigation update');
    return;
  }
  setNavigationState((prev) => normalizeNavigationUpdate(rawPayload, prev));
}

export const updateNavigationState = normalizeNavigationUpdate;

export function sanitizeNavigationPacket(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return {
    type: 'navigation_update',
    isNavigating: Boolean(payload.isNavigating),
    distanceToTurn: Math.max(0, Number(payload.distanceToTurn) || 0),
    remainingDistance: Number.isFinite(Number(payload.remainingDistance)) ? Math.max(0, Number(payload.remainingDistance)) : 0,
    maneuver: typeof payload.maneuver === 'string' ? payload.maneuver : 'CONTINUE',
    instruction: typeof payload.instruction === 'string' ? payload.instruction : '',
  };
}
