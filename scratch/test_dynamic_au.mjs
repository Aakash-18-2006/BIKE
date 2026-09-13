const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';

async function getMapplsAu(key) {
  try {
    const res = await fetch(`https://sdk.mappls.com/map/sdk/plugins?access_token=${key}&v=3.0&libraries=search`);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/au:\s*['"]([a-zA-Z0-9]+)['"]/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
  return 'dc1f93c4d84174289efbm2370dab5179c0d26';
}

async function run() {
  const au = await getMapplsAu(apiKey);
  console.log('Extracted au:', au);
}

run();
