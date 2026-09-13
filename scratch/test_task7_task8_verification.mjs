import { searchPlaces, resolveCoordinates, calculateRoute } from '../backend/src/controllers/navigationController.js';
import { normalizeCoordinates } from '../mobile-app/src/utils/coordinates.js';
import { searchMapplsPlaces, resolveDestinationObject } from '../mobile-app/src/utils/mapplsSearch.js';

function createMockReqRes(query = {}) {
  const req = { query, body: {}, user: { _id: 'test_user_id' }, originalUrl: '/api/navigation/search' };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  };

  return { req, res };
}

async function runTask7And8Tests() {
  console.log('================================================================');
  console.log('🧪 TASK 7 & 8: COMPREHENSIVE MAPPLS SEARCH & ROUTE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const queries = [
    { label: '1. Bengaluru', query: 'Bengaluru' },
    { label: '2. Chennai', query: 'Chennai' },
    { label: '3. Coimbatore', query: 'Coimbatore' },
    { label: '4. Kempegowda International Airport', query: 'Kempegowda International Airport' },
    { label: '5. Specific Address (MG Road, Bengaluru)', query: 'MG Road, Bengaluru' },
    { label: '6. Empty Search', query: '   ', isEmpty: true },
    { label: '7. Search containing spaces', query: '   Indiranagar 100ft Road   ' },
    { label: '8. Special characters', query: 'Koramangala 5th Block, #123 & 4th Cross!' },
  ];

  let resolvedDestinations = [];

  for (const item of queries) {
    console.log(`\n--- Testing ${item.label} ---`);
    const { req, res } = createMockReqRes({ query: item.query });
    await searchPlaces(req, res);
    const data = res.getResponseData();

    if (item.isEmpty) {
      assert(res.getStatusCode() === 200, 'Empty search returns HTTP 200');
      assert(data?.success === true, 'Empty search returns success: true');
      assert(Array.isArray(data?.data) && data.data.length === 0, 'Empty search returns empty data array without upstream fetch');
      continue;
    }

    assert(res.getStatusCode() === 200, `Search HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Search returned success: true');
    assert(Array.isArray(data?.data) && data.data.length > 0, `Results returned: ${data?.data?.length}`);

    const first = data.data[0];
    assert(first.name && first.eLoc, `Result has name ("${first.name}") and eLoc ("${first.eLoc}")`);

    // Verify coordinate resolution and normalization
    const { req: cReq, res: cRes } = createMockReqRes({ eloc: first.eLoc });
    await resolveCoordinates(cReq, cRes);
    const cData = cRes.getResponseData();
    assert(cRes.getStatusCode() === 200, `Coords HTTP status 200 for eLoc ${first.eLoc}`);
    assert(cData?.success === true && cData?.data?.latitude != null, `Coords found: [${cData?.data?.latitude}, ${cData?.data?.longitude}]`);

    const normalized = normalizeCoordinates({
      lat: cData.data.latitude,
      lng: cData.data.longitude,
    });
    assert(normalized !== null, `Coordinates validly normalized: lat=${normalized.lat}, lng=${normalized.lng}`);
    assert(normalized.lat >= -90 && normalized.lat <= 90 && normalized.lng >= -180 && normalized.lng <= 180, 'Coordinates within valid geographic bounds');

    resolvedDestinations.push({
      name: first.name,
      coords: normalized,
    });
  }

  // TASK 8: DESTINATION FLOW & BIKING ROUTE VERIFICATION
  console.log('\n================================================================');
  console.log('🚴 TASK 8: DESTINATION FLOW & MAPPLS BIKING ROUTE VERIFICATION');
  console.log('================================================================\n');

  const origin = { lat: 12.9716, lng: 77.5946 }; // Bengaluru central

  for (const dest of resolvedDestinations.slice(0, 3)) {
    console.log(`Calculating biking route from Origin [${origin.lat}, ${origin.lng}] to "${dest.name}" [${dest.coords.lat}, ${dest.coords.lng}]...`);
    const { req, res } = createMockReqRes({
      originLat: String(origin.lat),
      originLng: String(origin.lng),
      destLat: String(dest.coords.lat),
      destLng: String(dest.coords.lng),
      profile: 'biking',
    });

    await calculateRoute(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `Biking route HTTP 200 for destination ${dest.name}`);
    assert(data?.success === true, 'Route calculation success: true');
    assert(data?.route?.distanceMeters > 0, `Route distance verified: ${data?.route?.distanceFormatted}`);
    assert(Array.isArray(data?.route?.coordinates) && data.route.coordinates.length > 0, `Route geometry has ${data?.route?.coordinates?.length} polyline points`);
  }

  // TASK 6: ERROR NORMALIZATION VERIFICATION (Never show "Proxy returned HTTP 500")
  console.log('\n================================================================');
  console.log('🛡️ TASK 6: ERROR NORMALIZATION TESTS');
  console.log('================================================================\n');

  const origFetch = global.fetch;
  try {
    // 1. Simulate upstream 500
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
      text: async () => 'Internal Server Error',
    });

    try {
      await searchMapplsPlaces('Test 500', 'mock_key');
      assert(false, 'Should throw error');
    } catch (err) {
      assert(err.message === 'Place search is temporarily unavailable.', `500 normalized to: "${err.message}" (NEVER "Proxy returned HTTP 500")`);
    }

    // 2. Simulate upstream 401
    global.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
      text: async () => 'auth',
    });

    try {
      await searchMapplsPlaces('Test 401', 'mock_key');
      assert(false, 'Should throw error');
    } catch (err) {
      assert(err.message === 'Place search authentication failed.', `401 normalized to: "${err.message}"`);
    }

    // 3. Simulate upstream 429
    global.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too Many Requests' }),
      text: async () => 'limit',
    });

    try {
      await searchMapplsPlaces('Test 429', 'mock_key');
      assert(false, 'Should throw error');
    } catch (err) {
      assert(err.message === 'Place search rate limit exceeded. Please try again shortly.', `429 normalized to: "${err.message}"`);
    }
  } finally {
    global.fetch = origFetch;
  }

  console.log('\n================================================================');
  console.log(`🏁 ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTask7And8Tests().catch((e) => {
  console.error('Fatal error in tests:', e);
  process.exit(1);
});
