import { NavigationDestination } from '../models/NavigationDestination.js';
import { CONFIG } from '../config/env.js';

export async function getDestinations(req, res) {
  try {
    const destinations = await NavigationDestination.find({ userId: req.user._id })
      .sort({ lastNavigatedAt: -1, updatedAt: -1 })
      .limit(30);

    const saved = destinations.filter((d) => d.category !== 'recent');
    const recent = destinations.filter((d) => d.category === 'recent');

    res.json({
      destinations,
      saved,
      recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch destinations' });
  }
}

export async function saveDestination(req, res) {
  try {
    const { name, address, latitude, longitude, category } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }

    const destination = await NavigationDestination.create({
      userId: req.user._id,
      name,
      address: address || '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      category: category || 'saved',
      lastNavigatedAt: new Date(),
    });

    res.status(201).json({
      message: 'Destination saved successfully',
      destination,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save destination' });
  }
}

export async function deleteDestination(req, res) {
  try {
    const { id } = req.params;
    const deleted = await NavigationDestination.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    res.json({ message: 'Destination deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete destination' });
  }
}

function encodeMapplsQuery(str) {
  if (!str) return '';
  const b64 = Buffer.from(encodeURIComponent(str)).toString('base64');
  return b64.split('').reverse().join('');
}

function decryptMapplsPayload(text) {
  if (!text) return null;
  let enc = '';
  for (let i = 0; i < text.length; i++) {
    enc += String.fromCharCode(text.charCodeAt(i) ^ 0x71);
  }
  const reversed = enc.split('').reverse().join('');
  return JSON.parse(reversed);
}

let cachedMapplsAu = 'dc1f93c4d84174289ebm237f0dab5179c0d26';
let auCacheTime = 0;

export async function getMapplsAu(apiKey, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedMapplsAu && (now - auCacheTime < 3600000)) {
    return cachedMapplsAu;
  }
  try {
    const pluginUrl = `https://sdk.mappls.com/map/sdk/plugins?access_token=${encodeURIComponent(apiKey)}&v=3.0&libraries=search`;
    const res = await fetch(pluginUrl);
    if (res.ok) {
      const txt = await res.text();
      const match = txt.match(/au:\s*['"]([^'"]+)['"]/);
      if (match && match[1]) {
        cachedMapplsAu = match[1];
        auCacheTime = now;
        return cachedMapplsAu;
      }
    }
  } catch (err) {
    // fallback
  }
  return cachedMapplsAu || 'dc1f93c4d84174289ebm237f0dab5179c0d26';
}

export async function searchPlaces(req, res) {
  const isDev = process.env.NODE_ENV !== 'production';
  const query = req.query.q || req.query.query || '';
  const trimmed = query.trim();

  if (!trimmed) {
    return res.json({ success: true, data: [], results: [] });
  }

  const apiKey = (CONFIG && CONFIG.MAPPLS_API_KEY) || process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
  const k = Buffer.from(apiKey).toString('base64');
  let currentAu = await getMapplsAu(apiKey);
  const q = encodeMapplsQuery(trimmed);
  const lat = req.query.lat || req.query.latitude;
  const lng = req.query.lng || req.query.longitude;
  const locationParam = (lat && lng) ? Buffer.from(`${lat},${lng}`).toString('base64') : '';

  let url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
  const safeUrl = url.replace(k, '***MASKED***');

  if (isDev) {
    console.log(`[Mappls Search] request: "${trimmed}"`);
  }

  try {
    let mRes;
    try {
      mRes = await fetch(url);
    } catch (netErr) {
      if (isDev) {
        console.error(`[Mappls Search] Network failure:`, netErr.message);
      }
      return res.status(502).json({
        success: false,
        error: 'Mappls unreachable',
        message: 'Place search is temporarily unavailable.',
      });
    }

    let text = await mRes.text();

    if (text === 'auth') {
      currentAu = await getMapplsAu(apiKey, true);
      url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
      try {
        mRes = await fetch(url);
        text = await mRes.text();
      } catch (retryErr) {
        // ignore
      }
    }

    if (isDev) {
      console.log(`[Mappls Search] response status: ${mRes.status}`);
      if (!mRes.ok || text === 'auth' || text === 'limit' || (text && text.startsWith('error-'))) {
        console.warn(`[Mappls Search Dev] Upstream response body:`, text);
      }
    }

    // 401/403: Mappls authentication/API-key problem
    if (text === 'auth' || mRes.status === 401 || mRes.status === 403) {
      return res.status(401).json({
        success: false,
        error: 'Mappls authentication error',
        message: 'Place search authentication failed.',
      });
    }

    // 429: Mappls rate limit
    if (text === 'limit' || mRes.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Mappls rate limit exceeded',
        message: 'Place search rate limit exceeded. Please try again shortly.',
      });
    }

    // 404: Invalid upstream endpoint
    if (mRes.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Invalid upstream endpoint',
        message: 'Search endpoint not found.',
      });
    }

    // 400: Invalid request/search input
    if (mRes.status === 400 || (text && text.startsWith('error-'))) {
      return res.status(400).json({
        success: false,
        error: text || 'Invalid search input',
        message: 'Unable to search this place.',
      });
    }

    // 5xx: Mappls/upstream/server failure
    if (mRes.status >= 500) {
      return res.status(502).json({
        success: false,
        error: `Mappls upstream failure (HTTP ${mRes.status})`,
        message: 'Place search is temporarily unavailable.',
      });
    }

    let decoded;
    try {
      decoded = decryptMapplsPayload(text);
    } catch (parseErr) {
      if (isDev) {
        console.error(`[Mappls Search Dev] Response parsing failure:`, parseErr.message);
        console.error(`[Mappls Search Dev] Stack trace:`, parseErr.stack);
      }
      return res.status(502).json({
        success: false,
        error: 'Response parsing failure',
        message: 'Place search is temporarily unavailable.',
      });
    }

    const rawList = Array.isArray(decoded) ? decoded : [];
    const formatted = rawList.map((item) => ({
      name: item.placeName || item.name || trimmed,
      address: item.placeAddress || item.address || '',
      eLoc: item.eLoc || item.eloc || null,
      latitude: item.latitude ? parseFloat(item.latitude) : null,
      longitude: item.longitude ? parseFloat(item.longitude) : null,
    }));

    return res.json({ success: true, data: formatted, results: formatted });
  } catch (err) {
    if (isDev) {
      console.error(`[Mappls Search Dev] Caught exception:`, err.message);
      console.error(`[Mappls Search Dev] Stack trace:`, err.stack);
    }
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error',
      message: 'Place search is temporarily unavailable.',
    });
  }
}

