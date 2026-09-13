async function test() {
  const base = 'https://mobile-app-rouge-two.vercel.app';
  const htmlRes = await fetch(base);
  const html = await htmlRes.text();
  console.log(`[1] Base URL: status ${htmlRes.status}, length: ${html.length}`);

  const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);

  if (jsMatch) {
    const jsRes = await fetch(base + jsMatch[1]);
    const jsText = await jsRes.text();
    console.log(`[2] JS bundle: status ${jsRes.status}, size: ${jsText.length} bytes`);
    console.log(`    Contains VITE_MAPPLS_API_KEY injected: ${jsText.includes('anpvcfbczpjtvdnswzxfquhxdguacpzejgbg')}`);
    console.log(`    Contains AEROVYN: ${jsText.includes('AEROVYN')}`);
    console.log(`    Contains Mappls: ${jsText.includes('mappls')}`);
  }

  if (cssMatch) {
    const cssRes = await fetch(base + cssMatch[1]);
    console.log(`[3] CSS bundle: status ${cssRes.status}`);
  }

  const logoPngRes = await fetch(`${base}/brand-logo.png`);
  console.log(`[4] Brand logo (/brand-logo.png): status ${logoPngRes.status}`);

  // Test SPA routing (e.g. /navigation, /dashboard)
  const navRouteRes = await fetch(`${base}/navigation`);
  const navHtml = await navRouteRes.text();
  console.log(`[5] SPA Route /navigation: status ${navRouteRes.status}, serves HTML: ${navHtml.includes('<!DOCTYPE html>')}`);
}

test();
