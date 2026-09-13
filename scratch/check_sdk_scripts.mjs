const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function run() {
  const url1 = `https://sdk.mappls.com/map/sdk/web?&v=3.0&access_token=${apiKey}`;
  const r1 = await fetch(url1);
  const t1 = await r1.text();
  console.log('web SDK script status:', r1.status, 'length:', t1.length);
  
  const url2 = `https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`;
  const r2 = await fetch(url2);
  const t2 = await r2.text();
  console.log('plugins SDK script status:', r2.status, 'length:', t2.length);

  // Let's search inside t1 and t2 for sdk.mappls.com or search or map_v3 or a=
  const matches1 = t1.match(/map_v\d/g);
  console.log('matches in t1:', matches1);
  const matches2 = t2.match(/map_v\d/g);
  console.log('matches in t2:', matches2);

  // Search for "sdk.mappls.com" in t2
  const urls2 = t2.match(/https?:\/\/[^"'\s)]+/g);
  console.log('urls in t2:', [...new Set(urls2)]);

  // Let's search for "search" in t2
  console.log('Includes "search" in t2?', t2.includes('search'));
  // Find where search plugin function is defined
  const idx = t2.indexOf('search');
  if (idx !== -1) {
    console.log('Snippet around search:', t2.substring(idx - 100, idx + 400));
  }
}

run();
