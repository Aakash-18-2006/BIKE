const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
const k = Buffer.from(apiKey).toString('base64');
const a = 'dc1f93c4d84174289ef0bm237dab5179c0d26';

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

async function handleSearch(query) {
  const q = encodeMapplsQuery(query.trim());
  const url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${a}&geo=0&x=2`;
  const mRes = await fetch(url);
  const text = await mRes.text();
  const decoded = decryptMapplsPayload(text);
  return (decoded || []).map((item) => ({
    name: item.placeName || item.name || query.trim(),
    address: item.placeAddress || item.address || '',
    eLoc: item.eLoc || item.eloc || null,
    latitude: item.latitude ? parseFloat(item.latitude) : null,
    longitude: item.longitude ? parseFloat(item.longitude) : null,
  }));
}

handleSearch('Bengaluru').then((results) => {
  console.log('Results count:', results.length);
  console.log('Sample result:', results[0]);
});
