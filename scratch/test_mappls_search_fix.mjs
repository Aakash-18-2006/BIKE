import { searchPlaces, resolveCoordinates, calculateRoute } from '../backend/src/controllers/navigationController.js';
import { searchMapplsPlaces, resolveDestinationObject, resolveMapplsCoordinates } from '../mobile-app/src/utils/mapplsSearch.js';

// Mock request / response helpers for testing Express controller directly
function createMockReqRes(query = {}, body = {}) {
  const req = { query, body, user: { _id: 'test_user_id' } };
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

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING MAPPLS SEARCH FIX');
  console.log('====================================================\n');

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

  // 1. Test "Bengaluru"
  console.log('Test 1: Search "Bengaluru"');
  {
    const { req, res } = createMockReqRes({ query: 'Bengaluru' });
    await searchPlaces(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Response indicates success: true');
    assert(Array.isArray(data?.data) && data.data.length > 0, `Results returned: count=${data?.data?.length}`);
    const first = data?.data?.[0];
    assert(first?.name && first?.eLoc, `First result valid: name="${first?.name}", eLoc="${first?.eLoc}"`);
    console.log(`    -> Sample: ${first?.name} (${first?.address || 'No address'}) [eLoc: ${first?.eLoc}]`);
  }

  // 2. Test "Chennai"
  console.log('\nTest 2: Search "Chennai"');
  {
    const { req, res } = createMockReqRes({ query: 'Chennai' });
    await searchPlaces(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Response indicates success: true');
    assert(Array.isArray(data?.data) && data.data.length > 0, `Results returned: count=${data?.data?.length}`);
    const first = data?.data?.[0];
    assert(first?.name && first?.eLoc, `First result valid: name="${first?.name}", eLoc="${first?.eLoc}"`);
    console.log(`    -> Sample: ${first?.name} (${first?.address || 'No address'}) [eLoc: ${first?.eLoc}]`);
  }

  // 3. Test a specific landmark
  console.log('\nTest 3: Search landmark "Vidhana Soudha"');
  {
    const { req, res } = createMockReqRes({ query: 'Vidhana Soudha' });
    await searchPlaces(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Response indicates success: true');
    assert(Array.isArray(data?.data) && data.data.length > 0, `Results returned: count=${data?.data?.length}`);
    const first = data?.data?.[0];
    assert(first?.name && first?.eLoc, `Landmark match: "${first?.name}", eLoc="${first?.eLoc}"`);
    console.log(`    -> Sample: ${first?.name} (${first?.address || 'No address'}) [eLoc: ${first?.eLoc}]`);
  }

  // 4. Test a specific address
  console.log('\nTest 4: Search address "MG Road, Bengaluru"');
  {
    const { req, res } = createMockReqRes({ query: 'MG Road, Bengaluru' });
    await searchPlaces(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Response indicates success: true');
    assert(Array.isArray(data?.data) && data.data.length > 0, `Results returned: count=${data?.data?.length}`);
    const first = data?.data?.[0];
    assert(first?.name && first?.eLoc, `Address match: "${first?.name}", eLoc="${first?.eLoc}"`);
    console.log(`    -> Sample: ${first?.name} (${first?.address || 'No address'}) [eLoc: ${first?.eLoc}]`);
  }

  // 5. Test empty search
  console.log('\nTest 5: Empty search');
  {
    const { req, res } = createMockReqRes({ query: '   ' });
    await searchPlaces(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, 'HTTP status is 200');
    assert(data?.success === true, 'Response success: true');
    assert(Array.isArray(data?.data) && data.data.length === 0, 'No request sent to Mappls, returns empty array');

    // Frontend utility test
    const frontResults = await searchMapplsPlaces('   ', 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg');
    assert(Array.isArray(frontResults) && frontResults.length === 0, 'Frontend searchMapplsPlaces returns [] without fetch');
  }

  // 6. Test special characters
  console.log('\nTest 6: Special characters "Koramangala 5th Block, #123 & 4th Cross!"');
  {
    const { req, res } = createMockReqRes({ query: 'Koramangala 5th Block, #123 & 4th Cross!' });
    await searchPlaces(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Response indicates success: true');
    assert(Array.isArray(data?.data) && data.data.length > 0, `Results returned for special characters: count=${data?.data?.length}`);
    const first = data?.data?.[0];
    console.log(`    -> Sample: ${first?.name} (${first?.address || 'No address'}) [eLoc: ${first?.eLoc}]`);
  }

  // 7. Test coordinate resolution for eLoc (Bengaluru 2UQY8X)
  console.log('\nTest 7: eLoc coordinate resolution');
  {
    const { req, res } = createMockReqRes({ eloc: '2UQY8X' });
    await resolveCoordinates(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Resolution success: true');
    assert(typeof data?.data?.latitude === 'number' && typeof data?.data?.longitude === 'number', `Coordinates returned: lat=${data?.data?.latitude}, lng=${data?.data?.longitude}`);
    assert(Math.abs(data.data.latitude - 12.967) < 0.05, 'Latitude is around 12.96');
    assert(Math.abs(data.data.longitude - 77.588) < 0.05, 'Longitude is around 77.58');
  }

  // 8. Test resolveDestinationObject
  console.log('\nTest 8: resolveDestinationObject full destination object');
  {
    const dest = await resolveDestinationObject(
      { name: 'Bengaluru', eLoc: '2UQY8X' },
      'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg'
    );
    assert(dest !== null, 'Resolved destination is not null');
    assert(dest?.name === 'Bengaluru', 'Destination name preserved');
    assert(dest?.latitude && dest?.longitude, `Destination coords: lat=${dest?.latitude}, lng=${dest?.longitude}`);
  }

  // 9. Verify Mappls Biking Route calculation is intact
  console.log('\nTest 9: Verification of existing Mappls biking route');
  {
    const { req, res } = createMockReqRes({
      originLat: '12.9716',
      originLng: '77.5946',
      destLat: '12.9352',
      destLng: '77.6245',
      profile: 'biking',
    });
    await calculateRoute(req, res);
    const data = res.getResponseData();
    assert(res.getStatusCode() === 200, `Biking route HTTP status is 200 (got ${res.getStatusCode()})`);
    assert(data?.success === true, 'Biking route calculated successfully');
    assert(data?.route?.distanceMeters > 0, `Route distance: ${data?.route?.distanceFormatted}`);
    assert(data?.route?.coordinates?.length > 0, `Route coordinates count: ${data?.route?.coordinates?.length}`);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
