import React, { useEffect, useRef, useState } from 'react';
import { mappls } from 'mappls-web-maps';

/**
 * Module-level SDK loading state to prevent duplicate script injections
 * and race conditions across React 18 StrictMode double-mounts and re-renders.
 */
let sdkLoadPromise = null;
let loadedApiKey = null;
let cachedMapplsInstance = null;
let cachedSdkError = null;

/**
 * Perform preflight/diagnostic query on the Mappls SDK URL to capture
 * exact HTTP status (401, 403, etc.) and error payload without guessing.
 */
async function queryMapplsEndpoint(url) {
  try {
    const res = await fetch(url);
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    return {
      status: res.status,
      statusText: res.statusText,
      payload,
    };
  } catch (err) {
    return {
      status: null,
      statusText: 'Network Connection Error',
      payload: err.message || String(err),
    };
  }
}

/**
 * Single-flight Mappls Web Maps SDK loader
 */
function loadMapplsSdk(apiKey) {
  // If already loaded for this key, return immediately
  if (cachedMapplsInstance && loadedApiKey === apiKey && window.mappls && typeof window.mappls.Map === 'function') {
    return Promise.resolve(cachedMapplsInstance);
  }

  // If in-flight for the same key, return the existing promise
  if (sdkLoadPromise && loadedApiKey === apiKey) {
    return sdkLoadPromise;
  }

  loadedApiKey = apiKey;
  cachedMapplsInstance = null;
  cachedSdkError = null;

  console.log('[Mappls] SDK initialization started');

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
      console.log('[Mappls] SDK initialization successful');
      resolve(instance);
    };

    const finalizeFailure = (errData) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (observer) observer.disconnect();
      cachedSdkError = errData;
      sdkLoadPromise = null; // Allow retry on subsequent calls
      console.error('[Mappls] SDK initialization failed', errData);
      reject(errData);
    };

    // If window.mappls is already present in DOM
    if (window.mappls && typeof window.mappls.Map === 'function') {
      const instance = new mappls();
      finalizeSuccess(instance);
      return;
    }

    try {
      const instance = new mappls();

      // Monitor DOM for the script element injected by mappls-web-maps
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.tagName === 'SCRIPT' && node.src && node.src.includes('mappls.com')) {
              const scriptTag = node;
              scriptTag.addEventListener('error', async () => {
                const diag = await queryMapplsEndpoint(scriptTag.src);
                finalizeFailure({
                  status: diag.status || 0,
                  statusText: diag.statusText,
                  details: diag.payload,
                  url: scriptTag.src,
                });
              });
            }
          }
        }
      });
      observer.observe(document.head, { childList: true });

      // Safety timeout: 8 seconds
      timeoutId = setTimeout(async () => {
        if (!settled) {
          const expectedUrl = `https://sdk.mappls.com/map/sdk/web?&v=3.0&access_token=${apiKey}`;
          const diag = await queryMapplsEndpoint(expectedUrl);
          finalizeFailure({
            status: diag.status || 408,
            statusText: diag.statusText || 'Request Timeout',
            details: diag.payload || 'Mappls SDK initialization did not complete within 8s.',
            url: expectedUrl,
          });
        }
      }, 8000);

      // Official Mappls Web Maps initialization for installed package
      instance.initialize(
        apiKey,
        {
          map: true,
          version: '3.0',
        },
        () => {
          finalizeSuccess(instance);
        }
      );
    } catch (exc) {
      finalizeFailure({
        status: 'EXCEPTION',
        statusText: 'Synchronous SDK Error',
        details: exc.message || String(exc),
      });
    }
  });

  return sdkLoadPromise;
}

/**
 * Safe diagnostic formatter for Mappls / Mapbox errors, API error responses,
 * JavaScript Error instances, and event objects.
 * Extracts useful fields (message, error, error_code, error_description, responsecode, status, statusText)
 * and guarantees readable formatting without ever yielding '[object Object]'.
 */
