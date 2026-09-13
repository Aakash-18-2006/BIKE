import React, { useEffect, useRef, useState, useCallback } from 'react';
import { mappls } from 'mappls-web-maps';
import { Icon } from '../common/Icons.jsx';
import {
  normalizeCoordinates,
  toMapplsCoordinate,
  toMapplsGeoJSON,
  toMapplsLngLat,
  toMapplsLatLngObj,
  toMapplsBounds,
  toRouteBounds,
  haversineDistance,
} from '../../utils/coordinates.js';

/**
 * Format error object safely without displaying "[object Object]"
 */
export function formatMapplsError(error) {
  if (!error) return 'Unknown Mappls error (null/undefined)';
  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    return error.message || error.stack || error.toString();
  }

  const parts = [];
  if (error.error) parts.push(`Error: ${typeof error.error === 'object' ? JSON.stringify(error.error) : error.error}`);
  if (error.error_description) parts.push(`Description: ${error.error_description}`);
  if (error.message) parts.push(`Message: ${error.message}`);
  if (error.error_code) parts.push(`Code: ${error.error_code}`);
  if (error.responsecode) parts.push(`Response Code: ${error.responsecode}`);
  if (error.status) parts.push(`Status: ${error.status}`);
  if (error.statusText) parts.push(`Status Text: ${error.statusText}`);
  if (error.details) parts.push(`Details: ${typeof error.details === 'object' ? JSON.stringify(error.details) : error.details}`);

  if (parts.length > 0) return parts.join(' | ');

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

// Single-flight loader for Mappls SDK
let cachedMapplsInstance = null;
let sdkLoadPromise = null;
let loadedApiKey = null;

function loadMapplsSdk(apiKey) {
  if (cachedMapplsInstance && loadedApiKey === apiKey && window.mappls && typeof window.mappls.Map === 'function') {
    return Promise.resolve(cachedMapplsInstance);
  }

  if (sdkLoadPromise && loadedApiKey === apiKey) {
    return sdkLoadPromise;
  }

  loadedApiKey = apiKey;
  cachedMapplsInstance = null;

  console.log('[Mappls Mobile] SDK initialization started');

  sdkLoadPromise = new Promise((resolve, reject) => {
    let timeoutId = null;
    let observer = null;
    let settled = false;

    const finalizeSuccess = (instance) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (observer) observer.disconnect();
      cachedMapplsInstance = instance;
      console.log('[Mappls Mobile] SDK initialized');
      resolve(instance);
    };

    const finalizeFailure = (errData) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (observer) observer.disconnect();
      sdkLoadPromise = null;
      console.error('[Mappls Mobile] Initialization failed:', formatMapplsError(errData));
      reject(errData);
    };

    // If window.mappls is already present
    if (window.mappls && typeof window.mappls.Map === 'function') {
      try {
        const instance = new mappls();
        finalizeSuccess(instance);
        return;
      } catch (err) {
        finalizeFailure(err);
        return;
      }
    }

    try {
      const instance = new mappls();

      // Monitor DOM for script tag errors
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.tagName === 'SCRIPT' && node.src && node.src.includes('mappls.com')) {
              node.addEventListener('error', () => {
                finalizeFailure({
                  status: 'SCRIPT_LOAD_ERROR',
                  message: 'Failed to load script from ' + node.src,
                });
              });
            }
          }
        }
      });
      observer.observe(document.head, { childList: true });

      // Safety timeout: 10 seconds
      timeoutId = setTimeout(() => {
        if (!settled) {
          finalizeFailure({
            status: 408,
            message: 'Mappls SDK initialization timed out after 10 seconds.',
          });
        }
      }, 10000);

      // Official Mappls Web Maps initialization for installed package
      instance.initialize(
        apiKey,
        {
          map: true,
          version: '3.0',
          plugins: ['search'],
        },
        () => {
          finalizeSuccess(instance);
        }
      );
    } catch (exc) {
      finalizeFailure(exc);
    }
  });

  return sdkLoadPromise;
}

