const apiKey = 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg';
const k = Buffer.from(apiKey).toString('base64');
const au_correct = 'dc1f93c4d84174289efbm2370dab5179c0d26';
const au_wrong = 'dc1f93c4d84174289ef0bm237dab5179c0d26';

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

async function test(query) {
  const q = encodeMapplsQuery(query);
  const url_wrong = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${au_wrong}&geo=0&x=2`;
  const res1 = await fetch(url_wrong);
  const t1 = await res1.text();
  console.log(`With WRONG au: "${query}" -> Status ${res1.status}, body="${t1}"`);

  const url_correct = `https://sdk.mappls.com/map_v3/?b=0&q=${q}&hp=0&re=&l=&p=&f=&k=${k}&a=${au_correct}&geo=0&x=2`;
  const res2 = await fetch(url_correct);
  const t2 = await res2.text();
  console.log(`With CORRECT au: "${query}" -> Status ${res2.status}, body length=${t2.length}`);
  if (t2 !== 'auth') {
    const decoded = decryptMapplsPayload(t2);
    console.log(`  Decoded count: ${decoded?.length}`);
    if (decoded?.length > 0) {
      console.log(`  First place:`, decoded[0].placeName, '-', decoded[0].placeAddress);
    }
  }
}

async function run() {
  await test('Coimbatore');
  await test('Gandhipuram');
}

run();
