const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function testEndpoint(url, desc) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`[${res.status}] ${desc}: ${text.substring(0, 150)}`);
  } catch (e) {
    console.log(`[ERR] ${desc}: ${e.message}`);
  }
}

async function run() {
  // 1. apis.mappls.com geo_code
  await testEndpoint(
    `https://apis.mappls.com/advancedmaps/v1/${apiKey}/geo_code?addr=Coimbatore`,
    'apis.mappls.com/advancedmaps/v1/{key}/geo_code?addr=Coimbatore'
  );

  // 2. apis.mappls.com autosuggest / search
  await testEndpoint(
    `https://apis.mappls.com/advancedmaps/v1/${apiKey}/autosuggest?query=Coimbatore`,
    'apis.mappls.com/advancedmaps/v1/{key}/autosuggest?query=Coimbatore'
  );

  // 3. apis.mappls.com still_search
  await testEndpoint(
    `https://apis.mappls.com/advancedmaps/v1/${apiKey}/search?query=Coimbatore`,
    'apis.mappls.com/advancedmaps/v1/{key}/search?query=Coimbatore'
  );

  // 4. atlas.mappls.com with bearer or access_token
  await testEndpoint(
    `https://atlas.mappls.com/api/places/search/json?query=Coimbatore&access_token=${apiKey}`,
    'atlas.mappls.com/api/places/search/json with access_token'
  );

  // 5. atlas.mappls.com geocode
  await testEndpoint(
    `https://atlas.mappls.com/api/places/geocode?address=Coimbatore&access_token=${apiKey}`,
    'atlas.mappls.com/api/places/geocode'
  );
  
  // 6. atlas.mappls.com with header
  try {
    const res = await fetch(`https://atlas.mappls.com/api/places/search/json?query=Coimbatore`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    console.log(`[${res.status}] atlas with Bearer: ${(await res.text()).substring(0, 150)}`);
  } catch(e) {}
}

run();
