import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  return JSON.parse(enc.split('').reverse().join(''));
}

let cachedMapplsAu = 'dc1f93c4d84174289ebm237f0dab5179c0d26';
let auCacheTime = 0;

async function getMapplsAu(apiKey, forceRefresh = false) {
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

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...loadEnv(mode, __dirname, ''),
  };
  const apiKey = env.VITE_MAPPLS_API_KEY || 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
  const k = Buffer.from(apiKey).toString('base64');

  return {
    plugins: [
      react(),
      {
        name: 'mappls-navigation-dev-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const urlObj = new URL(req.url, 'http://localhost:3000');
            const pathname = urlObj.pathname;

            if (pathname === '/api/navigation/search') {
              const query = urlObj.searchParams.get('query') || urlObj.searchParams.get('q') || '';
              const trimmed = query.trim();

              console.log(`[Mappls Search] request: "${trimmed || '(none)'}"`);

              if (!trimmed) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, data: [], results: [] }));
              }

              try {
                const lat = urlObj.searchParams.get('latitude') || urlObj.searchParams.get('lat') || '';
                const lng = urlObj.searchParams.get('longitude') || urlObj.searchParams.get('lng') || '';
                const locationParam = (lat && lng) ? Buffer.from(`${lat},${lng}`).toString('base64') : '';
                const q = encodeMapplsQuery(trimmed);

                let currentAu = await getMapplsAu(apiKey);
                let upstreamUrl = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;

                let mRes = await fetch(upstreamUrl);
                let text = await mRes.text();

                if (text === 'auth') {
                  console.warn(`[Mappls Search] Token expired/rejected, refreshing Mappls au...`);
                  currentAu = await getMapplsAu(apiKey, true);
                  upstreamUrl = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
                  mRes = await fetch(upstreamUrl);
                  text = await mRes.text();
                }

                console.log(`[Mappls Search] response status: ${mRes.status}`);

                if (!mRes.ok || text === 'auth' || text === 'limit' || text.startsWith('error-')) {
                  console.error(`[Mappls Search] Upstream error: ${text || mRes.status}`);
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  return res.end(JSON.stringify({
                    success: false,
                    error: text || 'Mappls search failed',
                    message: 'Unable to search this place.',
                  }));
                }

                const decoded = decryptMapplsPayload(text);
                const rawList = Array.isArray(decoded) ? decoded : [];
                const formatted = rawList.map((item) => ({
                  name: item.placeName || item.name || trimmed,
                  address: item.placeAddress || item.address || '',
                  eLoc: item.eLoc || item.eloc || null,
                  latitude: item.latitude ? parseFloat(item.latitude) : null,
                  longitude: item.longitude ? parseFloat(item.longitude) : null,
                }));

                console.log(`[Mappls Search] result count: ${formatted.length}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, data: formatted, results: formatted }));
              } catch (upstreamErr) {
                console.error(`[Mappls Search] error: ${upstreamErr.message}`);
                res.writeHead(502, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: false,
                  error: upstreamErr.message,
                  message: 'Place search is temporarily unavailable.',
                }));
              }
            }

            if (pathname === '/api/navigation/coordinates') {
              const eloc = urlObj.searchParams.get('eLoc') || urlObj.searchParams.get('eloc') || '';
              if (!eloc) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'eloc is required' }));
              }
              try {
                let currentAu = await getMapplsAu(apiKey);
                let upstreamUrl = `https://sdk.mappls.com/map_v3/?elm=${Buffer.from(eloc).toString('base64')}&k=${k}&a=${currentAu}`;
                let mRes = await fetch(upstreamUrl);
                let text = await mRes.text();

                if (text === 'auth') {
                  currentAu = await getMapplsAu(apiKey, true);
                  upstreamUrl = `https://sdk.mappls.com/map_v3/?elm=${Buffer.from(eloc).toString('base64')}&k=${k}&a=${currentAu}`;
                  mRes = await fetch(upstreamUrl);
                  text = await mRes.text();
                }

                const decoded = decryptMapplsPayload(text);
                if (decoded?.results && decoded.results.length > 0) {
                  const coords = {
                    latitude: parseFloat(decoded.results[0].latitude),
                    longitude: parseFloat(decoded.results[0].longitude),
                  };
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  return res.end(JSON.stringify({ success: true, data: coords, ...coords }));
                }
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Coordinates not found' }));
              } catch (coordErr) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: coordErr.message }));
              }
            }

            // 3. Direct fallback for /api/navigation/route when backend is not running
            if (pathname === '/api/navigation/route') {
              const originLat = urlObj.searchParams.get('originLat');
              const originLng = urlObj.searchParams.get('originLng');
              const destLat = urlObj.searchParams.get('destLat');
              const destLng = urlObj.searchParams.get('destLng');
              const profile = urlObj.searchParams.get('profile') || 'biking';
              if (!originLat || !originLng || !destLat || !destLng) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Missing coordinates' }));
              }
              const routeUrl = `https://route.mappls.com/route/direction/route_adv/${profile}/${originLng},${originLat};${destLng},${destLat}?steps=true&overview=full&geometries=geojson&access_token=${apiKey}`;
              try {
                const rRes = await fetch(routeUrl);
                const rData = await rRes.json();
                const resPayload = {
                  success: rRes.ok,
                  ...rData,
                  route: rData.routes?.[0] ? {
                    distanceMeters: rData.routes[0].distance,
                    durationSeconds: rData.routes[0].duration,
                    rawCoordinates: rData.routes[0].geometry?.coordinates || [],
                    steps: rData.routes[0].legs?.[0]?.steps || [],
                  } : null,
                };
                res.writeHead(rRes.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(resPayload));
              } catch (rErr) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: rErr.message }));
              }
            }

            next();
          });
        },
      },
    ],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
