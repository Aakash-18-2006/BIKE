const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function run() {
  const url2 = `https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`;
  const r2 = await fetch(url2);
  const t2 = await r2.text();
  console.log('Snippet around 15627:');
  console.log(t2.substring(15550, 15750));
}

run();
