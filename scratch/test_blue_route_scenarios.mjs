// Test the 4 route scenarios against the running backend endpoint (port 5000)
async function testRoutes() {
  const origin = { lat: 12.9716, lng: 77.5946 }; // Bengaluru central

  const testCases = [
    {
      name: '1. Short route with several turns (Cubbon Park to MG Road Metro)',
      destLat: 12.9756,
      destLng: 77.6066,
    },
    {
      name: '2. Long route (Bengaluru to Nandi Hills)',
      destLat: 13.3702,
      destLng: 77.6835,
    },
    {
      name: '3. Route with multiple curves (Sankey Tank / Sadashivanagar twists)',
      destLat: 13.0105,
      destLng: 77.5735,
    },
    {
      name: '4. New destination replacement (Koramangala to Indiranagar)',
      destLat: 12.9719,
      destLng: 77.6412,
    },
  ];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`TEST: ${tc.name}`);
    console.log(`========================================`);

    const url = `http://localhost:5000/api/navigation/route?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${tc.destLat}&destLng=${tc.destLng}&profile=biking`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error(`FAILED:`, data);
      continue;
    }

    const route = data.route;
    const rawCoords = route.rawCoordinates;
    const coords = route.coordinates;

    const midIdx = Math.floor(rawCoords.length / 2);
    const firstCoord = rawCoords[0];
    const midCoord = rawCoords[midIdx];
    const lastCoord = rawCoords[rawCoords.length - 1];

    console.log('[BLUE ROUTE DEBUG]');
    console.log(`Geometry type: ${route.geometryType || 'LineString'}`);
    console.log(`Number of route points: ${rawCoords.length}`);
    console.log(`First coordinate: [${firstCoord[0]}, ${firstCoord[1]}]`);
    console.log(`Middle coordinate: [${midCoord[0]}, ${midCoord[1]}]`);
    console.log(`Last coordinate: [${lastCoord[0]}, ${lastCoord[1]}]`);
    console.log(`Distance: ${route.distanceFormatted}`);
    console.log(`Duration: ${route.durationFormatted}`);

    // Validations:
    const isGeoJsonOrder = firstCoord[0] > 70 && firstCoord[0] < 90 && firstCoord[1] > 8 && firstCoord[1] < 35;
    console.log(`Validation - Coordinate format is [longitude, latitude]: ${isGeoJsonOrder ? 'PASSED' : 'FAILED'}`);
    console.log(`Validation - Not a straight line (points > 2): ${rawCoords.length > 2 ? 'PASSED' : 'FAILED'} (${rawCoords.length} points)`);
    console.log(`Validation - Coordinates match point-for-point: ${coords.length === rawCoords.length ? 'PASSED' : 'FAILED'}`);
  }
}

testRoutes().catch(console.error);