export function formatMapplsError(error) {
  if (error === null || error === undefined) {
    return 'Unknown Mappls error (null / undefined)';
  }

  // If it's already a string
  if (typeof error === 'string') {
    return error.trim().length > 0 ? error : 'Empty error string received';
  }

  // If it's a standard JavaScript Error instance
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }

  if (typeof error === 'object') {
    const fields = [];
    const inner = (typeof error.error === 'object' && error.error !== null) ? error.error : error;

    if (inner instanceof Error) {
      fields.push(inner.stack || `${inner.name}: ${inner.message}`);
    } else if (typeof inner === 'object' && inner !== null) {
      if (inner.message) fields.push(`message: ${inner.message}`);
      if (inner.error_description) fields.push(`error_description: ${inner.error_description}`);
      if (inner.error_code) fields.push(`error_code: ${inner.error_code}`);
      if (inner.error && typeof inner.error === 'string') fields.push(`error: ${inner.error}`);
      if (inner.responsecode !== undefined) fields.push(`responsecode: ${inner.responsecode}`);
      if (inner.status !== undefined) fields.push(`status: ${inner.status}`);
      if (inner.statusText) fields.push(`statusText: ${inner.statusText}`);
      if (inner.url) fields.push(`url: ${inner.url}`);
    }

    if (error !== inner) {
      if (error.message && !fields.some((f) => f.startsWith('message:'))) {
        fields.push(`message: ${error.message}`);
      }
      if (error.status !== undefined && !fields.some((f) => f.startsWith('status:'))) {
        fields.push(`status: ${error.status}`);
      }
      if (error.type) {
        fields.push(`event_type: ${error.type}`);
      }
    }

    let serialized = '';
    try {
      const seen = new WeakSet();
      serialized = JSON.stringify(
        error,
        (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          if (value instanceof Error) {
            return {
              name: value.name,
              message: value.message,
              stack: value.stack,
            };
          }
          return value;
        },
        2
      );
    } catch {
      serialized = '';
    }

    if (fields.length > 0) {
      if (serialized && serialized !== '{}' && serialized !== 'null') {
        return `${fields.join(' | ')}\n\nFull Diagnostic:\n${serialized}`;
      }
      return fields.join(' | ');
    }

    if (serialized && serialized !== '{}' && serialized !== 'null') {
      return serialized;
    }

    try {
      const propNames = Object.getOwnPropertyNames(error);
      if (propNames.length > 0) {
        return propNames.map((k) => `${k}: ${String(error[k])}`).join(', ');
      }
    } catch {}

    return String(error);
  }

  return String(error);
}

/**
 * NavigationMap - Base Map Diagnostic Component for Mappls Web Maps
 * 
 * Configured according to specifications:
 * - Official Mappls Web Maps SDK (mappls-web-maps v3.8.1)
 * - Base map centered around Bengaluru [12.9716, 77.5946], zoom 14
 * - React StrictMode duplicate initialization protection
 * - Standardized diagnostic logs
 * - Explicit HTTP status error reporting (401/403/network)
 */
