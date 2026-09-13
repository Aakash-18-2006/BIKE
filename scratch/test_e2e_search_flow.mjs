process.env.VITE_MAPPLS_API_KEY = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

import { searchMapplsPlaces, resolveDestinationObject } from '../mobile-app/src/utils/mapplsSearch.js';
import { calculateBikeRoute } from '../mobile-app/src/navigation/mapplsNavigationService.js';

const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function run() {
  console.log('=== Search for "Coimbatore" ===');
  const results = await searchMapplsPlaces('Coimbatore', apiKey);
  const selected = results[0];
  const destination = await resolveDestinationObject(selected, apiKey);
  console.log('Resolved Destination:', destination);

  console.log('=== Calculate Biking Route ===');
  const origin = { lat: 12.9716, lng: 77.5946 };
  const routeResult = await calculateBikeRoute(origin, destination, apiKey);
  console.log('Route Success:', routeResult.success);
  if (routeResult.success) {
    console.log('Distance:', routeResult.routeData.distanceFormatted);
    console.log('Duration:', routeResult.routeData.durationFormatted);
    console.log('Coordinates count:', routeResult.routeData.coordinates?.length);
    console.log('Steps count:', routeResult.routeData.steps?.length);
  } else {
    console.error('Route error:', routeResult.error);
  }
}

run();
