const assert = require('assert');

(async () => {
  const {
    normalizeAdminInput,
    extractAdminSemanticConcepts,
    processAdminQuery
  } = await import('file:///c:/Users/acer/Desktop/abdi/frontend/src/services/ai/adminAiEngine.js');

  console.log('========================================================');
  console.log('🧠 TESTING ADMIN AI: HOW TO CHANGE PASSWORD & EMAIL');
  console.log('========================================================\n');

  const mockLiveData = {
    today: { orders_count: 0, revenue: 0, pending: 0, payment_review: 0, confirmed: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 },
    all_time: { total_orders: 0, confirmed_revenue: 0, gross_revenue: 0 },
    pending_payments: { count: 0, items: [] },
    inventory: { total_catalog: 4, in_stock_count: 4, out_of_stock_count: 0, out_of_stock_products: [], all_products: [] },
    top_products: [],
    recent_orders: []
  };

  // Test 1: Exact English prompt
  console.log('--- TEST 1: "how to change password" ---');
  const res1 = await processAdminQuery({
    query: 'how to change password',
    currentLanguage: 'en',
    liveData: mockLiveData,
    bypassLiveFetch: true
  });
  console.log('Response:\n', res1.text);
  assert(res1.text.includes('Account & Security'), 'Must mention Account & Security button');
  assert(res1.text.includes('Current Password'), 'Must instruct to enter Current Password');
  assert(res1.text.includes('bcrypt'), 'Must mention bcrypt encryption privacy');
  console.log('✅ TEST 1 PASSED!\n');

  // Test 2: Typo prompt "how to chnage passwored"
  console.log('--- TEST 2: Typo "how to chnage passwored" ---');
  const normalized2 = normalizeAdminInput('how to chnage passwored');
  console.log('Normalized:', normalized2);
  const concepts2 = extractAdminSemanticConcepts(normalized2.cleanText, normalized2.tokens);
  assert(concepts2.isHowToChangePasswordOrSecurity, 'Must detect password change intent despite typos');

  const res2 = await processAdminQuery({
    query: 'how to chnage passwored',
    currentLanguage: 'en',
    liveData: mockLiveData,
    bypassLiveFetch: true
  });
  console.log('Response:\n', res2.text);
  assert(res2.text.includes('Account & Security'), 'Must mention Account & Security button');
  console.log('✅ TEST 2 PASSED: Typo tolerance works!\n');

  // Test 3: "how do i change email"
  console.log('--- TEST 3: "how do i change email" ---');
  const res3 = await processAdminQuery({
    query: 'how do i change email',
    currentLanguage: 'en',
    liveData: mockLiveData,
    bypassLiveFetch: true
  });
  console.log('Response:\n', res3.text);
  assert(res3.text.includes('personal email address'), 'Must mention email updating');
  console.log('✅ TEST 3 PASSED!\n');

  // Test 4: Amharic prompt "የይለፍ ቃል እንዴት መቀየር እችላለሁ"
  console.log('--- TEST 4: Amharic "የይለፍ ቃል እንዴት መቀየር እችላለሁ" ---');
  const res4 = await processAdminQuery({
    query: 'የይለፍ ቃል እንዴት መቀየር እችላለሁ',
    currentLanguage: 'am',
    liveData: mockLiveData,
    bypassLiveFetch: true
  });
  console.log('Response:\n', res4.text);
  assert(res4.text.includes('የአድሚን የይለፍ ቃል'), 'Must return Amharic title');
  assert(res4.text.includes('Account & Security'), 'Must mention Account & Security button');
  assert(res4.text.includes('bcrypt'), 'Must mention bcrypt in Amharic');
  console.log('✅ TEST 4 PASSED!\n');

  console.log('========================================================');
  console.log('🎉 ALL HOW-TO PASSWORD & SECURITY AI TESTS PASSED 100%!');
  console.log('========================================================');
  process.exit(0);
})();