export function NavigationMap({
  currentLocation = null,
  destination = null,
  route = null,
  className = '',
}) {
  const mapSlotRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const sdkInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const lastRouteKeyRef = useRef(null);

  // Engine state: 'INIT' | 'LIVE' | 'FAILED'
  const [mapEngineStatus, setMapEngineStatus] = useState('INIT');
  const [mapplsError, setMapplsError] = useState(null);

  // Live Map Follow Mode: true = camera follows rider GPS; false = user manually panned map
  const [isFollowing, setIsFollowing] = useState(true);

  // Read API key strictly from environment variable
  const apiKey = import.meta.env.VITE_MAPPLS_API_KEY;

  useEffect(() => {
    let isCurrentMount = true;

    // 1. API key detection check
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_mappls_static_key_here') {
      const keyError = {
        title: 'MAPPLS API KEY REQUIRED',
        status: 'KEY_MISSING',
        detail: 'VITE_MAPPLS_API_KEY is not configured in speedometer/.env. Please add your Mappls Static Key and restart the dev server.',
      };
      console.warn('[Mappls] API key not found or using placeholder in VITE_MAPPLS_API_KEY');
      console.error('[Mappls] Runtime error:', keyError);
      console.error('[Mappls] SDK initialization failed - VITE_MAPPLS_API_KEY is not set');
      setMapplsError(keyError);
      setMapEngineStatus('FAILED');
      return;
    }

    // Masked log for security
    const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '****';
    console.log(`[Mappls] API key detected (${maskedKey})`);

    // 2. Initialize official Mappls SDK
    loadMapplsSdk(apiKey)
      .then((sdkInstance) => {
        if (!isCurrentMount) return;
        sdkInstanceRef.current = sdkInstance;

        const targetSlot = document.getElementById('tft-mappls-map-slot');
        if (!targetSlot) {
          throw new Error('Map container (#tft-mappls-map-slot) DOM element not found');
        }

        // Clean up any previously attached canvas
        if (mapInstanceRef.current) {
          try {
            if (typeof mapInstanceRef.current.remove === 'function') {
              mapInstanceRef.current.remove();
            }
          } catch (e) {
            console.warn('[Mappls] Notice during map instance cleanup:', e);
          }
          mapInstanceRef.current = null;
        }
        targetSlot.innerHTML = '';

        try {
          // 3. Create Real Mappls Map centered on Bengaluru
          const initialCenter = currentLocation && Number.isFinite(currentLocation.lat) && Number.isFinite(currentLocation.lng)
            ? [currentLocation.lat, currentLocation.lng]
            : [12.9716, 77.5946];

          const newMap = sdkInstance.Map({
            id: 'tft-mappls-map-slot',
            properties: {
              center: initialCenter,
              zoom: 14,
              zoomControl: false,
              location: false,
              fullscreenControl: false,
              scaleControl: false,
              rotateControl: false,
            },
          });

          if (!newMap) {
            throw new Error('sdkInstance.Map() returned null or undefined');
          }

          mapInstanceRef.current = newMap;
          console.log('[Mappls] TFT Map created');

          if (typeof newMap.on === 'function') {
            newMap.on('load', () => {
              if (isCurrentMount) {
                setMapEngineStatus('LIVE');
                setMapplsError(null);
              }
            });

            newMap.on('error', (mapErr) => {
              console.error('[Mappls] Runtime error:', mapErr);
              if (isCurrentMount) {
                setMapplsError({
                  title: 'MAPPLS MAP RUNTIME ERROR',
                  detail: formatMapplsError(mapErr),
                });
              }
            });

            newMap.on('dragstart', () => {
              setIsFollowing(false);
            });
          } else {
            setMapEngineStatus('LIVE');
            setMapplsError(null);
          }
        } catch (mapCreateErr) {
          console.error('[Mappls] Runtime error:', mapCreateErr);
          if (isCurrentMount) {
            setMapplsError({
              title: 'MAP CREATION ERROR',
              detail: formatMapplsError(mapCreateErr),
            });
            setMapEngineStatus('FAILED');
          }
        }
      })
      .catch((err) => {
        if (!isCurrentMount) return;
        setMapEngineStatus('FAILED');
        console.error('[Mappls] Runtime error:', err);

        const httpStatus = err?.status ? `HTTP ${err.status}` : 'LOAD_ERROR';
        setMapplsError({
          title: `MAPPLS SDK INITIALIZATION ERROR (${httpStatus})`,
          status: err?.status,
          detail: formatMapplsError(err?.details || err),
        });
      });

    return () => {
      isCurrentMount = false;
      if (userMarkerRef.current) {
        try {
          if (typeof userMarkerRef.current.remove === 'function') userMarkerRef.current.remove();
        } catch (e) {}
        userMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        try {
          if (typeof destinationMarkerRef.current.remove === 'function') destinationMarkerRef.current.remove();
        } catch (e) {}
        destinationMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        try {
          if (typeof mapInstanceRef.current.remove === 'function') {
            mapInstanceRef.current.remove();
          }
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [apiKey]);

  // Current Location Marker & Follow Mode on TFT Map
  useEffect(() => {
    if (!mapInstanceRef.current || mapEngineStatus !== 'LIVE') return;
    const lat = currentLocation?.lat ?? currentLocation?.latitude;
    const lng = currentLocation?.lng ?? currentLocation?.longitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    try {
      const pos = { lat: Number(lat), lng: Number(lng) };
      if (userMarkerRef.current) {
        if (typeof userMarkerRef.current.setPosition === 'function') {
          userMarkerRef.current.setPosition(pos);
        }
      } else {
        const MarkerConstructor = (window.mappls && window.mappls.Marker) || (sdkInstanceRef.current && sdkInstanceRef.current.Marker);
        if (MarkerConstructor) {
          const marker = new MarkerConstructor({
            map: mapInstanceRef.current,
            position: pos,
            width: 22,
            height: 22,
            offset: [0, 0],
            fitbounds: false,
            html: `
              <div style="width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
                <div style="width:16px; height:16px; border-radius:50%; background:#00F0FF; border:3px solid #ffffff; box-shadow:0 0 14px #00F0FF; box-sizing:border-box;"></div>
              </div>
            `,
          });
          marker._anchor = 'center';
          userMarkerRef.current = marker;
        }
      }

      // Smooth camera follow without resetting zoom or flickering
      if (isFollowing && mapInstanceRef.current) {
        if (typeof mapInstanceRef.current.panTo === 'function') {
          mapInstanceRef.current.panTo(pos, { animate: true, duration: 600 });
        } else if (typeof mapInstanceRef.current.setCenter === 'function') {
          mapInstanceRef.current.setCenter(pos);
        }
      }
    } catch (e) {
      console.warn('[TFT Map] Location marker notice:', e);
    }
  }, [currentLocation, isFollowing, mapEngineStatus]);

  // Destination Marker on TFT Map
  useEffect(() => {
    if (!mapInstanceRef.current || mapEngineStatus !== 'LIVE') return;
    const lat = destination?.lat ?? destination?.latitude;
    const lng = destination?.lng ?? destination?.longitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (destinationMarkerRef.current) {
        try {
          if (typeof destinationMarkerRef.current.remove === 'function') destinationMarkerRef.current.remove();
        } catch (e) {}
        destinationMarkerRef.current = null;
      }
      return;
    }

    try {
      const pos = { lat: Number(lat), lng: Number(lng) };
      if (destinationMarkerRef.current) {
        if (typeof destinationMarkerRef.current.setPosition === 'function') {
          destinationMarkerRef.current.setPosition(pos);
        }
      } else {
        const MarkerConstructor = (window.mappls && window.mappls.Marker) || (sdkInstanceRef.current && sdkInstanceRef.current.Marker);
        if (MarkerConstructor) {
          const destMarker = new MarkerConstructor({
            map: mapInstanceRef.current,
            position: pos,
            width: 30,
            height: 38,
            offset: [0, -18],
            fitbounds: false,
            html: `
              <div style="width:30px; height:38px; display:flex; flex-direction:column; align-items:center;">
                <svg viewBox="0 0 24 30" width="30" height="36" style="filter: drop-shadow(0 0 8px rgba(255, 59, 48, 0.9));">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12z" fill="#FF3B30" stroke="#FFFFFF" stroke-width="1.5"/>
                  <circle cx="12" cy="11" r="4.5" fill="#FFFFFF"/>
                </svg>
              </div>
            `,
          });
          destMarker._anchor = 'bottom';
          destinationMarkerRef.current = destMarker;
        }
      }
    } catch (e) {
      console.warn('[TFT Map] Destination marker notice:', e);
    }
  }, [destination, mapEngineStatus]);

  // Route Polyline Rendering & Auto-Fit Bounds on TFT Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapEngineStatus !== 'LIVE') return;

    const clearRouteLayer = () => {
      try {
        if (typeof map.getLayer === 'function') {
          if (map.getLayer('tft-bike-route-line')) map.removeLayer('tft-bike-route-line');
          if (map.getLayer('tft-bike-route-glow')) map.removeLayer('tft-bike-route-glow');
        }
        if (typeof map.getSource === 'function') {
          if (map.getSource('tft-bike-route-source')) map.removeSource('tft-bike-route-source');
        }
      } catch (e) {
        console.warn('[TFT Map] Layer cleanup notice:', e);
      }
    };

    const geom = route?.geometry || (Array.isArray(route?.polyline) ? route.polyline.map((p) => [p.lng, p.lat]) : []);

    if (!Array.isArray(geom) || geom.length < 2) {
      clearRouteLayer();
      lastRouteKeyRef.current = null;
      return;
    }

    // Convert and normalize strictly to GeoJSON standard [longitude, latitude]
    const cleanGeoCoords = geom
      .map((pt) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          const p0 = Number(pt[0]);
          const p1 = Number(pt[1]);
          if (!isNaN(p0) && !isNaN(p1)) {
            // If already [lng, lat] (lng ~77, lat ~12)
            if (p0 > 45 && p1 < 40) return [p0, p1];
            // If [lat, lng] (lat ~12, lng ~77)
            if (p0 < 40 && p1 > 45) return [p1, p0];
            return [p0, p1];
          }
        } else if (pt && typeof pt === 'object') {
          const lat = Number(pt.lat ?? pt.latitude);
          const lng = Number(pt.lng ?? pt.longitude);
          if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
        }
        return null;
      })
      .filter(Boolean);

    if (cleanGeoCoords.length < 2) {
      clearRouteLayer();
      lastRouteKeyRef.current = null;
      return;
    }

    const routeGeoJson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: cleanGeoCoords,
      },
    };

    const routeFingerprint = `${cleanGeoCoords.length}_${cleanGeoCoords[0][0].toFixed(5)}_${cleanGeoCoords[cleanGeoCoords.length - 1][0].toFixed(5)}_${cleanGeoCoords[Math.floor(cleanGeoCoords.length / 2)][1].toFixed(5)}`;
    const isNewRoute = lastRouteKeyRef.current !== routeFingerprint;

    try {
      if (typeof map.getSource === 'function' && map.getSource('tft-bike-route-source')) {
        map.getSource('tft-bike-route-source').setData(routeGeoJson);
      } else if (typeof map.addSource === 'function' && typeof map.addLayer === 'function') {
        clearRouteLayer();

        map.addSource('tft-bike-route-source', {
          type: 'geojson',
          data: routeGeoJson,
        });

        map.addLayer({
          id: 'tft-bike-route-glow',
          type: 'line',
          source: 'tft-bike-route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#0055ff',
            'line-width': 8,
            'line-opacity': 0.6,
          },
        });

        map.addLayer({
          id: 'tft-bike-route-line',
          type: 'line',
          source: 'tft-bike-route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#00F0FF',
            'line-width': 4.5,
          },
        });
      }

      // Auto-fit route bounds ONLY when a new route or reroute arrives, preventing zoom jitter on GPS ticks
      if (isNewRoute) {
        lastRouteKeyRef.current = routeFingerprint;
        setIsFollowing(true);

        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const [lng, lat] of cleanGeoCoords) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }

        if (minLng !== Infinity && typeof map.fitBounds === 'function') {
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 45, maxZoom: 16 }
          );
          console.log(`[TFT Map] New route rendered with ${cleanGeoCoords.length} points; bounds fitted`);
        }
      }
    } catch (e) {
      console.warn('[TFT Map] Error rendering route line:', e);
    }
  }, [route?.geometry, route?.polyline, mapEngineStatus]);

  return (
    <div className={`tft-map-viewport-wrapper ${className}`}>
      {/* 1. Mappls Maps Mounting Slot (non-zero dimensions) */}
      <div
        id="tft-mappls-map-slot"
        ref={mapSlotRef}
        className="tft-mappls-map-canvas-slot"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'block',
        }}
      />

      {/* 2. Error Display Banner */}
      {mapplsError && (
        <div className="tft-mappls-error-banner">
          <div className="tft-error-title">{mapplsError.title}</div>
          <div className="tft-error-detail" style={{ whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto', textAlign: 'left' }}>
            {mapplsError.detail}
          </div>
        </div>
      )}

      {/* 3. Non-intrusive Map Engine Status Badge */}
      <div className={`tft-map-engine-badge status-${mapEngineStatus === 'LIVE' ? 'live' : (mapEngineStatus === 'INIT' ? 'demo' : 'offline')}`}>
        <span className="engine-status-dot" />
        <span className="engine-status-text">
          {mapEngineStatus === 'LIVE'
            ? 'MAPPLS LIVE'
            : (mapEngineStatus === 'INIT' ? 'INITIALIZING MAPPLS...' : 'MAPPLS ERROR / OFFLINE')}
        </span>
      </div>

      {/* 4. Floating Recenter Button when user manually dragged map */}
      {!isFollowing && (
        <button
          className="tft-map-recenter-btn"
          onClick={() => {
            setIsFollowing(true);
            const lat = currentLocation?.lat ?? currentLocation?.latitude;
            const lng = currentLocation?.lng ?? currentLocation?.longitude;
            if (Number.isFinite(lat) && Number.isFinite(lng) && mapInstanceRef.current) {
              const pos = { lat: Number(lat), lng: Number(lng) };
              if (typeof mapInstanceRef.current.panTo === 'function') {
                mapInstanceRef.current.panTo(pos, { animate: true, duration: 600 });
              } else if (typeof mapInstanceRef.current.setCenter === 'function') {
                mapInstanceRef.current.setCenter(pos);
              }
            }
          }}
          title="Recenter and follow rider position"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '5px' }}>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          RECENTER
        </button>
      )}
    </div>
  );
}