export function MapplsMobileMap({
  height = 360,
  destination = null,
  routeData = null,
  isNavigating = false,
  isMapFollowing = true,
  currentLocation = null,
  onLocationUpdate,
  onMapDrag,
  onRecenter,
  style = {},
  hideBuiltInControls = false,
  mapRef = null,
}) {
  const [mapStatus, setMapStatus] = useState('INITIALIZING'); // INITIALIZING, READY, FAILED
  const [errorMessage, setErrorMessage] = useState(null);
  const [userLocation, setUserLocation] = useState(currentLocation);

  // Sync external currentLocation with internal state
  useEffect(() => {
    if (currentLocation) {
      const norm = normalizeCoordinates(currentLocation);
      if (norm) {
        setUserLocation(norm);
      }
    }
  }, [currentLocation]);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const routeGlowPolylineRef = useRef(null);
  const sdkInstanceRef = useRef(null);
  const lastCameraPosRef = useRef(null);
  const lastCameraBearingRef = useRef(0);

  const apiKey = import.meta.env.VITE_MAPPLS_API_KEY;

  // Request and watch user geolocation (only if not provided by external filter)
  const requestLocation = useCallback(() => {
    if (currentLocation) {
      // Use filtered GPS location from parent props as source of truth
      return;
    }
    if (!navigator.geolocation) {
      console.warn('[Mappls Mobile] Geolocation is not supported by this browser/device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const norm = normalizeCoordinates({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        const coords = {
          lat: norm.lat,
          lng: norm.lng,
          latitude: norm.lat,
          longitude: norm.lng,
          accuracy: pos.coords.accuracy,
        };
        console.log('[Mappls Mobile] Location permission granted');
        console.log(`[MAP DEBUG] Current: ${coords.lat}, ${coords.lng}`);
        setUserLocation(coords);

        if (onLocationUpdate) {
          onLocationUpdate(coords);
        }

        // Center map if already ready and no active destination
        if (mapInstanceRef.current && !destination) {
          try {
            const userPos = { lat: coords.lat, lng: coords.lng };
            if (typeof mapInstanceRef.current.setCenter === 'function') {
              mapInstanceRef.current.setCenter(userPos);
            } else if (typeof mapInstanceRef.current.panTo === 'function') {
              mapInstanceRef.current.panTo(userPos);
            }
          } catch (e) {
            console.warn('[Mappls Mobile] Could not center map:', e);
          }
        }
      },
      (err) => {
        console.warn('[Mappls Mobile] Location access denied or unavailable:', err.message);
        // Default to Bengaluru center if denied
        const fallback = { lat: 12.9716, lng: 77.5946, latitude: 12.9716, longitude: 77.5946, fallback: true };
        console.log(`[MAP DEBUG] Current: ${fallback.lat}, ${fallback.lng}`);
        setUserLocation(fallback);
        if (onLocationUpdate) {
          onLocationUpdate(fallback);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [onLocationUpdate, destination]);

  // Center on current user position
  const handleMyLocationClick = () => {
    const norm = normalizeCoordinates(userLocation);
    if (norm && mapInstanceRef.current) {
      try {
        const userPos = { lat: norm.lat, lng: norm.lng };
        if (typeof mapInstanceRef.current.setCenter === 'function') {
          mapInstanceRef.current.setCenter(userPos);
        } else if (typeof mapInstanceRef.current.panTo === 'function') {
          mapInstanceRef.current.panTo(userPos);
        }
        if (typeof mapInstanceRef.current.setZoom === 'function') {
          mapInstanceRef.current.setZoom(15);
        }
      } catch (e) {
        console.warn('[Mappls Mobile] Error centering on user location:', e);
      }
    } else {
      requestLocation();
    }
    if (onRecenter) {
      onRecenter();
    }
  };

  // Zoom In handler for driver-friendly map control
  const handleZoomIn = useCallback(() => {
    if (!mapInstanceRef.current) return;
    try {
      if (typeof mapInstanceRef.current.zoomIn === 'function') {
        mapInstanceRef.current.zoomIn();
      } else if (typeof mapInstanceRef.current.getZoom === 'function' && typeof mapInstanceRef.current.setZoom === 'function') {
        mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1);
      }
    } catch (e) {
      console.warn('[Mappls Mobile] Zoom in notice:', e);
    }
  }, []);

  // Zoom Out handler for driver-friendly map control
  const handleZoomOut = useCallback(() => {
    if (!mapInstanceRef.current) return;
    try {
      if (typeof mapInstanceRef.current.zoomOut === 'function') {
        mapInstanceRef.current.zoomOut();
      } else if (typeof mapInstanceRef.current.getZoom === 'function' && typeof mapInstanceRef.current.setZoom === 'function') {
        mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() - 1);
      }
    } catch (e) {
      console.warn('[Mappls Mobile] Zoom out notice:', e);
    }
  }, []);

  // Expose methods via mapRef if parent provided one
  useEffect(() => {
    if (mapRef) {
      mapRef.current = {
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        centerOnLocation: handleMyLocationClick,
        getMapInstance: () => mapInstanceRef.current,
      };
    }
  }, [mapRef, handleZoomIn, handleZoomOut, userLocation]);

  // Initialize Map
  useEffect(() => {
    let isCurrentMount = true;

    // Check API Key
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_mappls_static_key_here') {
      const errText = 'VITE_MAPPLS_API_KEY is not configured in mobile-app/.env';
      console.error('[Mappls Mobile] Initialization failed:', errText);
      setErrorMessage(errText);
      setMapStatus('FAILED');
      return;
    }

    const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '****';
    console.log(`[Mappls Mobile] API key detected (${maskedKey})`);

    // Request user location only if not already provided externally
    if (!currentLocation) {
      requestLocation();
    }

    // Load Mappls SDK
    loadMapplsSdk(apiKey)
      .then((sdkInstance) => {
        if (!isCurrentMount) return;
        sdkInstanceRef.current = sdkInstance;

        const container = mapContainerRef.current;
        if (!container) {
          throw new Error('Map container DOM element not found');
        }

        // Clean up previous instance
        if (mapInstanceRef.current) {
          try {
            if (typeof mapInstanceRef.current.remove === 'function') {
              mapInstanceRef.current.remove();
            }
          } catch (e) {
            console.warn('[Mappls Mobile] Cleanup warning:', e);
          }
          mapInstanceRef.current = null;
        }
        container.innerHTML = '';

        // Default initial center: user location or Bengaluru
        // MapLibre / Mappls Web Maps GL properties.center expects [longitude, latitude]
        const normUser = normalizeCoordinates(currentLocation || userLocation);
        const initialCenter = normUser
          ? [normUser.lng, normUser.lat]
          : [77.5946, 12.9716];

        try {
          const map = sdkInstance.Map({
            id: container.id,
            properties: {
              center: initialCenter,
              zoom: 14,
              zoomControl: true,
              location: false,
              fullscreenControl: false,
              scaleControl: true,
              rotateControl: true,
            },
          });

          if (!map) {
            throw new Error('sdkInstance.Map() returned null or undefined');
          }

          mapInstanceRef.current = map;
          console.log('[Mappls Mobile] Map created');

          if (typeof map.on === 'function') {
            map.on('load', () => {
              if (isCurrentMount) {
                setMapStatus('READY');
                setErrorMessage(null);
              }
            });

            map.on('error', (mapErr) => {
              console.error('[Mappls Mobile] Map runtime error:', mapErr);
              if (isCurrentMount) {
                setErrorMessage(formatMapplsError(mapErr));
              }
            });

            map.on('dragstart', () => {
              if (onMapDrag) onMapDrag();
            });
          } else {
            setMapStatus('READY');
          }
        } catch (mapErr) {
          console.error('[Mappls Mobile] Initialization failed:', mapErr);
          if (isCurrentMount) {
            setErrorMessage(formatMapplsError(mapErr));
            setMapStatus('FAILED');
          }
        }
      })
      .catch((err) => {
        if (!isCurrentMount) return;
        console.error('[Mappls Mobile] Initialization failed:', err);
        setErrorMessage(formatMapplsError(err));
        setMapStatus('FAILED');
      });

    return () => {
      isCurrentMount = false;
      if (userMarkerRef.current) {
        try {
          if (typeof userMarkerRef.current.remove === 'function') {
            userMarkerRef.current.remove();
          }
        } catch (e) { }
        userMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        try {
          if (typeof destinationMarkerRef.current.remove === 'function') {
            destinationMarkerRef.current.remove();
          }
        } catch (e) { }
        destinationMarkerRef.current = null;
      }
      if (routeGlowPolylineRef.current) {
        try {
          if (typeof routeGlowPolylineRef.current.remove === 'function') {
            routeGlowPolylineRef.current.remove();
          } else if (typeof routeGlowPolylineRef.current.setMap === 'function') {
            routeGlowPolylineRef.current.setMap(null);
          }
        } catch (e) { }
        routeGlowPolylineRef.current = null;
      }
      if (routePolylineRef.current) {
        try {
          if (typeof routePolylineRef.current.remove === 'function') {
            routePolylineRef.current.remove();
          } else if (typeof routePolylineRef.current.setMap === 'function') {
            routePolylineRef.current.setMap(null);
          }
        } catch (e) { }
        routePolylineRef.current = null;
      }
      if (mapInstanceRef.current) {
        try {
          if (typeof mapInstanceRef.current.remove === 'function') {
            mapInstanceRef.current.remove();
          }
        } catch (e) { }
        mapInstanceRef.current = null;
      }
    };
  }, [apiKey]);

  // Update or place user location marker (Current GPS Location from accepted GPS pipeline)
  useEffect(() => {
    const effectiveLoc = currentLocation || userLocation;
    const normUser = normalizeCoordinates(effectiveLoc);
    if (!normUser || !mapInstanceRef.current) return;

    try {
      const pos = toMapplsCoordinate(normUser);

      const heading = Number.isFinite(currentLocation?.heading) ? currentLocation.heading : null;
      if (userMarkerRef.current) {
        if (typeof userMarkerRef.current.setPosition === 'function') {
          userMarkerRef.current.setPosition(pos);
        }
        if (typeof userMarkerRef.current.getElement === 'function') {
          const el = userMarkerRef.current.getElement();
          const arrowEl = el?.querySelector?.('.bike-heading-pointer');
          if (arrowEl) {
            if (heading !== null) {
              arrowEl.style.display = 'block';
              arrowEl.style.transform = `rotate(${heading}deg)`;
            } else {
              arrowEl.style.display = 'none';
            }
          }
        }
      } else {
        const MarkerConstructor = (window.mappls && window.mappls.Marker) || (sdkInstanceRef.current && sdkInstanceRef.current.Marker);
        if (MarkerConstructor) {
          const marker = new MarkerConstructor({
            map: mapInstanceRef.current,
            position: pos,
            width: 28,
            height: 28,
            offset: [0, 0],
            fitbounds: false,
            html: `
              <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; pointer-events:auto;">
                <div class="bike-heading-pointer" style="position:absolute; width:28px; height:28px; pointer-events:none; display:${heading !== null ? 'block' : 'none'}; transform:rotate(${heading || 0}deg); transition:transform 0.3s ease;">
                  <svg viewBox="0 0 24 24" style="width:28px; height:28px; fill:#00F0FF; filter:drop-shadow(0 0 4px rgba(0,240,255,0.9));">
                    <path d="M12 2 L18 20 L12 16 L6 20 Z" />
                  </svg>
                </div>
                <div style="position:relative; z-index:2; width:16px; height:16px; border-radius:50%; background:#00F0FF; border:3px solid #ffffff; box-shadow:0 0 14px #00F0FF; box-sizing:border-box;"></div>
              </div>
            `,
          });

          // Ensure geographic anchor is exact center of the circular dot
          marker._anchor = 'center';
          if (typeof marker.setOffset === 'function') {
            marker.setOffset([0, 0]);
          }
          if (typeof marker.getElement === 'function') {
            const el = marker.getElement();
            if (el) {
              el.style.width = '28px';
              el.style.height = '28px';
              el.style.background = 'transparent';
            }
          }
          if (typeof marker._update === 'function') {
            marker._update();
          }

          userMarkerRef.current = marker;
        }
      }

      const normDest = normalizeCoordinates(destination);
      console.log('[MARKER DEBUG]');
      console.log(`Blue marker: {lat: ${normUser.lat}, lng: ${normUser.lng}}`);
      console.log(`Red marker: {lat: ${normDest?.lat ?? 'none'}, lng: ${normDest?.lng ?? 'none'}}`);
      console.log('Blue anchor: center');
      console.log('Red anchor: bottom');
    } catch (markerErr) {
      console.warn('[Mappls Mobile] User marker placement notice:', markerErr);
    }
  }, [userLocation, mapStatus, destination]);

  // Handle Destination Marker Placement & Direct Centering on Selected Destination
  useEffect(() => {
    if (!mapInstanceRef.current || mapStatus !== 'READY') return;

    if (destination) {
      const normDest = normalizeCoordinates(destination);
      if (normDest) {
        const destPos = toMapplsCoordinate(normDest);

        // Required [COORD DEBUG] destination logs:
        console.log('[COORD DEBUG]');
        console.log('Destination raw object:', destination);
        console.log(`Destination latitude: ${normDest.lat}`);
        console.log(`Destination longitude: ${normDest.lng}`);
        console.log(`Destination marker coordinate: {lat: ${destPos.lat}, lng: ${destPos.lng}}`);

        console.log(`[MAP DEBUG] Destination: ${normDest.lat}, ${normDest.lng}`);
        const mapplsCoords = toMapplsGeoJSON(normDest);
        console.log(`[MAP DEBUG] Map coordinates: [${mapplsCoords[0]}, ${mapplsCoords[1]}]`);

        // Clean up any existing destination marker so the new pin with updated label is fresh
        if (destinationMarkerRef.current) {
          try {
            if (typeof destinationMarkerRef.current.remove === 'function') {
              destinationMarkerRef.current.remove();
            }
          } catch (e) { }
          destinationMarkerRef.current = null;
        }

        const MarkerConstructor = (window.mappls && window.mappls.Marker) || (sdkInstanceRef.current && sdkInstanceRef.current.Marker);
        if (MarkerConstructor) {
          const destName = destination.name && destination.name.length > 20
            ? destination.name.substring(0, 18) + '...'
            : (destination.name || 'Destination');

          const destMarker = new MarkerConstructor({
            map: mapInstanceRef.current,
            position: destPos,
            anchor: 'bottom',
            offset: [0, 0],
            fitbounds: false,
            html: `
              <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer; pointer-events:auto; z-index:100;">
                <div style="background:#ff3b30; color:#ffffff; padding:4px 9px; border-radius:12px; font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; white-space:nowrap; box-shadow:0 4px 16px rgba(255,59,48,0.6); border:1px solid #ffffff; display:flex; align-items:center; gap:5px;">
                  <span>📍</span>
                  <span>${destName}</span>
                </div>
                <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid #ff3b30; margin-top:-1px;"></div>
              </div>
            `,
          });

          // Anchor the pin so its bottom-pointing tip is anchored exactly to the road coordinate
          destMarker._anchor = 'bottom';
          if (typeof destMarker.setOffset === 'function') {
            destMarker.setOffset([0, 0]);
          }
          if (typeof destMarker.getElement === 'function') {
            const el = destMarker.getElement();
            if (el) {
              el.style.width = 'max-content';
              el.style.height = 'max-content';
              el.style.display = 'flex';
              el.style.flexDirection = 'column';
              el.style.alignItems = 'center';
              el.style.background = 'transparent';
            }
          }
          if (typeof destMarker._update === 'function') {
            destMarker._update();
          }

          destinationMarkerRef.current = destMarker;
        }

        const normUser = normalizeCoordinates(userLocation);
        console.log('[MARKER DEBUG]');
        console.log(`Blue marker: {lat: ${normUser?.lat ?? 'none'}, lng: ${normUser?.lng ?? 'none'}}`);
        console.log(`Red marker: {lat: ${normDest.lat}, lng: ${normDest.lng}}`);
        console.log('Blue anchor: center');
        console.log('Red anchor: bottom');

        // Center map directly on selected destination (if route is not active yet)
        if (!routeData) {
          try {
            if (typeof mapInstanceRef.current.setCenter === 'function') {
              mapInstanceRef.current.setCenter(destPos);
            } else if (typeof mapInstanceRef.current.panTo === 'function') {
              mapInstanceRef.current.panTo(destPos);
            }
            if (typeof mapInstanceRef.current.setZoom === 'function') {
              mapInstanceRef.current.setZoom(15);
            }
          } catch (centerErr) {
            console.warn('[Mappls Mobile] setCenter notice:', centerErr);
          }
        }
      }
    } else {
      // Remove destination marker when cleared
      if (destinationMarkerRef.current) {
        console.log('[Mappls Mobile] Destination marker removed');
        try {
          if (typeof destinationMarkerRef.current.remove === 'function') {
            destinationMarkerRef.current.remove();
          }
        } catch (e) { }
        destinationMarkerRef.current = null;
      }

      // Smoothly re-center on current user GPS position
      const normUser = normalizeCoordinates(userLocation);
      if (normUser && mapInstanceRef.current) {
        try {
          const userPos = { lat: normUser.lat, lng: normUser.lng };
          if (typeof mapInstanceRef.current.setCenter === 'function') {
            mapInstanceRef.current.setCenter(userPos);
          } else if (typeof mapInstanceRef.current.panTo === 'function') {
            mapInstanceRef.current.panTo(userPos);
          }
          if (typeof mapInstanceRef.current.setZoom === 'function') {
            mapInstanceRef.current.setZoom(15);
          }
        } catch (centerErr) {
          console.warn('[Mappls Mobile] Re-centering notice:', centerErr);
        }
      }
    }
  }, [destination, userLocation, mapStatus, routeData]);

  // Render Route Polyline & Bounds on Map
  useEffect(() => {
    if (!mapInstanceRef.current || mapStatus !== 'READY') return;

    const clearRoutePolyline = () => {
      const map = mapInstanceRef.current;
      if (!map) return;

      try {
        if (typeof map.getLayer === 'function') {
          if (map.getLayer('bike-route-line')) {
            map.removeLayer('bike-route-line');
          }
          if (map.getLayer('bike-route-glow')) {
            map.removeLayer('bike-route-glow');
          }
        }
        if (typeof map.getSource === 'function') {
          if (map.getSource('bike-route-source')) {
            map.removeSource('bike-route-source');
          }
        }
      } catch (e) {
        console.warn('[Mappls Mobile] Route layer cleanup notice:', e);
      }

      if (routeGlowPolylineRef.current) {
        try {
          if (typeof routeGlowPolylineRef.current.remove === 'function') {
            routeGlowPolylineRef.current.remove();
          } else if (typeof routeGlowPolylineRef.current.setMap === 'function') {
            routeGlowPolylineRef.current.setMap(null);
          }
        } catch (e) { }
        routeGlowPolylineRef.current = null;
      }
      if (routePolylineRef.current) {
        try {
          if (typeof routePolylineRef.current.remove === 'function') {
            routePolylineRef.current.remove();
          } else if (typeof routePolylineRef.current.setMap === 'function') {
            routePolylineRef.current.setMap(null);
          }
        } catch (e) { }
        routePolylineRef.current = null;
      }
    };

    if (routeData && ((Array.isArray(routeData.rawCoordinates) && routeData.rawCoordinates.length > 0) || (Array.isArray(routeData.coordinates) && routeData.coordinates.length > 0))) {
      // 1. Extract complete, unsimplified route geometry
      let rawList = [];
      if (Array.isArray(routeData.rawCoordinates) && routeData.rawCoordinates.length > 0) {
        rawList = routeData.rawCoordinates;
      } else if (Array.isArray(routeData.coordinates) && routeData.coordinates.length > 0) {
        rawList = routeData.coordinates;
      }

      // Convert strictly to GeoJSON standard [longitude, latitude] using centralized utility
      const cleanGeojsonCoords = rawList.map((pt) => toMapplsGeoJSON(pt)).filter(Boolean);

      // 2. Output required temporary development logs
      const geomType = routeData.geometryType || 'LineString';
      const pointsCount = cleanGeojsonCoords.length;
      const midIdx = Math.floor(pointsCount / 2);
      const firstRaw = rawList[0];
      const secondRaw = rawList[1] || firstRaw;
      const midRaw = rawList[midIdx] || firstRaw;
      const lastRaw = rawList[pointsCount - 1] || firstRaw;

      console.log('[COORD DEBUG]');
      console.log(`Route geometry type: ${geomType}`);
      console.log(`First raw route coordinate: ${JSON.stringify(firstRaw)}`);
      console.log(`Second raw route coordinate: ${JSON.stringify(secondRaw)}`);
      console.log(`Middle raw route coordinate: ${JSON.stringify(midRaw)}`);
      console.log(`Last raw route coordinate: ${JSON.stringify(lastRaw)}`);

      console.log('[BLUE ROUTE DEBUG]');
      console.log(`Geometry type: ${geomType}`);
      console.log(`Number of route points: ${pointsCount}`);
      console.log(`First coordinate: [${cleanGeojsonCoords[0]?.[0]}, ${cleanGeojsonCoords[0]?.[1]}]`);
      console.log(`Middle coordinate: [${cleanGeojsonCoords[midIdx]?.[0]}, ${cleanGeojsonCoords[midIdx]?.[1]}]`);
      console.log(`Last coordinate: [${cleanGeojsonCoords[pointsCount - 1]?.[0]}, ${cleanGeojsonCoords[pointsCount - 1]?.[1]}]`);

      // Stage 5 Cross-verification logs:
      const normUser = normalizeCoordinates(userLocation);
      const normDest = normalizeCoordinates(destination);
      const mapCenter = mapInstanceRef.current && typeof mapInstanceRef.current.getCenter === 'function' ? mapInstanceRef.current.getCenter() : null;

      console.log('[COORD STAGE 5 VERIFY]');
      console.log(`GPS: {lat: ${normUser?.lat ?? 'none'}, lng: ${normUser?.lng ?? 'none'}}`);
      console.log(`Map coordinate: [${mapCenter?.lng != null ? mapCenter.lng.toFixed(6) : 'none'}, ${mapCenter?.lat != null ? mapCenter.lat.toFixed(6) : 'none'}]`);
      console.log(`Destination: {lat: ${normDest?.lat ?? 'none'}, lng: ${normDest?.lng ?? 'none'}}`);
      console.log(`Destination marker: [${toMapplsGeoJSON(normDest)?.[0] ?? 'none'}, ${toMapplsGeoJSON(normDest)?.[1] ?? 'none'}]`);
      console.log(`Route first point: [${cleanGeojsonCoords[0]?.[0]}, ${cleanGeojsonCoords[0]?.[1]}]`);
      console.log(`Route last point: [${cleanGeojsonCoords[pointsCount - 1]?.[0]}, ${cleanGeojsonCoords[pointsCount - 1]?.[1]}]`);

      const map = mapInstanceRef.current;
      const routeGeoJson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: cleanGeojsonCoords,
        },
      };

      // 3. Render directly on MapLibre / Mappls map canvas for sub-pixel road accuracy
      if (typeof map.addSource === 'function' && typeof map.addLayer === 'function') {
        try {
          const existingSource = typeof map.getSource === 'function' && map.getSource('bike-route-source');
          if (existingSource) {
            existingSource.setData(routeGeoJson);
          } else {
            // Clean up any stale state first
            clearRoutePolyline();

            map.addSource('bike-route-source', {
              type: 'geojson',
              data: routeGeoJson,
            });

            // Outer glow / contrast casing (round join prevents miter spikiness)
            map.addLayer({
              id: 'bike-route-glow',
              type: 'line',
              source: 'bike-route-source',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#0055ff',
                'line-width': 9,
                'line-opacity': 0.6,
              },
            });

            // Vibrant road-following cyan route line
            map.addLayer({
              id: 'bike-route-line',
              type: 'line',
              source: 'bike-route-source',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#00F0FF',
                'line-width': 5,
                'line-opacity': 0.98,
              },
            });
          }

          // Ensure route layers sit on top of road surfaces, bridges, and waterways
          if (typeof map.moveLayer === 'function') {
            try { map.moveLayer('bike-route-glow'); } catch (e) { }
            try { map.moveLayer('bike-route-line'); } catch (e) { }
          }
        } catch (layerErr) {
          console.warn('[Mappls Mobile] Vector route layer notice, using SDK polyline fallback:', layerErr);

          // SDK Polyline fallback
          clearRoutePolyline();
          const PolylineConstructor =
            (window.mappls && (window.mappls.Polyline || window.mappls.polyline)) ||
            (sdkInstanceRef.current && (sdkInstanceRef.current.Polyline || sdkInstanceRef.current.polyline));

          if (PolylineConstructor) {
            try {
              const pathObj = cleanGeojsonCoords.map(([lng, lat]) => ({ lat, lng }));
              const glowPolyline = new PolylineConstructor({
                map: map,
                path: pathObj,
                strokeColor: '#0055ff',
                strokeOpacity: 0.6,
                strokeWeight: 9,
                lineJoin: 'round',
                lineCap: 'round',
                labelup: false,
                fitbounds: false,
              });
              routeGlowPolylineRef.current = glowPolyline;

              const mainPolyline = new PolylineConstructor({
                map: map,
                path: pathObj,
                strokeColor: '#00F0FF',
                strokeOpacity: 0.98,
                strokeWeight: 5,
                lineJoin: 'round',
                lineCap: 'round',
                labelup: false,
                fitbounds: false,
              });
              routePolylineRef.current = mainPolyline;
            } catch (sdkPolyErr) {
              console.warn('[Mappls Mobile] SDK polyline fallback notice:', sdkPolyErr);
            }
          }
        }
      }

      // Automatically adjust map viewport so current location, destination, and full route are visible
      // MapLibre / Mappls fitBounds expects: [[swLng, swLat], [neLng, neLat]]
      // Only fit full route bounds on initial route preview when NOT actively navigating to prevent camera thrashing
      const bounds =
        routeData.bounds ||
        toRouteBounds(routeData.coordinates) ||
        toMapplsBounds(userLocation, destination);

      if (!isNavigating && bounds && mapInstanceRef.current) {
        try {
          if (typeof mapInstanceRef.current.fitBounds === 'function') {
            mapInstanceRef.current.fitBounds(bounds, {
              padding: 60,
              maxZoom: 16,
            });
          } else if (typeof mapInstanceRef.current.setCenter === 'function') {
            const [[minLng, minLat], [maxLng, maxLat]] = bounds;
            mapInstanceRef.current.setCenter({
              lat: (minLat + maxLat) / 2,
              lng: (minLng + maxLng) / 2,
            });
          }
        } catch (fitErr) {
          console.warn('[Mappls Mobile] Route fitBounds notice:', fitErr);
        }
      }
    } else {
      clearRoutePolyline();
    }

    return () => {
      clearRoutePolyline();
    };
  }, [routeData, mapStatus]);

  // Active Navigation Camera Follow Effect (Step 10 Real Accuracy & Motorcycle Camera Stabilization)
  useEffect(() => {
    if (!isNavigating || !isMapFollowing || !mapInstanceRef.current || mapStatus !== 'READY') return;
    const loc = normalizeCoordinates(currentLocation || userLocation);
    if (!loc) return;

    try {
      const pos = { lat: loc.lat, lng: loc.lng };
      const map = mapInstanceRef.current;

      // Check distance moved since last camera update
      let distMoved = Infinity;
      if (lastCameraPosRef.current) {
        distMoved = haversineDistance(
          lastCameraPosRef.current.lat,
          lastCameraPosRef.current.lng,
          loc.lat,
          loc.lng
        );
      }

      // Check if rider is moving vs stationary
      const speed = Number.isFinite(currentLocation?.speed) ? currentLocation.speed : null;
      const isStationary = speed !== null ? speed <= 0.5 : distMoved < 2.0;

      // Only update bearing if moving and heading has changed meaningfully
      const rawHeading = Number.isFinite(currentLocation?.heading) ? currentLocation.heading : (Number.isFinite(loc.heading) ? loc.heading : null);
      let targetBearing = lastCameraBearingRef.current;

      if (!isStationary && rawHeading !== null) {
        // Normalize to 0–360
        const normHeading = ((rawHeading % 360) + 360) % 360;
        const diff = Math.abs(normHeading - lastCameraBearingRef.current);
        const shortestDiff = Math.min(diff, 360 - diff);
        // Suppress tiny angular jitter (< 4 degrees)
        if (shortestDiff >= 4) {
          targetBearing = normHeading;
          lastCameraBearingRef.current = normHeading;
        }
      }

      // If stationary and moved less than 2.0m, don't thrash easeTo
      if (isStationary && distMoved < 2.0 && lastCameraPosRef.current) {
        return;
      }

      if (typeof map.easeTo === 'function') {
        const easeOptions = {
          center: [loc.lng, loc.lat],
          duration: 450,
        };
        if (targetBearing !== null && Number.isFinite(targetBearing)) {
          easeOptions.bearing = targetBearing;
          easeOptions.pitch = 25;
        }
        map.easeTo(easeOptions);
        lastCameraPosRef.current = { lat: loc.lat, lng: loc.lng };
      } else if (typeof map.setCenter === 'function') {
        map.setCenter(pos);
        lastCameraPosRef.current = { lat: loc.lat, lng: loc.lng };
      } else if (typeof map.panTo === 'function') {
        map.panTo(pos);
        lastCameraPosRef.current = { lat: loc.lat, lng: loc.lng };
      }
    } catch (e) {
      console.warn('[Mappls Mobile] Nav camera follow notice:', e);
    }
  }, [isNavigating, isMapFollowing, currentLocation, userLocation, mapStatus]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: height,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#09090b',
        ...style,
      }}
    >
      {/* Map DOM Slot */}
      <div
        id="mobile-mappls-map-container"
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          display: mapStatus === 'FAILED' ? 'none' : 'block',
        }}
      />

      {/* Loading Overlay */}
      {mapStatus === 'INITIALIZING' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(9, 9, 11, 0.88)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid rgba(255, 255, 255, 0.15)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ fontFamily: 'Chakra Petch', fontSize: 13, color: '#ffffff', letterSpacing: '0.06em' }}>
            INITIALIZING MAPPLS WEB MAPS...
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Connecting to official Mappls SDK
          </div>
        </div>
      )}

      {/* Error Fallback Overlay */}
      {mapStatus === 'FAILED' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0d0d11',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textAlign: 'center',
            zIndex: 10,
            gap: 10,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255, 59, 48, 0.15)',
              border: '1px solid rgba(255, 59, 48, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff3b30',
              fontSize: 20,
            }}
          >
            ✕
          </div>
          <div style={{ fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
            MAPPLS INITIALIZATION FAILED
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#ff6b6b',
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '8px 12px',
              borderRadius: 6,
              maxWidth: '90%',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {errorMessage || 'Unknown Mappls SDK error'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 6,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'Chakra Petch',
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* Controls Overlay: Zoom & Location Controls */}
      {mapStatus === 'READY' && !hideBuiltInControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 5,
          }}
        >
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#141418',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 20,
              fontWeight: 700,
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#141418',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 22,
              fontWeight: 700,
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
          >
            −
          </button>
          <button
            onClick={handleMyLocationClick}
            title="Current Location"
            aria-label="Current Location"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#141418',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              color: userLocation && !userLocation.fallback ? '#00F0FF' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Icon name="mapPin" size={18} color={userLocation && !userLocation.fallback ? '#00F0FF' : '#ffffff'} />
          </button>
        </div>
      )}

      {/* Subtle Top Badge Indicating Mappls Engine */}
      {!hideBuiltInControls && !isNavigating && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(10, 10, 14, 0.75)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 20,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: mapStatus === 'READY' ? '#30d158' : mapStatus === 'INITIALIZING' ? '#ffd60a' : '#ff453a',
              boxShadow: mapStatus === 'READY' ? '0 0 8px #30d158' : 'none',
            }}
          />
          <span style={{ fontFamily: 'Chakra Petch', fontSize: 10, fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
            MAPPLS WEB MAPS
          </span>
        </div>
      )}

      {/* Floating Recenter Button during Active Navigation */}
      {isNavigating && !isMapFollowing && !hideBuiltInControls && (
        <button
          onClick={() => {
            if (onRecenter) onRecenter();
            const loc = normalizeCoordinates(currentLocation || userLocation);
            if (loc && mapInstanceRef.current) {
              try {
                const pos = { lat: loc.lat, lng: loc.lng };
                if (typeof mapInstanceRef.current.setCenter === 'function') {
                  mapInstanceRef.current.setCenter(pos);
                } else if (typeof mapInstanceRef.current.panTo === 'function') {
                  mapInstanceRef.current.panTo(pos);
                }
              } catch (e) { }
            }
          }}
          style={{
            position: 'absolute',
            bottom: 56,
            right: 12,
            background: 'rgba(10, 15, 25, 0.94)',
            border: '1px solid #00F0FF',
            color: '#00F0FF',
            borderRadius: 20,
            padding: '7px 14px',
            fontSize: 11,
            fontFamily: 'Chakra Petch',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 240, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 15,
          }}
        >
          <span>🎯</span>
          <span>RECENTER</span>
        </button>
      )}
    </div>
  );
}
