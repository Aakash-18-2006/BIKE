import { searchMapplsPlaces } from '../mobile-app/src/utils/mapplsSearch.js';

async function testErrorHandling() {
  console.log('Testing frontend error handling...');

  // 1. Mock global fetch returning HTTP 400
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Bad Request' }),
      text: async () => 'Bad Request',
    });

    try {
      await searchMapplsPlaces('Bad Query', 'mock_key');
      console.error('❌ Failed: Expected HTTP 400 to throw error');
      process.exit(1);
    } catch (err) {
      if (err.message === 'Unable to search this place') {
        console.log('✅ HTTP 400 correctly translates to "Unable to search this place"');
      } else {
        console.error('❌ Failed: Expected "Unable to search this place", got:', err.message);
        process.exit(1);
      }
    }

    // 2. Mock global fetch throwing network error
    global.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    try {
      await searchMapplsPlaces('Network Query', 'mock_key');
      console.error('❌ Failed: Expected network failure to throw error');
      process.exit(1);
    } catch (err) {
      if (err.message === 'Search unavailable') {
        console.log('✅ Network failure correctly translates to "Search unavailable"');
      } else {
        console.error('❌ Failed: Expected "Search unavailable", got:', err.message);
        process.exit(1);
      }
    }

    // 3. Test empty search (no fetch should be invoked)
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    };

    const emptyRes = await searchMapplsPlaces('   ', 'mock_key');
    if (!fetchCalled && Array.isArray(emptyRes) && emptyRes.length === 0) {
      console.log('✅ Empty search does not call fetch and returns []');
    } else {
      console.error('❌ Failed: Empty search triggered fetch');
      process.exit(1);
    }

  } finally {
    global.fetch = originalFetch;
  }

  console.log('All error handling tests passed!');
}

testErrorHandling().catch((err) => {
  console.error(err);
  process.exit(1);
});