export async function resolveCoordinates(req, res) {
  const isDev = process.env.NODE_ENV !== 'production';
  const eloc = req.query.eloc || req.query.eLoc;
  if (!eloc) {
    return res.status(400).json({ success: false, error: 'eloc is required', message: 'eloc is required' });
  }

  const apiKey = (CONFIG && CONFIG.MAPPLS_API_KEY) || process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
  const k = Buffer.from(apiKey).toString('base64');
  let currentAu = await getMapplsAu(apiKey);
  let url = `https://sdk.mappls.com/map_v3/?elm=${Buffer.from(eloc).toString('base64')}&k=${k}&a=${currentAu}`;
  const safeUrl = url.replace(k, '***MASKED***');

  if (isDev) {
    console.log(`[Mappls Coords Dev] eLoc: "${eloc}"`);
    console.log(`[Mappls Coords Dev] Upstream URL: ${safeUrl}`);
  }

  try {
    let mRes;
    try {
      mRes = await fetch(url);
    } catch (fetchErr) {
      if (isDev) {
        console.error(`[Mappls Coords Dev] Upstream network fetch failed:`, fetchErr.message);
        console.error(`[Mappls Coords Dev] Stack trace:`, fetchErr.stack);
      }
      return res.status(503).json({
        success: false,
        error: 'Mappls unreachable',
        message: 'Coordinate resolution is temporarily unavailable.',
      });
    }

    let text = await mRes.text();

    if (text === 'auth') {
      currentAu = await getMapplsAu(apiKey, true);
      url = `https://sdk.mappls.com/map_v3/?elm=${Buffer.from(eloc).toString('base64')}&k=${k}&a=${currentAu}`;
      try {
        mRes = await fetch(url);
        text = await mRes.text();
      } catch (retryErr) {
        // ignore
      }
    }

    if (isDev) {
      console.log(`[Mappls Coords Dev] Upstream HTTP status: ${mRes.status}`);
      if (!mRes.ok || text === 'auth' || text === 'limit' || (text && text.startsWith('error-'))) {
        console.warn(`[Mappls Coords Dev] Upstream response body:`, text);
      }
    }

    if (text === 'auth' || mRes.status === 401 || mRes.status === 403) {
      return res.status(401).json({
        success: false,
        error: 'Mappls authentication error',
        message: 'Coordinate resolution authentication failed.',
      });
    }

    if (text === 'limit' || mRes.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Mappls rate limit exceeded',
        message: 'Rate limit exceeded. Please try again shortly.',
      });
    }

    if (mRes.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: 'Coordinate service endpoint not found.',
      });
    }

    if (mRes.status === 400 || (text && text.startsWith('error-'))) {
      return res.status(400).json({
        success: false,
        error: text || 'Resolution failed',
        message: 'Unable to resolve coordinates.',
      });
    }

    if (mRes.status >= 500) {
      return res.status(502).json({
        success: false,
        error: `Mappls upstream failure (HTTP ${mRes.status})`,
        message: 'Coordinate resolution is temporarily unavailable.',
      });
    }

    let decoded;
    try {
      decoded = decryptMapplsPayload(text);
    } catch (parseErr) {
      if (isDev) {
        console.error(`[Mappls Coords Dev] Decrypt failed:`, parseErr.message);
        console.error(`[Mappls Coords Dev] Stack trace:`, parseErr.stack);
      }
      return res.status(502).json({
        success: false,
        error: 'Response parsing failure',
        message: 'Coordinate resolution is temporarily unavailable.',
      });
    }

    if (decoded?.results && decoded.results.length > 0) {
      const coords = {
        latitude: parseFloat(decoded.results[0].latitude),
        longitude: parseFloat(decoded.results[0].longitude),
      };
      return res.json({
        success: true,
        data: coords,
        ...coords,
      });
    }
    return res.status(404).json({ success: false, error: 'Coordinates not found for eLoc', message: 'Coordinates not found for this location.' });
  } catch (err) {
    if (isDev) {
      console.error(`[Mappls Coords Dev] Caught exception:`, err.message);
      console.error(`[Mappls Coords Dev] Stack trace:`, err.stack);
    }
    return res.status(500).json({ success: false, error: err.message || 'Resolution failed', message: 'Coordinate resolution is temporarily unavailable.' });
  }
}

