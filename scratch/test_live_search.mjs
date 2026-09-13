async function test(query) {
  const url = `http://localhost:3000/api/navigation/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(`[TEST] query="${query}" -> HTTP ${res.status}`);
  console.log(`  Success:`, data.success);
  console.log(`  Results count:`, data.data?.length);
  if (data.data && data.data.length > 0) {
    console.log(`  First item:`, data.data[0]);
  } else if (data.message) {
    console.log(`  Message:`, data.message);
  }
}

async function run() {
  await test('Coimbatore');
  await test('Gandhipuram');
}

run();
