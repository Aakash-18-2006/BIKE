const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function run() {
  const url2 = `https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`;
  const r2 = await fetch(url2);
  const t2 = await r2.text();

  let pos = 0;
  while ((pos = t2.indexOf('au', pos)) !== -1) {
    const snippet = t2.substring(Math.max(0, pos - 20), Math.min(t2.length, pos + 40));
    if (snippet.includes('au:') || snippet.includes('au=') || snippet.includes('.au')) {
      console.log('Match at', pos, ':', snippet);
    }
    pos += 2;
  }
}

run();
