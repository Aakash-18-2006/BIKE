const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
const k = Buffer.from(apiKey).toString('base64');
const a = 'dc1f93c4d84174289ef0bm237dab5179c0d26';

function encodeMapplsQuery(str) {
  if (!str) return '';
  const b64 = Buffer.from(encodeURIComponent(str)).toString('base64');
  return b64.split('').reverse().join('');
}

async function testParam(name, url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(`[${res.status}] ${name}: body length=${text.length}, text=${JSON.stringify(text.substring(0, 40))}`);
    return text;
  } catch (e) {
    console.log(`[ERR] ${name}: ${e.message}`);
  }
}

async function run() {
  const q = encodeMapplsQuery('Coimbatore');
  
  // Test variations of https://sdk.mappls.com/map_v3/
  console.log('--- Testing query params ---');
  await testParam('baseline', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`);
  await testParam('without a', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&geo=0&x=2`);
  await testParam('without k b64 (raw k)', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${apiKey}&a=${a}&geo=0&x=2`);
  await testParam('raw query (not b64)', `https://sdk.mappls.com/map_v3/?b=0&q=Coimbatore&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`);
  
  console.log('--- Testing headers / referrers ---');
  await testParam('Referer: https://sdk.mappls.com', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'Referer': 'https://sdk.mappls.com/'
  });
  await testParam('Referer: https://outpost.mappls.com', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'Referer': 'https://outpost.mappls.com/'
  });
  await testParam('Referer: https://apis.mappls.com', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'Referer': 'https://apis.mappls.com/'
  });
  await testParam('Referer: localhost:3000', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'Referer': 'http://localhost:3000/'
  });
  await testParam('Origin: localhost:3000', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'Origin': 'http://localhost:3000'
  });
  await testParam('Browser User-Agent', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  await testParam('Browser UA + Referer: https://apis.mappls.com', `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://apis.mappls.com/'
  });
}

run();
