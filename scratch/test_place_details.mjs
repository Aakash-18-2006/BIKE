const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
const k = Buffer.from(apiKey).toString('base64');
const au = 'dc1f93c4d84174289efbm2370dab5179c0d26';

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

async function testQuery(qStr) {
  const q = encodeMapplsQuery(qStr);
  const url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${au}&geo=0&x=2`;
  const res = await fetch(url);
  const text = await res.text();
  const decoded = decryptMapplsPayload(text);
  console.log(`Results for "${qStr}" (${decoded.length} items):`);
  for (let i = 0; i < Math.min(3, decoded.length); i++) {
    const item = decoded[i];
    console.log(`  [${i}] name="${item.placeName || item.name}" addr="${item.placeAddress || item.address}" eLoc="${item.eLoc || item.eloc}" lat=${item.latitude} lng=${item.longitude}`);
    
    // If no lat/lng, test resolveMapplsCoordinates
    if (!item.latitude && item.eLoc) {
      const coordUrl = `https://sdk.mappls.com/map_v3/?elm=${Buffer.from(item.eLoc).toString('base64')}&k=${k}&a=${au}`;
      const cRes = await fetch(coordUrl);
      const cText = await cRes.text();
      const cDecoded = decryptMapplsPayload(cText);
      console.log(`      Resolved coords for eLoc ${item.eLoc}:`, cDecoded?.results?.[0]?.latitude, cDecoded?.results?.[0]?.longitude);
    }
  }
}

async function run() {
  await testQuery('Coimbatore');
  await testQuery('Gandhipuram');
}

run();
