const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function run() {
  const url2 = `https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`;
  const r2 = await fetch(url2);
  const t2 = await r2.text();

  // Look for initialization of mE or au or k
  const idx = t2.indexOf('.au');
  console.log('--- .au occurrences ---');
  let pos = 0;
  while ((pos = t2.indexOf('.au', pos)) !== -1) {
    console.log(t2.substring(Math.max(0, pos - 100), Math.min(t2.length, pos + 100)));
    pos += 3;
  }
}

run();
