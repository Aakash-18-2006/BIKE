import React, { useState, useEffect, useRef } from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';
import { MapplsMobileMap } from '../components/navigation/MapplsMobileMap.jsx';
import { VisualNavigationHUD, ManeuverIcon } from '../components/navigation/VisualNavigationHUD.jsx';
import { searchMapplsPlaces, resolveDestinationObject, formatSearchError } from '../utils/mapplsSearch.js';
import { calculateBikeRoute } from '../navigation/mapplsNavigationService.js';
import { formatRouteError } from '../utils/mapplsRoute.js';
import { normalizeCoordinates, toMapplsCoordinate, validateRouteGeometry } from '../utils/coordinates.js';
import {
  processNavigationTick,
  haversineDistance,
  formatNavDistance,
  formatNavDuration,
  findNearestPointOnRoute,
  calculateRemainingDistance,
  calculateRouteProgress,
  determineNextManeuver,
  normalizeManeuver,
  getGuidanceBand,
} from '../navigation/mapplsNavigationEngine.js';
import { parseRouteSteps } from '../utils/navigationEngine.js';
import { useVoiceNavigation, cancelSpeech } from '../utils/voiceNavigation.js';
import { GpsReliabilityFilter } from '../utils/gpsReliability.js';
import { tftNavigationBridge } from '../services/tftNavigationBridge.js';
import { navigationDiagnostics } from '../navigation/navigationDiagnostics.js';

