async function testProxySearch() {
  const cities = ['Coimbatore', 'Gandhipuram', 'Chennai', 'Bengaluru'];
  for (const city of cities) {
    try {
      const res = await fetch(`http://localhost:3000/api/navigation/search?query=${encodeURIComponent(city)}`);
      const data = await res.json();
      console.log(`[PROXY SEARCH] "${city}": status=${res.status}, success=${data.success}, count=${data.data?.length || 0}`);
      if (data.data?.length > 0) {
        console.log(`   First result: "${data.data[0].name}" | "${data.data[0].address}" | eLoc: ${data.data[0].eLoc}`);
      } else {
        console.log(`   Response:`, data);
      }
    } catch (err) {
      console.error(`[PROXY SEARCH] "${city}" failed:`, err.message);
    }
  }
}

testProxySearch();
