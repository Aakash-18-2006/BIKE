const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
async function test() {
  const res = await fetch('https://sdk.mappls.com/map/sdk/web?&v=3.0&access_token=' + apiKey);
  const text = await res.text();
  
  // Find style references
  const re = /style[a-zA-Z0-9_\-\.\/:]*/g;
  const matches = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length > 10 && m[0].includes('.')) {
      matches.add(m[0]);
    }
  }
  console.log('Matches:', Array.from(matches).slice(0, 20));
}
test();
