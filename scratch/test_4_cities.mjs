import { searchPlaces } from '../backend/src/controllers/navigationController.js';

const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
const k = Buffer.from(apiKey).toString('base64');
let currentAu = 'dc1f93c4d84174289ebm237f0dab5179c0d26';

function encodeMapplsQuery(str) {
  const b64 = Buffer.from(encodeURIComponent(str)).toString('base64');
  return b64.split('').reverse().join('');
}

function decryptMapplsPayload(text) {
  let enc = '';
  for (let i = 0; i < text.length; i++) {
    enc += String.fromCharCode(text.charCodeAt(i) ^ 0x71);
  }
  return JSON.parse(enc.split('').reverse().join(''));
}

async function searchMappls(name) {
  const q = encodeMapplsQuery(name);
  let url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
  let res = await fetch(url);
  let text = await res.text();
  if (text === 'auth') {
    console.log('Got auth, refreshing token...');
    const pluginRes = await fetch(`https://sdk.mappls.com/map/sdk/plugins?access_token=${apiKey}&v=3.0&libraries=search`);
    const pluginText = await pluginRes.text();
    const match = pluginText.match(/au:\s*['"]([a-zA-Z0-9]+)['"]/);
    if (match && match[1]) {
      currentAu = match[1];
      url = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${currentAu}&geo=0&x=2`;
      res = await fetch(url);
      text = await res.text();
    }
  }
  const decoded = decryptMapplsPayload(text);
  console.log(`SEARCH "${name}": ${decoded.length} results; First: "${decoded[0].placeName}" | "${decoded[0].placeAddress}" | eLoc: ${decoded[0].eLoc}`);
}

async function run() {
  await searchMappls('Coimbatore');
  await searchMappls('Gandhipuram');
  await searchMappls('Chennai');
  await searchMappls('Bengaluru');
}

run();
