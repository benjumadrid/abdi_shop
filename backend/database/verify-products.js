const http = require('http');

async function testApi() {
  const res = await fetch('http://localhost:5000/api/products');
  const data = await res.json();
  const products = data.data || data;

  console.log('--- API VERIFICATION ---');
  console.log('Total Products returned:', products.length);

  if (products.length !== 4) {
    console.error('FAIL: Expected exactly 4 products, got ' + products.length);
    process.exit(1);
  }

  let allPassed = true;
  products.forEach((p, idx) => {
    console.log('\n[Product ' + (idx + 1) + ']');
    console.log('ID: ' + p.id);
    console.log('Name EN: ' + p.name_en);
    console.log('Name AM: ' + p.name_am);
    console.log('Price: ' + p.price);
    console.log('Description EN: ' + (p.description_en ? p.description_en.substring(0, 50) + '...' : 'NULL'));
    console.log('Description AM: ' + (p.description_am ? p.description_am.substring(0, 50) + '...' : 'NULL'));

    if (!p.description_am || p.description_am.trim().length === 0) {
      console.error('FAIL: description_am is empty or null for ' + p.name_en);
      allPassed = false;
    } else {
      console.log('PASS: description_am is populated and valid.');
    }

    if (!p.description_en || p.description_en.trim().length === 0) {
      console.error('FAIL: description_en is missing for ' + p.name_en);
      allPassed = false;
    }
  });

  if (!allPassed) {
    console.error('\nVerification failed.');
    process.exit(1);
  }

  console.log('\nALL 4 PRODUCTS VERIFIED VIA API SUCCESSFULLY!');
}

testApi().catch(err => {
  console.error('API call failed:', err);
  process.exit(1);
});