function formatArrivalTime(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return '';
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  let hours = arrival.getHours();
  const minutes = arrival.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Utility to extract structured city and state names for driver-friendly location displays
 */
function parseCityState(item) {
  if (!item) return { city: '', state: '' };
  if (item.city && item.state) {
    return { city: String(item.city).trim(), state: String(item.state).trim() };
  }
  const addr = item.address || item.placeAddress || '';
  if (!addr) {
    return {
      city: item.city ? String(item.city).trim() : '',
      state: item.state ? String(item.state).trim() : '',
    };
  }

  const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  const cleaned = parts.filter((p) => !/^\d{5,6}$/.test(p) && p.toLowerCase() !== 'india');

  let city = item.city ? String(item.city).trim() : '';
  let state = item.state ? String(item.state).trim() : '';

  if (!city && cleaned.length >= 2) {
    city = cleaned[cleaned.length - 2];
    state = cleaned[cleaned.length - 1];
  } else if (!city && cleaned.length === 1) {
    city = cleaned[0];
  }

  return { city, state };
}

export function NavigationScreen({ onNavigate, onBack } = {}) {
  const { destinations, saveDestination, deleteDestination, sendNavigationUpdate, socket, showToast } = useBike();

  // Explicitly separated states as required
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null); // { name, address, latitude, longitude }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Route calculation states
  const [routeData, setRouteData] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [isNavReady, setIsNavReady] = useState(false);

  // Turn-by-turn navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isMapFollowing, setIsMapFollowing] = useState(true);
  const [isDestinationReached, setIsDestinationReached] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [navTelemetry, setNavTelemetry] = useState(null);
  const [navigationGuidance, setNavigationGuidance] = useState(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isGpsSignalLost, setIsGpsSignalLost] = useState(false);
  const [isRouteUpdated, setIsRouteUpdated] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const mapRef = useRef(null);

  // Turn-by-turn spoken voice guidance
  const voiceNavigator = useVoiceNavigation(isNavigating, navTelemetry, isVoiceEnabled);

  const apiKey = import.meta.env.VITE_MAPPLS_API_KEY;
  const searchTimeoutRef = useRef(null);
  const watchIdRef = useRef(null);
  const recalculationDebounceRef = useRef(null);
  const lastNavPacketRef = useRef(null);
  const offRouteCountRef = useRef(0);
  const arrivalCountRef = useRef(0);
  const lastRerouteTimeRef = useRef(0);
  const lastLoggedManeuverRef = useRef('');
  const lastGuidanceLogRef = useRef('');
  const lastLoggedGpsRef = useRef({ lat: 0, lng: 0 });
  const gpsFilterRef = useRef(new GpsReliabilityFilter());
  const consecutiveRerouteFailuresRef = useRef(0);
  const prevGpsLostRef = useRef(false);
  const currentLocationRef = useRef(currentLocation);
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  // Initial GPS location acquisition on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        };
        console.log(`[Navigation] Initial GPS acquired: [${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}]`);
        setCurrentLocation(coords);
      },
      (err) => {
        console.warn('[Navigation] Initial GPS notice:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  }, []);

  // Debounced Mappls Autosuggest Search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    // If query matches the currently active destination name, don't re-trigger dropdown search
    if (destination && destination.name.toLowerCase() === trimmed.toLowerCase()) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setIsDropdownOpen(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchMapplsPlaces(trimmed, apiKey, { location: currentLocation });
        setSearchResults(results);
        setIsSearching(false);
      } catch (err) {
        console.error('[Mappls Search] Query failed:', formatSearchError(err));
        setSearchError(formatSearchError(err));
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, apiKey, currentLocation, destination]);

  // Continuous high-accuracy GPS tracking during active navigation with reliability filtering
  useEffect(() => {
    if (!isNavigating || isDestinationReached) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const rawCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        };
        const filterResult = gpsFilterRef.current.process(rawCoords, pos.timestamp || Date.now());
        if (filterResult.accepted) {
          setIsGpsSignalLost(false);
          setCurrentLocation(filterResult.location);
        } else {
          console.warn('[GPS] rejected outlier/noisy reading:', filterResult.reason);
        }
      },
      (err) => {
        console.warn('[Navigation] GPS signal lost notice:', err.message);
        setIsGpsSignalLost(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isNavigating, isDestinationReached]);

  // App Background / Resume handler (Session Recovery)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isNavigating && !isDestinationReached) {
        console.log('[Navigation] App returned to foreground, ensuring GPS tracking is active');
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const rawCoords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                accuracy: pos.coords.accuracy,
              };
              const filterResult = gpsFilterRef.current.process(rawCoords, pos.timestamp || Date.now());
              if (filterResult.accepted) {
                setIsGpsSignalLost(false);
                setCurrentLocation(filterResult.location);
              }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isNavigating, isDestinationReached]);

  // Compute active navigation telemetry and advance steps automatically
  // Compute active navigation telemetry and advance steps automatically using Mappls Navigation Engine
  useEffect(() => {
    if (!isNavigating || !routeData || !destination) {
      setNavTelemetry(null);
      setNavigationGuidance(null);
      offRouteCountRef.current = 0;
      arrivalCountRef.current = 0;
      return;
    }

    const telemetry = processNavigationTick({
      currentLocation: currentLocation || { latitude: 12.9716, longitude: 77.5946 },
      destination,
      routeData,
      currentStepIndex,
      offRouteCount: offRouteCountRef.current,
      arrivalCount: arrivalCountRef.current,
      prevProgress: navTelemetry?.progress || 0,
      isRerouting: isRecalculating,
      isNavigating,
      offRouteThreshold: 25,
      arrivalThreshold: 30,
    });

    offRouteCountRef.current = telemetry.offRouteCount;
    arrivalCountRef.current = telemetry.arrivalCount;
    setNavTelemetry(telemetry);
    setNavigationGuidance(telemetry.navigationGuidance || null);

    // GPS position log (throttled to significant movement to avoid spam)
    if (currentLocation) {
      const curLat = currentLocation.lat ?? currentLocation.latitude;
      const curLng = currentLocation.lng ?? currentLocation.longitude;
      if (
        Math.hypot(
          curLat - lastLoggedGpsRef.current.lat,
          curLng - lastLoggedGpsRef.current.lng
        ) > 0.0001
      ) {
        console.log(`[MAPPLS GPS] Current position: ${curLat.toFixed(6)}, ${curLng.toFixed(6)}`);
        lastLoggedGpsRef.current = { lat: curLat, lng: curLng };
      }
    }

    // Step advancement and maneuver logging
    if (telemetry.stepAdvanced) {
      setCurrentStepIndex(telemetry.currentStepIndex);
      console.log(`[Navigation] Step completed: ${telemetry.currentStepIndex - 1}`);
      console.log(`[Navigation] Current step: ${telemetry.currentStepIndex}`);
    }

    const maneuverLogKey = `${telemetry.currentStepIndex}-${telemetry.nextManeuver}-${telemetry.distanceToManeuverFormatted}`;
    if (maneuverLogKey !== lastLoggedManeuverRef.current) {
      console.log(`[MAPPLS MANEUVER] Next: ${String(telemetry.nextManeuver).toUpperCase()} in ${telemetry.distanceToManeuverFormatted}`);
      lastLoggedManeuverRef.current = maneuverLogKey;
    }

    // Turn Guidance Distance Band Logging
    const guidanceLogKey = `${telemetry.currentStepIndex}-${telemetry.nextManeuver}-${telemetry.guidanceBand}`;
    if (guidanceLogKey !== lastGuidanceLogRef.current) {
      if (telemetry.guidanceBand === 'NOW') {
        console.log(`[MAPPLS GUIDANCE] ${telemetry.nextManeuver} NOW`);
      } else {
        console.log(`[MAPPLS GUIDANCE] ${telemetry.nextManeuver} in ${telemetry.distanceToManeuver}m`);
      }
      lastGuidanceLogRef.current = guidanceLogKey;
    }

    // Arrival detection with confirmation
    if (telemetry.arrived && !isDestinationReached) {
      console.log('[MAPPLS ARRIVAL] Destination reached');
      setIsDestinationReached(true);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    // Transmit navigation update to paired TFT over Socket.IO
    if (typeof sendNavigationUpdate === 'function') {
      const curCoord = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
      const destCoord = toMapplsCoordinate(destination);
      const last = lastNavPacketRef.current;

      const isFinished = telemetry.arrived || telemetry.isDestinationReached;
      const geom = Array.isArray(routeData.rawCoordinates) && routeData.rawCoordinates.length > 0
        ? routeData.rawCoordinates
        : (Array.isArray(routeData.coordinates) ? routeData.coordinates.map((c) => [c.lng, c.lat]) : []);
      const totalSteps = Array.isArray(routeData.steps) ? routeData.steps.length : 0;
      const currentManeuver = isFinished
        ? 'ARRIVE'
        : (isRecalculating ? 'REROUTING' : (telemetry.nextManeuver || 'CONTINUE'));
      const currentInstruction = isFinished
        ? 'You have arrived at your destination.'
        : (isRecalculating ? 'Recalculating route...' : (telemetry.nextInstruction || ''));
      const navStatus = isFinished
        ? 'ARRIVED'
        : (isRecalculating
          ? 'REROUTING'
          : (isGpsSignalLost ? 'GPS_LOST' : (telemetry.navigationStatus || 'NAVIGATING')));

      // Check for GPS recovery transition
      const isGpsRecovered = prevGpsLostRef.current && !isGpsSignalLost;
      prevGpsLostRef.current = isGpsSignalLost;

      const effectiveNavStatus = isGpsRecovered
        ? 'GPS_RECOVERED'
        : navStatus;

      const gpsMoved =
        !last?.current ||
        Math.hypot((last.current.lat - curCoord.lat), (last.current.lng - curCoord.lng)) >= 0.00005;

      const isSignificantChange =
        !last ||
        !last.isNavigating ||
        last.stepIndex !== telemetry.currentStepIndex ||
        last.maneuver !== currentManeuver ||
        last.instruction !== currentInstruction ||
        last.navigationStatus !== navStatus ||
        last.etaMinutes !== telemetry.etaMinutes ||
        last.isDestinationReached !== isFinished ||
        telemetry.arrived ||
        isRecalculating ||
        isGpsSignalLost ||
        isGpsRecovered;

      const shouldUpdate =
        isSignificantChange ||
        (gpsMoved && !tftNavigationBridge.shouldThrottleTick(false));

      if (shouldUpdate) {
        const rawPacket = {
          type: 'navigation_update',
          isNavigating: !isFinished,
          isDestinationReached: isFinished,
          current: { lat: curCoord.lat, lng: curCoord.lng },
          destination: destCoord ? {
            name: destination.name || destination.address || 'Destination',
            lat: destCoord.lat,
            lng: destCoord.lng,
          } : null,
          maneuver: currentManeuver,
          instruction: currentInstruction,
          roadName: isFinished ? '' : (telemetry.nextRoadName || telemetry.currentStep?.roadName || destination.name || ''),
          distanceToTurn: isFinished ? 0 : telemetry.distanceToManeuver,
          remainingDistance: isFinished ? 0 : telemetry.distanceRemaining,
          etaMinutes: isFinished ? 0 : telemetry.etaMinutes,
          stepIndex: telemetry.currentStepIndex,
          totalSteps,
          progress: telemetry.progress || 0,
          navigationStatus: effectiveNavStatus,
          status: effectiveNavStatus,
          offRoute: Boolean(telemetry.offRoute),
          isRerouting: Boolean(isRecalculating || telemetry.isRerouting),
          arrived: Boolean(isFinished),
          laneAssist: telemetry.laneAssist || { available: false },
          junctionInfo: telemetry.junctionInfo || { available: false },
          trafficInfo: telemetry.trafficInfo || { available: false },
          route: {
            geometry: geom,
          },
          distanceToTurnMeters: isFinished ? 0 : telemetry.distanceToManeuver,
          distanceToTurnFormatted: isFinished ? '0 m' : telemetry.distanceToManeuverFormatted,
          remainingDistanceMeters: isFinished ? 0 : telemetry.distanceRemaining,
          remainingDistanceFormatted: isFinished ? '0 m' : telemetry.distanceRemainingFormatted,
        };

        const updatePacket = tftNavigationBridge.buildPacket(rawPacket, effectiveNavStatus);
        lastNavPacketRef.current = updatePacket;
        console.log('[MAPPLS TFT] navigation_update sent');
        console.log(`[MAPPLS TFT] Status: ${effectiveNavStatus} [session=${updatePacket.navigationSessionId}, seq=${updatePacket.sequence}]`);
        sendNavigationUpdate(updatePacket);

        if (isGpsRecovered) {
          const navSnapshot = tftNavigationBridge.buildPacket(rawPacket, 'NAVIGATING');
          lastNavPacketRef.current = navSnapshot;
          sendNavigationUpdate(navSnapshot);
        }
      }
    }

    // Record throttled diagnostic telemetry snapshot
    navigationDiagnostics.record({
      telemetry,
      currentLocation,
      destination,
      tftPacket: lastNavPacketRef.current,
    });

    // Off-route candidate log
    if (telemetry.offRouteDistance > 25 && !telemetry.offRoute) {
      console.log(`[MAPPLS OFF ROUTE] Candidate detected: ${telemetry.offRouteDistance}m`);
    }

    // Confirmed off-route detection and auto-reroute with loop backoff protection
    if (telemetry.offRoute && !isOffRoute && !isRecalculating) {
      console.log(`[MAPPLS OFF ROUTE] Confirmed off route: ${telemetry.offRouteDistance}m`);
      setIsOffRoute(true);

      const now = Date.now();
      const cooldownMs = Math.min(12000, 4000 + (consecutiveRerouteFailuresRef.current * 3000));
      if (now - lastRerouteTimeRef.current > cooldownMs) {
        lastRerouteTimeRef.current = now;
        if (recalculationDebounceRef.current) clearTimeout(recalculationDebounceRef.current);
        recalculationDebounceRef.current = setTimeout(async () => {
          try {
            setIsRecalculating(true);
            if (voiceNavigator) {
              voiceNavigator.reset();
            }

            console.log('[MAPPLS REROUTE] Requesting new Mappls bike route');

            if (typeof sendNavigationUpdate === 'function') {
              const curCoord = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
              const destCoord = toMapplsCoordinate(destination);
              const reroutePacket = tftNavigationBridge.buildPacket({
                type: 'navigation_update',
                isNavigating: true,
                isDestinationReached: false,
                current: { lat: curCoord.lat, lng: curCoord.lng },
                destination: destCoord ? {
                  name: destination.name || destination.address || 'Destination',
                  lat: destCoord.lat,
                  lng: destCoord.lng,
                } : null,
                maneuver: 'REROUTING',
                instruction: 'Recalculating route...',
                roadName: '',
                distanceToTurn: 0,
                remainingDistance: 0,
                etaMinutes: 0,
                stepIndex: 0,
                totalSteps: 0,
                progress: 0,
                navigationStatus: 'REROUTING',
                offRoute: true,
                isRerouting: true,
                arrived: false,
                laneAssist: { available: false },
                junctionInfo: { available: false },
                trafficInfo: { available: false },
                route: { geometry: [] },
                distanceToTurnMeters: 0,
                distanceToTurnFormatted: '0 m',
                remainingDistanceMeters: 0,
                remainingDistanceFormatted: '0 m',
              }, 'REROUTING');
              lastNavPacketRef.current = reroutePacket;
              console.log('[MAPPLS TFT] navigation_update sent');
              console.log(`[MAPPLS TFT] Status: REROUTING [session=${reroutePacket.navigationSessionId}, seq=${reroutePacket.sequence}]`);
              sendNavigationUpdate(reroutePacket);
            }

            const result = await calculateBikeRoute(
              currentLocation || { latitude: 12.9716, longitude: 77.5946 },
              destination
            );
            if (result.success && result.routeData) {
              console.log('[MAPPLS REROUTE] New route received');
              setRouteData(result.routeData);
              setCurrentStepIndex(0);
              setIsOffRoute(false);
              offRouteCountRef.current = 0;
              setIsRecalculating(false);
              consecutiveRerouteFailuresRef.current = 0;
              setIsRouteUpdated(true);
              setTimeout(() => setIsRouteUpdated(false), 3500);
              if (voiceNavigator) {
                voiceNavigator.reset();
              }

              // Immediately emit updated route packet with same session ID but higher sequence
              if (typeof sendNavigationUpdate === 'function') {
                const curCoord = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
                const destCoord = toMapplsCoordinate(destination);
                const steps = parseRouteSteps(result.routeData.steps);
                const firstStep = steps?.[0] || null;
                const geom = Array.isArray(result.routeData.rawCoordinates) && result.routeData.rawCoordinates.length > 0
                  ? result.routeData.rawCoordinates
                  : (Array.isArray(result.routeData.coordinates) ? result.routeData.coordinates.map((c) => [c.lng, c.lat]) : []);

                const newRoutePacket = tftNavigationBridge.buildPacket({
                  type: 'navigation_update',
                  isNavigating: true,
                  isDestinationReached: false,
                  current: { lat: curCoord.lat, lng: curCoord.lng },
                  destination: destCoord ? {
                    name: destination.name || destination.address || 'Destination',
                    lat: destCoord.lat,
                    lng: destCoord.lng,
                  } : null,
                  maneuver: normalizeManeuver(firstStep?.maneuverType, firstStep?.modifier),
                  instruction: firstStep?.instruction || 'Continue on new route',
                  roadName: firstStep?.roadName || destination?.name || '',
                  distanceToTurn: firstStep?.distance || 0,
                  remainingDistance: Math.round(result.routeData.distanceMeters || result.routeData.distance || 0),
                  etaMinutes: Math.max(1, Math.round((result.routeData.durationSeconds || result.routeData.duration || 60) / 60)),
                  stepIndex: 0,
                  totalSteps: steps.length,
                  progress: 0,
                  navigationStatus: 'NAVIGATING',
                  offRoute: false,
                  isRerouting: false,
                  arrived: false,
                  laneAssist: { available: false },
                  junctionInfo: { available: false },
                  trafficInfo: { available: false },
                  route: { geometry: geom },
                  distanceToTurnMeters: firstStep?.distance || 0,
                  distanceToTurnFormatted: formatNavDistance(firstStep?.distance || 0),
                  remainingDistanceMeters: Math.round(result.routeData.distanceMeters || result.routeData.distance || 0),
                  remainingDistanceFormatted: formatNavDistance(result.routeData.distanceMeters || result.routeData.distance || 0),
                }, 'NAVIGATING');
                lastNavPacketRef.current = newRoutePacket;
                console.log(`[MAPPLS TFT] Updated route packet sent: seq=${newRoutePacket.sequence}`);
                sendNavigationUpdate(newRoutePacket);
              }
            } else {
              console.warn('[MAPPLS REROUTE] Reroute calculation failed, preserving existing routeData:', result.error);
              consecutiveRerouteFailuresRef.current += 1;
              setIsRecalculating(false);
            }
          } catch (recalcErr) {
            console.warn('[MAPPLS REROUTE] Recalculation notice:', recalcErr.message);
            consecutiveRerouteFailuresRef.current += 1;
            setIsRecalculating(false);
          }
        }, 1000);
      }
    } else if (!telemetry.offRoute && isOffRoute) {
      setIsOffRoute(false);
    }
  }, [
    currentLocation,
    isNavigating,
    routeData,
    destination,
    currentStepIndex,
    isDestinationReached,
    isOffRoute,
    isRecalculating,
    apiKey,
    sendNavigationUpdate,
  ]);

  // Listener for TFT-initiated destination selection over WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleTftDestinationSelected = async (data) => {
      const incomingDest = data?.destination;
      if (!incomingDest || incomingDest.lat == null || incomingDest.lng == null) {
        console.warn('[MOBILE NAV IN] Incomplete destination received from TFT:', incomingDest);
        return;
      }

      console.log('[MOBILE NAV IN] Received destination selection from TFT:', incomingDest);
      const targetDest = {
        name: incomingDest.name || 'Destination',
        address: incomingDest.address || incomingDest.name || '',
        lat: Number(incomingDest.lat),
        lng: Number(incomingDest.lng),
        latitude: Number(incomingDest.lat),
        longitude: Number(incomingDest.lng),
      };

      setDestination(targetDest);
      setSearchQuery(targetDest.name);
      setSearchResults([]);
      setRouteError(null);

      // Current GPS location
      const normOrigin = toMapplsCoordinate(currentLocationRef.current) || {
        lat: 12.9716,
        lng: 77.5946,
      };

      console.log(`[MOBILE NAV IN] Calculating real Mappls route from [${normOrigin.lat}, ${normOrigin.lng}] to [${targetDest.lat}, ${targetDest.lng}]`);
      setIsCalculatingRoute(true);

      try {
        const result = await calculateBikeRoute(normOrigin, targetDest);
        if (!result.success || !result.routeData) {
          throw new Error(result.error || 'Failed to calculate bike route');
        }

        const route = result.routeData;
        setRouteData(route);
        setIsCalculatingRoute(false);
        setIsNavReady(true);

        // Automatically start navigation state with a fresh session
        tftNavigationBridge.createSession(targetDest.name);
        setIsNavigating(true);
        setCurrentStepIndex(0);
        setIsMapFollowing(true);
        setIsDestinationReached(false);
        setIsOffRoute(false);
        console.log('[MOBILE NAV IN] Started navigation for TFT destination');

        // Immediately transmit complete navigation_update to TFT
        const steps = parseRouteSteps(route.steps);
        const firstStep = steps && steps.length > 0 ? steps[0] : null;

        if (isVoiceEnabled && voiceNavigator) {
          voiceNavigator.announceStart(firstStep?.instruction);
        }
        const geom = Array.isArray(route.rawCoordinates) && route.rawCoordinates.length > 0
          ? route.rawCoordinates
          : (Array.isArray(route.coordinates) ? route.coordinates.map((c) => [c.lng, c.lat]) : []);

        const initialManeuver = normalizeManeuver(firstStep?.maneuverType, firstStep?.modifier);
        const initialPacket = tftNavigationBridge.buildPacket({
          type: 'navigation_update',
          isNavigating: true,
          isDestinationReached: false,
          current: { lat: normOrigin.lat, lng: normOrigin.lng },
          destination: {
            name: targetDest.name,
            lat: targetDest.lat,
            lng: targetDest.lng,
          },
          maneuver: initialManeuver,
          instruction: firstStep?.instruction || 'Start route',
          roadName: firstStep?.roadName || targetDest.name || '',
          distanceToTurn: firstStep?.distance || 0,
          remainingDistance: Math.round(route.distanceMeters || route.distance || 0),
          etaMinutes: Math.max(1, Math.round((route.durationSeconds || route.duration || 60) / 60)),
          stepIndex: 0,
          totalSteps: steps.length,
          progress: 0,
          navigationStatus: 'NAVIGATING',
          offRoute: false,
          isRerouting: false,
          arrived: false,
          laneAssist: { available: false },
          junctionInfo: { available: false },
          trafficInfo: { available: false },
          route: {
            geometry: geom,
          },
          distanceToTurnMeters: firstStep?.distance || 0,
          distanceToTurnFormatted: formatNavDistance(firstStep?.distance || 0),
          remainingDistanceMeters: Math.round(route.distanceMeters || route.distance || 0),
          remainingDistanceFormatted: formatNavDistance(route.distanceMeters || route.distance || 0),
        }, 'NAVIGATING');

        lastNavPacketRef.current = initialPacket;
        console.log('[MAPPLS TFT] navigation_update sent');
        console.log(`[MAPPLS TFT] Status: NAVIGATING [session=${initialPacket.navigationSessionId}, seq=${initialPacket.sequence}]`);
        if (typeof sendNavigationUpdate === 'function') {
          sendNavigationUpdate(initialPacket);
        }
      } catch (err) {
        console.error('[MOBILE NAV IN] Failed to calculate route for TFT destination:', err);
        setRouteError(formatRouteError(err));
        setIsCalculatingRoute(false);
      }
    };

    socket.on('destination_selected', handleTftDestinationSelected);
    socket.on('tft_destination_select', handleTftDestinationSelected);

    return () => {
      socket.off('destination_selected', handleTftDestinationSelected);
      socket.off('tft_destination_select', handleTftDestinationSelected);
    };
  }, [socket, apiKey, sendNavigationUpdate, isVoiceEnabled, voiceNavigator]);

  // Start Navigation Action
  const handleStartNavigation = async () => {
    if (isNavigating || isCalculatingRoute) {
      console.warn('[Navigation] Start ignored: already navigating or route calculation in progress');
      return;
    }
    if (!destination) {
      console.warn('[Navigation] Cannot start: destination missing');
      return;
    }

    const normOrigin = toMapplsCoordinate(currentLocation) || {
      lat: 12.9716,
      lng: 77.5946,
    };
    const normDest = toMapplsCoordinate(destination);
    if (!normDest) {
      console.warn('[Navigation] Cannot start: invalid destination coordinates');
      return;
    }

    console.log('[MAPPLS NAVIGATION] Route calculation started');
    console.log(`[MAPPLS NAVIGATION] Origin: ${normOrigin.lat}, ${normOrigin.lng}`);
    console.log(`[MAPPLS NAVIGATION] Destination: ${normDest.lat}, ${normDest.lng}`);

    setIsCalculatingRoute(true);
    setRouteError(null);
    setIsNavReady(false);

    let activeRoute = null;
    try {
      const result = await calculateBikeRoute(normOrigin, normDest);
      if (result.success && result.routeData) {
        console.log('[MAPPLS NAVIGATION] Route calculation successful');
        console.log(`[MAPPLS NAVIGATION] Distance: ${result.routeData.distance} m`);
        console.log(`[MAPPLS NAVIGATION] Duration: ${result.routeData.duration} s`);
        console.log(`[MAPPLS NAVIGATION] Steps: ${result.routeData.steps?.length || 0}`);

        activeRoute = result.routeData;
        setRouteData(activeRoute);
        setIsNavReady(true);
        setIsCalculatingRoute(false);
      } else {
        const errorMsg = result.error || 'Unable to calculate bike route. Please check your connection and try again.';
        console.error('[MAPPLS NAVIGATION] Route calculation failed:', errorMsg);
        setRouteError(errorMsg);
        setRouteData(null);
        setIsCalculatingRoute(false);
        setIsNavigating(false);
        return; // Do not mark navigation as started if route calculation failed
      }
    } catch (calcErr) {
      const errorMsg = calcErr?.message || 'Unable to calculate bike route. Please check your connection and try again.';
      console.error('[MAPPLS NAVIGATION] Route calculation failed:', errorMsg);
      setRouteError(errorMsg);
      setRouteData(null);
      setIsCalculatingRoute(false);
      setIsNavigating(false);
      return;
    }

    setIsNavigating(true);
    setCurrentStepIndex(0);
    setIsMapFollowing(true);
    setIsDestinationReached(false);
    setIsOffRoute(false);
    offRouteCountRef.current = 0;
    arrivalCountRef.current = 0;
    console.log('[MAPPLS NAV ENGINE] Navigation processing started');
    console.log('[Navigation] Started');

    // Immediate initial sync to TFT display
    const steps = parseRouteSteps(activeRoute.steps);
    const firstStep = steps && steps.length > 0 ? steps[0] : null;

    if (isVoiceEnabled && voiceNavigator) {
      voiceNavigator.announceStart(firstStep?.instruction);
    }
    tftNavigationBridge.createSession(destination?.name || 'Destination');
    const curCoord = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
    const destCoord = toMapplsCoordinate(destination);
    const geom = Array.isArray(activeRoute.rawCoordinates) && activeRoute.rawCoordinates.length > 0
      ? activeRoute.rawCoordinates
      : (Array.isArray(activeRoute.coordinates) ? activeRoute.coordinates.map((c) => [c.lng, c.lat]) : []);

    const initialManeuver = normalizeManeuver(firstStep?.maneuverType, firstStep?.modifier);
    const initialPacket = tftNavigationBridge.buildPacket({
      type: 'navigation_update',
      isNavigating: true,
      isDestinationReached: false,
      current: { lat: curCoord.lat, lng: curCoord.lng },
      destination: destCoord ? {
        name: destination.name || destination.address || 'Destination',
        lat: destCoord.lat,
        lng: destCoord.lng,
      } : null,
      maneuver: initialManeuver,
      instruction: firstStep?.instruction || 'Start route',
      roadName: firstStep?.roadName || destination.name || '',
      distanceToTurn: firstStep?.distance || 0,
      remainingDistance: Math.round(activeRoute.distanceMeters || activeRoute.distance || 0),
      etaMinutes: Math.max(1, Math.round((activeRoute.durationSeconds || activeRoute.duration || 60) / 60)),
      stepIndex: 0,
      totalSteps: steps.length,
      progress: 0,
      navigationStatus: 'NAVIGATING',
      offRoute: false,
      isRerouting: false,
      arrived: false,
      laneAssist: { available: false },
      junctionInfo: { available: false },
      trafficInfo: { available: false },
      route: {
        geometry: geom,
      },
      distanceToTurnMeters: firstStep?.distance || 0,
      distanceToTurnFormatted: formatNavDistance(firstStep?.distance || 0),
      remainingDistanceMeters: Math.round(activeRoute.distanceMeters || activeRoute.distance || 0),
      remainingDistanceFormatted: formatNavDistance(activeRoute.distanceMeters || activeRoute.distance || 0),
    }, 'NAVIGATING');
    lastNavPacketRef.current = initialPacket;
    console.log('[MAPPLS TFT] navigation_update sent');
    console.log(`[MAPPLS TFT] Status: NAVIGATING [session=${initialPacket.navigationSessionId}, seq=${initialPacket.sequence}]`);
    if (typeof sendNavigationUpdate === 'function') {
      sendNavigationUpdate(initialPacket);
    }
  };

  // Navigate to Bike Action: Sends destination telemetry to TFT cluster and initiates navigation
  const handleNavigateToBike = async () => {
    if (!destination) {
      console.warn('[Navigation] Cannot navigate to bike: no destination selected');
      return;
    }
    if (isCalculatingRoute) {
      console.warn('[Navigation] Route calculation in progress, please wait');
      return;
    }

    let activeRoute = routeData;
    if (!activeRoute) {
      const normOrigin = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
      const normDest = toMapplsCoordinate(destination);
      if (normDest) {
        setIsCalculatingRoute(true);
        try {
          const result = await calculateBikeRoute(normOrigin, normDest);
          if (result.success && result.routeData) {
            activeRoute = result.routeData;
            setRouteData(activeRoute);
            setIsNavReady(true);
          }
        } catch (err) {
          console.warn('[Navigation] Route calculation failed for Navigate to Bike:', err);
        } finally {
          setIsCalculatingRoute(false);
        }
      }
    }

    const curCoord = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
    const destCoord = toMapplsCoordinate(destination) || {
      lat: destination.latitude || destination.lat,
      lng: destination.longitude || destination.lng,
    };

    tftNavigationBridge.createSession(destination?.name || 'Destination');

    const steps = parseRouteSteps(activeRoute?.steps || []);
    const firstStep = steps && steps.length > 0 ? steps[0] : null;

    const geom = Array.isArray(activeRoute?.rawCoordinates) && activeRoute.rawCoordinates.length > 0
      ? activeRoute.rawCoordinates
      : (Array.isArray(activeRoute?.coordinates) ? activeRoute.coordinates.map((c) => [c.lng, c.lat]) : []);

    const distMeters = Math.round(activeRoute?.distanceMeters || activeRoute?.distance || 0);
    const distKm = Number((distMeters / 1000).toFixed(1));
    const durationSec = activeRoute?.durationSeconds || activeRoute?.duration || 60;
    const etaMins = Math.max(1, Math.round(durationSec / 60));
    const etaFormatted = activeRoute?.durationFormatted || `${etaMins} min`;
    const distFormatted = activeRoute?.distanceFormatted || formatNavDistance(distMeters);

    const initialManeuver = normalizeManeuver(firstStep?.maneuverType, firstStep?.modifier);

    const navPacket = tftNavigationBridge.buildPacket({
      type: 'navigation_update',
      isNavigating: true,
      isDestinationReached: false,
      current: { lat: curCoord.lat, lng: curCoord.lng },
      destination: {
        name: destination.name || destination.address || 'Destination',
        address: destination.address || '',
        city: destCity || '',
        state: destState || '',
        lat: destCoord.lat,
        lng: destCoord.lng,
        latitude: destCoord.lat,
        longitude: destCoord.lng,
      },
      maneuver: initialManeuver,
      instruction: firstStep?.instruction || `Head towards ${destination.name || 'Destination'}`,
      roadName: firstStep?.roadName || destination.name || '',
      distanceToTurn: firstStep?.distance || 0,
      distanceToTurnMeters: firstStep?.distance || 0,
      distanceToTurnFormatted: formatNavDistance(firstStep?.distance || 0),
      remainingDistance: distMeters,
      remainingDistanceMeters: distMeters,
      remainingDistanceFormatted: distFormatted,
      remainingDistanceKm: distKm,
      etaMinutes: etaMins,
      eta: etaFormatted,
      stepIndex: 0,
      totalSteps: steps.length,
      progress: 0,
      navigationStatus: 'NAVIGATING',
      offRoute: false,
      isRerouting: false,
      arrived: false,
      laneAssist: { available: false },
      junctionInfo: { available: false },
      trafficInfo: { available: false },
      route: {
        geometry: geom,
        distanceRemainingKm: distKm,
        distanceRemainingFormatted: distFormatted,
        eta: etaFormatted,
        totalSteps: steps.length,
        speedLimitKm: 60,
      },
    }, 'NAVIGATING');

    lastNavPacketRef.current = navPacket;
    console.log('[MAPPLS TFT] Destination sent to bike cluster via navigation_update:', navPacket);

    if (typeof sendNavigationUpdate === 'function') {
      sendNavigationUpdate(navPacket);
    }

    // Start mobile navigation follow mode and guidance
    setIsNavigating(true);
    setCurrentStepIndex(0);
    setIsMapFollowing(true);
    setIsDestinationReached(false);
    setIsOffRoute(false);
    offRouteCountRef.current = 0;
    arrivalCountRef.current = 0;

    if (isVoiceEnabled && voiceNavigator) {
      voiceNavigator.announceStart(firstStep?.instruction);
    }

    // Small confirmation toast on mobile without blocking or hiding map
    if (typeof showToast === 'function') {
      showToast('Destination sent to bike', 'success');
    }
  };

  // Exit Map Action: Returns to previous screen; confirms if navigation is active
  const handleExitMap = () => {
    // If navigation is active, prompt with Exit Navigation? confirmation modal
    if (isNavigating) {
      setShowExitConfirm(true);
      return;
    }

    // If destination was selected but navigation has NOT started, clear temporary destination UI state
    if (destination) {
      setDestination(null);
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
      setIsDropdownOpen(false);
      setIsSearchOpen(false);
      setRouteData(null);
      setRouteError(null);
      setIsNavReady(false);
    }

    if (typeof onBack === 'function') {
      onBack();
    } else if (typeof onNavigate === 'function') {
      onNavigate('dashboard');
    }
  };

  // Stop Navigation Action
  const handleStopNavigation = () => {
    if (!isNavigating && !isNavReady && !routeData) {
      return;
    }
    setIsNavigating(false);
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setCurrentStepIndex(0);
    setIsDestinationReached(false);
    setIsOffRoute(false);
    setIsRecalculating(false);
    setNavTelemetry(null);
    setNavigationGuidance(null);
    lastGuidanceLogRef.current = '';
    offRouteCountRef.current = 0;
    arrivalCountRef.current = 0;
    consecutiveRerouteFailuresRef.current = 0;
    setIsGpsSignalLost(false);
    prevGpsLostRef.current = false;
    if (gpsFilterRef.current) {
      gpsFilterRef.current.reset();
    }
    if (voiceNavigator) {
      voiceNavigator.reset();
    }
    cancelSpeech();
    console.log('[Navigation] Stopped');

    if (typeof sendNavigationUpdate === 'function') {
      const curCoord = toMapplsCoordinate(currentLocation) || { lat: 12.9716, lng: 77.5946 };
      const stopPacket = tftNavigationBridge.buildStopPacket(curCoord);
      lastNavPacketRef.current = stopPacket;
      console.log(`[MOBILE NAV OUT] Navigation stopped packet sent to TFT [session=${stopPacket.navigationSessionId}, seq=${stopPacket.sequence}]`);
      sendNavigationUpdate(stopPacket);
    }
  };

  // Calculate Route handler using official Mappls Biking profile
  const handleCalculateRoute = async (targetDest = destination) => {
    if (isCalculatingRoute) {
      return;
    }
    const normDest = normalizeCoordinates(targetDest);

    if (!normDest) {
      setRouteError('Please select a valid destination with coordinates');
      return;
    }

    const normOrigin = normalizeCoordinates(currentLocation) || {
      lat: 12.9716,
      lng: 77.5946,
    };

    console.log('[MAPPLS NAVIGATION] Route calculation started');
    console.log(`[MAPPLS NAVIGATION] Origin: ${normOrigin.lat}, ${normOrigin.lng}`);
    console.log(`[MAPPLS NAVIGATION] Destination: ${normDest.lat}, ${normDest.lng}`);

    setIsCalculatingRoute(true);
    setRouteError(null);
    setIsNavReady(false);

    try {
      const result = await calculateBikeRoute(normOrigin, normDest);
      if (result.success && result.routeData) {
        console.log('[MAPPLS NAVIGATION] Route calculation successful');
        console.log(`[MAPPLS NAVIGATION] Distance: ${result.routeData.distance} m`);
        console.log(`[MAPPLS NAVIGATION] Duration: ${result.routeData.duration} s`);
        console.log(`[MAPPLS NAVIGATION] Steps: ${result.routeData.steps?.length || 0}`);

        setRouteData(result.routeData);
        setIsNavReady(true);
        setIsCalculatingRoute(false);
      } else {
        const errorMsg = result.error || 'Unable to calculate bike route. Please check your connection and try again.';
        console.error('[MAPPLS NAVIGATION] Route calculation failed:', errorMsg);
        setRouteError(errorMsg);
        setRouteData(null);
        setIsCalculatingRoute(false);
      }
    } catch (err) {
      const errorMsg = err?.message || 'Unable to calculate bike route. Please check your connection and try again.';
      console.error('[MAPPLS NAVIGATION] Route calculation failed:', errorMsg);
      setRouteError(errorMsg);
      setRouteData(null);
      setIsCalculatingRoute(false);
    }
  };

  // Handle Suggestion Tap
  const handleSelectSuggestion = async (item) => {
    try {
      handleStopNavigation();
      setIsSearching(true);
      setSearchError(null);
      setIsDropdownOpen(false);
      setIsSearchOpen(false);

      const resolvedDest = await resolveDestinationObject(item, apiKey);
      console.log('[Mappls Mobile] Selected Destination:', resolvedDest);

      setDestination(resolvedDest);
      setSearchQuery(resolvedDest.name);
      setSearchResults([]);
      setIsSearching(false);
      setRouteData(null);
      setRouteError(null);
      setIsNavReady(false);

      // Save to user waypoints history in database
      saveDestination({
        name: resolvedDest.name,
        address: resolvedDest.address,
        latitude: resolvedDest.latitude,
        longitude: resolvedDest.longitude,
        category: 'recent',
      });

      // Calculate route immediately for the chosen destination
      handleCalculateRoute(resolvedDest);
    } catch (err) {
      console.error('[Mappls Mobile] Destination resolution failed:', formatSearchError(err));
      setSearchError(formatSearchError(err));
      setIsSearching(false);
    }
  };

  // Clear Destination handler
  const handleClearDestination = () => {
    handleStopNavigation();
    setDestination(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsDropdownOpen(false);
    setIsSearchOpen(false);
    setRouteData(null);
    setRouteError(null);
    setIsNavReady(false);
  };

  // Handle saved waypoint click from cloud sync
  const handleSelectSavedWaypoint = (wp) => {
    const norm = normalizeCoordinates(wp);
    if (norm) {
      handleStopNavigation();
      console.log(`[MAP DEBUG] Destination: ${norm.lat}, ${norm.lng}`);
      const destObj = {
        name: wp.name,
        address: wp.address || 'Saved destination',
        lat: norm.lat,
        lng: norm.lng,
        latitude: norm.lat,
        longitude: norm.lng,
      };
      setDestination(destObj);
      setSearchQuery(wp.name);
      setSearchResults([]);
      setIsDropdownOpen(false);
      setRouteData(null);
      setRouteError(null);
      setIsNavReady(false);

      handleCalculateRoute(destObj);
    }
  };

  const destCityState = parseCityState(destination);
  const destCity = destCityState.city;
  const destState = destCityState.state;

  return (
    <div className="mappls-nav-container">
      {/* 1. MAP-FIRST CANVAS: Occupies entire background */}
      <div className="mappls-map-fill">
        <MapplsMobileMap
          height="100%"
          destination={destination}
          routeData={routeData}
          isNavigating={isNavigating}
          isMapFollowing={isMapFollowing}
          currentLocation={currentLocation}
          onLocationUpdate={setCurrentLocation}
          onMapDrag={() => setIsMapFollowing(false)}
          onRecenter={() => setIsMapFollowing(true)}
          hideBuiltInControls={true}
          mapRef={mapRef}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
      </div>

      {/* FLOATING MAP CONTROLS: Ergonomic Right-Side Column (Zoom, Recenter, Locate Me, Voice) */}
      <div className="mappls-floating-actions" id="mappls-map-controls">
        {/* Voice Navigation Toggle */}
        {isNavigating && (
          <button
            className={`mappls-floating-btn ${isVoiceEnabled ? 'active' : ''}`}
            onClick={() => {
              setIsVoiceEnabled((prev) => {
                const next = !prev;
                if (!next) cancelSpeech();
                return next;
              });
            }}
            title={isVoiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
            aria-label="Toggle Voice Navigation"
            id="mappls-voice-btn"
          >
            {isVoiceEnabled ? '🔊' : '🔇'}
          </button>
        )}

        {/* Recenter Button (visible when user manually drags map off-follow during navigation) */}
        {isNavigating && !isMapFollowing && (
          <button
            className="mappls-floating-btn mappls-recenter-pill-btn"
            onClick={() => {
              setIsMapFollowing(true);
              if (mapRef.current?.centerOnLocation) {
                mapRef.current.centerOnLocation();
              }
            }}
            title="Recenter Camera on Bike"
            aria-label="Recenter Camera on Bike"
            id="mappls-recenter-btn"
          >
            <span style={{ fontSize: 16 }}>🎯</span>
            <span className="mappls-recenter-label">RECENTER</span>
          </button>
        )}

        {/* Zoom In Button */}
        <button
          className="mappls-floating-btn"
          onClick={() => mapRef.current?.zoomIn?.()}
          title="Zoom In"
          aria-label="Zoom In"
          id="mappls-zoom-in-btn"
        >
          <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>+</span>
        </button>

        {/* Zoom Out Button */}
        <button
          className="mappls-floating-btn"
          onClick={() => mapRef.current?.zoomOut?.()}
          title="Zoom Out"
          aria-label="Zoom Out"
          id="mappls-zoom-out-btn"
        >
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>−</span>
        </button>

        {/* Current Location / Locate Me Button */}
        <button
          className="mappls-floating-btn"
          onClick={() => {
            if (isNavigating) {
              setIsMapFollowing(true);
            }
            if (mapRef.current?.centerOnLocation) {
              mapRef.current.centerOnLocation();
            }
          }}
          title="Center on Current Location"
          aria-label="Current Location"
          id="mappls-locate-me-btn"
          style={{
            color: currentLocation ? '#00F0FF' : '#ffffff',
            borderColor: currentLocation ? 'rgba(0, 240, 255, 0.45)' : undefined,
          }}
        >
          <Icon name="mapPin" size={18} color={currentLocation ? '#00F0FF' : '#ffffff'} />
        </button>
      </div>

      {/* SCREEN 1: MAP HOME - Floating Search Bar & Quick Drawer */}
      {!destination && !isSearchOpen && !isNavigating && (
        <>
          <div style={{ position: 'absolute', top: 14, left: 14, right: 14, zIndex: 25, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleExitMap}
              className="mappls-top-exit-btn"
              id="mappls-top-exit-btn"
              title="Exit Map"
              aria-label="Exit Map"
            >
              <span>←</span>
              <span>EXIT</span>
            </button>
            <div
              className="mappls-floating-search"
              onClick={() => {
                setIsSearchOpen(true);
                setIsDropdownOpen(true);
              }}
              id="mappls-home-search-bar"
              style={{ flex: 1, position: 'static' }}
            >
              <span className="mappls-search-icon">🔍</span>
              <span className="mappls-search-placeholder">Where do you want to go?</span>
              <div className="mappls-search-trailing">
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Chakra Petch', letterSpacing: '0.06em' }}>AEROVYN</span>
              </div>
            </div>
          </div>

          {/* Mappls Destination / Route Bottom Panel (Resting State when no destination selected) */}
          <div className="mappls-bottom-sheet" id="mappls-route-preview-sheet">
            <div className="mappls-sheet-drag-handle" />

            {/* Quick Access / Saved Places bottom panel if available */}
            {destinations?.saved?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Chakra Petch', fontSize: 11, fontWeight: 700, color: '#00F0FF', letterSpacing: '0.05em' }}>
                    QUICK ACCESS · SAVED DESTINATIONS
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{destinations.saved.length} places</span>
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {destinations.saved.slice(0, 5).map((d) => {
                    const savedCityState = parseCityState(d);
                    return (
                      <div
                        key={d._id}
                        onClick={() => handleSelectSavedWaypoint(d)}
                        className="mappls-quick-place-card"
                      >
                        <span style={{ fontSize: 14 }}>📍</span>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {d.name}
                          </div>
                          {(savedCityState.city || savedCityState.state) && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {[savedCityState.city, savedCityState.state].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 15, color: '#00F0FF' }}>📍</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Select a destination to navigate to bike
              </span>
            </div>

            <button
              className="mappls-start-btn mappls-navigate-bike-btn"
              disabled={true}
              id="mappls-navigate-to-bike-btn"
              title="Select a destination first to navigate to bike"
            >
              <span>🏍️</span>
              <span>NAVIGATE TO BIKE</span>
            </button>

            <button
              className="mappls-exit-map-btn"
              onClick={handleExitMap}
              id="mappls-exit-map-btn-resting"
              title="Exit Map and return to dashboard"
              style={{ marginTop: 8 }}
            >
              <span>✕</span>
              <span>EXIT MAP</span>
            </button>
          </div>
        </>
      )}

      {/* SCREEN 2: SEARCH OVERLAY */}
      {isSearchOpen && (
        <div className="mappls-search-view" id="mappls-search-overlay">
          <div className="mappls-search-bar-active">
            <button
              className="mappls-search-back-btn"
              onClick={() => {
                setIsSearchOpen(false);
                setIsDropdownOpen(false);
              }}
              title="Back"
            >
              ←
            </button>
            <div className="mappls-input-wrapper">
              <span style={{ fontSize: 15, color: '#8e8e93' }}>🔍</span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Where do you want to go?"
                id="mappls-search-input"
              />
              {searchQuery && (
                <button
                  className="mappls-search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              {isSearching && <div className="mappls-spinner-sm" />}
            </div>
          </div>

          <div className="mappls-search-list">
            {searchError && (
              <div style={{ margin: '10px 16px', padding: '10px 14px', background: 'rgba(255, 69, 58, 0.12)', border: '1px solid rgba(255, 69, 58, 0.4)', borderRadius: 10, color: '#ff6b6b', fontSize: 12 }}>
                {searchError}
              </div>
            )}

            {isSearching && searchResults.length === 0 && (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Searching destinations...
              </div>
            )}

            {!isSearching && !searchError && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No destinations found for "{searchQuery}"
              </div>
            )}

            {/* Live Search Results */}
            {searchResults.map((item, idx) => {
              const itemCityState = parseCityState(item);
              let distText = '';
              if (currentLocation && item.latitude && item.longitude) {
                const curLat = currentLocation.lat ?? currentLocation.latitude;
                const curLng = currentLocation.lng ?? currentLocation.longitude;
                const d = haversineDistance(curLat, curLng, item.latitude, item.longitude);
                distText = formatNavDistance(d);
              }

              return (
                <div
                  key={item.eLoc || idx}
                  className="mappls-search-item"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <div className="mappls-search-item-icon">📍</div>
                  <div className="mappls-search-item-content">
                    <div className="mappls-search-item-title-row">
                      <div className="mappls-search-item-title">{item.name}</div>
                      {distText && <span className="mappls-search-dist-tag">{distText}</span>}
                    </div>
                    {item.address && (
                      <div className="mappls-search-item-address">{item.address}</div>
                    )}
                    {(itemCityState.city || itemCityState.state) && (
                      <div className="mappls-search-item-meta">
                        {itemCityState.city && <span className="mappls-city-badge">City: {itemCityState.city}</span>}
                        {itemCityState.state && <span className="mappls-state-badge">State: {itemCityState.state}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Recent & Saved Places fallback in search view */}
            {searchResults.length === 0 && destinations?.saved?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ padding: '8px 18px', fontSize: 11, fontWeight: 700, fontFamily: 'Chakra Petch', color: '#00F0FF', letterSpacing: '0.05em' }}>
                  RECENT & SAVED PLACES
                </div>
                {destinations.saved.map((d) => {
                  const savedCityState = parseCityState(d);
                  let distText = '';
                  if (currentLocation && (d.latitude || d.lat) && (d.longitude || d.lng)) {
                    const curLat = currentLocation.lat ?? currentLocation.latitude;
                    const curLng = currentLocation.lng ?? currentLocation.longitude;
                    const dLat = d.latitude ?? d.lat;
                    const dLng = d.longitude ?? d.lng;
                    const distM = haversineDistance(curLat, curLng, dLat, dLng);
                    distText = formatNavDistance(distM);
                  }

                  return (
                    <div
                      key={d._id}
                      className="mappls-search-item"
                      onClick={() => {
                        setIsSearchOpen(false);
                        handleSelectSavedWaypoint(d);
                      }}
                    >
                      <div className="mappls-search-item-icon">⭐</div>
                      <div className="mappls-search-item-content">
                        <div className="mappls-search-item-title-row">
                          <div className="mappls-search-item-title">{d.name}</div>
                          {distText && <span className="mappls-search-dist-tag">{distText}</span>}
                        </div>
                        <div className="mappls-search-item-address">{d.address || 'Saved destination'}</div>
                        {(savedCityState.city || savedCityState.state) && (
                          <div className="mappls-search-item-meta">
                            {savedCityState.city && <span className="mappls-city-badge">City: {savedCityState.city}</span>}
                            {savedCityState.state && <span className="mappls-state-badge">State: {savedCityState.state}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREEN 3 & 4: DESTINATION SELECTED & ROUTE PREVIEW */}
      {destination && !isNavigating && (
        <>
          {/* Top route header summary chip */}
          <div className="mappls-top-dest-chip">
            <button
              onClick={handleExitMap}
              className="mappls-exit-map-chip-btn"
              id="mappls-exit-map-top-btn"
              title="Exit Map"
            >
              <span>←</span>
              <span>EXIT MAP</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 16 }}>📍</span>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>
                  {destination.name}
                </span>
                {(destCity || destState) && (
                  <span style={{ fontSize: 11, color: '#00F0FF', marginLeft: 6 }}>
                    · {[destCity, destState].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleClearDestination}
              className="mappls-chip-close-btn"
              title="Close destination"
            >
              ✕
            </button>
          </div>

          {/* Mappls-Style Bottom Route Panel */}
          <div className="mappls-bottom-sheet" id="mappls-route-preview-sheet">
            <div className="mappls-sheet-drag-handle" />

            <div className="mappls-route-header-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mappls-route-dest-name">{destination.name}</div>
                {destination.address && (
                  <div className="mappls-route-dest-address">{destination.address}</div>
                )}
                {/* Explicit City Name & State Name display */}
                {(destCity || destState) && (
                  <div className="mappls-city-state-row">
                    {destCity && (
                      <span className="mappls-pill-tag city">
                        City: <strong>{destCity}</strong>
                      </span>
                    )}
                    {destState && (
                      <span className="mappls-pill-tag state">
                        State: <strong>{destState}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleClearDestination}
                className="mappls-route-change-btn"
              >
                Change
              </button>
            </div>

            {/* Route Calculation Progress */}
            {isCalculatingRoute && (
              <div className="mappls-calc-progress">
                <div className="mappls-spinner-sm" style={{ borderTopColor: '#00F0FF' }} />
                <span>CALCULATING BIKE ROUTE...</span>
              </div>
            )}

            {/* Route Error */}
            {routeError && !isCalculatingRoute && (
              <div className="mappls-route-error-banner">
                <span style={{ fontSize: 12, color: '#ff6b6b' }}>{routeError}</span>
                <button
                  onClick={() => handleCalculateRoute(destination)}
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'Chakra Petch', width: 'auto' }}
                >
                  RETRY
                </button>
              </div>
            )}

            {/* Route Info & Metrics Bar */}
            {routeData && !isCalculatingRoute && (
              <>
                {/* Route Profile Options Selector */}
                <div className="mappls-route-options-row">
                  <div className="mappls-route-option-pill active">
                    <span>🏍️</span>
                    <span style={{ fontWeight: 700 }}>Fastest Bike Route</span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>(Recommended)</span>
                  </div>
                </div>

                {/* Core metrics: Travel Time, Distance in KM, Expected Arrival Time */}
                <div className="mappls-route-metrics-bar">
                  <div className="mappls-route-metric-item">
                    <div className="mappls-metric-caption">TRAVEL TIME</div>
                    <div className="mappls-route-eta">
                      {routeData.durationFormatted || Math.round((routeData.durationSeconds || routeData.duration || 60) / 60) + ' min'}
                    </div>
                  </div>
                  <div className="mappls-route-metric-item">
                    <div className="mappls-metric-caption">DISTANCE</div>
                    <div className="mappls-route-dist">
                      {routeData.distanceFormatted || ((routeData.distanceMeters || routeData.distance || 0) / 1000).toFixed(1) + ' km'}
                    </div>
                  </div>
                  <div className="mappls-route-metric-item right">
                    <div className="mappls-metric-caption">EXPECTED ARRIVAL</div>
                    <div className="mappls-route-arrival-val">
                      {formatArrivalTime(routeData.durationSeconds || routeData.duration)}
                    </div>
                  </div>
                </div>

                {routeData.summary && (
                  <div className="mappls-route-via-row">
                    <span>🛣️</span>
                    <span>Via {routeData.summary} (Two-Wheeler Profile)</span>
                  </div>
                )}

                {/* Action Buttons: NAVIGATE TO BIKE (Prominent), START NAVIGATION, and EXIT MAP */}
                <div className="mappls-route-action-buttons">
                  <button
                    className="mappls-start-btn mappls-navigate-bike-btn"
                    onClick={handleNavigateToBike}
                    disabled={!destination || isCalculatingRoute}
                    id="mappls-navigate-to-bike-btn"
                    title="Transmit destination and route to AEROVYN bike cluster"
                  >
                    <span>🏍️</span>
                    <span>NAVIGATE TO BIKE</span>
                  </button>

                  <button
                    className="mappls-secondary-start-btn"
                    onClick={handleStartNavigation}
                    disabled={isCalculatingRoute}
                    id="mappls-start-navigation-btn"
                    title="Start turn-by-turn guidance on mobile"
                  >
                    <span>▲</span>
                    <span>START NAVIGATION</span>
                  </button>

                  <button
                    className="mappls-exit-map-btn"
                    onClick={handleExitMap}
                    id="mappls-exit-map-btn"
                    title="Exit Map and return to dashboard"
                  >
                    <span>✕</span>
                    <span>EXIT MAP</span>
                  </button>
                </div>
              </>
            )}

            {/* Fallback Calculate Route button */}
            {!routeData && !isCalculatingRoute && !routeError && (
              <div className="mappls-route-action-buttons">
                <button
                  className="mappls-start-btn mappls-navigate-bike-btn"
                  onClick={handleNavigateToBike}
                  disabled={!destination || isCalculatingRoute}
                  id="mappls-navigate-to-bike-btn"
                >
                  <span>🏍️</span>
                  <span>NAVIGATE TO BIKE</span>
                </button>

                <button
                  className="mappls-secondary-start-btn"
                  onClick={() => handleCalculateRoute(destination)}
                >
                  <span>🏍️</span>
                  <span>CALCULATE ROUTE</span>
                </button>

                <button
                  className="mappls-exit-map-btn"
                  onClick={handleExitMap}
                  id="mappls-exit-map-btn"
                  title="Exit Map and return to dashboard"
                >
                  <span>✕</span>
                  <span>EXIT MAP</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* SCREEN 5: ACTIVE NAVIGATION */}
      {isNavigating && (
        <>
          {/* Active Navigation Top Bar: ← EXIT MAP */}
          <div className="mappls-nav-active-top-bar">
            <button
              onClick={handleExitMap}
              className="mappls-exit-map-chip-btn mappls-nav-active-exit-btn"
              id="mappls-exit-map-active-btn"
              title="Exit Map"
            >
              <span>←</span>
              <span>EXIT MAP</span>
            </button>
          </div>

          {/* Top Turn Card (Mappls Signature Blue Banner) */}
          <div className="mappls-turn-card-container">
            <div className="mappls-turn-card-main">
              <div className="mappls-turn-icon-box">
                <ManeuverIcon
                  maneuver={navTelemetry?.maneuver || navigationGuidance?.maneuver || 'CONTINUE'}
                  size={36}
                  color="#ffffff"
                />
              </div>
              <div className="mappls-turn-info">
                <div className="mappls-turn-distance">
                  {navTelemetry?.distanceToManeuverFormatted || formatNavDistance(navTelemetry?.distanceToManeuver || 0)}
                </div>
                <div className="mappls-turn-instruction">
                  {navTelemetry?.instruction || navigationGuidance?.instruction || 'Continue on route'}
                </div>
                <div className="mappls-turn-subtext">
                  {navTelemetry?.nextRoadName || navTelemetry?.currentStep?.roadName || destination?.name || ''}
                </div>
              </div>

              {/* Next Step Preview Chip */}
              {navTelemetry?.nextStep && (
                <div className="mappls-turn-next-pill">
                  <span>Then {formatNavDistance(navTelemetry.nextStep.distance || 0)}</span>
                  <ManeuverIcon
                    maneuver={navTelemetry.nextStep.normalizedManeuver || 'CONTINUE'}
                    size={14}
                    color="#000000"
                  />
                </div>
              )}
            </div>

            {/* Small non-intrusive status indicators */}
            <div className="mappls-status-pills-row">
              {isGpsSignalLost && (
                <div className="mappls-status-pill gps-lost" id="mappls-gps-lost-indicator">
                  <span>⚠️</span>
                  <span>GPS SIGNAL LOST</span>
                </div>
              )}

              {isRecalculating && (
                <div className="mappls-status-pill recalculating" id="mappls-recalculating-indicator">
                  <div className="mappls-spinner-sm" />
                  <span>RECALCULATING ROUTE</span>
                </div>
              )}

              {isRouteUpdated && !isRecalculating && (
                <div className="mappls-status-pill route-updated" id="mappls-route-updated-indicator">
                  <span>✓</span>
                  <span>ROUTE UPDATED</span>
                </div>
              )}

              {isDestinationReached && (
                <div className="mappls-status-pill arrived" id="mappls-arrived-indicator">
                  <span>🏁</span>
                  <span>ARRIVED</span>
                </div>
              )}
            </div>
          </div>

          {/* Compact Bottom Navigation Info Bar */}
          <div className="mappls-bottom-nav-bar" id="mappls-active-bottom-bar">
            <div className="mappls-bottom-nav-left">
              <div className="mappls-bottom-nav-eta-row">
                <span className="mappls-bottom-nav-arrival-time">
                  {formatArrivalTime(navTelemetry?.remainingDurationSeconds || (navTelemetry?.etaMinutes || 1) * 60)}
                </span>
                <span className="mappls-bottom-nav-dist">
                  {navTelemetry?.distanceRemainingFormatted || '0 m'}
                </span>
                <span className="mappls-bottom-nav-eta">
                  {navTelemetry?.etaMinutes || 1} min
                </span>
              </div>
              <div className="mappls-bottom-nav-dest-row">
                <span className="mappls-bottom-dest-name">{destination?.name}</span>
                {(destCity || destState) && (
                  <span className="mappls-bottom-dest-geo">
                    · {[destCity, destState].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>

            <div className="mappls-bottom-nav-right">
              <button
                className="mappls-stop-nav-btn"
                onClick={() => setShowStopConfirm(true)}
                title="Stop Navigation"
                id="mappls-stop-nav-btn"
              >
                ✕ STOP
              </button>
            </div>
          </div>

          {/* Stop Navigation Confirmation Dialog */}
          {showStopConfirm && (
            <div className="mappls-confirm-modal-overlay" id="mappls-stop-confirm-modal">
              <div className="mappls-confirm-modal">
                <div className="mappls-confirm-icon">🛑</div>
                <div className="mappls-confirm-title">Stop navigation?</div>
                <div className="mappls-confirm-subtext">
                  Are you sure you want to end active navigation guidance?
                </div>
                <div className="mappls-confirm-actions">
                  <button
                    className="mappls-confirm-btn cancel"
                    onClick={() => setShowStopConfirm(false)}
                    id="mappls-confirm-cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    className="mappls-confirm-btn stop"
                    onClick={() => {
                      setShowStopConfirm(false);
                      handleStopNavigation();
                    }}
                    id="mappls-confirm-stop-btn"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Exit Navigation Confirmation Dialog */}
          {showExitConfirm && (
            <div className="mappls-confirm-modal-overlay" id="mappls-exit-nav-confirm-modal">
              <div className="mappls-confirm-modal">
                <div className="mappls-confirm-icon">🛑</div>
                <div className="mappls-confirm-title">Exit Navigation?</div>
                <div className="mappls-confirm-subtext">
                  Your current navigation will be stopped.
                </div>
                <div className="mappls-confirm-actions">
                  <button
                    className="mappls-confirm-btn cancel"
                    onClick={() => setShowExitConfirm(false)}
                    id="mappls-exit-confirm-cancel-btn"
                  >
                    CANCEL
                  </button>
                  <button
                    className="mappls-confirm-btn stop"
                    onClick={() => {
                      setShowExitConfirm(false);
                      handleStopNavigation();
                      setDestination(null);
                      setSearchQuery('');
                      setSearchResults([]);
                      setSearchError(null);
                      setIsDropdownOpen(false);
                      setIsSearchOpen(false);
                      setRouteData(null);
                      setRouteError(null);
                      setIsNavReady(false);
                      if (typeof onBack === 'function') {
                        onBack();
                      } else if (typeof onNavigate === 'function') {
                        onNavigate('dashboard');
                      }
                    }}
                    id="mappls-exit-confirm-exit-btn"
                  >
                    EXIT
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Clean Mappls-Style Arrival Confirmation Bottom Card */}
          {isDestinationReached && (
            <div className="mappls-arrival-bottom-card" id="mappls-arrival-card">
              <div className="mappls-arrival-header">
                <div className="mappls-arrival-check-icon">✓</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mappls-arrival-title">YOU'VE ARRIVED</div>
                  <div className="mappls-arrival-dest-name">{destination?.name}</div>
                  {(destCity || destState) && (
                    <div className="mappls-arrival-dest-sub">
                      {[destCity, destState].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="mappls-arrival-summary-grid">
                <div className="mappls-arrival-metric">
                  <span className="mappls-metric-label">DISTANCE</span>
                  <span className="mappls-metric-val">{routeData?.distanceFormatted || 'Completed'}</span>
                </div>
                <div className="mappls-arrival-metric">
                  <span className="mappls-metric-label">TIME</span>
                  <span className="mappls-metric-val">{routeData?.durationFormatted || 'Arrived'}</span>
                </div>
              </div>

              <div className="mappls-arrival-btn-row">
                <button
                  className="mappls-arrival-btn done"
                  onClick={handleStopNavigation}
                  id="mappls-arrival-done-btn"
                >
                  DONE
                </button>
                <button
                  className="mappls-arrival-btn start-new"
                  onClick={() => {
                    handleStopNavigation();
                    setIsSearchOpen(true);
                  }}
                  id="mappls-arrival-new-btn"
                >
                  START NEW NAVIGATION
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function RideStatsScreen() {
  const { statistics } = useBike();

  const stats = statistics || {
    totalRides: 48,
    totalDistanceKm: 1420.5,
    totalDurationMinutes: 1840,
    maxSpeedKmh: 138.6,
    averageSpeedKmh: 48.2,
    longestRideKm: 74.8,
  };

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>RIDE STATISTICS</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lifetime Riding Telemetry & Milestones</p>
        </div>
        <span className="badge" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.18)', color: '#ffffff', fontFamily: 'Chakra Petch', fontWeight: 700 }}>
          ODOMETER: {stats.totalDistanceKm} KM
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <div className="card">
          <div className="card-title">Total Distance</div>
          <div className="metric-val">{stats.totalDistanceKm}<span className="metric-unit">km</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Across all journeys</div>
        </div>

        <div className="card">
          <div className="card-title">Total Rides</div>
          <div className="metric-val">{stats.totalRides}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Completed trips</div>
        </div>

        <div className="card">
          <div className="card-title">Top Speed</div>
          <div className="metric-val">{stats.maxSpeedKmh}<span className="metric-unit">km/h</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Highest recorded speed</div>
        </div>

        <div className="card">
          <div className="card-title">Avg Speed</div>
          <div className="metric-val">{stats.averageSpeedKmh}<span className="metric-unit">km/h</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Average cruising pace</div>
        </div>

        <div className="card">
          <div className="card-title">Total Riding Time</div>
          <div className="metric-val">{Math.round(stats.totalDurationMinutes / 60)}<span className="metric-unit">hrs</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Saddle time</div>
        </div>

        <div className="card">
          <div className="card-title">Longest Ride</div>
          <div className="metric-val">{stats.longestRideKm}<span className="metric-unit">km</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Single excursion record</div>
        </div>
      </div>
    </div>
  );
}

export function RideHistoryScreen() {
  const { rides } = useBike();

  const defaultRides = [
    {
      id: '1',
      date: 'Today, 4:15 PM',
      distanceKm: 24.8,
      durationMinutes: 32,
      avgSpeed: 46.5,
      maxSpeed: 98.2,
      mode: 'SPORT',
      start: 'Downtown Pavilion',
      end: 'Highland Overlook',
    },
    {
      id: '2',
      date: 'Yesterday, 8:40 AM',
      distanceKm: 18.2,
      durationMinutes: 28,
      avgSpeed: 39.0,
      maxSpeed: 84.5,
      mode: 'NORMAL',
      start: 'Home Garage',
      end: 'Tech Park Campus',
    },
    {
      id: '3',
      date: 'Sep 7, 6:10 PM',
      distanceKm: 42.6,
      durationMinutes: 52,
      avgSpeed: 49.2,
      maxSpeed: 118.0,
      mode: 'SPORT',
      start: 'West Lake Ring',
      end: 'Ridge View Point',
    },
  ];

  const rideList = rides && rides.length > 0 ? rides : defaultRides;

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>RIDE HISTORY</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chronological Riding Log</p>
        </div>
        <span className="badge" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.18)', color: '#ffffff', fontFamily: 'Chakra Petch', fontWeight: 700 }}>
          {rideList.length} JOURNEYS
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rideList.map((ride, idx) => (
          <div key={ride._id || ride.id || idx} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                {ride.date || (ride.startTime ? new Date(ride.startTime).toLocaleDateString() : 'Recent Ride')}
              </span>
              <span className="badge" style={{
                background: (ride.ridingMode === 'SPORT' || ride.mode === 'SPORT') ? '#ffffff' : '#111113',
                color: (ride.ridingMode === 'SPORT' || ride.mode === 'SPORT') ? '#000000' : '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontFamily: 'Chakra Petch',
                fontWeight: 700,
              }}>
                {ride.ridingMode || ride.mode || 'NORMAL'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0' }}>
              <div>
                <span style={{ fontFamily: 'Chakra Petch', fontSize: 26, fontWeight: 700, color: '#ffffff' }}>
                  {ride.distanceKm}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>KM</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ⏱ {ride.durationMinutes} mins · Avg: {ride.averageSpeedKmh || ride.avgSpeed} km/h
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              📍 {ride.startLocation?.address || ride.start || 'Start'} ➔ {ride.endLocation?.address || ride.end || 'Destination'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
