const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function run() {
  const url2 = `https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`;
  const r2 = await fetch(url2);
  const t2 = await r2.text();

  let pos = 0;
  while ((pos = t2.indexOf('map_v3', pos)) !== -1) {
    console.log('--- Occurrence at', pos, '---');
    console.log(t2.substring(Math.max(0, pos - 150), Math.min(t2.length, pos + 250)));
    pos += 6;
  }
}

run();
