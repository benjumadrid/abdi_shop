/**
 * Abdela Admin AI Copilot Reasoning Engine
 *
 * Provides real-time operational intelligence, financial calculations,
 * inventory monitoring, and interactive administrative actions for Brother Abdela
 * and the store management team.
 *
 * Features:
 * - Real-time zero-refresh live data synchronization directly from database
 * - Semantic concept understanding (agnostic to exact phrasing)
 * - Typo and misspelling tolerance (English & Amharic)
 * - Bilingual fluency (English & Amharic Ethiopic script)
 * - Interactive action cards for immediate 1-click admin navigation
 */

import {
  adminGetAnalyticsOverview,
  adminGetOrders,
  adminGetPayments,
  adminGetProducts
} from '../api.js';

// ─── CANONICAL SPELLING CORRECTION DICTIONARY ──────────────────────────────
const ADMIN_TYPO_MAP = {
  // Income / Revenue
  incom: 'income',
  incme: 'income',
  revnue: 'revenue',
  revenu: 'revenue',
  erning: 'earning',
  ernings: 'earnings',
  sale: 'sales',
  seles: 'sales',

  // Today
  todat: 'today',
  tday: 'today',
  todau: 'today',

  // Orders
  oder: 'order',
  oders: 'orders',
  ordr: 'order',
  ordrs: 'orders',
  pnding: 'pending',
  pendin: 'pending',
  recnt: 'recent',
  reent: 'recent',
  leatest: 'latest',
  latst: 'latest',

  // Customers / Users
  custmer: 'customer',
  customr: 'customer',
  cutomer: 'customer',
  usr: 'user',
  usrs: 'users',

  // Actions
  edti: 'edit',
  edite: 'edit',
  chng: 'change',
  chage: 'change',
  delt: 'delete',
  delet: 'delete',
  delte: 'delete',
  remve: 'remove',
  cancle: 'cancel',
  canclled: 'cancelled',
  canceld: 'cancelled',
  cancled: 'cancelled',
  cancell: 'cancelled',
  cancellation: 'cancelled',
  delivred: 'delivered',
  delived: 'delivered',
  delverd: 'delivered',
  delver: 'deliver',
  confimed: 'confirmed',
  confrimed: 'confirmed',
  confirmd: 'confirmed',
  reviw: 'review',
  reveiw: 'review',
  addd: 'add',
  cret: 'create',

  // Payments
  paymnt: 'payment',
  paymnts: 'payments',
  pymnt: 'payment',
  paymet: 'payment',
  telebir: 'telebirr',
  telbir: 'telebirr',
  telebr: 'telebirr',
  scrnshot: 'screenshot',
  verfy: 'verify',
  verfication: 'verification',

  // Products & Stock
  stok: 'stock',
  stck: 'stock',
  prodct: 'product',
  prodcts: 'products',
  prouct: 'product',
  itms: 'items',
  unavailble: 'unavailable',

  // Security & Password
  pasword: 'password',
  passwored: 'password',
  passward: 'password',
  passwrd: 'password',
  psswd: 'password',
  chnage: 'change',

  // Locations
  buabuha: 'buanbuha',
  buanbua: 'buanbuha',
  bonbua: 'buanbuha',
  desie: 'dessie',
  desi: 'dessie'
};

/**
 * Common administrative words that must NEVER be mutated by fuzzy Levenshtein
 */
const PROTECTED_ADMIN_TOKENS = new Set([
  'order', 'orders', 'payment', 'payments', 'cancel', 'cancelled', 'stock',
  'edit', 'add', 'delete', 'review', 'verify', 'deliver', 'delivered',
  'confirm', 'confirmed', 'pending', 'pipeline', 'password', 'email'
]);

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Normalizes input text and corrects common administrative typos
 */
