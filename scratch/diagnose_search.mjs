
function encodeMapplsQuery(str) {
  if (!str) return '';
  const b64 = Buffer.from(encodeURIComponent(str)).toString('base64');
  return b64.split('').reverse().join('');
}

function decryptMapplsPayload(text) {
  if (!text) return null;
  let enc = '';
  for (let i = 0; i < text.length; i++) {
    enc += String.fromCharCode(text.charCodeAt(i) ^ 0x71);
  }
  return JSON.parse(enc.split('').reverse().join(''));
}

const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
const k = Buffer.from(apiKey).toString('base64');
const a = 'dc1f93c4d84174289ef0bm237dab5179c0d26';

async function testMapplsDirect(query, lat, lng, headers = {}) {
  const q = encodeMapplsQuery(query);
  const locationParam = (lat && lng) ? Buffer.from(`${lat},${lng}`).toString('base64') : '';
  const url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=${locationParam}&p=&f=&k=${k}&a=${a}&geo=0&x=2`;
  
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(`[Direct] query="${query}" lat/lng=${lat},${lng} -> Status ${res.status}, body length: ${text.length}, first 60 chars: ${JSON.stringify(text.substring(0, 60))}`);
    if (text !== 'auth' && text !== 'limit' && !text.startsWith('error-')) {
      try {
        const decoded = decryptMapplsPayload(text);
        console.log(`  Decoded items count: ${decoded?.length}`);
        if (decoded?.length > 0) {
          console.log(`  First item:`, decoded[0].placeName, decoded[0].placeAddress);
        }
      } catch (e) {
        console.log(`  Decrypt error:`, e.message);
      }
    }
  } catch (err) {
    console.error(`[Direct Error]`, err.message);
  }
}

async function testProxy(query) {
  try {
    const res = await fetch(`http://localhost:3000/api/navigation/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    console.log(`[Proxy :3000] query="${query}" -> Status ${res.status}, success: ${data.success}, items: ${data.data?.length || data.results?.length}, message: ${data.message}`);
  } catch (err) {
    console.error(`[Proxy :3000 Error]`, err.message);
  }
}

async function run() {
  console.log('Testing Coimbatore without location:');
  await testMapplsDirect('Coimbatore');

  console.log('\nTesting Coimbatore with location:');
  await testMapplsDirect('Coimbatore', 12.7172, 77.8415);

  console.log('\nTesting Gandhipuram without location:');
  await testMapplsDirect('Gandhipuram');

  console.log('\nTesting Gandhipuram with location:');
  await testMapplsDirect('Gandhipuram', 12.7172, 77.8415);

  console.log('\nTesting "be" without location:');
  await testMapplsDirect('be');

  console.log('\nTesting "be" with location:');
  await testMapplsDirect('be', 12.7172, 77.8415);

  console.log('\nTesting with Referer header:');
  await testMapplsDirect('Coimbatore', null, null, { 'Referer': 'http://localhost:3000' });
  await testMapplsDirect('Coimbatore', null, null, { 'Referer': 'http://localhost:5173' });

  console.log('\nTesting proxy :3000:');
  await testProxy('Coimbatore');
  await testProxy('Gandhipuram');
}

run();