export async function calculateRoute(req, res) {
  try {
    let originLng = req.query.originLng;
    let originLat = req.query.originLat;
    let destLng = req.query.destLng;
    let destLat = req.query.destLat;

    if (req.query.origin) {
      const parts = req.query.origin.split(',');
      if (parts.length === 2) {
        originLng = parts[0];
        originLat = parts[1];
      }
    }
    if (req.query.destination) {
      const parts = req.query.destination.split(',');
      if (parts.length === 2) {
        destLng = parts[0];
        destLat = parts[1];
      }
    }

    if (!originLng || !originLat || !destLng || !destLat) {
      return res.status(400).json({
        success: false,
        error: 'Valid origin and destination coordinates are required',
      });
    }

    const profile = req.query.profile || 'biking';
    const apiKey = process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

    // Ensure valid coordinates:
    let numOriginLat = parseFloat(originLat);
    let numOriginLng = parseFloat(originLng);
    let numDestLat = parseFloat(destLat);
    let numDestLng = parseFloat(destLng);

    // Swap safety check for India
    if (numOriginLat > 45 && numOriginLng < 40) {
      const t = numOriginLat; numOriginLat = numOriginLng; numOriginLng = t;
    }
    if (numDestLat > 45 && numDestLng < 40) {
      const t = numDestLat; numDestLat = numDestLng; numDestLng = t;
    }

    const url = `https://route.mappls.com/route/direction/route_adv/${profile}/${numOriginLng},${numOriginLat};${numDestLng},${numDestLat}?steps=true&overview=full&geometries=geojson&access_token=${apiKey}`;

    const mRes = await fetch(url);
    const data = await mRes.json();

    if (!mRes.ok) {
      return res.status(mRes.status).json({
        success: false,
        error: data.error_description || data.message || `Mappls route error HTTP ${mRes.status}`,
        statusCode: mRes.status,
      });
    }

    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No route found between given coordinates',
      });
    }

    const route = data.routes[0];
    const distM = route.distance || 0;
    const durS = route.duration || 0;

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

    if (route.geometry) {
      if (typeof route.geometry === 'string') {
        geometryType = 'EncodedPolyline';
        let decoded = decodePolyline(route.geometry, 5);
        if (decoded.length > 0 && Math.abs(decoded[0][0]) < 10) {
          decoded = decodePolyline(route.geometry, 6);
        }
        rawCoords = decoded;
      } else if (Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0) {
        geometryType = route.geometry.type || 'LineString';
        rawCoords = route.geometry.coordinates;
      }
    }

    if (rawCoords.length === 0 && Array.isArray(route.legs?.[0]?.steps)) {
      geometryType = 'StepGeometries';
      const stepPts = [];
      route.legs[0].steps.forEach((step) => {
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

    const coords = rawCoords.map((pt) => ({
      lat: pt[1],
      lng: pt[0],
    }));

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    coords.forEach((pt) => {
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lng < minLng) minLng = pt.lng;
      if (pt.lng > maxLng) maxLng = pt.lng;
    });

    const distanceFormatted = distM >= 1000
      ? `${(distM / 1000).toFixed(1)} km`
      : `${Math.round(distM)} m`;

    const durationFormatted = durS >= 3600
      ? `${Math.floor(durS / 3600)} hr ${Math.round((durS % 3600) / 60)} min`
      : `${Math.max(1, Math.round(durS / 60))} min`;

    const result = {
      distanceMeters: distM,
      distanceKm: (distM / 1000).toFixed(1),
      distanceFormatted,
      durationSeconds: durS,
      durationMinutes: Math.round(durS / 60),
      durationFormatted,
      profile,
      summary: route.legs?.[0]?.summary || '',
      geometryType,
      coordinates: coords,
      rawCoordinates: rawCoords,
      steps: route.legs?.[0]?.steps || [],
      bounds: coords.length > 0 ? [[minLng, minLat], [maxLng, maxLat]] : null,
    };

    res.json({
      success: true,
      route: result,
      routes: data.routes,
      raw: data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Route calculation failed',
    });
  }
}