export function normalizeAdminInput(text) {
  if (!text || typeof text !== 'string') return { cleanText: '', tokens: [], isAmharic: false };

  // Detect Amharic script
  const isAmharic = /[\u1200-\u137F]/.test(text);

  // Clean and split
  const cleanText = text.toLowerCase().trim().replace(/[?!.,;:"'()[\]{}#]/g, ' ');
  const rawTokens = cleanText.split(/\s+/).filter(Boolean);

  const tokens = rawTokens.map(tok => {
    // 1. Direct typo dictionary match
    if (ADMIN_TYPO_MAP[tok]) return ADMIN_TYPO_MAP[tok];

    // 1.5. Never fuzzy-mutate protected administrative terms
    if (PROTECTED_ADMIN_TOKENS.has(tok)) return tok;

    // 2. Fuzzy Levenshtein match for key admin words (length >= 5)
    if (tok.length >= 5) {
      const targets = [
        'income', 'revenue', 'today', 'orders', 'payments',
        'telebirr', 'pending', 'confirmed', 'delivered', 'stock',
        'products', 'buanbuha', 'dessie', 'verify', 'delete',
        'recent', 'customer'
      ];
      for (const target of targets) {
        if (levenshtein(tok, target) <= 1) {
          return target;
        }
      }
    }
    return tok;
  });

  return {
    cleanText: tokens.join(' '),
    tokens,
    isAmharic
  };
}

// Ethiopic name transliteration dictionary for cross-script matching
const ETHIOPIC_NAME_MAP = {
  'መብራቱ': 'mebratu',
  'መልአኩ': 'melaku',
  'መላኩ': 'melaku',
  'አብደላ': 'abdela',
  'አብዲ': 'abdi',
  'አበበ': 'abebe',
  'ከበደ': 'kebede',
  'ተስፋዬ': 'tesfaye',
  'መሐመድ': 'mohammed',
  'መሀመድ': 'mohammed',
  'አህመድ': 'ahmed',
  'አሊ': 'ali',
  'ኡመር': 'umer',
  'ዑመር': 'umer',
  'ሰኢድ': 'seid',
  'ሰዒድ': 'seid',
  'ፋጡማ': 'fatuma'
};

/**
 * Deep search for customer names, phone numbers, or order numbers
 */
export function searchCustomerOrOrder(cleanText, recentOrders = [], pendingPayments = []) {
  if (!cleanText) return null;

  // Build transliterated text for Ethiopic-to-Latin cross-script matching
  let transliteratedText = cleanText;
  for (const [amharicWord, latinWord] of Object.entries(ETHIOPIC_NAME_MAP)) {
    if (transliteratedText.includes(amharicWord)) {
      transliteratedText = transliteratedText.replace(new RegExp(amharicWord, 'g'), latinWord);
    }
  }

  const searchCorpus = `${cleanText} ${transliteratedText}`;

  // 1. Direct search across recent orders
  for (const order of recentOrders) {
    const custName = (order.customer_name || '').toLowerCase().trim();
    const custPhone = (order.customer_phone || '').replace(/\D/g, '');
    const orderNum = (order.order_number || '').toLowerCase().trim();

    // Full name match (e.g. "mebratu melaku")
    const isFullNameMatch = custName && searchCorpus.includes(custName);

    // Partial name match: any name word >= 4 letters (e.g. "mebratu" or "melaku")
    const nameParts = custName.split(/\s+/).filter(part => part.length >= 4);
    const isPartNameMatch = nameParts.some(part => searchCorpus.includes(part));

    // Phone match
    const isPhoneMatch = custPhone && (searchCorpus.includes(custPhone) || (custPhone.length >= 9 && searchCorpus.includes(custPhone.slice(-9))));

    // Order number match (e.g. "ord-20260908-0148" or "0148")
    const isOrderMatch = orderNum && (searchCorpus.includes(orderNum) || (orderNum.length >= 4 && searchCorpus.includes(orderNum.slice(-4))));

    if (isFullNameMatch || isPartNameMatch || isPhoneMatch || isOrderMatch) {
      const allCustomerOrders = recentOrders.filter(o =>
        (o.customer_name && o.customer_name.toLowerCase().trim() === custName) ||
        (custPhone && (o.customer_phone || '').replace(/\D/g, '') === custPhone)
      );

      return {
        matched: true,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        orders: allCustomerOrders.length > 0 ? allCustomerOrders : [order]
      };
    }
  }

  // 2. Search pending payments list
  for (const pay of pendingPayments) {
    const custName = (pay.customer_name || '').toLowerCase().trim();
    const custPhone = (pay.customer_phone || '').replace(/\D/g, '');
    const orderNum = (pay.order_number || '').toLowerCase().trim();

    const isNameMatch = custName && (searchCorpus.includes(custName) || custName.split(/\s+/).filter(p => p.length >= 4).some(p => searchCorpus.includes(p)));
    const isPhoneMatch = custPhone && (searchCorpus.includes(custPhone) || (custPhone.length >= 9 && searchCorpus.includes(custPhone.slice(-9))));
    const isOrderMatch = orderNum && searchCorpus.includes(orderNum);

    if (isNameMatch || isPhoneMatch || isOrderMatch) {
      return {
        matched: true,
        customerName: pay.customer_name,
        customerPhone: pay.customer_phone,
        customerAddress: pay.customer_address,
        orders: [
          {
            order_number: pay.order_number,
            total_amount: pay.amount,
            status: 'payment_review',
            customer_name: pay.customer_name,
            customer_phone: pay.customer_phone,
            customer_address: pay.customer_address,
            payments: [{ method: pay.method, amount: pay.amount, status: pay.status }],
            created_at: pay.created_at
          }
        ]
      };
    }
  }

  // 3. Check if user explicitly asked about a customer/user who was not found
  const isExplicitCustomerInquiry =
    cleanText.includes('user') ||
    cleanText.includes('customer') ||
    cleanText.includes('client') ||
    cleanText.includes('ደንበኛ') ||
    cleanText.includes('who is') ||
    cleanText.includes('tell me about user') ||
    cleanText.includes('tell me about customer');

  if (isExplicitCustomerInquiry) {
    const stripped = cleanText
      .replace(/\b(tell|me|about|user|customer|client|info|who|is|search|find|orders|order|for|the|of)\b/gi, ' ')
      .replace(/(ስለ|ደንበኛ|ማነው|ንገረኝ|የደንበኛ)/g, ' ')
      .trim();

    if (stripped.length >= 2) {
      return {
        matched: false,
        isNotFoundCustomerQuery: true,
        candidateName: stripped
      };
    }
  }

  return null;
}

/**
 * Searches product catalog for specific product inquiries
 */
export function searchCatalogProduct(cleanText, allProducts = [], topProducts = []) {
  if (!cleanText || allProducts.length === 0) return null;

  for (const prod of allProducts) {
    const nameEn = (prod.name_en || '').toLowerCase();
    const nameAm = (prod.name_am || '').toLowerCase();

    const keywords = [];
    if (nameEn.includes('power bank')) keywords.push('power bank', 'powerbank', 'f-max', 'td-301', '30000', 'ፓወር');
    if (nameEn.includes('cramp')) keywords.push('cramp', 'period', 'belt', 'menstrual', 'ፔሬድ');
    if (nameEn.includes('honey')) keywords.push('honey', 'yemen', 'yemeni', 'የመን', 'ማር');
    if (nameEn.includes('boost cable') || nameEn.includes('router')) keywords.push('wifi', 'router', 'boost cable', 'ዋይፋይ', 'ራውተር');

    const matchedKeyword = keywords.find(kw => cleanText.includes(kw));
    const isEnMatch = cleanText.includes(nameEn);
    const isAmMatch = nameAm && cleanText.includes(nameAm);

    if (matchedKeyword || isEnMatch || isAmMatch) {
      const topMeta = topProducts.find(t => t.id === prod.id);
      return {
        product: prod,
        meta: topMeta || null
      };
    }
  }
  return null;
}

/**
 * Extracts high-level administrative semantic concepts
 */
export function extractAdminSemanticConcepts(cleanText, tokens = []) {
  const tSet = new Set(tokens);

  // 1. Today's Income & Financial Earnings
  const isTodayIncomeIdea =
    (cleanText.includes('today') && (cleanText.includes('income') || cleanText.includes('revenue') || cleanText.includes('sale') || cleanText.includes('money') || cleanText.includes('earn') || cleanText.includes('make') || cleanText.includes('total') || cleanText.includes('etb') || cleanText.includes('birr'))) ||
    cleanText.includes('daily income') ||
    cleanText.includes('daily revenue') ||
    cleanText.includes('today sales') ||
    cleanText.includes('sales today') ||
    cleanText.includes('today income') ||
    cleanText.includes('how much did make income today') ||
    cleanText.includes('how much did we make today') ||
    cleanText.includes('how much we made') ||
    cleanText.includes('የዛሬ ገቢ') ||
    cleanText.includes('የዛሬ ሽያጭ') ||
    cleanText.includes('ዛሬ ስንት አገኘን') ||
    cleanText.includes('የዛሬ ብር');

  // 2. Total / Gross Financial Earnings (All-time or general)
  const isTotalRevenueIdea =
    !isTodayIncomeIdea &&
    (cleanText.includes('total revenue') ||
     cleanText.includes('total sales') ||
     cleanText.includes('gross revenue') ||
     cleanText.includes('overall revenue') ||
     cleanText.includes('how much total money') ||
     cleanText.includes('ጠቅላላ ገቢ') ||
     cleanText.includes('አጠቃላይ ሽያጭ'));

  // 3. Today's Orders
  const isTodayOrdersIdea =
    !isTodayIncomeIdea &&
    ((cleanText.includes('today') && (cleanText.includes('order') || cleanText.includes('orders') || cleanText.includes('bought') || cleanText.includes('customer'))) ||
     cleanText.includes('today orders') ||
     cleanText.includes('orders today') ||
     cleanText.includes('how many orders today') ||
     cleanText.includes('who ordered today') ||
     cleanText.includes('የዛሬ ትዕዛዞች') ||
     cleanText.includes('ዛሬ ምን ያህል ታዘዘ') ||
     cleanText.includes('የዛሬ ደንበኞች'));

  // ──────────────────────────────────────────────────────────────────────────
  // HOW-TO GUIDES & OPERATIONAL PROCEDURES
  // ──────────────────────────────────────────────────────────────────────────
  // How-To: Edit Products
  const isHowToEditProduct =
    (cleanText.includes('edit') && (cleanText.includes('how') || cleanText.includes('product') || cleanText.includes('price') || cleanText.includes('photo') || cleanText.includes('image') || cleanText.includes('stock') || cleanText.includes('item'))) ||
    cleanText.includes('how to edit') ||
    cleanText.includes('how do i edit') ||
    cleanText.includes('change price') ||
    cleanText.includes('change photo') ||
    cleanText.includes('update product') ||
    cleanText.includes('እቃ ማስተካከል') ||
    cleanText.includes('እንዴት ማስተካከል') ||
    cleanText.includes('ዋጋ መቀየር');

  // How-To: Delete Products
  const isHowToDeleteProduct =
    (cleanText.includes('delete') && (cleanText.includes('how') || cleanText.includes('product') || cleanText.includes('item') || cleanText.includes('can i') || cleanText.includes('remove') || cleanText.includes('button'))) ||
    cleanText.includes('how to delete') ||
    cleanText.includes('how do i delete') ||
    cleanText.includes('delete product') ||
    cleanText.includes('remove product') ||
    cleanText.includes('እቃ መሰረዝ') ||
    cleanText.includes('እንዴት መሰረዝ');

  // How-To: Add Product
  const isHowToAddProduct =
    (cleanText.includes('add') && (cleanText.includes('how') || cleanText.includes('product') || cleanText.includes('item') || cleanText.includes('new') || cleanText.includes('create'))) ||
    cleanText.includes('how to add') ||
    cleanText.includes('how do i add') ||
    cleanText.includes('add new product') ||
    cleanText.includes('create product') ||
    cleanText.includes('አዲስ እቃ መጨመር') ||
    cleanText.includes('እንዴት እቃ መጨመር');

  // How-To: Verify Payments
  const isHowToVerifyPayment =
    ((cleanText.includes('verify') || cleanText.includes('approve') || cleanText.includes('reject')) && (cleanText.includes('how') || cleanText.includes('payment') || cleanText.includes('telebirr') || cleanText.includes('screenshot'))) ||
    cleanText.includes('how to verify') ||
    cleanText.includes('how to approve') ||
    cleanText.includes('how to reject') ||
    cleanText.includes('ክፍያ እንዴት ማረጋገጥ') ||
    cleanText.includes('ቴሌብር ማረጋገጥ');

  // How-To: Manage / Advance Orders
  const isHowToManageOrders =
    (cleanText.includes('how') && (cleanText.includes('status') || cleanText.includes('confirm order') || cleanText.includes('cancel order') || cleanText.includes('deliver order') || cleanText.includes('manage order'))) ||
    cleanText.includes('how to confirm order') ||
    cleanText.includes('how to cancel order') ||
    cleanText.includes('how to deliver') ||
    cleanText.includes('ትዕዛዝ እንዴት ማስተዳደር');

  // How-To: Change Password, Email & Account Security
  const isHowToChangePasswordOrSecurity =
    (cleanText.includes('password') && (cleanText.includes('change') || cleanText.includes('how') || cleanText.includes('update') || cleanText.includes('reset') || cleanText.includes('edit') || cleanText.includes('new') || cleanText.includes('chnage'))) ||
    (cleanText.includes('email') && (cleanText.includes('change') || cleanText.includes('how') || cleanText.includes('update') || cleanText.includes('edit') || cleanText.includes('chnage'))) ||
    cleanText.includes('change password') ||
    cleanText.includes('change email') ||
    cleanText.includes('how to change password') ||
    cleanText.includes('how do i change password') ||
    cleanText.includes('change admin password') ||
    cleanText.includes('change admin email') ||
    cleanText.includes('update credentials') ||
    cleanText.includes('account security') ||
    cleanText.includes('security settings') ||
    cleanText.includes('የይለፍ ቃል መቀየር') ||
    cleanText.includes('የይለፍ ቃል እንዴት መቀየር') ||
    cleanText.includes('የይለፍ ቃል') ||
    cleanText.includes('ፓስወርድ መቀየር') ||
    cleanText.includes('ኢሜይል መቀየር') ||
    cleanText.includes('እንዴት ፓስወርድ መቀየር');

  // ──────────────────────────────────────────────────────────────────────────
  // STATUS-SPECIFIC ORDER INQUIRIES
  // ──────────────────────────────────────────────────────────────────────────
  // 3.1. Cancelled Orders Inquiry
  const isCancelledOrdersIdea =
    cleanText.includes('cancelled') ||
    cleanText.includes('canceled') ||
    cleanText.includes('canclled') ||
    cleanText.includes('canceld') ||
    cleanText.includes('cancled') ||
    cleanText.includes('cancel order') ||
    cleanText.includes('cancelled order') ||
    cleanText.includes('cancelled orders') ||
    cleanText.includes('canceled order') ||
    cleanText.includes('canceled orders') ||
    cleanText.includes('cancel orders') ||
    cleanText.includes('cancellation') ||
    cleanText.includes('የተሰረዙ ትዕዛዞች') ||
    cleanText.includes('የተሰረዘ ትዕዛዝ') ||
    cleanText.includes('የተሰረዙ') ||
    cleanText.includes('የተሰረዘ');

  // 3.2. Delivered & Completed Orders Inquiry
  const isDeliveredOrdersIdea =
    !isHowToManageOrders && (
      cleanText.includes('delivered') ||
      cleanText.includes('delivred') ||
      cleanText.includes('delivered order') ||
      cleanText.includes('delivered orders') ||
      cleanText.includes('completed order') ||
      cleanText.includes('completed orders') ||
      cleanText.includes('orders delivered') ||
      cleanText.includes('orders completed') ||
      cleanText.includes('የደረሱ ትዕዛዞች') ||
      cleanText.includes('የደረሰ ትዕዛዝ') ||
      cleanText.includes('የደረሱ')
    );

  // 3.3. Out for Delivery / In Transit Orders Inquiry
  const isOutForDeliveryIdea =
    !isHowToManageOrders && (
      cleanText.includes('out of delivery') ||
      cleanText.includes('out for delivery') ||
      cleanText.includes('in delivery') ||
      cleanText.includes('in transit') ||
      cleanText.includes('dispatched order') ||
      cleanText.includes('dispatched orders') ||
      cleanText.includes('orders out for delivery') ||
      cleanText.includes('orders in delivery') ||
      cleanText.includes('በማድረስ ላይ ያሉ ትዕዛዞች') ||
      cleanText.includes('በመጓጓዝ ላይ ያሉ') ||
      cleanText.includes('በማድረስ ላይ')
    );

  // 3.4. Confirmed Orders Inquiry
  const isConfirmedOrdersIdea =
    !isHowToManageOrders && (
      cleanText.includes('confirmed order') ||
      cleanText.includes('confirmed orders') ||
      cleanText.includes('ready for packing') ||
      cleanText.includes('approved order') ||
      cleanText.includes('approved orders') ||
      cleanText.includes('orders confirmed') ||
      cleanText === 'confirmed' ||
      cleanText.includes('የተረጋገጡ ትዕዛዞች') ||
      cleanText.includes('የተረጋገጠ ትዕዛዝ') ||
      cleanText.includes('የተረጋገጡ')
    );

  // 3.5. Payment Review & Pending Orders Inquiry
  const isPendingReviewOrdersIdea =
    !isHowToVerifyPayment && (
      cleanText.includes('payment review') ||
      cleanText.includes('pending payment') ||
      cleanText.includes('pending review') ||
      cleanText.includes('review order') ||
      cleanText.includes('review orders') ||
      cleanText.includes('orders review') ||
      cleanText.includes('pending order') ||
      cleanText.includes('pending orders') ||
      cleanText.includes('orders waiting') ||
      cleanText.includes('awaiting verification') ||
      cleanText.includes('unverified order') ||
      cleanText.includes('unverified orders') ||
      cleanText === 'pending' ||
      cleanText.includes('ማረጋገጫ የሚጠብቁ ትዕዛዞች') ||
      cleanText.includes('ያልተረጋገጡ ትዕዛዞች') ||
      cleanText.includes('ክፍያ ማረጋገጫ')
    );

  // 3.6. Fulfillment Pipeline Overview
  const isOrderPipelineIdea =
    !isCancelledOrdersIdea && !isDeliveredOrdersIdea && !isOutForDeliveryIdea && !isConfirmedOrdersIdea && !isPendingReviewOrdersIdea &&
    (cleanText.includes('pipeline') ||
     cleanText.includes('order pipeline') ||
     cleanText.includes('fulfillment') ||
     cleanText.includes('order status summary') ||
     cleanText.includes('unfulfilled') ||
     cleanText.includes('የትዕዛዝ ሂደት') ||
     cleanText.includes('የትዕዛዝ ሁኔታ ማጠቃለያ'));

  // 4. Recent Orders / All Orders / Orders Inquiry
  const isRecentOrdersIdea =
    !isTodayIncomeIdea && !isTodayOrdersIdea &&
    !isCancelledOrdersIdea && !isDeliveredOrdersIdea && !isOutForDeliveryIdea && !isConfirmedOrdersIdea && !isPendingReviewOrdersIdea && !isOrderPipelineIdea &&
    (cleanText.includes('recent order') ||
     cleanText.includes('latest order') ||
     cleanText.includes('last order') ||
     cleanText.includes('show order') ||
     cleanText.includes('orders list') ||
     cleanText.includes('list order') ||
     cleanText.includes('all order') ||
     cleanText.includes('what are the order') ||
     cleanText.includes('what are orders') ||
     (cleanText.includes('view order') && !cleanText.includes('review')) ||
     cleanText.includes('who ordered') ||
     cleanText.includes('order table') ||
     cleanText.includes('order history') ||
     cleanText === 'orders' ||
     cleanText === 'order' ||
     cleanText.includes('የቅርብ ጊዜ ትዕዛዝ') ||
     cleanText.includes('ትዕዛዞች') ||
     cleanText.includes('የትዕዛዝ ዝርዝር'));

  // 5. Pending Payments & Telebirr Verification
  const isPendingPaymentsIdea =
    cleanText.includes('pending payment') ||
    cleanText.includes('payment review') ||
    cleanText.includes('telebirr') ||
    cleanText.includes('verify payment') ||
    cleanText.includes('unverified') ||
    cleanText.includes('screenshot') ||
    cleanText.includes('need review') ||
    cleanText.includes('proof') ||
    cleanText.includes('ማረጋገጫ የሚጠብቁ') ||
    cleanText.includes('ያልተረጋገጠ ክፍያ') ||
    cleanText.includes('ቴሌብር ማረጋገጫ') ||
    cleanText.includes('ክፍያ');

  // 11. Order Pipeline / Unfulfilled / Pending Orders (Alias)
  const isPendingOrdersIdea = isOrderPipelineIdea || isPendingReviewOrdersIdea;

  // 12. Out-of-Stock & Inventory Alerts
  const isOutOfStockIdea =
    cleanText.includes('out of stock') ||
    cleanText.includes('outofstock') ||
    cleanText.includes('low stock') ||
    cleanText.includes('finished product') ||
    cleanText.includes('restock') ||
    cleanText.includes('inventory') ||
    cleanText.includes('unavailable product') ||
    cleanText.includes('ያለቀ እቃ') ||
    cleanText.includes('ያለቁ እቃዎች') ||
    cleanText.includes('ክምችት ያለቀ');

  // 13. Best-Selling Products
  const isBestSellerIdea =
    cleanText.includes('best seller') ||
    cleanText.includes('bestseller') ||
    cleanText.includes('best selling') ||
    cleanText.includes('top product') ||
    cleanText.includes('top selling') ||
    cleanText.includes('most sold') ||
    cleanText.includes('sells most') ||
    cleanText.includes('sell most') ||
    cleanText.includes('popular product') ||
    cleanText.includes('highest selling') ||
    cleanText.includes('በብዛት የተሸጠ') ||
    cleanText.includes('ተወዳጅ እቃ') ||
    cleanText.includes('አንደኛ እቃ');

  // 14. Village / Delivery Location Inquiry
  const isVillageLogisticsIdea =
    cleanText.includes('buanbuha') ||
    cleanText.includes('dessie') ||
    cleanText.includes('robit') ||
    cleanText.includes('piassa') ||
    cleanText.includes('arada') ||
    cleanText.includes('hote') ||
    cleanText.includes('village') ||
    cleanText.includes('delivery location') ||
    cleanText.includes('ቧንቧ ውሃ') ||
    cleanText.includes('ደሴ') ||
    cleanText.includes('ሮቢት') ||
    cleanText.includes('ፒያሳ') ||
    cleanText.includes('መንደር');

  // 15. Product Catalog & Price Audit
  const isProductCatalogIdea =
    !isOutOfStockIdea && !isBestSellerIdea && !isHowToEditProduct && !isHowToDeleteProduct &&
    (cleanText.includes('products') ||
     cleanText.includes('catalog') ||
     cleanText.includes('price list') ||
     cleanText.includes('all items') ||
     cleanText.includes('የእቃዎች ዝርዝር') ||
     cleanText.includes('ዋጋዎች'));

  // 16. Greeting
  const isGreeting =
    tSet.has('hi') ||
    tSet.has('hello') ||
    tSet.has('hey') ||
    cleanText.includes('good morning') ||
    cleanText.includes('good afternoon') ||
    cleanText.includes('ሰላም') ||
    cleanText.includes('እንደምን አለህ');

  // 17. Help / Capabilities
  const isHelpIdea =
    tSet.has('help') ||
    cleanText.includes('what can you do') ||
    cleanText.includes('who are you') ||
    cleanText.includes('commands') ||
    cleanText.includes('ምን ማድረግ ትችላለህ') ||
    cleanText.includes('እርዳታ');

  return {
    isTodayIncomeIdea,
    isTotalRevenueIdea,
    isTodayOrdersIdea,
    isRecentOrdersIdea,
    isPendingPaymentsIdea,
    isCancelledOrdersIdea,
    isDeliveredOrdersIdea,
    isOutForDeliveryIdea,
    isConfirmedOrdersIdea,
    isPendingReviewOrdersIdea,
    isOrderPipelineIdea,
    isHowToEditProduct,
    isHowToDeleteProduct,
    isHowToAddProduct,
    isHowToVerifyPayment,
    isHowToManageOrders,
    isHowToChangePasswordOrSecurity,
    isPendingOrdersIdea,
    isOutOfStockIdea,
    isBestSellerIdea,
    isVillageLogisticsIdea,
    isProductCatalogIdea,
    isGreeting,
    isHelpIdea
  };
}

/**
 * Fetches fresh live data across all admin domains directly from the server.
 */
export async function fetchLiveAdminData() {
  try {
    const analytics = await adminGetAnalyticsOverview();
    return analytics;
  } catch (err) {
    console.warn('[AdminAI] Could not fetch overview analytics, falling back to parallel fetch:', err);

    try {
      const [ordersRes, paymentsRes, productsRes] = await Promise.all([
        adminGetOrders({ limit: 50 }).catch(() => ({ orders: [], pagination: { total: 0 } })),
        adminGetPayments({ limit: 50 }).catch(() => ({ payments: [], pagination: { total: 0 } })),
        adminGetProducts().catch(() => [])
      ]);

      const orders = ordersRes.orders || [];
      const payments = paymentsRes.payments || [];
      const products = productsRes || [];

      const todayIso = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter(o => o.created_at && o.created_at.slice(0, 10) === todayIso);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      const pendingPayments = payments.filter(p => p.status === 'submitted');
      const outOfStock = products.filter(p => p.is_available === false);

      return {
        today: {
          orders_count: todayOrders.length,
          revenue: todayRevenue,
          pending: todayOrders.filter(o => o.status === 'pending').length,
          payment_review: todayOrders.filter(o => o.status === 'payment_review').length,
          confirmed: todayOrders.filter(o => o.status === 'confirmed').length,
          out_for_delivery: todayOrders.filter(o => o.status === 'out_for_delivery').length,
          delivered: todayOrders.filter(o => o.status === 'delivered').length,
          cancelled: todayOrders.filter(o => o.status === 'cancelled').length
        },
        all_time: {
          total_orders: ordersRes.pagination?.total || orders.length,
          confirmed_revenue: orders.filter(o => ['confirmed', 'out_for_delivery', 'delivered'].includes(o.status))
            .reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0),
          gross_revenue: orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0)
        },
        pending_payments: {
          count: pendingPayments.length,
          items: pendingPayments
        },
        inventory: {
          total_catalog: products.length,
          in_stock_count: products.length - outOfStock.length,
          out_of_stock_count: outOfStock.length,
          out_of_stock_products: outOfStock,
          all_products: products
        },
        top_products: products.slice(0, 5),
        recent_orders: orders.slice(0, 100)
      };
    } catch (fallbackErr) {
      console.error('[AdminAI] Critical failure loading fallback admin data:', fallbackErr);
      return null;
    }
  }
}

