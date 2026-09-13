async function test() {
  const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
  const pluginUrl = `https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`;
  const res = await fetch(pluginUrl);
  const txt = await res.text();
  const match = txt.match(/au:\s*['"]([^'"]+)['"]/);
  console.log('Regex extracted au:', match ? match[1] : 'NOT FOUND');
}
test();