/**
 * Formats a list of order objects into structured, readable admin markdown lines
 */
function formatAdminOrderLines(orders, isAmharicResponse) {
  return orders.map(o => {
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString(isAmharicResponse ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const itemsText = Array.isArray(o.items) && o.items.length > 0
      ? o.items.map(i => `${i.quantity}x ${isAmharicResponse && i.product_name_am ? i.product_name_am : (i.product_name_en || 'Item')}`).join(', ')
      : '1 item';
    const statusUpper = (o.status || 'PENDING').toUpperCase();
    return `• **${o.order_number}** — **${o.customer_name || 'Customer'}** (${o.customer_phone || 'Phone'}) | **${parseFloat(o.total_amount || 0).toLocaleString()} ETB** [Status: **${statusUpper}**]\n  _${itemsText}_ (${dateStr})`;
  }).join('\n\n');
}

/**
 * Main reasoning processor for the Admin AI Copilot
 */
export async function processAdminQuery({
  query,
  currentLanguage = 'en',
  liveData = null,
  bypassLiveFetch = false
}) {
  const { cleanText, tokens, isAmharic } = normalizeAdminInput(query);
  const isAmharicResponse = isAmharic || currentLanguage === 'am';

  // 1. Fetch up-to-the-second operational data directly from server
  let data = liveData;
  if (!bypassLiveFetch) {
    try {
      const fresh = await fetchLiveAdminData();
      if (fresh) data = fresh;
    } catch {
      // Keep liveData fallback
    }
  } else if (!data) {
    data = await fetchLiveAdminData();
  }

  // Safe defaults
  const today = data?.today || { orders_count: 0, revenue: 0, pending: 0, payment_review: 0, confirmed: 0, delivered: 0, out_for_delivery: 0, cancelled: 0 };
  const allTime = data?.all_time || { total_orders: 0, confirmed_revenue: 0, gross_revenue: 0, pending: 0, payment_review: 0, confirmed: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
  const pendingPayments = data?.pending_payments || { count: 0, items: [] };
  const inventory = data?.inventory || { total_catalog: 0, in_stock_count: 0, out_of_stock_count: 0, out_of_stock_products: [], all_products: [] };
  const topProducts = data?.top_products || [];
  const recentOrders = data?.recent_orders || [];

  // ─── PRIORITY 1: CUSTOMER & ORDER ENTITY LOOKUP ──────────────────────────
  const customerMatch = searchCustomerOrOrder(cleanText, recentOrders, pendingPayments.items);
  if (customerMatch && customerMatch.matched) {
    const orders = customerMatch.orders;
    const orderCards = orders.map(o => {
      const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString(isAmharicResponse ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
      const itemsList = Array.isArray(o.items) && o.items.length > 0
        ? o.items.map(it => `    • ${it.quantity}x ${isAmharicResponse && it.product_name_am ? it.product_name_am : (it.product_name_en || 'Product')} (${parseFloat(it.subtotal || it.unit_price || 0).toLocaleString()} ETB)`).join('\n')
        : '    • 1 item';

      const paymentMethod = o.payments && o.payments[0]?.method ? o.payments[0].method.toUpperCase() : 'Telebirr';
      const payStatus = o.payments && o.payments[0]?.status ? `[Payment: ${o.payments[0].status}]` : '';
      const cleanNote = o.customer_note
        ? o.customer_note.replace(/^\[Payment:\s*[^\]]+\]\s*/i, '').replace(/^\(Payment:\s*[^)]+\)\s*/i, '').trim()
        : null;

      return isAmharicResponse
        ? `📋 **ትዕዛዝ #${o.order_number}** (${dateStr})፡\n  • **ሁኔታ**፡ **${o.status.toUpperCase()}**\n  • **ጠቅላላ ዋጋ**፡ **${parseFloat(o.total_amount || 0).toLocaleString()} ETB**\n  • **የክፍያ መንገድ**፡ **${paymentMethod}** ${payStatus}\n  • **የታዘዙ እቃዎች**፡\n${itemsList}${cleanNote ? `\n  • **የማድረሻ ማስታወሻ**፡ _"${cleanNote}"_` : ''}`
        : `📋 **Order #${o.order_number}** (${dateStr}):\n  • **Status**: **${o.status.toUpperCase()}**\n  • **Total Amount**: **${parseFloat(o.total_amount || 0).toLocaleString()} ETB**\n  • **Payment**: **${paymentMethod}** ${payStatus}\n  • **Items**:\n${itemsList}${cleanNote ? `\n  • **Delivery Note**: _"${cleanNote}"_` : ''}`;
    }).join('\n\n');

    return {
      text: isAmharicResponse
        ? `👤 **የደንበኛ መረጃ እና የትዕዛዝ ታሪክ**፡\n\n• **የደንበኛ ስም**፡ **${customerMatch.customerName}**\n• **ስልክ ቁጥር**፡ **${customerMatch.customerPhone || 'የለም'}**\n• **የመላኪያ አድራሻ**፡ **${customerMatch.customerAddress || 'ደሴ'}**\n• **ጠቅላላ ትዕዛዞች**፡ **${orders.length} ትዕዛዝ**\n\n${orderCards}\n\nይህን ትዕዛዝ ለማየት ወይም ለማስተዳደር ከታች ያለውን ቁልፍ ይጫኑ።`
        : `👤 **Customer Profile & Order History**:\n\n• **Customer Name**: **${customerMatch.customerName}**\n• **Phone Number**: **${customerMatch.customerPhone || 'N/A'}**\n• **Delivery Address**: **${customerMatch.customerAddress || 'Dessie'}**\n• **Total Orders Recorded**: **${orders.length} order(s)**\n\n${orderCards}\n\nClick below to open the complete details in Orders or Payments!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥን ክፈት' : 'View in Orders Table' },
        { type: 'NAVIGATE', path: '/admin/payments', label: isAmharicResponse ? 'ክፍያዎችን ይመልከቱ' : 'View in Payments' }
      ]
    };
  }

  if (customerMatch && customerMatch.isNotFoundCustomerQuery) {
    return {
      text: isAmharicResponse
        ? `🔍 **ደንበኛ አልተገኘም**፡\n\nበቅርብ ጊዜ በተመዘገቡ ትዕዛዞች ውስጥ '**${customerMatch.candidateName}**' በሚል ስም ወይም ስልክ የተመዘገበ ደንበኛ አልተገኘም። እባክዎ የስሙን አጻጻፍ ያረጋግጡ ወይም ሙሉውን የትዕዛዝ ሰንጠረዥ ይመልከቱ።`
        : `🔍 **Customer Not Found**:\n\nI searched recent order records for '**${customerMatch.candidateName}**', but could not find any matching customer name, phone number, or order number. Please verify the spelling or check the full Orders table below.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ሁሉንም ትዕዛዞች ፈልግ' : 'Search All Orders' }
      ]
    };
  }

  const concepts = extractAdminSemanticConcepts(cleanText, tokens);

  // ─── PRIORITY 2: HOW-TO ADMINISTRATIVE OPERATIONAL GUIDES ─────────────────
  // How to edit products
  if (concepts.isHowToEditProduct) {
    return {
      text: isAmharicResponse
        ? `✏️ **እቃዎችን እንዴት ማስተካከል እንደሚቻል (How to Edit Products)**፡\n\n1. **የእቃዎች ገጽን ይክፈቱ**፡ በግራ በኩል **"Products"** የሚለውን ይጫኑ (ወይም ከታች ያለውን ቁልፍ ይጠቀሙ)።\n2. **ማስተካከል የሚፈልጉትን እቃ ይምረጡ**፡ በእቃው ካርድ ላይ ያለውን የ**እርሳስ (Edit)** ምልክት ይጫኑ።\n3. **የሚከተሉትን መቀየር ይችላሉ**፡\n   • **ዋጋ (Price)**፡ አዲሱን ዋጋ በብር ያስገቡ።\n   • **ክምችት (Stock Status)**፡ **In Stock** ወይም **Out of Stock** የሚለውን ያብሩ/ያጥፉ።\n   • **ስም እና ዝርዝር**፡ የእንግሊዝኛ ወይም የአማርኛ መግለጫዎችን ያስተካክሉ።\n   • **ፎቶ**፡ አዲስ ፎቶ ማከል ወይም መቀየር ይችላሉ (ሁለተኛው ፎቶ አማራጭ ነው፤ ባይኖርም ማስቀመጥ አይከለክልዎትም!)።\n4. **አስቀምጥ (Save Changes)**፡ **"Save Changes"** ሲጫኑ በሱቁ ገጽ እና በአይ ላይ ወዲያውኑ **ያለ ሪፍሬሽ** ይቀየራል!`
        : `✏️ **How to Edit Products & Update Inventory**:\n\n1. **Open Products**: Click **"Products"** in the sidebar (or click the button below).\n2. **Locate Item**: Find the product card and click the **Edit** (pencil) button.\n3. **Editable Fields**:\n   • **Price**: Enter the updated price in ETB.\n   • **Stock Status**: Toggle between **In Stock** and **Out of Stock**.\n   • **Names & Details**: Edit English and Amharic titles and bullet points.\n   • **Photos**: Upload or replace pictures. *(Note: The secondary image is optional and will never block you from saving!)*\n4. **Save Changes**: Click **"Save Changes"**. Your updates instantly go live across the storefront and AI with **zero refresh required**!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'ወደ እቃዎች ገጽ ሂድ' : 'Go to Products' }
      ]
    };
  }

  // How to delete products
  if (concepts.isHowToDeleteProduct) {
    return {
      text: isAmharicResponse
        ? `🗑️ **እቃን ከሱቁ ውስጥ እንዴት መሰረዝ ይቻላል (How to Delete Product)**፡\n\n1. በግራ በኩል ያለውን **"Products"** ገጽ ይክፈቱ።\n2. መሰረዝ የሚፈልጉትን እቃ ካርድ ይፈልጉ።\n3. በእቃው ካርድ ላይ ያለውን ቀይ የ**መሰረዣ (Delete / ቆሻሻ መጣያ)** ምልክት ይጫኑ።\n4. ማረጋገጫ (Confirm) ሲጠይቅዎት **OK** ይበሉ።\n\nእቃው ወዲያውኑ ከሱቁ ካታሎግ እና ከደንበኞች እይታ ሙሉ በሙሉ ይሰረዛል!`
        : `🗑️ **How to Delete a Product from Store**:\n\n1. Open the **Products** screen (/admin/products).\n2. Locate the product you want to remove.\n3. Click the red **"Delete"** (trash can) button on that product's card.\n4. Confirm the prompt when asked.\n\nThe product will be permanently removed from the storefront catalog and customer search immediately!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'የእቃዎች ገጽ' : 'Manage Products' }
      ]
    };
  }

  // How to add a new product
  if (concepts.isHowToAddProduct) {
    return {
      text: isAmharicResponse
        ? `➕ **አዲስ እቃ ወደ ሱቁ እንዴት እንደሚጨመር (How to Add Product)**፡\n\n1. **"Products"** ገጽን ይክፈቱ።\n2. ከላይ በቀኝ በኩል ያለውን **"+ Add Product"** የሚለውን ቁልፍ ይጫኑ።\n3. የእቃውን የእንግሊዝኛ ስም፣ የአማርኛ ስም፣ ዋጋ (በብር)፣ ምድብ እና መግለጫ ያስገቡ።\n4. ቢያንስ 1 ዋና ፎቶ ይምረጡ (ሁለተኛው ፎቶ አማራጭ ነው)።\n5. **"Create Product"** የሚለውን ይጫኑ። እቃው ወዲያውኑ በሱቁ እና በአይ ረዳቱ ላይ ለሽያጭ ዝግጁ ይሆናል!`
        : `➕ **How to Add a New Product to Catalog**:\n\n1. Open **Products** (/admin/products).\n2. Click the **"+ Add Product"** button at the top right.\n3. Fill in English Name, Amharic Name, Price (ETB), Category, and description.\n4. Upload the primary product image (secondary image is optional).\n5. Click **"Create Product"**. It goes live instantly across the entire storefront and AI!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'አዲስ እቃ ጨምር' : 'Add New Product' }
      ]
    };
  }

  // How to verify Telebirr payments
  if (concepts.isHowToVerifyPayment) {
    return {
      text: isAmharicResponse
        ? `💳 **የቴሌብር ክፍያዎችን እንዴት ማረጋገጥ ይቻላል (How to Verify Payments)**፡\n\n1. በግራ በኩል **"Payments"** የሚለውን ገጽ ይክፈቱ።\n2. **"Submitted"** በሚለው ማጣሪያ ሥር ያሉትን ያልተረጋገጡ ክፍያዎች ይምረጡ።\n3. ደንበኛው የላከውን የቴሌብር ስክሪንሾት (Screenshot) ለመመልከት በምስሉ ላይ ይጫኑ።\n4. የተላከው የብር መጠን ከትዕዛዙ ጠቅላላ ዋጋ ጋር መመሳሰሉን ያረጋግጡ።\n5. **"Verify Payment"** የሚለውን ይጫኑ (የተሳሳተ ከሆነ **"Reject"** ማድረግ ይችላሉ)።\n\nክፍያው ሲረጋገጥ የትዕዛዙ ሁኔታ በቀጥታ ወደ **Confirmed** ይቀየራል!`
        : `💳 **How to Verify Telebirr Payments**:\n\n1. Open the **Payments** screen (/admin/payments).\n2. Look for payments under the **"Submitted"** tab.\n3. Click the customer's uploaded receipt screenshot to inspect the transaction amount and reference number.\n4. Check that the amount transferred matches the order total.\n5. Click **"Verify Payment"** to approve (or **"Reject"** if the screenshot is invalid).\n\nUpon verification, the customer's order status automatically advances to **Confirmed**!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/payments?status=submitted', label: isAmharicResponse ? 'ክፍያዎችን መርምር' : 'Review Payments' }
      ]
    };
  }

  // How to manage / advance order status
  if (concepts.isHowToManageOrders) {
    return {
      text: isAmharicResponse
        ? `📦 **የትዕዛዞችን ሁኔታ እንዴት መቀየር ይቻላል (How to Manage Orders)**፡\n\n1. **"Orders"** የሚለውን ገጽ ይክፈቱ።\n2. የትዕዛዙን ዝርዝር ለመመልከት በትዕዛዙ ላይ ይጫኑ።\n3. የሁኔታ (Status) ሳጥኑን በመጠቀም ትዕዛዙን ያራምዱ፡\n   • **Pending** ➡️ ክፍያ የሚጠብቅ\n   • **Confirmed** ➡️ የተረጋገጠ እና የሚዘጋጅ\n   • **Out for Delivery** ➡️ ለሹፌር የተሰጠ እና በመጓጓዝ ላይ ያለ\n   • **Delivered** ➡️ ለደንበኛው በሰላም የደረሰ\n   • **Cancelled** ➡️ ውድቅ የተደረገ ወይም የተሰረዘ`
        : `📦 **How to Process & Update Order Status**:\n\n1. Open **Orders** (/admin/orders).\n2. Click on the order to view customer details and phone number.\n3. Use the status dropdown to advance the order pipeline:\n   • **Pending** ➡️ Awaiting payment or review\n   • **Confirmed** ➡️ Payment verified, ready for packing\n   • **Out for Delivery** ➡️ With delivery courier on the way to customer\n   • **Delivered** ➡️ Completed & received\n   • **Cancelled** ➡️ If customer cancelled or payment rejected`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ትዕዛዞችን አስተዳድር' : 'Manage Orders' }
      ]
    };
  }

  // How to change admin password, email & account security
  if (concepts.isHowToChangePasswordOrSecurity) {
    return {
      text: isAmharicResponse
        ? `🔒 **የአድሚን የይለፍ ቃል (Password) እና ኢሜይል እንዴት መቀየር እንደሚቻል**፡\n\n1. **የደህንነት መስኮትን ይክፈቱ**፡ በግራ በኩል በስምዎ ስር ያለውን **"Account & Security"** የሚለውን ቁልፍ (ወይም ከላይ በቀኝ በኩል ያለውን የቁልፍ ምልክት) ይጫኑ።\n2. **ኢሜይል ወይም ስም ይቀይሩ**፡ አዲሱን የግል ኢሜይልዎን (ለምሳሌ \`abdela@gmail.com\`) ያስገቡ።\n3. **አሁን ያለውን የይለፍ ቃል ያስገቡ (Current Password)**፡ ለደህንነት ሲባል እርስዎ መሆንዎን ለማረጋገጥ አሁን የሚጠቀሙበትን የይለፍ ቃል ያስገቡ።\n4. **አዲስ የይለፍ ቃል ያስገቡ (New Password)**፡ አዲስ ሚስጥራዊ የይለፍ ቃል (ቢያንስ 6 ፊደላት) ያስገቡ እና በድጋሚ በማስገባት ያረጋግጡ (Confirm)።\n5. **"Save Changes"** የሚለውን ይጫኑ።\n\n🛡️ **ሙሉ ሚስጥራዊነት**፡ አዲሱ የይለፍ ቃል በከፍተኛ የ \`bcrypt\` ምስጠራ (encryption) ዳታቤዝ ውስጥ ስለሚቀመጥ ማንም ሰው (የሲስተሙ ሰሪዎችም ጭምር) ሊያዩት ወይም ሊያውቁት አይችሉም! እርስዎ ብቻ ነዎት የሚያውቁት።`
        : `🔒 **How to Change Admin Password & Login Email**:\n\n1. **Open Account & Security**: Click the **"Account & Security"** button in the sidebar (bottom profile card) or in the top header bar.\n2. **Update Email / Name**: Enter your personal email address (e.g. \`abdela@gmail.com\`) and display name.\n3. **Enter Current Password**: Type your current password to authorize the change and verify your identity.\n4. **Enter New Secret Password**: Type your new password (min. 6 characters) and re-type it in the confirm box.\n5. **Click "Save Changes"**.\n\n🛡️ **100% Privacy Guarantee**: Your new password is immediately encrypted using high-grade \`bcrypt\` hashing in the database. Neither developers nor anyone else can view or read your password. Only you have access!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin', label: isAmharicResponse ? 'ወደ ዳሽቦርድ ሂድ' : 'Open Dashboard' }
      ]
    };
  }

  // ─── PRIORITY 3: SPECIFIC CATALOG PRODUCT INQUIRY ────────────────────────
  const prodMatch = searchCatalogProduct(cleanText, inventory.all_products, topProducts);
  if (prodMatch) {
    const p = prodMatch.product;
    const meta = prodMatch.meta;
    const statusText = p.is_available ? '✅ In Stock' : '⚠️ Out of Stock';
    const name = isAmharicResponse && p.name_am ? p.name_am : p.name_en;

    const salesStats = meta
      ? `• **Total Sold**: **${meta.total_sold_qty || 0} unit(s)** across ${meta.order_count || 0} orders\n• **Revenue Generated**: **${parseFloat(meta.total_revenue || 0).toLocaleString()} ETB**`
      : '• **Sales**: 0 completed orders recorded yet';

    return {
      text: isAmharicResponse
        ? `📦 **የእቃ መረጃ፡ ${name}**\n\n• **ዋጋ**፡ **${parseFloat(p.price || 0).toLocaleString()} ETB (ብር)**\n• **የክምችት ሁኔታ**፡ **${statusText}**\n${salesStats}\n\nዋጋውን ለመቀየር ወይም ክምችቱን ለማስተካከል ከታች ያለውን ቁልፍ ይጫኑ።`
        : `📦 **Product Details: ${name}**\n\n• **Current Price**: **${parseFloat(p.price || 0).toLocaleString()} ETB**\n• **Inventory Status**: **${statusText}**\n${salesStats}\n\nTo edit price, description, photos, or stock availability, click below:`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'በእቃዎች ገጽ አስተካክል' : 'Edit in Products' }
      ]
    };
  }

  // ─── PRIORITY 3.5: STATUS-SPECIFIC ORDER INQUIRIES & PIPELINE ────────────────
  // 1. Cancelled Orders Inquiry
  if (concepts.isCancelledOrdersIdea) {
    const cancelledOrders = recentOrders.filter(o => o.status === 'cancelled');
    if (cancelledOrders.length === 0 && (allTime.cancelled || 0) === 0) {
      return {
        text: isAmharicResponse
          ? `✅ **የተሰረዘ ትዕዛዝ የለም**!\n\nበአሁኑ ሰዓት በሱቁ ውስጥ የተሰረዘ ምንም አይነት ትዕዛዝ የለም (0 የተሰረዙ)። ሁሉም የደንበኛ ትዕዛዞች በሂደት ላይ ወይም የተጠናቀቁ ናቸው።`
          : `✅ **No Cancelled Orders**!\n\nThere are currently 0 cancelled orders recorded in the store database. All customer orders are active, in fulfillment, or successfully completed!`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥ' : 'View Orders Table' }
        ]
      };
    }

    const orderLines = formatAdminOrderLines(cancelledOrders, isAmharicResponse);
    const countDisplay = cancelledOrders.length || allTime.cancelled || 1;

    return {
      text: isAmharicResponse
        ? `❌ **የተሰረዙ ትዕዛዞች (${countDisplay} ትዕዛዞች)**፡\n\n${orderLines}\n\nእነዚህ ትዕዛዞች በደንበኛው ጥያቄ ወይም በክፍያ ውድቅ ምክንያት የተሰረዙ ናቸው። ሙሉውን ሰንጠረዥ ለመመልከት ከታች ያለውን ቁልፍ ይጫኑ።`
        : `❌ **Cancelled Orders (${countDisplay} recorded)**:\n\n${orderLines}\n\nThese orders were cancelled by customer request or due to rejected payments. Click below to view in the Orders management screen.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?status=cancelled', label: isAmharicResponse ? 'የተሰረዙ ትዕዛዞች' : 'Filter Cancelled Orders' },
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ሁሉንም ትዕዛዞች ክፈት' : 'All Orders' }
      ]
    };
  }

  // 2. Delivered Orders Inquiry
  if (concepts.isDeliveredOrdersIdea) {
    const deliveredOrders = recentOrders.filter(o => o.status === 'delivered');
    if (deliveredOrders.length === 0 && (allTime.delivered || 0) === 0) {
      return {
        text: isAmharicResponse
          ? `📋 **እስካሁን የደረሰ ትዕዛዝ የለም**\n\nበአሁኑ ሰዓት በዳታቤዝ ውስጥ 'Delivered' (የደረሰ) የተባለ ትዕዛዝ የለም (0 የደረሱ)። እቃዎች ለደንበኞች ሲደርሱ ሁኔታቸውን ወደ **Delivered** በመቀየር ማጠናቀቅ ይችላሉ።`
          : `📋 **No Delivered Orders Yet**\n\nThere are currently 0 orders marked as **Delivered** in the store database. Once a delivery rider hands over an order to a customer, update its status to **Delivered** to track completed fulfillment.`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥ' : 'Open Orders Table' }
        ]
      };
    }

    const orderLines = formatAdminOrderLines(deliveredOrders, isAmharicResponse);
    const countDisplay = deliveredOrders.length || allTime.delivered;

    return {
      text: isAmharicResponse
        ? `✅ **በሰላም የደረሱ የተጠናቀቁ ትዕዛዞች (${countDisplay} ትዕዛዞች)**፡\n\n${orderLines}\n\nእነዚህ ትዕዛዞች ለደንበኞች ደርሰው የተጠናቀቁ ናቸው።`
        : `✅ **Delivered & Completed Orders (${countDisplay} recorded)**:\n\n${orderLines}\n\nThese orders have been safely delivered to customers.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?status=delivered', label: isAmharicResponse ? 'የደረሱ ትዕዛዞች' : 'Filter Delivered Orders' }
      ]
    };
  }

  // 3. Out for Delivery Orders Inquiry
  if (concepts.isOutForDeliveryIdea) {
    const inDeliveryOrders = recentOrders.filter(o => o.status === 'out_for_delivery');
    if (inDeliveryOrders.length === 0 && (allTime.out_for_delivery || 0) === 0) {
      return {
        text: isAmharicResponse
          ? `🚚 **በማድረስ ላይ ያለ ትዕዛዝ የለም**\n\nበአሁኑ ሰዓት በመጓጓዝ/በማድረስ ላይ ያለ ጥቅል የለም (0 ትዕዛዞች)። የታሸጉ እቃዎችን ለሹፌር ሲሰጡ ሁኔታቸውን ወደ **Out for Delivery** ይቀይሩ።`
          : `🚚 **No Orders Currently Out for Delivery**\n\nThere are currently 0 packages in transit with delivery couriers right now. Once ready, you can assign them to a rider and advance their status to **Out for Delivery**!`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥ' : 'Open Orders Table' }
        ]
      };
    }

    const orderLines = formatAdminOrderLines(inDeliveryOrders, isAmharicResponse);
    const countDisplay = inDeliveryOrders.length || allTime.out_for_delivery;

    return {
      text: isAmharicResponse
        ? `🚚 **በመጓጓዝ/በማድረስ ላይ ያሉ ትዕዛዞች (${countDisplay} ትዕዛዞች)**፡\n\n${orderLines}\n\nእነዚህ ጥቅሎች ወደ ደንበኞች ደጃፍ በመጓጓዝ ላይ ይገኛሉ።`
        : `🚚 **Orders Currently Out for Delivery (${countDisplay} in transit)**:\n\n${orderLines}\n\nThese packages are currently on their way to customers across Dessie and local villages.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?status=out_for_delivery', label: isAmharicResponse ? 'በማድረስ ላይ ያሉ' : 'Filter In-Delivery' }
      ]
    };
  }

  // 4. Confirmed Orders Inquiry
  if (concepts.isConfirmedOrdersIdea) {
    const confirmedOrders = recentOrders.filter(o => o.status === 'confirmed');
    if (confirmedOrders.length === 0 && (allTime.confirmed || 0) === 0) {
      return {
        text: isAmharicResponse
          ? `📋 **የተረጋገጠ ትዕዛዝ የለም**\n\nበአሁኑ ሰዓት መታሸግ ወይም መላክ የሚጠብቅ የተረጋገጠ ትዕዛዝ የለም (0 ትዕዛዞች)።`
          : `📋 **No Confirmed Orders**\n\nThere are currently 0 confirmed orders awaiting packaging or delivery dispatch.`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥ' : 'Open Orders Table' }
        ]
      };
    }

    const orderLines = formatAdminOrderLines(confirmedOrders, isAmharicResponse);
    const countDisplay = confirmedOrders.length || allTime.confirmed;

    return {
      text: isAmharicResponse
        ? `📦 **የተረጋገጡ እና ለመታሸግ የተዘጋጁ ትዕዛዞች (${countDisplay} ትዕዛዞች)**፡\n\n${orderLines}\n\nክፍያቸው ተረጋግጦ ለመታሸግ እና ለመላክ የተዘጋጁ ትዕዛዞች ናቸው።`
        : `📦 **Confirmed Orders Ready for Packaging / Dispatch (${countDisplay} orders)**:\n\n${orderLines}\n\nPayments for these orders have been approved and they are ready to be packaged and dispatched.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?status=confirmed', label: isAmharicResponse ? 'የተረጋገጡ ትዕዛዞች' : 'Filter Confirmed' }
      ]
    };
  }

  // 5. Payment Review & Pending Orders Inquiry
  if (concepts.isPendingReviewOrdersIdea) {
    const pendingReviewOrders = recentOrders.filter(o => o.status === 'pending' || o.status === 'payment_review');
    const totalPendingCount = (pendingPayments.count || 0) + pendingReviewOrders.length;

    if (totalPendingCount === 0 && (allTime.pending || 0) === 0 && (allTime.payment_review || 0) === 0) {
      return {
        text: isAmharicResponse
          ? `✅ **ክፍያ ማረጋገጫ የሚጠብቅ ትዕዛዝ የለም**!\n\nሁሉም የቀረቡ ትዕዛዞች እና የቴሌብር ክፍያዎች ተገምግመዋል ወይም ተረጋግጠዋል። ማረጋገጫ የሚጠብቅ ምንም አይነት ትዕዛዝ የለም።`
          : `✅ **No Orders Awaiting Payment Review**!\n\nAll submitted customer orders and Telebirr payments are currently reviewed and up to date. There are 0 orders pending payment verification.`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/payments', label: isAmharicResponse ? 'የክፍያዎች ገጽ' : 'Open Payments' },
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥ' : 'Open Orders Table' }
        ]
      };
    }

    const paymentLines = (pendingPayments.items && pendingPayments.items.length > 0)
      ? pendingPayments.items.map(p => `• **Order #${p.order_number}** — **${p.customer_name || 'Customer'}** (${p.customer_phone || 'Phone'}) | **${parseFloat(p.amount || 0).toLocaleString()} ETB** [${p.method.toUpperCase()} Proof Submitted]`).join('\n')
      : '';

    const orderLines = formatAdminOrderLines(pendingReviewOrders, isAmharicResponse);
    const combinedList = [paymentLines, orderLines].filter(Boolean).join('\n\n');

    return {
      text: isAmharicResponse
        ? `⚠️ **ክፍያ/ትዕዛዝ ማረጋገጫ የሚጠብቁ ትዕዛዞች (${totalPendingCount})**፡\n\n${combinedList}\n\nእባክዎ የቴሌብር ስክሪንሾቱን በመመርመር ክፍያቸውን ያረጋግጡ (Verify)።`
        : `⚠️ **Orders Awaiting Payment Review & Verification (${totalPendingCount})**:\n\n${combinedList}\n\nPlease inspect the submitted Telebirr transaction screenshots to verify or reject.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/payments?status=submitted', label: isAmharicResponse ? 'ያልተረጋገጡ ክፍያዎችን መርምር' : 'Review Payments' },
        { type: 'NAVIGATE', path: '/admin/orders?status=pending', label: isAmharicResponse ? 'ያልተጠናቀቁ ትዕዛዞች' : 'Filter Pending Orders' }
      ]
    };
  }

  // 6. Fulfillment Pipeline Overview
  if (concepts.isOrderPipelineIdea) {
    const pendingCount = (allTime.pending || 0) + (allTime.payment_review || 0);
    const inDelivery = allTime.out_for_delivery || 0;

    return {
      text: isAmharicResponse
        ? `📦 **የትዕዛዝ ሂደት እና ሁኔታ (Order Pipeline)**፡\n\n• **ክፍያ/ትዕዛዝ ማረጋገጫ የሚጠብቁ**፡ **${pendingCount} ትዕዛዞች**\n• **የተረጋገጡ (የሚዘጋጁ)**፡ **${allTime.confirmed || 0} ትዕዛዞች**\n• **በመጓጓዝ/በማድረስ ላይ ያሉ**፡ **${inDelivery} ትዕዛዞች**\n• **በሰላም የደረሱ**፡ **${allTime.delivered || 0} ትዕዛዞች**\n• **የተሰረዙ**፡ **${allTime.cancelled || 0} ትዕዛዞች**`
        : `📦 **Order Fulfillment Pipeline**:\n\n• **Orders Awaiting Processing/Review**: **${pendingCount} orders**\n• **Confirmed (Ready for Packing)**: **${allTime.confirmed || 0} orders**\n• **Out for Delivery Right Now**: **${inDelivery} orders**\n• **Delivered Successfully**: **${allTime.delivered || 0} orders**\n• **Cancelled Orders**: **${allTime.cancelled || 0} orders**`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?status=pending', label: isAmharicResponse ? 'ያልተጠናቀቁ ትዕዛዞችን አሳይ' : 'Show Pending Orders' },
        { type: 'NAVIGATE', path: '/admin/orders?status=confirmed', label: isAmharicResponse ? 'የተረጋገጡ ትዕዛዞችን አሳይ' : 'Show Confirmed Orders' }
      ]
    };
  }

  // ─── PRIORITY 4: RECENT ORDERS & GENERAL ORDERS INQUIRY ───────────────────
  if (concepts.isRecentOrdersIdea) {
    if (recentOrders.length === 0) {
      return {
        text: isAmharicResponse
          ? `📋 **የትዕዛዝ ታሪክ**፡\n\nእስካሁን በሱቁ ውስጥ የተመዘገበ ትዕዛዝ የለም (**0 ትዕዛዞች**)። ደንበኞች በሱቁ ገጽ ላይ ትዕዛዝ እንዳስገቡ እዚህ ወዲያውኑ ይዘረዘራሉ!`
          : `📋 **Recent Orders**:\n\nCurrently, there are 0 orders recorded in the store database. As soon as a customer orders, it will appear here in real time!`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥ' : 'Open Orders Table' }
        ]
      };
    }

    const displayOrders = recentOrders.slice(0, 20);
    const orderLines = displayOrders.map(o => {
      const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString(isAmharicResponse ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const itemsText = Array.isArray(o.items) && o.items.length > 0
        ? o.items.map(i => `${i.quantity}x ${isAmharicResponse && i.product_name_am ? i.product_name_am : (i.product_name_en || 'Product')}`).join(', ')
        : '1 item';

      return `• **Order #${o.order_number}** — **${o.customer_name || 'Customer'}** (${o.customer_phone || 'Phone'}) | **${parseFloat(o.total_amount || 0).toLocaleString()} ETB** [Status: **${(o.status || 'PENDING').toUpperCase()}**]\n  _${itemsText}_ (${dateStr})`;
    }).join('\n\n');

    const extraNotice = recentOrders.length > 20
      ? (isAmharicResponse ? `\n\n*(+ ተጨማሪ ${recentOrders.length - 20} ትዕዛዞች በዳታቤዝ ውስጥ ይገኛሉ)*` : `\n\n*(+ ${recentOrders.length - 20} more earlier orders recorded in database)*`)
      : '';

    return {
      text: isAmharicResponse
        ? `📋 **የቅርብ ጊዜ ትዕዛዞች ዝርዝር** (ጠቅላላ የተመዘገቡ **${allTime.total_orders}** ትዕዛዞች / የዛሬ **${today.orders_count}** ትዕዛዝ)፡\n\n${orderLines}${extraNotice}\n\nዝርዝር መረጃዎችን ለማየት እና ሁኔታዎችን ለማስተካከል ከታች ያለውን ቁልፍ ይጫኑ።`
        : `📋 **Recent Orders Breakdown** (${allTime.total_orders} lifetime recorded / ${today.orders_count} today):\n\n${orderLines}${extraNotice}\n\n• **All-Time Recorded Gross**: **${allTime.gross_revenue.toLocaleString()} ETB**\n• **Today's New Orders**: **${today.orders_count} order(s)**\n\nClick below to open the complete Orders management screen!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዞች ሰንጠረዥ' : 'Open Orders Table' },
        { type: 'NAVIGATE', path: '/admin/orders?date=today', label: isAmharicResponse ? 'የዛሬ ትዕዛዞች' : "Today's Orders" }
      ]
    };
  }

  // ─── SCENARIO 1: TODAY'S INCOME & REVENUE ────────────────────────────────
  if (concepts.isTodayIncomeIdea) {
    const formattedRevenue = today.revenue.toLocaleString();
    const confirmedRev = (today.confirmed + today.delivered) > 0
      ? `• Confirmed / In Delivery: **${today.confirmed + today.delivered} orders**`
      : '';

    return {
      text: isAmharicResponse
        ? `💰 **የዛሬ ገቢ እና ሽያጭ ማጠቃለያ**፡\n\n• **የዛሬ ጠቅላላ ሽያጭ**፡ **${formattedRevenue} ETB (ብር)**\n• **የዛሬ ትዕዛዞች ብዛት**፡ **${today.orders_count} ትዕዛዞች**\n• **ክፍያ ማረጋገጫ ላይ**፡ **${today.payment_review} ትዕዛዞች**\n• **የተረጋገጡ/በማድረስ ላይ**፡ **${today.confirmed + today.out_for_delivery} ትዕዛዞች**\n• **የተጠናቀቁ (የደረሱ)**፡ **${today.delivered} ትዕዛዞች**\n\n• **አጠቃላይ የሱቁ የሽያጭ መጠን**፡ **${allTime.gross_revenue.toLocaleString()} ETB** (${allTime.total_orders} ትዕዛዞች)\n\nዝርዝር ትዕዛዞችን ለማየት ከታች ያለውን ቁልፍ ይጫኑ።`
        : `💰 **Today's Revenue & Income Summary**:\n\n• **Today's Gross Sales**: **${formattedRevenue} ETB**\n• **Total Orders Placed Today**: **${today.orders_count} order(s)**\n• **Awaiting Payment Verification**: **${today.payment_review} order(s)**\n• **Confirmed & Out for Delivery**: **${today.confirmed + today.out_for_delivery} order(s)**\n• **Delivered & Completed**: **${today.delivered} order(s)**\n\n• **All-Time Recorded Sales**: **${allTime.gross_revenue.toLocaleString()} ETB** across **${allTime.total_orders} total orders**\n\n${confirmedRev ? `${confirmedRev}\n\n` : ''}Click below to view and manage orders!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?date=today', label: isAmharicResponse ? 'የዛሬ ትዕዛዞችን ይመልከቱ' : "View Today's Orders" },
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ሁሉንም ትዕዛዞች ክፈት' : 'All Orders' },
        { type: 'NAVIGATE', path: '/admin/payments', label: isAmharicResponse ? 'ክፍያዎችን ይመልከቱ' : 'View Payments' }
      ]
    };
  }

  // ─── SCENARIO 2: ALL-TIME GROSS & CONFIRMED REVENUE ──────────────────────
  if (concepts.isTotalRevenueIdea) {
    const totalConfirmed = allTime.confirmed_revenue.toLocaleString();
    const totalGross = allTime.gross_revenue.toLocaleString();

    return {
      text: isAmharicResponse
        ? `📈 **አጠቃላይ የሱቁ የገንዘብ ገቢ**፡\n\n• **የተረጋገጠ የተጠናቀቀ ሽያጭ**፡ **${totalConfirmed} ETB**\n• **ጠቅላላ የተመዘገበ ሽያጭ**፡ **${totalGross} ETB**\n• **ጠቅላላ የታዘዙ ትዕዛዞች**፡ **${allTime.total_orders} ትዕዛዞች**\n• **የተረጋገጡ ትዕዛዞች**፡ **${allTime.confirmed || 0}**\n• **የደረሱ ትዕዛዞች**፡ **${allTime.delivered || 0}**`
        : `📈 **Store Total Revenue & Financial Metrics**:\n\n• **Confirmed & Completed Sales**: **${totalConfirmed} ETB**\n• **Gross Order Pipeline**: **${totalGross} ETB**\n• **Lifetime Orders Count**: **${allTime.total_orders} total orders**\n• **Delivered Packages**: **${allTime.delivered || 0} orders**`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ትዕዛዞችን ይመልከቱ' : 'Open Orders Table' }
      ]
    };
  }

  // ─── SCENARIO 3: TODAY'S ORDERS ──────────────────────────────────────────
  if (concepts.isTodayOrdersIdea) {
    if (today.orders_count === 0) {
      return {
        text: isAmharicResponse
          ? `📋 **የዛሬ ትዕዛዞች**፡\n\nእስካሁን ለዛሬ ቀን አዲስ ትዕዛዝ አልገባም (**0 ትዕዛዞች**)።\n\n• **ጠቅላላ የተመዘገቡ ትዕዛዞች**፡ **${allTime.total_orders} ትዕዛዞች**\n• **የቅርብ ጊዜ ትዕዛዞችን** ለማየት ከታች ያለውን ቁልፍ ይጫኑ!`
          : `📋 **Today's Orders Status**:\n\nNo orders have been submitted yet today (**0 orders**).\n\n• **Lifetime Total Recorded**: **${allTime.total_orders} order(s)**\n• You can review previous orders in the Orders screen!`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ሁሉንም ትዕዛዞች ክፈት' : 'View All Orders' }
        ]
      };
    }

    const orderLines = recentOrders.slice(0, 5).map(o => {
      return `• **${o.order_number}** — ${o.customer_name || 'Customer'} (${o.customer_address || 'Dessie'}) | **${parseFloat(o.total_amount || 0).toLocaleString()} ETB** [${o.status}]`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `📋 **የዛሬ ትዕዛዞች ማጠቃለያ** (${today.orders_count} ${today.orders_count === 1 ? 'ትዕዛዝ' : 'ትዕዛዞች'})፡\n\n${orderLines}\n\n• **ክፍያ ማረጋገጫ የሚጠብቁ**፡ ${today.payment_review}\n• **የተረጋገጡ/በማድረስ ላይ**፡ ${today.confirmed + today.out_for_delivery}\n• **የደረሱ**፡ ${today.delivered}`
        : `📋 **Today's Orders Breakdown** (${today.orders_count} ${today.orders_count === 1 ? 'order' : 'orders'}):\n\n${orderLines}\n\n• **Awaiting Payment Review**: ${today.payment_review}\n• **Confirmed / Out for Delivery**: ${today.confirmed + today.out_for_delivery}\n• **Delivered**: ${today.delivered}`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?date=today', label: isAmharicResponse ? 'የዛሬ ትዕዛዞችን ዝርዝር ክፈት' : "Filter Today's Orders" }
      ]
    };
  }

  // ─── SCENARIO 4: PENDING PAYMENTS & TELEBIRR APPROVALS ───────────────────
  if (concepts.isPendingPaymentsIdea) {
    if (pendingPayments.count === 0) {
      return {
        text: isAmharicResponse
          ? `✅ **ማረጋገጫ የሚጠብቁ ክፍያዎች የሉም**!\n\nሁሉም የቀረቡ የቴሌብር ክፍያዎች እና ደረሰኞች ተገምግመዋል ወይም ተረጋግጠዋል። አዲስ የክፍያ ስክሪንሾት እንደገባ ወዲያውኑ ይገለጽልዎታል።`
          : `✅ **No Payments Pending Verification**!\n\nAll submitted Telebirr transaction screenshots and payments are currently reviewed and up to date. As soon as a customer uploads a new proof screenshot, you can verify it here!`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/payments', label: isAmharicResponse ? 'የክፍያዎች ገጽ' : 'Open Payments' }
        ]
      };
    }

    const paymentLines = pendingPayments.items.slice(0, 5).map(p => {
      return `• **Order ${p.order_number}** — ${p.customer_name || 'Customer'} (${p.customer_phone || 'Phone'}) | **${parseFloat(p.amount || 0).toLocaleString()} ETB** (${p.method.toUpperCase()})`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `⚠️ **${pendingPayments.count} የቴሌብር ክፍያዎች ማረጋገጫ ይጠብቃሉ**፡\n\n${paymentLines}\n\nእባክዎ የደንበኞቹን የግብይት ስክሪንሾት (Transaction Screenshot) በመመርመር ክፍያቸውን ያረጋግጡ (Verify) ወይም አስፈላጊ ከሆነ ውድቅ ያድርጉ (Reject)።`
        : `⚠️ **${pendingPayments.count} Payment(s) Awaiting Admin Verification**:\n\n${paymentLines}\n\nPlease inspect the transaction screenshot and customer transaction number to verify the order or provide feedback.`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/payments?status=submitted', label: isAmharicResponse ? 'ያልተረጋገጡ ክፍያዎችን መርምር' : 'Review Pending Payments' }
      ]
    };
  }

  // ─── SCENARIO 6: OUT OF STOCK & INVENTORY ALERTS ─────────────────────────
  if (concepts.isOutOfStockIdea) {
    if (inventory.out_of_stock_count === 0) {
      return {
        text: isAmharicResponse
          ? `✅ **ሁሉም እቃዎች ክምችት ላይ ይገኛሉ (In Stock)**!\n\nበአሁኑ ሰዓት ከሱቁ ውስጥ ያለቀ እቃ የለም። ሁሉም **${inventory.total_catalog}** እቃዎች ለመሸጥ ዝግጁ ናቸው።`
          : `✅ **All Products are In Stock**!\n\nCurrently, zero products are marked Out of Stock. All **${inventory.total_catalog}** catalog items are available for customer orders.`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'የእቃዎች ዝርዝር' : 'Manage Products' }
        ]
      };
    }

    const oosList = inventory.out_of_stock_products.map(p => {
      const name = isAmharicResponse && p.name_am ? p.name_am : p.name_en;
      return `• ⚠️ **${name}** — ${parseFloat(p.price || 0).toLocaleString()} ETB (Out of Stock)`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `⚠️ **ክምችት ያለቀባቸው (${inventory.out_of_stock_count}) እቃዎች**፡\n\n${oosList}\n\nአዲስ ክምችት ሲገባ በምርቶች ገጽ ላይ በመግባት ሁኔታውን ወደ **In Stock** መቀየር ይችላሉ — ደንበኞች በሱቁ ገጽ እና በአብደላ AI ወዲያውኑ ማዘዝ ይችላሉ።`
        : `⚠️ **Out-of-Stock Alert (${inventory.out_of_stock_count} item(s))**:\n\n${oosList}\n\nOrders for these items are currently paused on the storefront. Once new inventory arrives, toggle their status back to **In Stock** in Products Management!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'እቃዎችን አስተካክል / Restock' : 'Go to Products / Restock' }
      ]
    };
  }

  // ─── SCENARIO 7: BEST-SELLING PRODUCTS ───────────────────────────────────
  if (concepts.isBestSellerIdea) {
    if (topProducts.length === 0) {
      return {
        text: isAmharicResponse
          ? `📊 በሱቁ እስካሁን የተጠናቀቁ የሽያጭ መረጃዎች አልተመዘገቡም።`
          : `📊 No historical product sales recorded yet.`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'ምርቶችን ክፈት' : 'View Products' }
        ]
      };
    }

    const productLines = topProducts.slice(0, 4).map((p, idx) => {
      const name = isAmharicResponse && p.name_am ? p.name_am : p.name_en;
      return `${idx + 1}. **${name}**\n   • Sold: **${p.total_sold_qty} unit(s)** across ${p.order_count} orders\n   • Revenue: **${parseFloat(p.total_revenue || 0).toLocaleString()} ETB**`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `🏆 **በብዛት የተሸጡ ተወዳጅ እቃዎች ደረጃ**፡\n\n${productLines}`
        : `🏆 **Top-Selling Products Leaderboard**:\n\n${productLines}`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'የእቃዎች ዝርዝር' : 'View Catalog' }
      ]
    };
  }

  // ─── SCENARIO 8: VILLAGE & DELIVERY LOCATION LOGISTICS ───────────────────
  if (concepts.isVillageLogisticsIdea) {
    const locKeyword = cleanText.includes('buanbuha') || cleanText.includes('ቧንቧ ውሃ') ? 'buanbuha' : 'dessie';
    const matchedOrders = recentOrders.filter(o => {
      const addr = (o.customer_address || '').toLowerCase();
      return addr.includes(locKeyword);
    });

    if (matchedOrders.length === 0) {
      return {
        text: isAmharicResponse
          ? `🚚 ከ**${locKeyword === 'buanbuha' ? 'ቧንቧ ውሃ' : 'ደሴ'}** በቅርብ ጊዜ የተመዘገበ ትዕዛዝ የለም። በአጠቃላይ በደሴ ውስጥ ያሉ ሁሉም መንደሮች (ቧንቧ ውሃ፣ ፒያሳ፣ ሮቢት፣ አራዳ) በ1–2 ሰዓት ውስጥ ይደርሳሉ።`
          : `🚚 No recent orders found explicitly matching **${locKeyword === 'buanbuha' ? 'Buanbuha' : 'Dessie'}**. Doorstep delivery across all Dessie villages (Buanbuha, Robit, Piassa, Arada) is dispatched same-day within 1–2 hours.`,
        actions: [
          { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'ሁሉንም ትዕዛዞች ክፈት' : 'View Orders' }
        ]
      };
    }

    const list = matchedOrders.slice(0, 4).map(o => {
      return `• **${o.order_number}** — ${o.customer_name} (${o.customer_phone}) | ${o.customer_address} [${o.status}]`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `🚚 **ከ${locKeyword === 'buanbuha' ? 'ቧንቧ ውሃ' : 'ደሴ'} የተመዘገቡ የቅርብ ጊዜ ትዕዛዞች** (${matchedOrders.length})፡\n\n${list}`
        : `🚚 **Recent Orders for ${locKeyword === 'buanbuha' ? 'Buanbuha' : 'Dessie'}** (${matchedOrders.length}):\n\n${list}`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የትዕዛዝ ሰንጠረዥን ክፈት' : 'Open Orders' }
      ]
    };
  }

  // ─── SCENARIO 9: PRODUCT CATALOG & PRICE AUDIT ───────────────────────────
  if (concepts.isProductCatalogIdea) {
    const allProds = inventory.all_products || [];
    const prodList = allProds.map(p => {
      const name = isAmharicResponse && p.name_am ? p.name_am : p.name_en;
      const statusBadge = p.is_available ? '✅ In Stock' : '⚠️ Out of Stock';
      return `• **${name}** — **${parseFloat(p.price || 0).toLocaleString()} ETB** (${statusBadge})`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `📦 **የሱቁ ሙሉ የእቃዎች እና የዋጋ ዝርዝር** (${allProds.length} እቃዎች)፡\n\n${prodList}`
        : `📦 **Live Product Catalog & Price Audit** (${allProds.length} items):\n\n${prodList}`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'እቃዎችን አስተካክል' : 'Edit Products' }
      ]
    };
  }

  // ─── SCENARIO 10: GREETING & STATUS PULSE ─────────────────────────────────
  if (concepts.isGreeting) {
    return {
      text: isAmharicResponse
        ? `👋 **ሰላም ወንድም አብደላ! የአስተዳዳሪ ረዳት AI ነኝ።**\n\nየሱቁ የቀጥታ ሁኔታ፡\n• **የዛሬ ሽያጭ**፡ **${today.revenue.toLocaleString()} ETB** (${today.orders_count} ትዕዛዞች)\n• **ማረጋገጫ የሚጠብቁ ክፍያዎች**፡ **${pendingPayments.count} ክፍያዎች**\n• **ያለቁ እቃዎች**፡ **${inventory.out_of_stock_count} እቃዎች**\n\nምን ማወቅ ይፈልጋሉ? ስለ ዛሬ ገቢ፣ ስለ ክፍያዎች፣ ስለ ትዕዛዞች፣ ስለ ደንበኞች ወይም እቃዎችን እንዴት ማስተካከል/መሰረዝ እንደሚቻል ሊጠይቁኝ ይችላሉ!`
        : `👋 **Hello Brother Abdela! I am your Admin AI Copilot.**\n\nHere is your live store pulse right now:\n• **Today's Revenue**: **${today.revenue.toLocaleString()} ETB** (${today.orders_count} orders)\n• **Payments Awaiting Review**: **${pendingPayments.count} payment(s)**\n• **Out-of-Stock Items**: **${inventory.out_of_stock_count} item(s)**\n\nHow can I help you? You can ask about today's income, recent orders, pending payments, customer lookups, or how to edit/delete products!`,
      actions: [
        { type: 'NAVIGATE', path: '/admin/orders?date=today', label: isAmharicResponse ? 'የዛሬ ትዕዛዞች' : "Today's Orders" },
        { type: 'NAVIGATE', path: '/admin/payments?status=submitted', label: isAmharicResponse ? 'ክፍያዎችን መርምር' : 'Review Payments' },
        { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'እቃዎችን ተቆጣጠር' : 'Inventory' }
      ]
    };
  }

  // ─── SCENARIO 11: HELP / CAPABILITIES ─────────────────────────────────────
  return {
    text: isAmharicResponse
      ? `💡 **የአስተዳዳሪ ረዳት AI ምን ማወቅ እና ማድረግ ይችላል?**\n\n1. 💰 **የዛሬ ገቢ እና ሽያጭ** (ለምሳሌ: *"የዛሬ ገቢ ስንት ነው"*, *"today income"*, *"daily revenue"*)\n2. 📋 **የትዕዛዞች እና የደንበኛ ታሪክ** (ለምሳሌ: *"recent orders"*, *"የቅርብ ጊዜ ትዕዛዞች"*, *"ስለ ደንበኛ መብራቱ ንገረኝ"*)\n3. ✏️ **የአስተዳዳሪ እርዳታ እና መመሪያ** (ለምሳሌ: *"እቃ እንዴት ማስተካከል እችላለሁ"*, *"እንዴት እቃ መሰረዝ እችላለሁ"*, *"አዲስ እቃ መጨመር"*)\n4. 🔒 **የይለፍ ቃል እና ኢሜይል መቀየር** (ለምሳሌ: *"የይለፍ ቃል እንዴት መቀየር ይቻላል"*, *"how to change password"*)\n5. ⚠️ **የክፍያ ማረጋገጫዎች** (ለምሳሌ: *"ማረጋገጫ የሚጠብቁ ክፍያዎች"*, *"pending payments"*)\n6. 📦 **የእቃዎች ክምችት እና ዋጋ** (ለምሳሌ: *"ያለቁ እቃዎች አሉ?"*, *"የየመን ማር ዋጋ ስንት ነው"*)\n7. 🏆 **ምርጥ ሻጭ እቃዎች እና የመንደር መላኪያ** (ለምሳሌ: *"በብዛት የተሸጠ እቃ"*, *"ከቧንቧ ውሃ የመጣ ትዕዛዝ"*)\n\nበእንግሊዝኛም ሆነ በአማርኛ በማንኛውም አጠያየቅ በቀጥታ መጠየቅ ይችላሉ!`
      : `💡 **What can the Admin AI Copilot do?**\n\n1. 💰 **Today's Revenue & Income** (e.g. *"today income ?"*, *"how much did make income today"*, *"daily sales"*)\n2. 📋 **Orders & Customer Lookups** (e.g. *"recent orders ?"*, *"tell me about user mebratu melaku"*, *"who ordered"*)\n3. ✏️ **Store Management Guides** (e.g. *"how to edit product"*, *"how to delete product"*, *"how to verify payments"*)\n4. 🔒 **Change Password & Email** (e.g. *"how to change password"*, *"how to update email"*, *"account security"*)\n5. ⚠️ **Pending Payments** (e.g. *"any payments to verify?"*, *"show payment screenshots"*)\n6. 📦 **Stock & Catalog Inquiries** (e.g. *"what is out of stock?"*, *"price of yemen honey"*, *"inventory status"*)\n7. 🏆 **Best Sellers & Village Logistics** (e.g. *"which item sells most?"*, *"orders from Buanbuha"*)\n\nAsk me anything in English or Amharic, using your own words or voice dictation!`,
    actions: [
      { type: 'NAVIGATE', path: '/admin/orders?date=today', label: isAmharicResponse ? 'የዛሬ ገቢ' : "Today's Income" },
      { type: 'NAVIGATE', path: '/admin/orders', label: isAmharicResponse ? 'የቅርብ ጊዜ ትዕዛዞች' : 'Recent Orders' },
      { type: 'NAVIGATE', path: '/admin/payments?status=submitted', label: isAmharicResponse ? 'ክፍያዎችን መርምር' : 'Pending Payments' },
      { type: 'NAVIGATE', path: '/admin/products', label: isAmharicResponse ? 'እቃዎችን አስተካክል' : 'Manage Products' }
    ]
  };
}
