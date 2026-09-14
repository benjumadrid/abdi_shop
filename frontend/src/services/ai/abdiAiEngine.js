/**
 * Abdi AI - Intelligent Customer Support & Shopping Assistant Engine
 * 
 * Features:
 * 1. Levenshtein & phonetic fuzzy token normalization for customer typos (e.g. "oder", "paymant", "telebir", "availble")
 * 2. Real-time store state integration (always fetches fresh product catalog, prices, and stock status on demand)
 * 3. Real customer order history lookup from device storage (identifies newest orders, live verification & rejection notices)
 * 4. Multi-turn conversational memory (tracks active order/product across turns e.g. "I ordered honey" -> "is it confirmed?")
 * 5. Bilingual dialogue: Native English & natural, fluent Amharic
 * 6. Strict customer security: zero exposure of internal admin notes, credentials, or other customers' data
 */

import { getMySavedOrders, getCustomerOrderById, getProducts } from '../api.js';

// =============================================================================
// 1. FUZZY MATCHING & SPELLING CORRECTION UTILITIES
// =============================================================================

/**
 * Calculates Levenshtein edit distance between two strings
 */
function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b).length;
  const matrix = Array.from({ length: a.length + 1 }, () => []);

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Canonical dictionary mapping common typos/phonetic spellings to standard tokens
 */
const CANONICAL_DICTIONARY = {
  // Order variants (note: 'make' excluded to prevent false positives)
  order: ['order', 'orderr', 'oerder', 'oder', 'odr', 'ordr', 'ordring', 'ordering', 'buy', 'purchase', 'buying', 'place'],
  // Payment variants
  payment: ['payment', 'paymant', 'payement', 'pyament', 'paymnt', 'paying', 'pay', 'paid', 'peymnt', 'peymant'],
  // Telebirr variants
  telebirr: ['telebirr', 'telebir', 'telbirr', 'tellebirr', 'teleber', 'teleberr', 'tele', 'birr', 'telebirrpay'],
  // Cash on delivery variants
  cash: ['cash', 'cod', 'deliverypay', 'hand', 'cashondelivery'],
  // Screenshot / Proof variants
  screenshot: ['screenshot', 'screenshoot', 'screen', 'shot', 'screensht', 'proof', 'receipt', 'receit', 'slip', 'picture', 'pic', 'photo', 'upload', 'attach', 'attachement'],
  // Verification variants
  verify: ['verify', 'verification', 'verifcation', 'verifed', 'verified', 'verfy', 'approve', 'approved', 'confirm', 'confirmed'],
  // Rejection variants
  reject: ['reject', 'rejected', 'rejection', 'rejct', 'declined', 'denied', 'unapproved', 'failed', 'refuse', 'refused'],
  // Order history / My Orders variants
  history: ['history', 'histroy', 'myorders', 'myorder', 'orders', 'tracking', 'track'],
  // Availability / Stock variants
  available: ['available', 'availble', 'avialable', 'avaible', 'availabel', 'stock', 'stok', 'instock', 'outofstock', 'unavailable', 'soldout', 'exist', 'restock'],
  // Products variants
  product: ['product', 'products', 'prodct', 'prduct', 'produc', 'item', 'items', 'goods', 'catalog', 'shop', 'store'],
  // Delivery / Location variants
  delivery: ['delivery', 'delvery', 'deliver', 'delivering', 'shipping', 'dessie', 'address', 'location', 'buanbuha', 'buambuha', 'village', 'villages', 'neighborhood', 'kebele', 'sefer', 'reach', 'destination', 'area', 'doorstep'],
  // Speed / Timing variants
  speed: ['speed', 'fast', 'quick', 'quickly', 'duration', 'sameday', 'deliverytime'],
  // Authenticity / Quality variants
  authenticity: ['original', 'authentic', 'genuine', 'real', 'fake', 'quality', 'originality', 'durability', 'guarantee', 'warranty', 'durable'],
  // Contact / Phone variants
  contact: ['contact', 'call', 'calling', 'phone', 'phonenumber', 'number', 'hotline', 'telegram'],
  // Inspection / Return variants
  inspection: ['inspect', 'inspection', 'check', 'checking', 'damage', 'damaged', 'broken', 'return', 'refund', 'exchange'],
  // Discount variants
  discount: ['discount', 'discounts', 'deal', 'deals', 'negotiate', 'bargain', 'reduce', 'decrease', 'cheaper'],
  // Help variants
  help: ['help', 'support', 'assist', 'guide', 'info', 'what', 'how', 'who'],
  // Price variants
  price: ['price', 'cost', 'howmuch', 'expensive', 'cheap', 'rate', 'birr', 'etb'],
  // Language variants
  language: ['language', 'amharic', 'english', 'amharigna', 'translate'],
  // Recent / Latest variants
  latest: ['latest', 'recent', 'recently', 'newest', 'new', 'last', 'mostrecent']
};

/**
 * Common English words that must NEVER be mutated by fuzzy spelling correction
 */
const PROTECTED_ENGLISH_WORDS = new Set([
  'your', 'you', 'what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that',
  'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'they', 'them',
  'their', 'there', 'here', 'some', 'than', 'then', 'into', 'only', 'also', 'just',
  'more', 'most', 'very', 'does', 'done', 'open', 'send', 'good', 'well', 'find',
  'look', 'take', 'come', 'give', 'make', 'know', 'tell', 'show', 'much', 'many'
]);

/**
 * Normalizes an English or Amharic text into standardized tokens with spelling correction
 */
function normalizeAndCorrectText(rawText) {
  if (!rawText) return { cleanText: '', tokens: [], isAmharicScript: false };

  // Check if text contains Amharic Ethiopic Unicode characters (U+1200 - U+137F)
  const isAmharicScript = /[\u1200-\u137F]/.test(rawText);

  // Clean and lowercase
  const cleanText = rawText.toLowerCase().replace(/[^\w\s\u1200-\u137F]/g, ' ').replace(/\s+/g, ' ').trim();
  const rawWords = cleanText.split(' ').filter(Boolean);

  const tokens = rawWords.map((word) => {
    // Check direct dictionary match
    for (const [canonical, variants] of Object.entries(CANONICAL_DICTIONARY)) {
      if (variants.includes(word)) {
        return canonical;
      }
    }

    // Never fuzzy-mutate protected standard English words
    if (PROTECTED_ENGLISH_WORDS.has(word)) {
      return word;
    }

    // Check fuzzy Levenshtein distance for words length >= 4 (edit distance 1 for typos)
    if (word.length >= 4) {
      for (const [canonical, variants] of Object.entries(CANONICAL_DICTIONARY)) {
        for (const variant of variants) {
          if (Math.abs(word.length - variant.length) <= 1) {
            if (levenshteinDistance(word, variant) <= 1) {
              return canonical;
            }
          }
        }
      }
    }

    return word;
  });

  return { cleanText, tokens, isAmharicScript };
}

// =============================================================================
// 2. PRODUCT FUZZY MATCHER
// =============================================================================

/**
 * Known product aliases mapped to standard matchers
 */
const PRODUCT_ALIASES = [
  {
    key: 'honey',
    aliases: ['honey', 'yemeni', 'yemen', 'yeman', 'mar', 'ማር', 'የየመን'],
    nameSubstring: 'honey'
  },
  {
    key: 'powerbank',
    aliases: ['power', 'bank', 'powerbank', 'fmax', 'f-max', '30000', '30,000', 'battery', 'charger', 'ፓወር', 'ባንክ'],
    nameSubstring: 'power bank'
  },
  {
    key: 'cramp_relief',
    aliases: ['cramp', 'period', 'relief', 'women', 'menstrual', 'pain', 'ህመም', 'ፔሬድ', 'መቀነሻ', 'መቀነሺያ'],
    nameSubstring: 'period cramp relief'
  },
  {
    key: 'cable',
    aliases: ['cable', 'router', 'wifi', 'wi-fi', 'boost', 'rauter', 'ራውተር', 'ኬብል', 'ዋይፋይ'],
    nameSubstring: 'cable'
  }
];

/**
 * Finds matching product from current real store products using fuzzy query
 */
function findMatchingProduct(cleanText, tokens, products = []) {
  if (!products || products.length === 0) return null;

  // 1. Direct check against product names (full match or partial)
  for (const p of products) {
    const nameEn = (p.name_en || '').toLowerCase().trim();
    const nameAm = (p.name_am || '').toLowerCase().trim();

    // Check if whole name or substantial part is in query
    if (nameEn && (cleanText.includes(nameEn) || (nameEn.length > 5 && nameEn.includes(cleanText)))) {
      return p;
    }
    if (nameAm && (cleanText.includes(nameAm) || (nameAm.length > 5 && nameAm.includes(cleanText)))) {
      return p;
    }
  }

  // 2. Check token aliases (pre-configured aliases for core products)
  for (const item of PRODUCT_ALIASES) {
    const hasAlias = item.aliases.some((alias) =>
      tokens.includes(alias) || cleanText.includes(alias)
    );

    if (hasAlias) {
      // Find matching product in current products array
      const found = products.find((p) =>
        (p.name_en || '').toLowerCase().includes(item.nameSubstring) ||
        (p.name_am || '').toLowerCase().includes(item.aliases[item.aliases.length - 1])
      );
      if (found) return found;
    }
  }

  // Common generic adjectives / prefixes to avoid false positive singleton matching
  const GENERIC_NAME_TOKENS = new Set([
    'original', 'women', 'womens', 'fast', 'high', 'with', 'best', 'super', 'item', 'items', 'product', 'products', 'goods', 'shop', 'store',
    'ኦርጅናል', 'ኦሪጅናል', 'ጥራት', 'አዲስ', 'የሴቶች', 'እቃ', 'እቃዎች', 'ምርት', 'ምርቶች'
  ]);

  // 3. Dynamic match against individual English and Amharic words of ANY product (including new admin additions)
  for (const p of products) {
    // English words in product name
    const enWords = (p.name_en || '').toLowerCase().split(/[\s,/-]+/).filter(w => w.length >= 4 && !GENERIC_NAME_TOKENS.has(w));
    for (const w of enWords) {
      if (cleanText.includes(w) || tokens.some(t => t === w || (t.length >= 4 && levenshteinDistance(t, w) <= 1))) {
        return p;
      }
    }

    // Amharic words in product name
    const amWords = (p.name_am || '').toLowerCase().split(/[\s,/-]+/).filter(w => w.length >= 3 && !GENERIC_NAME_TOKENS.has(w));
    for (const w of amWords) {
      if (cleanText.includes(w)) {
        return p;
      }
    }
  }

  return null;
}

/**
 * Finds a product by standard key (honey, powerbank, cramp_relief, cable)
 */
export function findProductByKey(key, products = []) {
  if (!products || products.length === 0) return null;
  const aliasItem = PRODUCT_ALIASES.find(item => item.key === key);
  if (!aliasItem) return null;
  return products.find(p =>
    (p.name_en || '').toLowerCase().includes(aliasItem.nameSubstring) ||
    (p.name_am || '').toLowerCase().includes(aliasItem.aliases[aliasItem.aliases.length - 1])
  ) || null;
}

// =============================================================================
// 3. AMHARIC INTENT KEYWORD SETS
// =============================================================================

const AMHARIC_KEYWORDS = {
  order: ['ማዘዝ', 'እንዴት ማዘዝ', 'ትዕዛዝ', 'ትእዛዝ', 'ትዕዛዜ', 'ትእዛዜ', 'ትእዛዞች', 'ትዕዛዞች', 'ልዘዝ', 'እዘዝ', 'ለመግዛት', 'መግዛት', 'ልግዛ', 'አዝዣለሁ', 'አዝዣለሁኝ'],
  payment: ['ክፍያ', 'መክፈል', 'እንዴት ልክፈል', 'የክፍያ', 'እንዴት እከፍላለሁ'],
  telebirr: ['ቴሌብር', 'ቴሌ', 'ብር'],
  cash: ['በእጅ', 'በደረሰኝ', 'በጥሬ ገንዘብ', 'በጥሬ', 'ሲደርስ'],
  screenshot: ['ስክሪንሾት', 'ፎቶ', 'ደረሰኝ', 'ስክሪን', 'ማስረጃ', 'ማያያዝ'],
  verify: ['ማረጋገጥ', 'ማረጋገጫ', 'የተረጋገጠ', 'ተረጋግጧል', 'ይረጋገጣል', 'አልፏል'],
  reject: ['ውድቅ', 'ያልተረጋገጠ', 'ያልተረጋገጠበት', 'ተቀባይነት', 'ውድቅ የተደረገ'],
  history: ['የእኔ ትዕዛዞች', 'የትዕዛዝ ታሪክ', 'ትዕዛዜ', 'የት ደረሰ', 'ታሪክ'],
  available: ['አለ', 'አለ ወይ', 'ይገኛል', 'በክምችት', 'አልቋል', 'ያለቀ', 'የለም', 'ማዘዝ እችላለሁ'],
  products: [
    'ምን እቃዎች', 'ምን ምርቶች', 'የምርቶች ዝርዝር', 'የእቃዎች ዝርዝር', 'ምን አለ', 'ምን ትሸጣላችሁ',
    'የአብደላ እቃዎች', 'የአብደላ ምርቶች', 'ስለ አብደላ እቃዎች', 'ስለ አብደላ ምርቶች',
    'የአብዲ እቃዎች', 'የአብዲ ምርቶች', 'ስለ አብዲ እቃዎች', 'ስለ አብዲ ምርቶች', 'ስለ ምርቶች', 'ስለ እቃዎች',
    'የሚሸጡ እቃዎች', 'የሚሸጡ ምርቶች', 'ምርቶች', 'እቃዎች'
  ],
  price: ['ዋጋ', 'ስንት ነው', 'ዋጋው', 'በስንት', 'ዋጋቸው'],
  help: ['እርዳታ', 'ልትረዳኝ', 'አብደላ ማን ነው', 'ስለ አብደላ', 'አብዲ ማን ነው', 'ስለ አብዲ'],
  delivery: [
    'ማድረሻ', 'መላኪያ', 'ደሴ', 'የት ታደርሳላችሁ', 'አድራሻ', 'ቧንቧ ውሃ', 'ቧንቧውሃ',
    'ቧንቧ', 'ቦንቧ', 'መንደር', 'መንደሬ', 'መንደሮች', 'ሰፈር', 'ሰፈሬ', 'ሰፈሮች',
    'ቀበሌ', 'ፒያሳ', 'አራዳ', 'ሆቴ', 'ሮቢት', 'ኮምቦልቻ', 'ይደርሳል', 'ታደርሳላችሁ',
    'እቤቴ', 'ደጃፌ', 'እቤት', 'ቤት ድረስ', 'መንደር ድረስ', 'ሰፈር ድረስ', 'ማድረስ',
    'ማግኘት'
  ],
  speed: ['መቼ', 'ስንት ሰዓት', 'በስንት ሰዓት', 'በስንት ቀን', 'ስንት ቀን', 'ፈጣን', 'የማድረሻ ጊዜ', 'መቼ ይደርሳል', 'መቼ ነው የሚደርሰው'],
  authenticity: ['ኦርጅናል', 'ኦሪጅናል', 'ትክክለኛ', 'ጥራት', 'አስተማማኝ', 'ዋስትና', 'ፌክ', 'የውሸት', 'የሚበረክት', 'ጥንካሬ'],
  contact: ['ስልክ', 'ስልክ ቁጥር', 'እንዴት ልደውል', 'መደወል', 'ቴሌግራም', 'የአብደላ ስልክ', 'የአብዲ ስልክ', 'የደውሉልኝ', 'ደውል'],
  inspection: ['አይቼ', 'ካላማረኝ', 'ብላሽ', 'መመለስ', 'መቀየር', 'መፈተሽ'],
  discount: ['ቅናሽ', 'መቀነስ', 'ቀንስ', 'ይቀነሳል', 'ረከስ'],
  latest: ['የቅርብ ጊዜ', 'የመጨረሻው', 'የመጨረሻ', 'አሁን ያዘዝኩት', 'የቅርቡ']
};

function hasAmharicMatch(cleanText, category) {
  const words = AMHARIC_KEYWORDS[category] || [];
  return words.some(w => cleanText.includes(w));
}

// =============================================================================
// 3.5. SEMANTIC CONCEPT & PROBLEM MATCHER
// =============================================================================

/**
 * Extracts underlying semantic concepts regardless of phrasing
 */
export function extractSemanticConcepts(cleanText, tokens = []) {
  // 1. Price Concept
  const isPriceIdea =
    cleanText.includes('tell me the price') ||
    cleanText.includes('tell me price') ||
    cleanText.includes('price of') ||
    cleanText.includes('how much is') ||
    cleanText.includes('how much for') ||
    cleanText.includes('how much does') ||
    cleanText.includes('how much') ||
    cleanText.includes('what is the price') ||
    cleanText.includes('what is price') ||
    cleanText.includes('what does it cost') ||
    cleanText.includes('cost of') ||
    tokens.includes('price') ||
    hasAmharicMatch(cleanText, 'price') ||
    cleanText.includes('ዋጋ') ||
    cleanText.includes('ዋጋው') ||
    cleanText.includes('ዋጋቸው') ||
    cleanText.includes('ስንት ነው') ||
    cleanText.includes('በስንት');

  // 2. Why Can't Order / Stock Problem Concept
  const isWhyCantOrderIdea =
    cleanText.includes('why cant') ||
    cleanText.includes("why can't") ||
    cleanText.includes('why i cant') ||
    cleanText.includes("why i can't") ||
    cleanText.includes('why cannot') ||
    cleanText.includes('why i cannot') ||
    cleanText.includes('cant order') ||
    cleanText.includes("can't order") ||
    cleanText.includes('cannot order') ||
    cleanText.includes('unable to order') ||
    cleanText.includes('cant buy') ||
    cleanText.includes("can't buy") ||
    cleanText.includes('cannot buy') ||
    cleanText.includes('why is it out of stock') ||
    cleanText.includes('why out of stock') ||
    cleanText.includes('why is it unavailable') ||
    cleanText.includes('why unavailable') ||
    cleanText.includes('why is it sold out') ||
    cleanText.includes('why sold out') ||
    cleanText.includes('when will it be back') ||
    cleanText.includes('when is it back') ||
    cleanText.includes('when will it come') ||
    cleanText.includes('when back') ||
    cleanText.includes('back in stock') ||
    cleanText.includes('sold out') ||
    cleanText.includes('out of stock') ||
    cleanText.includes('restock') ||
    cleanText.includes('ለምን ማዘዝ') ||
    cleanText.includes('ማዘዝ አልቻልኩም') ||
    cleanText.includes('መግዛት አልቻልኩም') ||
    cleanText.includes('ለምን አልቋል') ||
    cleanText.includes('መቼ ይመጣል') ||
    cleanText.includes('መቼ ይገባል') ||
    cleanText.includes('መቼ ነው የሚመጣው');

  // 2.5. Availability / Stock Concept
  const isAvailabilityIdea =
    isWhyCantOrderIdea ||
    cleanText.includes('in stock') ||
    cleanText.includes('out of stock') ||
    cleanText.includes('do you have') ||
    cleanText.includes('is it available') ||
    cleanText.includes('are they available') ||
    cleanText.includes('can i get') ||
    cleanText.includes('can i order') ||
    cleanText.includes('can i buy') ||
    tokens.includes('available') ||
    hasAmharicMatch(cleanText, 'available') ||
    cleanText.includes('አለ ወይ') ||
    cleanText.includes('ይገኛል') ||
    cleanText.includes('በክምችት');

  // 3. Usage & How-To Guide Concept
  const isUsageGuideIdea =
    cleanText.includes('how to use') ||
    cleanText.includes('how do i use') ||
    cleanText.includes('how do you use') ||
    cleanText.includes('how does it work') ||
    cleanText.includes('how does the') ||
    cleanText.includes('how to operate') ||
    cleanText.includes('how do i charge') ||
    cleanText.includes('how to charge') ||
    cleanText.includes('how to connect') ||
    cleanText.includes('how do i connect') ||
    cleanText.includes('directions for use') ||
    cleanText.includes('instructions') ||
    cleanText.includes('አጠቃቀም') ||
    cleanText.includes('እንዴት ነው የሚሰራው') ||
    cleanText.includes('እንዴት ልጠቀም') ||
    cleanText.includes('እንዴት ይሰራል') ||
    cleanText.includes('እንዴት ቻርጅ');

  // 4. Delivery Fee / Cost Concept
  const isDeliveryFeeIdea =
    (cleanText.includes('delivery') || cleanText.includes('shipping') || cleanText.includes('መላኪያ') || cleanText.includes('ማድረሻ') || cleanText.includes('ማድረስ')) &&
    (cleanText.includes('fee') || cleanText.includes('cost') || cleanText.includes('price') || cleanText.includes('how much') || cleanText.includes('free') || cleanText.includes('charge') || cleanText.includes('ዋጋ') || cleanText.includes('ስንት'));

  // 5. Purchase Intent Concept
  const isPurchaseIntentIdea =
    cleanText.includes('i want to buy') ||
    cleanText.includes('i want to order') ||
    cleanText.includes('how can i purchase') ||
    cleanText.includes('i need to buy') ||
    cleanText.includes('where can i buy') ||
    cleanText.includes('መግዛት እፈልጋለሁ') ||
    cleanText.includes('ማዘዝ እፈልጋለሁ') ||
    cleanText.includes('ልግዛ');

  return {
    isPriceIdea,
    isAvailabilityIdea,
    isWhyCantOrderIdea,
    isUsageGuideIdea,
    isDeliveryFeeIdea,
    isPurchaseIntentIdea
  };
}

/**
 * Matches real-world customer problems/needs to the appropriate solution
 */
export function matchCustomerProblem(cleanText) {
  // Disqualify commercial inquiries / product orderability questions from being treated as medical/practical symptoms
  const isCommerceOrProductInquiry =
    cleanText.includes('why cant') ||
    cleanText.includes("why can't") ||
    cleanText.includes('why i cant') ||
    cleanText.includes("why i can't") ||
    cleanText.includes('why cannot') ||
    cleanText.includes('why i cannot') ||
    cleanText.includes('cant order') ||
    cleanText.includes("can't order") ||
    cleanText.includes('cannot order') ||
    cleanText.includes('can i order') ||
    cleanText.includes('can i buy') ||
    cleanText.includes('how can i order') ||
    cleanText.includes('how to order') ||
    cleanText.includes('tell me about') ||
    cleanText.includes('what is') ||
    cleanText.includes('price of') ||
    cleanText.includes('how much') ||
    cleanText.includes('in stock') ||
    cleanText.includes('out of stock') ||
    cleanText.includes('sold out') ||
    cleanText.includes('restock') ||
    cleanText.includes('ማዘዝ እችላለሁ') ||
    cleanText.includes('ማዘዝ አልቻልኩም') ||
    cleanText.includes('ለምን ማዘዝ') ||
    cleanText.includes('ስለ') ||
    cleanText.includes('ዋጋ');

  if (isCommerceOrProductInquiry) {
    return null;
  }

  // Problem 1: Power Outages / Blackouts / WiFi Down
  const isPowerWifiProblem =
    cleanText.includes('power cut') ||
    cleanText.includes('power is cut') ||
    cleanText.includes('power out') ||
    cleanText.includes('power is out') ||
    cleanText.includes('power gone') ||
    cleanText.includes('power is gone') ||
    cleanText.includes('power off') ||
    cleanText.includes('power is off') ||
    cleanText.includes('power interruption') ||
    cleanText.includes('power blackout') ||
    cleanText.includes('no power') ||
    cleanText.includes('blackout') ||
    cleanText.includes('no light') ||
    cleanText.includes('light is gone') ||
    cleanText.includes('light is off') ||
    cleanText.includes('light went out') ||
    cleanText.includes('electricity is out') ||
    cleanText.includes('electricity gone') ||
    cleanText.includes('electricity is gone') ||
    cleanText.includes('electricity is off') ||
    cleanText.includes('wifi stopped') ||
    cleanText.includes('wifi is off') ||
    cleanText.includes('wifi off') ||
    cleanText.includes('router off') ||
    cleanText.includes('wifi without power') ||
    cleanText.includes('wifi without light') ||
    cleanText.includes('power for router') ||
    cleanText.includes('መብራት ጠፍቶ') ||
    cleanText.includes('መብራት ሲጠፋ') ||
    cleanText.includes('መብራት የለም') ||
    cleanText.includes('ዋይፋይ ጠፍቷል') ||
    cleanText.includes('ዋይፋይ አቆመ') ||
    cleanText.includes('ራውተር ጠፋ');

  if (isPowerWifiProblem) {
    return { problemType: 'power_wifi' };
  }

  // Problem 2: Cramps / Menstrual / Period pain / Belly pain
  const isCrampProblem =
    cleanText.includes('cramp') ||
    cleanText.includes('cramps') ||
    cleanText.includes('period') ||
    cleanText.includes('menstrual') ||
    cleanText.includes('menstruation') ||
    cleanText.includes('belly pain') ||
    cleanText.includes('stomach ache') ||
    cleanText.includes('stomach pain') ||
    cleanText.includes('abdominal pain') ||
    cleanText.includes('back pain') ||
    cleanText.includes('lumbar pain') ||
    cleanText.includes('ህመም') ||
    cleanText.includes('የወር አበባ') ||
    cleanText.includes('የሆድ ህመም') ||
    cleanText.includes('የወገብ ህመም') ||
    cleanText.includes('ፔሬድ');

  if (isCrampProblem && !cleanText.includes('wifi') && !cleanText.includes('battery') && !cleanText.includes('router') && !cleanText.includes('product') && !cleanText.includes('item') && !cleanText.includes('order')) {
    return { problemType: 'cramp_relief' };
  }

  // Problem 3: Phone battery dying quickly / Travel charging
  const isBatteryProblem =
    cleanText.includes('phone die') ||
    cleanText.includes('phone dies') ||
    cleanText.includes('battery die') ||
    cleanText.includes('battery dies') ||
    cleanText.includes('battery low') ||
    cleanText.includes('battery drain') ||
    cleanText.includes('charge run out') ||
    cleanText.includes('runs out of charge') ||
    cleanText.includes('travel charger') ||
    cleanText.includes('charging on travel') ||
    cleanText.includes('need power bank') ||
    cleanText.includes('ስልኬ ቶሎ ያልቃል') ||
    cleanText.includes('ቻርጅ ቶሎ ይዘጋል') ||
    cleanText.includes('ቻርጅ አያቆይም') ||
    cleanText.includes('ቻርጅ አለቀ');

  if (isBatteryProblem) {
    return { problemType: 'power_bank' };
  }

  // Problem 4: Cold / Cough / Flu / Sore throat / Immunity
  const isHealthProblem =
    cleanText.includes('cold') ||
    cleanText.includes('cough') ||
    cleanText.includes('coughing') ||
    cleanText.includes('flu') ||
    cleanText.includes('sore throat') ||
    cleanText.includes('throat pain') ||
    cleanText.includes('immunity') ||
    cleanText.includes('immune') ||
    cleanText.includes('energy natural') ||
    cleanText.includes('ጉንፋን') ||
    cleanText.includes('ሳል') ||
    cleanText.includes('የጉሮሮ ህመም') ||
    cleanText.includes('የሰውነት አቅም') ||
    cleanText.includes('የበሽታ መከላከያ');

  if (isHealthProblem) {
    return { problemType: 'honey' };
  }

  return null;
}

// =============================================================================
// 4. DYNAMIC LIVE DATA RESOLVERS
// =============================================================================

/**
 * Fetches fresh, real-time products directly from the database API, bypassing stale caches.
 */
export async function fetchLiveProducts() {
  try {
    const res = await getProducts({ forceFresh: true });
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res)) return res;
  } catch (err) {
    console.warn('Abdi AI: could not fetch fresh products:', err);
  }
  return [];
}

/**
 * Fetches the customer's fresh, real-time orders and payment statuses from the server.
 */
export async function fetchLiveCustomerOrders() {
  try {
    const saved = getMySavedOrders();
    if (!saved || saved.length === 0) return [];

    const results = await Promise.allSettled(
      saved.map((item) => getCustomerOrderById(item.id))
    );

    const orders = [];
    results.forEach((res, idx) => {
      const item = saved[idx];
      if (res.status === 'fulfilled' && res.value) {
        orders.push({ ...item, ...res.value });
      } else if (item) {
        orders.push(item);
      }
    });
    return orders;
  } catch (err) {
    console.warn('Abdi AI: could not fetch customer orders:', err);
    try {
      return getMySavedOrders();
    } catch {
      return [];
    }
  }
}

// =============================================================================
// 5. INTENT CLASSIFICATION & RESPONSE GENERATOR
// =============================================================================

/**
 * Evaluates the customer's query against real-time application state and returns an intelligent response
 */
export async function processCustomerQuery({
  query,
  currentLanguage = 'en',
  products = [],
  conversationContext = {},
  bypassLiveFetch = false
}) {
  const { cleanText, tokens, isAmharicScript } = normalizeAndCorrectText(query);

  // Determine output language
  const isAmharicResponse =
    isAmharicScript ||
    currentLanguage === 'am' ||
    Object.values(AMHARIC_KEYWORDS).some(arr => arr.some(w => cleanText.includes(w)));

  // Extract semantic concepts & customer problems regardless of wording
  const concepts = extractSemanticConcepts(cleanText, tokens);
  const matchedProblem = matchCustomerProblem(cleanText);

  // ── DYNAMIC DATA FETCHING (Fresh on Demand) ──
  // Check whether query requires live product information
  const requiresProductData =
    concepts.isPriceIdea ||
    concepts.isAvailabilityIdea ||
    concepts.isWhyCantOrderIdea ||
    concepts.isUsageGuideIdea ||
    concepts.isDeliveryFeeIdea ||
    concepts.isPurchaseIntentIdea ||
    Boolean(matchedProblem) ||
    tokens.includes('price') ||
    tokens.includes('available') ||
    tokens.includes('product') ||
    tokens.includes('order') ||
    tokens.includes('delivery') ||
    cleanText.includes('how much') ||
    cleanText.includes('in stock') ||
    cleanText.includes('out of stock') ||
    cleanText.includes('can i order') ||
    cleanText.includes('cant order') ||
    cleanText.includes('cannot order') ||
    cleanText.includes('catalog') ||
    cleanText.includes('items') ||
    cleanText.includes('goods') ||
    cleanText.includes('እቃ') ||
    cleanText.includes('ምርት') ||
    hasAmharicMatch(cleanText, 'price') ||
    hasAmharicMatch(cleanText, 'available') ||
    hasAmharicMatch(cleanText, 'products') ||
    hasAmharicMatch(cleanText, 'delivery');

  let liveProducts = products;
  if (requiresProductData && !bypassLiveFetch) {
    const fresh = await fetchLiveProducts();
    if (fresh && fresh.length > 0) {
      liveProducts = fresh;
    }
  }

  // Check whether query requires live customer order data
  const requiresOrderData =
    tokens.includes('history') ||
    tokens.includes('reject') ||
    tokens.includes('latest') ||
    tokens.includes('orders') ||
    cleanText.includes('order') ||
    cleanText.includes('orders') ||
    cleanText.includes('my order') ||
    cleanText.includes('my orders') ||
    cleanText.includes('latest order') ||
    cleanText.includes('most recent') ||
    cleanText.includes('most recently') ||
    cleanText.includes('recent order') ||
    cleanText.includes('last order') ||
    cleanText.includes('what did i order') ||
    cleanText.includes('what was my order') ||
    cleanText.includes('what i ordered') ||
    cleanText.includes('all my order') ||
    cleanText.includes('all order') ||
    cleanText.includes('how many order') ||
    cleanText.includes('how many orders') ||
    cleanText.includes('list order') ||
    cleanText.includes('list my order') ||
    cleanText.includes('show order') ||
    cleanText.includes('show my order') ||
    cleanText.includes('show all order') ||
    cleanText.includes('earlier order') ||
    cleanText.includes('previous order') ||
    cleanText.includes('i ordered') ||
    cleanText.includes('placed an order') ||
    cleanText.includes('bought') ||
    cleanText.includes('confirmed') ||
    cleanText.includes('confirm') ||
    cleanText.includes('verified') ||
    cleanText.includes('verify') ||
    cleanText.includes('approved') ||
    cleanText.includes('approve') ||
    cleanText.includes('is it confirmed') ||
    cleanText.includes('is it verified') ||
    cleanText.includes('is my payment') ||
    cleanText.includes('verified now') ||
    cleanText.includes('payment status') ||
    cleanText.includes('order status') ||
    hasAmharicMatch(cleanText, 'history') ||
    hasAmharicMatch(cleanText, 'reject') ||
    hasAmharicMatch(cleanText, 'latest') ||
    hasAmharicMatch(cleanText, 'verify') ||
    cleanText.includes('ተረጋግጧል') ||
    cleanText.includes('ትዕዛዜ') ||
    cleanText.includes('ትዕዛዞቼ') ||
    cleanText.includes('ትዕዛዞች') ||
    cleanText.includes('ትዕዛዝ') ||
    cleanText.includes('ስንት ትዕዛዝ') ||
    cleanText.includes('አዝዣለሁ');

  let liveOrders = [];
  if (requiresOrderData) {
    liveOrders = await fetchLiveCustomerOrders();
  }

  // Try to find matching product in live products
  let matchedProduct = findMatchingProduct(cleanText, tokens, liveProducts);

  // Pronoun reference resolution
  const isPronounRef = tokens.some(t => ['it', 'this', 'that', 'item'].includes(t)) ||
                       cleanText.includes('ይህ') || cleanText.includes('ይሄ') || cleanText.includes('እሱን');
  if (!matchedProduct && isPronounRef && conversationContext.lastProduct) {
    matchedProduct = conversationContext.lastProduct;
  }

  const updatedContext = {
    ...conversationContext,
    lastProduct: matchedProduct || conversationContext.lastProduct,
    lastQuery: query
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 1: LATEST / MOST RECENT ORDER
  // e.g. "What is my latest order?", "What did I order most recently?", "last order"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingLatestOrder =
    (tokens.includes('latest') || cleanText.includes('most recent') || cleanText.includes('most recently') || cleanText.includes('recent order') || cleanText.includes('last order') || cleanText.includes('what did i order') || cleanText.includes('what was my order') || cleanText.includes('what i ordered') || hasAmharicMatch(cleanText, 'latest')) &&
    (tokens.includes('order') || cleanText.includes('what') || hasAmharicMatch(cleanText, 'order'));

  if (isAskingLatestOrder) {
    if (liveOrders && liveOrders.length > 0) {
      const latestOrder = liveOrders[0];
      updatedContext.activeOrder = latestOrder;
      updatedContext.subject = 'order';

      const items = latestOrder.items || [];
      const itemNames = items.map(i => {
        const name = isAmharicResponse && i.product_name_am ? i.product_name_am : i.product_name_en;
        return `${name} (×${i.quantity})`;
      }).join(', ') || (isAmharicResponse ? 'የታዘዘ እቃ' : 'Ordered item');

      const activePay = latestOrder.active_payment || (latestOrder.payments && latestOrder.payments[0]);
      const payStatus = activePay?.status || 'pending';
      const orderStatus = latestOrder.status;

      const orderStatusLabel = orderStatus === 'confirmed' ? (isAmharicResponse ? 'ተረጋግጧል (Confirmed)' : 'Confirmed')
        : orderStatus === 'delivered' ? (isAmharicResponse ? 'ደርሷል (Delivered)' : 'Delivered')
        : orderStatus === 'out_for_delivery' ? (isAmharicResponse ? 'በማድረስ ላይ (Out for Delivery)' : 'Out for Delivery')
        : orderStatus === 'cancelled' ? (isAmharicResponse ? 'ተሰርዟል (Cancelled)' : 'Cancelled')
        : (isAmharicResponse ? 'በመጠባበቅ ላይ (Pending)' : 'Pending');

      const payStatusLabel = payStatus === 'verified' ? (isAmharicResponse ? 'ተረጋግጧል (Payment Verified)' : 'Payment Verified')
        : payStatus === 'rejected' ? (isAmharicResponse ? 'ውድቅ ተደርጓል (Payment Rejected)' : 'Payment Rejected')
        : (isAmharicResponse ? 'ማረጋገጫ በመጠባበቅ ላይ (Awaiting Verification)' : 'Awaiting Verification');

      const payMethodLabel = activePay?.method === 'telebirr' ? 'Telebirr' : (isAmharicResponse ? 'በደረሰኝ ጊዜ (Cash on Delivery)' : 'Cash on Delivery');

      const earlierOrdersNote = liveOrders.length > 1
        ? (isAmharicResponse
            ? `\n\n*(በተጨማሪም በዚህ መሳሪያ ላይ ${liveOrders.length - 1} የቀደሙ ትዕዛዞች አሉዎት። ሁሉንም ለማየት "ሁሉንም ትዕዛዞቼን አሳየኝ" ብለው መጠየቅ ይችላሉ!)*`
            : `\n\n*(You also have ${liveOrders.length - 1} earlier order(s) on this device. Ask "show all my orders" to review every order in detail!)*`)
        : '';

      return {
        text: isAmharicResponse
          ? `የቅርብ ጊዜ ትዕዛዝዎ **ትዕዛዝ #${latestOrder.order_number}** ነው፡\n\n• **ያዘዙት እቃ**፡ ${itemNames}\n• **ጠቅላላ ዋጋ**፡ **${Number(latestOrder.total_amount).toLocaleString()} ETB**\n• **የትዕዛዝ ሁኔታ**፡ ${orderStatusLabel}\n• **የክፍያ ሁኔታ**፡ ${payStatusLabel} (${payMethodLabel})\n\nሙሉ ዝርዝሩን ከታች በ**"የእኔ ትዕዛዞች"** ክፍል መመልከት ይችላሉ።${earlierOrdersNote}`
          : `Your most recent order is **Order #${latestOrder.order_number}**:\n\n• **Items**: ${itemNames}\n• **Total Amount**: **${Number(latestOrder.total_amount).toLocaleString()} ETB**\n• **Order Status**: ${orderStatusLabel}\n• **Payment Status**: ${payStatusLabel} (${payMethodLabel})\n\nYou can review your full receipt and order tracking in the **My Orders** section below!${earlierOrdersNote}`,
        context: updatedContext,
        action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'ትዕዛዜን ይመልከቱ' : 'View Order' }
      };
    } else {
      return {
        text: isAmharicResponse
          ? `በዚህ መሳሪያ ላይ እስካሁን የተመዘገበ ትዕዛዝ የለም። በዌብሳይቱ ላይ እቃ ሲያዙ የትዕዛዝ መረጃዎ ወዲያውኑ እዚህ እና በ**"የእኔ ትዕዛዞች"** ክፍል ውስጥ ይታያል!`
          : `You haven't placed any orders on this device yet. Once you place an order, it will appear here immediately and in your **My Orders** section at the bottom of the page!`,
        context: updatedContext,
        action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 2: CUSTOMER MENTIONS AN ORDER ("I ordered honey")
  // e.g. "I ordered honey", "I bought honey", "ማር አዝዣለሁ"
  // ─────────────────────────────────────────────────────────────────────────
  const isStatingOrder =
    cleanText.includes('i ordered') ||
    cleanText.includes('i bought') ||
    cleanText.includes('placed an order') ||
    cleanText.includes('my order for') ||
    cleanText.includes('አዝዣለሁ') ||
    cleanText.includes('ገዝቻለሁ');

  if (isStatingOrder && matchedProduct) {
    const pName = isAmharicResponse && matchedProduct.name_am ? matchedProduct.name_am : matchedProduct.name_en;

    // Find if customer actually has an order with this product
    const matchingOrder = liveOrders.find(o =>
      o.items?.some(i =>
        i.product_id === matchedProduct.id ||
        (i.product_name_en && (i.product_name_en.toLowerCase().includes(matchedProduct.name_en.toLowerCase()) || matchedProduct.name_en.toLowerCase().includes(i.product_name_en.toLowerCase()))) ||
        (i.product_name_am && matchedProduct.name_am && (i.product_name_am.includes(matchedProduct.name_am) || matchedProduct.name_am.includes(i.product_name_am)))
      )
    );

    if (matchingOrder) {
      updatedContext.activeOrder = matchingOrder;
      updatedContext.subject = 'order';

      return {
        text: isAmharicResponse
          ? `አዎ! ለ**${pName}** ያዘዙትን **ትዕዛዝ #${matchingOrder.order_number}** አግኝቼዋለሁ። ስለ ትዕዛዙ ምን ማወቅ ይፈልጋሉ? ተረጋግጧል ወይ፣ የክፍያውን ሁኔታ፣ ወይም የማድረሻ ሂደቱን መጠየቅ ይችላሉ።`
          : `Yes, I can help with that! I see your order for **${pName}** (**Order #${matchingOrder.order_number}**). What would you like to know? You can ask if it is confirmed, check payment verification, or ask about delivery.`,
        context: updatedContext,
        action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'ትዕዛዜን ይመልከቱ' : 'View Order' }
      };
    } else {
      updatedContext.subject = 'order';
      return {
        text: isAmharicResponse
          ? `ስለ **${pName}** ልረዳዎት ዝግጁ ነኝ! በዚህ መሳሪያ ላይ የተመዘገበ ትዕዛዝ አላገኘሁም። በቅርቡ ካዘዙ 'የእኔ ትዕዛዞች' ክፍል ውስጥ መመልከት ወይም ማዘዝ ከፈለጉ ልርዳዎት እችላለሁ። ምን ማወቅ ይፈልጋሉ?`
          : `I'd be glad to help! I don't see an order for **${pName}** recorded on this device yet. If you recently placed it, you can check **My Orders** or ask me anything about ordering it!`,
        context: updatedContext
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 3: IS IT CONFIRMED / IS PAYMENT VERIFIED?
  // e.g. "is it confirmed?", "is my payment verified?", "is it verified now?"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingConfirmation =
    cleanText.includes('confirmed') ||
    cleanText.includes('confirm') ||
    cleanText.includes('verified') ||
    cleanText.includes('verify') ||
    cleanText.includes('approved') ||
    cleanText.includes('approve') ||
    cleanText.includes('is it confirm') ||
    cleanText.includes('is it verify') ||
    cleanText.includes('is my payment') ||
    cleanText.includes('payment status') ||
    cleanText.includes('order status') ||
    hasAmharicMatch(cleanText, 'verify') ||
    cleanText.includes('ተረጋግጧል');

  if (isAskingConfirmation) {
    const targetOrder = conversationContext.activeOrder || (liveOrders.length > 0 ? liveOrders[0] : null);

    if (targetOrder) {
      // Re-fetch fresh order to make sure we have up-to-the-second status
      let freshOrder = targetOrder;
      try {
        const fresh = await getCustomerOrderById(targetOrder.id);
        if (fresh) freshOrder = fresh;
      } catch {
        // fallback to targetOrder
      }

      const activePay = freshOrder.active_payment || (freshOrder.payments && freshOrder.payments[0]);
      const payStatus = activePay?.status || 'pending';
      const orderStatus = freshOrder.status;
      const isConfirmed = orderStatus === 'confirmed' || orderStatus === 'out_for_delivery' || orderStatus === 'delivered' || payStatus === 'verified';
      const isRejected = payStatus === 'rejected';

      const firstItem = freshOrder.items?.[0];
      const itemName = firstItem
        ? (isAmharicResponse && firstItem.product_name_am ? firstItem.product_name_am : firstItem.product_name_en)
        : (isAmharicResponse ? 'ያዘዙት እቃ' : 'your item');

      if (isConfirmed) {
        return {
          text: isAmharicResponse
            ? `አዎ! ለ**${itemName}** ያዘዙት **ትዕዛዝ #${freshOrder.order_number}** **ተረጋግጧል (Confirmed)**! የክፍያ ሁኔታዎም **ተረጋግጧል (Payment Verified)**። 🚚 እቃዎ በፍጥነት እንዲደርስዎ በመዘጋጀት ላይ ነው።`
            : `Yes! Your order for **${itemName}** (**Order #${freshOrder.order_number}**) has been **Confirmed** and your payment has been **Verified**! 🚚 We are preparing your package for delivery.`,
          context: updatedContext,
          action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'የትዕዛዝ ሁኔታ' : 'Track Order' }
        };
      } else if (isRejected) {
        const rejMessage = activePay?.customer_message || (isAmharicResponse ? 'የክፍያ ደረሰኝዎ ሊረጋገጥ አልቻለም።' : 'The payment screenshot could not be verified.');
        return {
          text: isAmharicResponse
            ? `ለትዕዛዝ **#${freshOrder.order_number}** የተላከው ክፍያ **ውድቅ ተደርጓል (Payment Rejected)**።\n\n**የሱቁ አስተዳዳሪ የሰጡት ምክንያት፡**\n> "${rejMessage}"\n\nይህንን በ**"የእኔ ትዕዛዞች"** ክፍል ውስጥ መመልከት እና እንደገና መሞከር ይችላሉ።`
            : `Your payment for **${itemName}** (**Order #${freshOrder.order_number}**) was **Rejected**.\n\n**Store Manager's Explanation:**\n> "${rejMessage}"\n\nYou can review your uploaded receipt and order status in your **My Orders** section.`,
          context: updatedContext,
          action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'የእኔ ትዕዛዞች' : 'My Orders' }
        };
      } else {
        // Pending / Awaiting verification
        return {
          text: isAmharicResponse
            ? `ለትዕዛዝ **#${freshOrder.order_number}** የተላከው ክፍያ በአሁን ሰዓት **ማረጋገጫ በመጠባበቅ ላይ (Awaiting Verification)** ነው። የሱቁ አስተዳዳሪ የላኩትን ስክሪንሾት እንደገመገሙ ወዲያውኑ ይረጋገጣል!`
            : `Your order for **${itemName}** (**Order #${freshOrder.order_number}**) is currently **Awaiting Verification**. The store manager is reviewing your submitted payment screenshot. As soon as it is approved, it will be marked as Confirmed!`,
          context: updatedContext,
          action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'የእኔ ትዕዛዞች' : 'My Orders' }
        };
      }
    } else {
      return {
        text: isAmharicResponse
          ? `በዚህ መሳሪያ ላይ እስካሁን ምንም ትዕዛዝ አላገኘሁም። ትዕዛዝ ሲያዙ የክፍያ እና የማረጋገጫ ሁኔታውን እዚህ መከታተል ይችላሉ።`
          : `You haven't placed an order on this device yet. Once you place an order, I will track its confirmation and payment status for you right here!`,
        context: updatedContext,
        action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 4: WHY PAYMENT REJECTED / PAYMENT REJECTION REASONS
  // e.g. "why my paymant rejected", "why payment rejected", "reject"
  // ─────────────────────────────────────────────────────────────────────────
  if (tokens.includes('reject') || hasAmharicMatch(cleanText, 'reject') || (tokens.includes('payment') && cleanText.includes('why'))) {
    // Check if customer has a rejected order in context or liveOrders
    const contextOrder = conversationContext.activeOrder;
    const contextRejected = contextOrder && (
      (contextOrder.active_payment && contextOrder.active_payment.status === 'rejected') ||
      (contextOrder.payments && contextOrder.payments.some(p => p.status === 'rejected'))
    );

    const rejectedOrder = (contextRejected ? contextOrder : null) || liveOrders.find(o => {
      const p = o.active_payment || (o.payments && o.payments[0]);
      return p?.status === 'rejected';
    });

    if (rejectedOrder) {
      const p = rejectedOrder.active_payment || (rejectedOrder.payments && rejectedOrder.payments[0]);
      const customerMsg = p?.customer_message || (isAmharicResponse
        ? 'የክፍያ ደረሰኝዎ ሊረጋገጥ አልቻለም።'
        : 'The payment receipt could not be verified.');

      return {
        text: isAmharicResponse
          ? `ለትዕዛዝ **#${rejectedOrder.order_number}** የተላከው ክፍያ ውድቅ ተደርጓል።\n\n**የሱቁ አስተዳዳሪ የሰጡት ምክንያት፡**\n> "${customerMsg}"\n\nይህንን በ**"የእኔ ትዕዛዞች" (My Orders)** ክፍል ውስጥ ቀይ ምልክት ተደርጎበት ማየት ይችላሉ።`
          : `For Order **#${rejectedOrder.order_number}**, your payment was rejected.\n\n**Store Manager's Explanation:**\n> "${customerMsg}"\n\nYou can review this rejection notice and your uploaded receipt in your **My Orders** section.`,
        context: updatedContext,
        action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'ትዕዛዞቼን ይመልከቱ' : 'View My Orders' }
      };
    }

    // General explanation for payment rejection
    return {
      text: isAmharicResponse
        ? `ክፍያ ውድቅ የሚደረግባቸው ዋና ዋና ምክንያቶች፡\n1. **የተሳሳተ ወይም የማይነበብ ስክሪንሾት** መላክ\n2. **የተከፈለው የገንዘብ መጠን** ከትዕዛዙ ጠቅላላ ዋጋ ጋር አለመጣጣም\n3. **የግብይት ቁጥር (Transaction ID)** በቴሌብር ሲስተም ውስጥ አለመገኘት\n4. **ቀደም ሲል የተጠቀሙበት ደረሰኝ** በድጋሚ መላክ\n\nክፍያዎ ውድቅ ሲደረግ፣ የሱቁ አስተዳዳሪ የጻፉት ትክክለኛ ምክንያት በ**"የእኔ ትዕዛዞች" (My Orders)** ውስጥ በግልጽ ይታያል።`
        : `Common reasons a payment may be rejected:\n1. **Blurry or unreadable screenshot**\n2. **Paid amount does not match** the total order amount\n3. **Invalid or unverified transaction ID** on Telebirr\n4. **Duplicate or reused screenshot**\n\nWhenever a payment is rejected, the store manager provides an explanation that appears in red directly in your **My Orders** section (e.g. *"The order payment pic is not real"*).`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'የእኔ ትዕዛዞች' : 'My Orders' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 5: GENERAL ORDER TRACKING / MY ORDERS / ALL ORDERS (UP TO 20+ IN FULL DETAIL)
  // e.g. "where is my order", "my orders", "all my orders", "how many orders", "order history", "show orders"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingOrderTracking =
    (cleanText.includes('track my') ||
     cleanText.includes('track order') ||
     cleanText.includes('track package') ||
     cleanText.includes('where is my') ||
     cleanText.includes('where is order') ||
     cleanText.includes('where are my') ||
     cleanText.includes('my order') ||
     cleanText.includes('my orders') ||
     cleanText.includes('all order') ||
     cleanText.includes('all my order') ||
     cleanText.includes('how many order') ||
     cleanText.includes('how many orders') ||
     cleanText.includes('list order') ||
     cleanText.includes('list my order') ||
     cleanText.includes('show order') ||
     cleanText.includes('show my order') ||
     cleanText.includes('show all order') ||
     cleanText.includes('orders list') ||
     cleanText.includes('previous order') ||
     cleanText.includes('earlier order') ||
     cleanText.includes('what are my orders') ||
     cleanText.includes('what orders do i have') ||
     tokens.includes('history') ||
     tokens.includes('orders') ||
     hasAmharicMatch(cleanText, 'history') ||
     cleanText.includes('ትዕዛዞች') ||
     cleanText.includes('ትዕዛዜ') ||
     cleanText.includes('ትዕዛዞቼ') ||
     cleanText.includes('ስንት ትዕዛዝ') ||
     cleanText.includes('ሁሉንም ትዕዛዝ')) ||
    (tokens.includes('track') && !matchedProduct);

  // Helper to format a single order entry with full customer details
  const formatCustomerOrderCard = (ord, index) => {
    const items = ord.items || [];
    const itemNames = items.length > 0
      ? items.map(i => {
          const name = isAmharicResponse && i.product_name_am ? i.product_name_am : (i.product_name_en || 'Product');
          return `${name} (×${i.quantity || 1})`;
        }).join(', ')
      : (isAmharicResponse ? 'የታዘዘ እቃ' : 'Ordered item');

    const activePay = ord.active_payment || (ord.payments && ord.payments[0]);
    const payStatus = activePay?.status || 'pending';
    const ordStatus = ord.status || 'pending';

    const orderStatusLabel = ordStatus === 'confirmed' ? (isAmharicResponse ? 'ተረጋግጧል (Confirmed)' : 'Confirmed')
      : ordStatus === 'delivered' ? (isAmharicResponse ? 'ደርሷል (Delivered)' : 'Delivered')
      : ordStatus === 'out_for_delivery' ? (isAmharicResponse ? 'በማድረስ ላይ (Out for Delivery)' : 'Out for Delivery')
      : ordStatus === 'cancelled' ? (isAmharicResponse ? 'ተሰርዟል (Cancelled)' : 'Cancelled')
      : ordStatus === 'rejected' ? (isAmharicResponse ? 'ውድቅ ተደርጓል (Rejected)' : 'Rejected')
      : (isAmharicResponse ? 'በመጠባበቅ ላይ (Pending)' : 'Pending');

    const payStatusLabel = payStatus === 'verified' ? (isAmharicResponse ? 'ተረጋግጧል (Payment Verified)' : 'Payment Verified')
      : payStatus === 'rejected' ? (isAmharicResponse ? 'ውድቅ ተደርጓል (Payment Rejected)' : 'Payment Rejected')
      : (isAmharicResponse ? 'ማረጋገጫ በመጠባበቅ ላይ (Awaiting Verification)' : 'Awaiting Verification');

    const payMethodLabel = activePay?.method === 'telebirr' ? 'Telebirr' : (isAmharicResponse ? 'በደረሰኝ ጊዜ (Cash on Delivery)' : 'Cash on Delivery');

    const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString(isAmharicResponse ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return `${index + 1}. **Order #${ord.order_number}** ${dateStr ? `(${dateStr})` : ''} — **${orderStatusLabel}**\n   • **${isAmharicResponse ? 'ያዘዙት እቃ' : 'Items'}**: ${itemNames}\n   • **${isAmharicResponse ? 'ጠቅላላ ዋጋ' : 'Total'}**: **${Number(ord.total_amount || 0).toLocaleString()} ETB**\n   • **${isAmharicResponse ? 'የክፍያ ሁኔታ' : 'Payment'}**: ${payStatusLabel} [${payMethodLabel}]`;
  };

  // Check if customer is asking about a specific order by order number or index
  const specificOrderTarget = (() => {
    if (!liveOrders || liveOrders.length === 0) return null;
    const ordNumMatch = cleanText.match(/ord-[\w-]+/i);
    if (ordNumMatch) {
      const found = liveOrders.find(o => (o.order_number || '').toLowerCase().includes(ordNumMatch[0].toLowerCase()));
      if (found) return found;
    }
    const isFirst = cleanText.includes('first order') || cleanText.includes('1st order') || cleanText.includes('አንደኛ');
    const isSecond = cleanText.includes('second order') || cleanText.includes('2nd order') || cleanText.includes('ሁለተኛ');
    const isThird = cleanText.includes('third order') || cleanText.includes('3rd order') || cleanText.includes('ሶስተኛ');
    const isFourth = cleanText.includes('fourth order') || cleanText.includes('4th order') || cleanText.includes('አራተኛ');
    const isFifth = cleanText.includes('fifth order') || cleanText.includes('5th order') || cleanText.includes('አምስተኛ');
    const numMatch = cleanText.match(/order\s*(?:#|number|no\.?)?\s*(\d+)/i);

    let idx = -1;
    if (isFirst) idx = 0;
    else if (isSecond) idx = 1;
    else if (isThird) idx = 2;
    else if (isFourth) idx = 3;
    else if (isFifth) idx = 4;
    else if (numMatch && numMatch[1]) {
      const parsed = parseInt(numMatch[1], 10);
      if (parsed >= 1 && parsed <= liveOrders.length) idx = parsed - 1;
    }

    if (idx >= 0 && idx < liveOrders.length) {
      return liveOrders[idx];
    }
    return null;
  })();

  if (specificOrderTarget && !matchedProduct && (tokens.includes('order') || cleanText.includes('order') || hasAmharicMatch(cleanText, 'order'))) {
    const targetIdx = liveOrders.findIndex(o => o.id === specificOrderTarget.id);
    const orderCard = formatCustomerOrderCard(specificOrderTarget, targetIdx >= 0 ? targetIdx : 0);
    updatedContext.activeOrder = specificOrderTarget;
    updatedContext.subject = 'order';

    return {
      text: isAmharicResponse
        ? `የመረጡት **ትዕዛዝ #${specificOrderTarget.order_number}** ዝርዝር መረጃ እንደሚከተለው ነው፡\n\n${orderCard}\n\nሙሉ ዝርዝሩን እና የተያያዘውን የክፍያ ደረሰኝ በ**"የእኔ ትዕዛዞች"** ክፍል ማየት ይችላሉ።`
        : `Here is the full detail for **Order #${specificOrderTarget.order_number}**:\n\n${orderCard}\n\nYou can review your uploaded receipt screenshot and tracking status in the **My Orders** section below!`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'ትዕዛዜን ይመልከቱ' : 'View Order' }
    };
  }

  if (isAskingOrderTracking && !matchedProduct) {
    if (liveOrders && liveOrders.length > 0) {
      if (liveOrders.length === 1) {
        const single = liveOrders[0];
        updatedContext.activeOrder = single;
        const singleCard = formatCustomerOrderCard(single, 0);

        return {
          text: isAmharicResponse
            ? `በዚህ መሳሪያ ላይ የተመዘገበ 1 ትዕዛዝ አለዎት፡\n\n${singleCard}\n\nሙሉ ዝርዝሩን እና የተያያዘውን የክፍያ ደረሰኝ ከታች በ**"የእኔ ትዕዛዞች"** ክፍል መመልከት ይችላሉ።`
            : `You have 1 active order recorded on this device:\n\n${singleCard}\n\nYou can inspect your receipt screenshot and live fulfillment status in the **My Orders** section below!`,
          context: updatedContext,
          action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'ትዕዛዜን ይመልከቱ' : 'View My Orders' }
        };
      }

      // Customer has multiple orders (2, 3, 5, up to 20 detailed orders!)
      const detailedOrders = liveOrders.slice(0, 20);
      const orderList = detailedOrders.map((ord, idx) => formatCustomerOrderCard(ord, idx)).join('\n\n');

      const deliveredCount = liveOrders.filter(o => o.status === 'delivered').length;
      const inDeliveryCount = liveOrders.filter(o => ['confirmed', 'out_for_delivery'].includes(o.status)).length;
      const pendingCount = liveOrders.filter(o => ['pending', 'payment_review'].includes(o.status)).length;
      const cancelledCount = liveOrders.filter(o => o.status === 'cancelled' || o.status === 'rejected').length;

      const extraNotice = liveOrders.length > 20
        ? (isAmharicResponse ? `\n\n*(+ ተጨማሪ ${liveOrders.length - 20} የቀደሙ ትዕዛዞች ተመዝግበዋል)*` : `\n\n*(+ ${liveOrders.length - 20} more earlier orders recorded)*`)
        : '';

      return {
        text: isAmharicResponse
          ? `በዚህ መሳሪያ ላይ የተመዘገቡ **${liveOrders.length} ትዕዛዞች** አሉዎት። የሁሉም ትዕዛዞችዎ ሙሉ ዝርዝር መረጃ እንደሚከተለው ነው፡\n\n${orderList}${extraNotice}\n\n📊 **የትዕዛዞች ማጠቃለያ**፡ ጠቅላላ፡ **${liveOrders.length}** | የደረሱ፡ **${deliveredCount}** | በሂደት/በማድረስ ላይ፡ **${inDeliveryCount}** | ማረጋገጫ የሚጠብቁ፡ **${pendingCount}**${cancelledCount > 0 ? ` | የተሰረዙ፡ ${cancelledCount}` : ''}\n\n💡 **ማስታወሻ**፡ የቅርብ 4 ትዕዛዞች ከታች በ**"የእኔ ትዕዛዞች"** ክፍል በነባሪነት የሚታዩ ሲሆን፣ እኔ ስለ ሁሉም **${liveOrders.length}** ትዕዛዞችዎ በማንኛውም ጊዜ ሙሉ መረጃ እሰጥዎታለሁ!`
          : `You have **${liveOrders.length} orders** recorded on this device. Here is the complete detailed breakdown of all your orders:\n\n${orderList}${extraNotice}\n\n📊 **Order Summary**: Total: **${liveOrders.length}** | Delivered: **${deliveredCount}** | In Delivery/Confirmed: **${inDeliveryCount}** | Pending/Review: **${pendingCount}**${cancelledCount > 0 ? ` | Cancelled: ${cancelledCount}` : ''}\n\n💡 **Note**: The latest 4 orders are featured in your **"My Orders"** section below (earlier orders can be expanded with the toggle button). As your personal shopping assistant, I have full detailed memory of all **${liveOrders.length}** of your orders!`,
        context: updatedContext,
        action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'የእኔ ትዕዛዞች' : 'View My Orders' }
      };
    }

    return {
      text: isAmharicResponse
        ? `ያዘዟቸውን ትዕዛዞች በሙሉ በገጹ ታችኛው ክፍል ባለው **"የእኔ ትዕዛዞች" (My Orders)** ክፍል ማየት ይችላሉ።\n\nእዚያም፡\n• የትዕዛዝ ቁጥር እና ቀን\n• ያዘዙት እቃ እና ብዛት\n• የክፍያ ሁኔታ (ተረጋግጧል፣ በመጠባበቅ ላይ፣ ወይም ውድቅ)\n• ያያያዙት የቴሌብር ደረሰኝ ይታያል።\n\nማስታወሻ፡ የሚያዩት ከዚህ መሳሪያ ያዘዟቸውን ትዕዛዞች ብቻ ነው።`
        : `You can track all your orders in the **My Orders** section at the bottom of the page.\n\nThere you can view:\n• Order number and date\n• Ordered items, quantity, and total price\n• Payment status (Verified, Awaiting verification, or Rejected)\n• Your uploaded payment screenshot\n\nNote: Orders are saved specifically to the device and browser you ordered from.`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'my-orders', label: isAmharicResponse ? 'የእኔ ትዕዛዞች' : 'My Orders' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 5.5: DELIVERY FEE & COST ESTIMATOR
  // e.g. "how much is delivery", "delivery fee", "መላኪያ ስንት ነው", "delivery cost to buanbuha"
  // ─────────────────────────────────────────────────────────────────────────
  if (concepts.isDeliveryFeeIdea) {
    const isSpecificBuanbuha = cleanText.includes('buanbuha') || cleanText.includes('buambuha') || cleanText.includes('ቧንቧ') || cleanText.includes('ቦንቧ');
    const villageMention = isSpecificBuanbuha
      ? (isAmharicResponse ? 'ቧንቧ ውሃ' : 'Buanbuha')
      : (isAmharicResponse ? 'ደሴ እና በአካባቢው መንደሮች' : 'Dessie and surrounding villages');

    return {
      text: isAmharicResponse
        ? `🚚 **የማድረሻ ዋጋ ዝርዝር (Delivery Fee)**፡\n\n• **በ${villageMention} (ደሴ፣ ቧንቧ ውሃ፣ ፒያሳ፣ አራዳ፣ ሆቴ፣ ሮቢት ወዘተ)**፡\n  - መደበኛ የማድረሻ ክፍያ **50 ብር (50 ETB)** ብቻ ነው!\n  - **ልዩ ቅናሽ**፡ 2 እና ከዚያ በላይ እቃዎችን ሲያዙ ማድረሻው **በነፃ (Free Delivery)** ይደረጋል!\n  - **የማድረሻ ፍጥነት**፡ በተመሳሳይ ቀን **ከ1–2 ሰዓት ባነሰ ጊዜ** ደጃፍዎ ይደርሳል።\n\n• **ከደሴ ውጭ ላሉ የኢትዮጵያ ከተሞች**፡\n  - እንደየከተማው ርቀት ከ**200 – 300 ብር** በአስተማማኝ መላኪያ ይደርሳል።\n  - **የማድረሻ ፍጥነት**፡ በ1–3 የስራ ቀናት ውስጥ ይደርሳል።\n\n💵 **የክፍያ አማራጭ**፡ እቃው እጅዎ ሲደርስ አይተው በጥሬ ገንዘብ (**Cash on Delivery**) ወይም በ**ቴሌብር** መክፈል ይችላሉ።`
        : `🚚 **Delivery Cost & Fee Breakdown**:\n\n• **Within ${villageMention} (Dessie, Buanbuha, Piassa, Arada, Hote, Robit, etc.)**:\n  - Standard doorstep delivery fee is only **50 ETB**!\n  - **Special Promotion**: Orders of 2 or more items enjoy **FREE delivery**!\n  - **Delivery Speed**: Same-day delivery within **1–2 hours** right to your door!\n\n• **Outside Dessie / Other Cities in Ethiopia**:\n  - Courier / bus delivery fee is approximately **200 – 300 ETB** depending on destination.\n  - **Delivery Speed**: Delivered within **1–3 business days**.\n\n💵 **Payment Options**: You can inspect and pay with **Cash on Delivery** at your doorstep or pay securely via **Telebirr**!`,
      context: updatedContext,
      productCard: matchedProduct || null,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 6: VILLAGE REACHABILITY, DELIVERY LOCATION & DOORSTEP LOGISTICS
  // e.g. "can i get my product in my village", "where do you deliver", "dessie", "buanbuha"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingDeliveryLocation =
    tokens.includes('delivery') ||
    cleanText.includes('village') ||
    cleanText.includes('in my area') ||
    cleanText.includes('to my area') ||
    cleanText.includes('neighborhood') ||
    cleanText.includes('kebele') ||
    cleanText.includes('doorstep') ||
    cleanText.includes('to my home') ||
    cleanText.includes('at my home') ||
    cleanText.includes('to my house') ||
    cleanText.includes('dessie') ||
    cleanText.includes('buanbuha') ||
    cleanText.includes('buambuha') ||
    cleanText.includes('piassa') ||
    cleanText.includes('arada') ||
    cleanText.includes('hote') ||
    cleanText.includes('robit') ||
    cleanText.includes('deliver') ||
    cleanText.includes('shipping') ||
    cleanText.includes('where do you deliver') ||
    cleanText.includes('do you deliver') ||
    cleanText.includes('can you deliver') ||
    cleanText.includes('reach') ||
    (cleanText.includes('can i get') && (cleanText.includes('village') || cleanText.includes('area') || cleanText.includes('home') || cleanText.includes('dessie') || cleanText.includes('buanbuha') || cleanText.includes('product') || cleanText.includes('item'))) ||
    hasAmharicMatch(cleanText, 'delivery') ||
    cleanText.includes('ይደርሳል') ||
    cleanText.includes('ታደርሳላችሁ') ||
    cleanText.includes('መንደር') ||
    cleanText.includes('መንደሬ') ||
    cleanText.includes('በመንደሬ') ||
    cleanText.includes('ሰፈር') ||
    cleanText.includes('ሰፈሬ') ||
    cleanText.includes('በሰፈሬ') ||
    cleanText.includes('ቀበሌ') ||
    cleanText.includes('ቧንቧ') ||
    cleanText.includes('እቤቴ') ||
    cleanText.includes('ደጃፌ') ||
    cleanText.includes('ደሴ');

  if (isAskingDeliveryLocation) {
    const isSpecificBuanbuha = cleanText.includes('buanbuha') || cleanText.includes('buambuha') || cleanText.includes('ቧንቧ') || cleanText.includes('ቦንቧ');
    const villageMention = isSpecificBuanbuha ? (isAmharicResponse ? 'ቧንቧ ውሃ (Buanbuha)' : 'Buanbuha') : (isAmharicResponse ? 'መንደርዎ እና ሰፈርዎ' : 'your village and neighborhood');

    if (matchedProduct) {
      const pName = isAmharicResponse && matchedProduct.name_am ? matchedProduct.name_am : matchedProduct.name_en;
      const isAvailable = matchedProduct.is_available !== false;
      const formattedPrice = `${Number(matchedProduct.price || 0).toLocaleString()} ETB`;

      if (!isAvailable) {
        return {
          text: isAmharicResponse
            ? `ወደ **${villageMention}** እና በመላው ደሴ ደጃፍ ድረስ በፍጥነት እናደርሳለን! 🚚\n\n⚠️ **የክምችት ማስታወሻ**፡ ሆኖም ግን **${pName}** ለጊዜው **አልቋል (Out of Stock)**። አሁን ማዘዝ ባይቻልም አዲስ ክምችት እንደገባ ወዲያውኑ ወደ **${villageMention}** ደጃፍዎ ከ1–2 ሰዓት ባነሰ ጊዜ ውስጥ ማድረስ እንጀምራለን!\n\nለበለጠ መረጃ እና ክምችቱ ሲገባ እንዲገለጽልዎ በ**0931862253** ደውለው ማረጋገጥ ይችላሉ።`
            : `We provide direct delivery to **${villageMention}** and all across Dessie! 🚚\n\n⚠️ **Stock Notice**: However, please note that **${pName}** is currently **Out of Stock** (temporarily sold out). You cannot place an order for it right now, but as soon as our fresh stock arrives, we will deliver it straight to your doorstep in **${villageMention}** within 1–2 hours!\n\nFeel free to contact Brother Abdela at **0931862253** for restock updates.`,
          context: updatedContext,
          productCard: matchedProduct,
          action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      }

      return {
        text: isAmharicResponse
          ? `አዎ በእርግጥ! **${pName}** (✅ በክምችት አለ — **${formattedPrice}**) ወደ **${villageMention}** እና ደጃፍዎ ድረስ ይደርስዎታል! 🚚\n\n📍 **የማድረሻ ክልል**፡\nበደሴ ከተማ ውስጥ (ቧንቧ ውሃ፣ ፒያሳ፣ አራዳ፣ ሆቴ፣ ሮቢት እና ሁሉንም መንደሮች/ሰፈሮች/ቀበሌዎች ጨምሮ) እንዲሁም በመላው ኢትዮጵያ በፍጥነት እናደርሳለን።\n\n📝 **እቃ ሲያዙ አድራሻ እንዴት ይሞላሉ?**\nበትዕዛዝ መስኮቱ ላይ **"ከተማ / ሰፈር / መንደር"** በሚለው መስክ ላይ ከተማዎን ከመንደርዎ ጋር አያይዘው ይጻፉ (ለምሳሌ፦ **ደሴ፣ ቧንቧ ውሃ**፤ ከአቅራቢያ መለያ ጋር)።\n\n⚡ **የማድረሻ ፍጥነት**፡\n• በደሴ እና በቅርብ መንደሮች፡ **በተመሳሳይ ቀን (ከ1–2 ሰዓት ባነሰ ጊዜ)** ደጃፍዎ ይደርሳል!\n• ከደሴ ውጭ ባሉ የኢትዮጵያ ክልሎች፡ በ1–3 ቀናት ውስጥ በአስተማማኝ ሁኔታ ይደርሳል።\n\n💵 **የክፍያ አማራጭ**፡\nእቃው እጅዎ ሲደርስ አይተው በጥሬ ገንዘብ (**Cash on Delivery**) መክፈል ወይም በ**ቴሌብር (Telebirr)** ማስተላለፍ ይችላሉ።`
          : `Yes, absolutely! **${pName}** (✅ In Stock — **${formattedPrice}**) can be delivered directly to your doorstep in **${villageMention}**! 🚚\n\n📍 **Delivery Coverage**:\nWe provide direct doorstep delivery across Dessie (including Buanbuha, Piassa, Arada, Hote, Robit, and all surrounding villages/kebeles) as well as across all regions of Ethiopia.\n\n📝 **How to enter your address when ordering**:\nOn the checkout popup, under the **"City / Village / Neighborhood"** field, enter your city and specific village (for example: **Dessie, Buanbuha**, along with any nearby landmark or house note) so our delivery team can reach your door.\n\n⚡ **Delivery Speed**:\n• Within Dessie & local villages: **Same-day delivery (often within 1–2 hours)** right to your door!\n• Outside Dessie / Nationwide: **1–3 business days**.\n\n💵 **Payment Options**:\nYou can choose **Cash on Delivery** to inspect the item and pay directly in cash when our delivery rider arrives, or pay via **Telebirr**!`,
        context: updatedContext,
        productCard: matchedProduct,
        action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
      };
    }

    // General Village / Delivery reachability response
    return {
      text: isAmharicResponse
        ? `አዎ በእርግጥ! እቃዎ ወደ **${villageMention}** እና ደጃፍዎ ድረስ በቀጥታ ይደርስዎታል! 🚚\n\n📍 **የማድረሻ ክልል**፡\nበደሴ ከተማ ውስጥ (ቧንቧ ውሃ፣ ፒያሳ፣ አራዳ፣ ሆቴ፣ ሮቢት እና ሁሉንም መንደሮች/ሰፈሮች/ቀበሌዎች ጨምሮ) እንዲሁም በመላው ኢትዮጵያ በፍጥነት እናደርሳለን።\n\n📝 **እቃ ሲያዙ አድራሻ እንዴት ይሞላሉ?**\nበትዕዛዝ መስኮቱ ላይ **"ከተማ / ሰፈር / መንደር"** በሚለው መስክ ከተማዎን ከተለየ መንደርዎ ጋር አያይዘው ይጻፉ (ለምሳሌ፦ **ደሴ፣ ቧንቧ ውሃ**፤ ከአቅራቢያ መለያ ምልክት ጋር)።\n\n⚡ **የማድረሻ ፍጥነት**፡\n• በደሴ እና በቅርብ መንደሮች፡ **በተመሳሳይ ቀን (ከ1–2 ሰዓት ባነሰ ጊዜ)** እጅዎ ይደርሳል!\n• ከደሴ ውጭ ባሉ የኢትዮጵያ ክልሎች፡ በ1–3 ቀናት ውስጥ ይደርሳል።\n\n💵 **የክፍያ አማራጭ**፡\nእቃው እጅዎ ሲደርስ አይተው በጥሬ ገንዘብ (**Cash on Delivery**) መክፈል ወይም በ**ቴሌብር (Telebirr)** ማስተላለፍ ይችላሉ።`
        : `Yes, absolutely! You can receive your order directly at **${villageMention}** and right to your doorstep! 🚚\n\n📍 **Delivery Coverage**:\nWe deliver directly to your village across Dessie (including Buanbuha, Piassa, Arada, Hote, Robit, and all surrounding neighborhoods/kebeles) as well as across all regions of Ethiopia.\n\n📝 **How to enter your address when ordering**:\nIn the checkout popup, under the **"City / Village / Neighborhood"** field, write your city and specific village (for example: **Dessie, Buanbuha**, along with any nearby landmark or house note) so our delivery team can find you quickly.\n\n⚡ **Delivery Speed**:\n• Within Dessie & local villages: **Same-day delivery (often within 1–2 hours)** right to your door!\n• Outside Dessie / Nationwide: **1–3 business days**.\n\n💵 **Payment Convenience**:\nYou can pay with **Cash on Delivery** when the package arrives in your hands, or pay securely using **Telebirr**!`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 7: DELIVERY TIME & SPEED
  // e.g. "how long does delivery take", "when will it arrive", "delivery time"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingDeliveryTime =
    (cleanText.includes('how long') ||
     cleanText.includes('how fast') ||
     cleanText.includes('delivery time') ||
     cleanText.includes('when will it arrive') ||
     cleanText.includes('when will my order arrive') ||
     cleanText.includes('when do you deliver') ||
     cleanText.includes('same day') ||
     hasAmharicMatch(cleanText, 'speed') ||
     cleanText.includes('ስንት ሰዓት') ||
     cleanText.includes('መቼ ይደርሳል') ||
     cleanText.includes('ስንት ቀን')) &&
    (cleanText.includes('deliver') ||
     cleanText.includes('shipping') ||
     cleanText.includes('arrive') ||
     cleanText.includes('reach') ||
     cleanText.includes('order') ||
     cleanText.includes('package') ||
     cleanText.includes('when') ||
     cleanText.includes('መቼ') ||
     cleanText.includes('ማድረሻ') ||
     cleanText.includes('መላኪያ') ||
     cleanText.includes('ይደርሳል'));

  if (isAskingDeliveryTime) {
    return {
      text: isAmharicResponse
        ? `🚚 **የማድረሻ ፍጥነት እና ጊዜ (Delivery Speed)**፡\n\n• **በደሴ ከተማ እና በዙሪያዋ ባሉ መንደሮች (ቧንቧ ውሃ፣ ፒያሳ፣ አራዳ፣ ሆቴ፣ ሮቢት ወዘተ)**፡ **በተመሳሳይ ቀን (ከ1–2 ሰዓት ባነሰ ጊዜ)** እቃዎ ደጃፍዎ ይደርሳል!\n• **ከደሴ ውጭ ለሆኑ የኢትዮጵያ ከተሞች**፡ በ1–3 የስራ ቀናት ውስጥ በአስተማማኝ መላኪያ ይደርሳል።\n\nየትዕዛዝዎን ሂደት በገጹ ታችኛው ክፍል ባለው **"የእኔ ትዕዛዞች"** መከታተል ይችላሉ።`
        : `🚚 **Delivery Speed & Schedule**:\n\n• **Within Dessie & local villages (Buanbuha, Piassa, Arada, Hote, Robit, etc.)**: **Same-day delivery (usually within 1–2 hours)** right to your doorstep!\n• **Outside Dessie / Other Ethiopian Cities**: Delivered within **1–3 business days** via secure regional couriers.\n\nYou can follow real-time progress in your **My Orders** section at any time!`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 7.1: PRODUCT USAGE & HOW-TO GUIDES
  // e.g. "how to use router cable", "how does the cramp relief belt work", "how to charge", "አጠቃቀም"
  // ─────────────────────────────────────────────────────────────────────────
  if (concepts.isUsageGuideIdea) {
    if (matchedProduct) {
      const lowerName = (matchedProduct.name_en || '').toLowerCase();

      if (lowerName.includes('cable') || lowerName.includes('router') || lowerName.includes('wifi')) {
        return {
          text: isAmharicResponse
            ? `💡 **የዋይፋይ ራውተር ፓወር ኬብል አጠቃቀም መመሪያ**፡\n\n1. **የዩኤስቢ (USB) ጫፉን ይሰኩ**፡ ኬብሉን በማንኛውም 5V ፓወር ባንክ (ለምሳሌ F-max 30,000mAh) ላይ ይሰኩት።\n2. **የክብ መሰኪያውን (DC Jack) ከራውተሩ ጋር ያገናኙ**፡ የኬብሉን ክብ ጫፍ በዋይፋይ ራውተርዎ የኃይል መሰኪያ (Power Port) ላይ ይሰኩት።\n3. **ይጠብቁ**፡ ራውተርዎ በ30 ሰከንድ ውስጥ በርቶ አገልግሎት መስጠት ይጀምራል!\n\n• ምንም አይነት ተጨማሪ ኮምፒውተር ወይም ሴቲንግ አያስፈልገውም — የ5 ቮልት ኃይልን ወደ 9V/12V በራሱ በመቀየር በቀጥታ ይሰራል!`
            : `💡 **How to Use the WiFi Router Power Boost Cable**:\n\n1. **Plug the USB end** into any standard 5V USB power bank (such as the F-max 30,000mAh).\n2. **Connect the DC barrel connector** into the power input port of your WiFi router.\n3. **Wait ~30 seconds**: Your WiFi router will boot up and broadcast WiFi immediately without mains electricity!\n\n• Plug-and-play with no configuration needed — the built-in intelligent boost module automatically converts 5V to the voltage your router requires.`,
          context: updatedContext,
          productCard: matchedProduct,
          action: (matchedProduct && matchedProduct.is_available !== false)
            ? { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
            : { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      }

      if (lowerName.includes('cramp') || lowerName.includes('relief') || lowerName.includes('women')) {
        return {
          text: isAmharicResponse
            ? `💡 **የሴቶች የወር አበባ ህመም መቀነሻ አጠቃቀም መመሪያ**፡\n\n1. **ያጥልቁ**፡ ለስላሳውን የላስቲክ ቀበቶ በሆድዎ ወይም በወገብዎ ዙሪያ በሚመችዎ መጠን ያስሩ።\n2. **ያብሩ**፡ የማብሪያ ቁልፉን ለ2 ሰከንድ ተጭነው ያብሩት።\n3. **የሙቀት መጠን ይምረጡ**፡ ቁልፉን በመጫን 45°C (አረንጓዴ)፣ 55°C (ሰማያዊ) ወይም 65°C (ቀይ) ይምረጡ — ጡንቻዎችን በማሞቅ ህመሙን በፍጥነት ያበርዳል።\n4. **ማሳጅ ይጨምሩ**፡ የማሳጅ ምልክት ያለውን ቁልፍ በመጫን ረጋ ያለ የማሳጅ ንዝረት ይጨምሩ።\n\n• በዩኤስቢ ቻርጅ የሚደረግ፣ ቀላል እና ድምጽ አልባ ስለሆነ በልብስ ስር በማንኛውም ቦታ መጠቀም ይቻላል።`
            : `💡 **How to Use the Women's Period Cramp Relief Belt**:\n\n1. **Fasten the Belt**: Wrap the soft elastic strap comfortably around your lower abdomen or lower back.\n2. **Power On**: Press and hold the power button for 2 seconds.\n3. **Adjust Heating**: Click to cycle through the 3 temperature levels (45°C gentle, 55°C medium, 65°C intense) to soothe muscle contractions.\n4. **Activate Massage**: Click the vibration button to engage gentle soothing vibrations.\n\n• Fully USB rechargeable, lightweight and whisper-quiet — perfect to wear discreetly under clothes anywhere!`,
          context: updatedContext,
          productCard: matchedProduct,
          action: (matchedProduct && matchedProduct.is_available !== false)
            ? { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
            : { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      }

      if (lowerName.includes('power bank') || lowerName.includes('f-max') || lowerName.includes('30000')) {
        return {
          text: isAmharicResponse
            ? `💡 **የ F-max 30,000mAh ፓወር ባንክ አጠቃቀም መመሪያ**፡\n\n1. **የመጀመሪያ ቻርጅ**፡ በType-C ወይም Micro-USB ኬብል ዲጂታል ስክሪኑ 100% እስኪሞላ ድረስ ሙሉ በሙሉ ቻርጅ ያድርጉት።\n2. **ስልክ/ራውተር ለመሙላት**፡ ስልክዎን ወይም የዋይፋይ ኬብልን በፈጣን ዩኤስቢ (USB-A) መሰኪያ ላይ ይሰኩ።\n3. **የፍላሽ መብራት**፡ የጎኑን ቁልፍ 2 ጊዜ በፍጥነት ሲጫኑ ደማቅ የአደጋ ጊዜ ፍላሽ መብራት ይበራል/ይጠፋል።\n\n• 30,000mAh እውነተኛ አቅም ስልክዎን ከ6 እስከ 8 ጊዜ ሙሉ በሙሉ ይሞላል!`
            : `💡 **How to Use the F-max 30,000mAh Power Bank**:\n\n1. **Initial Charge**: Connect via Type-C or Micro-USB until the LED digital percentage display reads 100%.\n2. **Charging Devices**: Plug your phone charging cable or WiFi router cable into the fast USB-A ports.\n3. **Emergency Flashlight**: Double-click the side button to toggle the bright built-in LED flashlight on/off.\n\n• Genuine 30,000mAh capacity provides 6 to 8 full charges for standard smartphones!`,
          context: updatedContext,
          productCard: matchedProduct,
          action: (matchedProduct && matchedProduct.is_available !== false)
            ? { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
            : { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      }

      if (lowerName.includes('honey') || lowerName.includes('yemeni')) {
        return {
          text: isAmharicResponse
            ? `💡 **የየመን ሲድር ማር አጠቃቀም መመሪያ**፡\n\n1. **ለሰውነት ጥንካሬ እና በሽታ መከላከያ**፡ ጠዋት በባዶ ሆድ ከ1–2 የሻይ ማንኪያ መውሰድ።\n2. **ለጉንፋን፣ ሳል እና የጉሮሮ ህመም**፡ ለብ ባለ (የማይፈላ) ውሃ ላይ ከሎሚ ጭማቂ ጋር አዋህዶ መጠጣት።\n\n• ጠቃሚ ምክር፡ የማሩ የተፈጥሮ ንጥረ ነገሮች እና ኢንዛይሞች እንዳይበላሹ ከፈላ ውሃ ጋር አያደባልቁ!`
            : `💡 **How to Use / Consume Yemeni Sidr Honey**:\n\n1. **Daily Immunity & Vitality**: Take 1 to 2 teaspoons in the morning on an empty stomach.\n2. **For Cough & Sore Throat**: Mix 1 tablespoon into warm (not boiling) water with fresh lemon juice.\n\n• Pro Tip: Do not mix with boiling hot water to preserve the live enzymes and antibacterial properties!`,
          context: updatedContext,
          productCard: matchedProduct,
          action: (matchedProduct && matchedProduct.is_available !== false)
            ? { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
            : { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      }
    }

    // General how-to guide if no specific product matched
    return {
      text: isAmharicResponse
        ? `ስለ የትኛው እቃ አጠቃቀም ማወቅ ይፈልጋሉ?\n• **የዋይፋይ ራውተር ኬብል** (መብራት ሲጠፋ ዋይፋይ እንዴት እንደሚሰራ)\n• **የሴቶች የወር አበባ ህመም መቀነሻ** (እንዴት እንደሚሞቅ እና እንደሚያሳጅ)\n• **F-max 30,000mAh ፓወር ባንክ** (ቻርጅ እና ፍላሽ መብራት)\n• **የየመን ሲድር ማር** (ለጉንፋን እና ለሰውነት አጠቃቀም)\n\nየሚፈልጉትን እቃ ስም ጠቅሰው ይጠይቁኝ!`
        : `Which product would you like instructions for?\n• **WiFi Router Boost Cable** (Running WiFi during blackouts)\n• **Women's Period Cramp Relief Belt** (Operating heat & vibration modes)\n• **F-max 30,000mAh Power Bank** (Charging & flashlight operation)\n• **Yemeni Sidr Honey** (Dosage for colds & immunity)\n\nJust tell me the product name and I'll explain step-by-step!`,
      context: updatedContext,
      productCards: liveProducts.slice(0, 4),
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 7.2: NEEDS-BASED PROBLEM SOLVING & RECOMMENDER
  // e.g. "blackout wifi stopped working", "severe period cramps", "phone battery dies fast", "cold and cough"
  // Only trigger if customer is NOT asking a direct product price/stock/availability inquiry for an already identified product
  // ─────────────────────────────────────────────────────────────────────────
  const isDirectProductInquiry = matchedProduct && (
    concepts.isPriceIdea ||
    concepts.isAvailabilityIdea ||
    concepts.isWhyCantOrderIdea ||
    concepts.isPurchaseIntentIdea ||
    tokens.includes('order') ||
    tokens.includes('price') ||
    tokens.includes('available') ||
    cleanText.includes('order') ||
    cleanText.includes('buy') ||
    cleanText.includes('why') ||
    cleanText.includes('cant') ||
    cleanText.includes('cannot') ||
    cleanText.includes("can't") ||
    cleanText.includes('tell me about') ||
    cleanText.includes('tell me') ||
    cleanText.includes('about') ||
    cleanText.includes('what is') ||
    cleanText.includes('can i order') ||
    cleanText.includes('cant order') ||
    cleanText.includes("can't order") ||
    cleanText.includes('cannot order') ||
    cleanText.includes('ማዘዝ እችላለሁ') ||
    cleanText.includes('ማዘዝ አልቻልኩም') ||
    cleanText.includes('መግዛት እፈልጋለሁ') ||
    cleanText.includes('አለ ወይ') ||
    cleanText.includes('አለወይ') ||
    cleanText.includes('ስለ') ||
    cleanText.includes('ንገረኝ')
  );

  if (matchedProblem && !isDirectProductInquiry) {
    if (matchedProblem.problemType === 'power_wifi') {
      const cableProduct = findProductByKey('cable', liveProducts);
      const powerBankProduct = findProductByKey('powerbank', liveProducts);
      const recommended = [cableProduct, powerBankProduct].filter(Boolean);

      const cablePrice = cableProduct ? `${Number(cableProduct.price).toLocaleString()} ETB` : '1,300 ETB';
      const pbPrice = powerBankProduct ? `${Number(powerBankProduct.price).toLocaleString()} ETB` : '4,500 ETB';
      const cableName = isAmharicResponse && cableProduct?.name_am ? cableProduct.name_am : 'የዋይፋይ ራውተር ፓወር ኬብል';
      const pbName = isAmharicResponse && powerBankProduct?.name_am ? powerBankProduct.name_am : 'F-max TD-301 30,000mAh ፓወር ባንክ';

      const isCableAvailable = cableProduct?.is_available !== false;
      const isPbAvailable = powerBankProduct?.is_available !== false;

      return {
        text: isAmharicResponse
          ? `💡 **መብራት ሲጠፋ ዋይፋይ እንዳይቋረጥ ፍቱን መፍትሄ አለን!**\n\nየኢትዮጵያ ኤሌክትሪክ መብራት በሚያቋርጥበት ወቅት የቤትዎ ወይም የቢሮዎ ዋይፋይ ራውተር እንዳይጠፋ የሚከተሉትን 2 ምርቶች እንመክራለን፡\n\n1. **${cableName}** (**${cablePrice}**) — ማንኛውንም 5V ፓወር ባንክ በቀጥታ ከዋይፋይ ራውተር (9V/12V) ጋር በማገናኘት ያለ መብራት ራውተሩን ያሰራል።\n2. **${pbName}** (**${pbPrice}**) — ከፍተኛ የባትሪ ክምችት ያለው በመሆኑ ራውተሩን ለረጅም ሰዓታት (እስከ 15–20 ሰዓት) በተከታታይ ያሰራዋል።\n\n${(isCableAvailable && isPbAvailable) ? 'ከታች **"አሁን እዘዝ"** የሚለውን በመጫን ወዲያውኑ ማዘዝ ይችላሉ! በደሴ ከተማ (ቧንቧ ውሃ ጨምሮ) ከ1–2 ሰዓት ውስጥ ደጃፍዎ እናደርሳለን።' : '⚠️ **ማስታወሻ**፡ አንዳንድ እቃዎች ክምችታቸው ውስን ሊሆን ይችላል። ሙሉ ዝርዝሩን ከታች ይመልከቱ።'}`
          : `💡 **Solution for WiFi during Power Blackouts!**\n\nWhen electricity goes out in Ethiopia, you don't have to lose your internet connection! We recommend our proven power backup solution:\n\n1. **WiFi Router Power Boost Cable** (**${cablePrice}**) — Connects any 5V USB power bank directly to your 9V/12V WiFi router to keep it powered without mains electricity.\n2. **F-max TD-301 30,000mAh Power Bank** (**${pbPrice}**) — Massive battery capacity that keeps your WiFi router powered for up to 15–20 hours during prolonged outages.\n\n${(isCableAvailable && isPbAvailable) ? 'Click **"Order Now"** on either product below to place your order! In Dessie (including Buanbuha), we deliver to your doorstep within 1–2 hours.' : '⚠️ **Notice**: Please check stock availability on the cards below for current in-stock status.'}`,
        context: { ...updatedContext, lastProduct: cableProduct || powerBankProduct },
        productCards: recommended,
        action: cableProduct ? { type: 'VIEW_PRODUCT', productId: cableProduct.id, label: (isCableAvailable ? (isAmharicResponse ? 'ኬብሉን እዘዝ' : 'Order Cable') : (isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details')) } : undefined
      };
    }

    if (matchedProblem.problemType === 'cramp_relief') {
      const crampProduct = findProductByKey('cramp_relief', liveProducts);
      const priceStr = crampProduct ? `${Number(crampProduct.price).toLocaleString()} ETB` : '2,600 ETB';
      const pName = isAmharicResponse && crampProduct?.name_am ? crampProduct.name_am : (isAmharicResponse ? 'ኦርጅናል የሴቶች የወር አበባ ህመም መቀነሻ ማሞቂያ ቀበቶ' : (crampProduct?.name_en || "Original Women's Period Cramp Relief Belt"));
      const isAvailable = crampProduct?.is_available !== false;

      if (!isAvailable) {
        return {
          text: isAmharicResponse
            ? `🌸 **ለወር አበባ ህመም እና ቁርጠት ፈጣን ተፈጥሯዊ ማስታገሻ!**\n\nየወር አበባ ህመምን (Period Cramps) እና የወገብ ቁርጠትን ለማስታገስ **${pName}** (**${priceStr}**) ምርጥ መፍትሄ ነው፡\n\n• **3 ደረጃ ያለው ፈጣን ሙቀት (45°C - 65°C)**፡ የሆድ ጡንቻዎችን በማሞቅ ህመሙን በደቂቃዎች ውስጥ ያበርዳል\n• **የማሳጅ ንዝረት (Vibration Massage)**፡ የደም ዝውውርን ያሻሽላል\n• **ቀላልና በልብስ ስር የሚታሰር**፡ ቤት ውስጥ፣ ስራ ቦታ ወይም እያረፉ በምቾት መጠቀም ይቻላል\n• **በዩኤስቢ ቻርጅ የሚደረግ**፡ አስተማማኝ ባትሪ ያለው\n\n⚠️ **የክምችት ማስታወሻ**፡ ይህ ምርት ለጊዜው **ክምችት አልቋል (Out of Stock)**፤ ስለዚህ አሁን ማዘዝ ባይቻልም በቅርቡ አዲስ ክምችት ይመለሳል! በስልክ **0931862253** ደውለው ማረጋገጥ ይችላሉ።`
            : `🌸 **Fast Natural Relief for Menstrual Cramps!**\n\nFor period cramps and abdominal discomfort, our **${pName}** (**${priceStr}**) provides instant, drug-free comfort:\n\n• **3 Adjustable Heating Levels (45°C - 65°C)**: Soothes cramped muscles within minutes\n• **Multi-Mode Vibration Massage**: Relaxes abdominal tension and improves circulation\n• **Discreet & Comfortable**: Wearable under clothing at work, school, or home\n• **USB Rechargeable**: Long-lasting rechargeable lithium battery\n\n⚠️ **Stock Notice**: Please note that this product is **temporarily out of stock** right now, but will be back in stock soon! Feel free to call Brother Abdela at **0931862253** for restock updates.`,
          context: { ...updatedContext, lastProduct: crampProduct },
          productCard: crampProduct,
          action: crampProduct ? { type: 'VIEW_PRODUCT', productId: crampProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' } : undefined
        };
      }

      return {
        text: isAmharicResponse
          ? `🌸 **ለወር አበባ ህመም እና ቁርጠት ፈጣን ተፈጥሯዊ ማስታገሻ!**\n\nየወር አበባ ህመምን (Period Cramps) እና የወገብ ቁርጠትን ለማስታገስ **${pName}** (**${priceStr}**) ምርጥ መፍትሄ ነው፡\n\n• **3 ደረጃ ያለው ፈጣን ሙቀት (45°C - 65°C)**፡ የሆድ ጡንቻዎችን በማሞቅ ህመሙን በደቂቃዎች ውስጥ ያበርዳል\n• **የማሳጅ ንዝረት (Vibration Massage)**፡ የደም ዝውውርን ያሻሽላል\n• **ቀላልና በልብስ ስር የሚታሰር**፡ ቤት ውስጥ፣ ስራ ቦታ ወይም እያረፉ በምቾት መጠቀም ይቻላል\n• **በዩኤስቢ ቻርጅ የሚደረግ**፡ አስተማማኝ ባትሪ ያለው\n\nከታች **"አሁን እዘዝ"** የሚለውን በመጫን በቀጥታ ማዘዝ ይችላሉ!`
          : `🌸 **Fast Natural Relief for Menstrual Cramps!**\n\nFor period cramps and abdominal discomfort, our **Original Women's Period Cramp Relief Belt** (**${priceStr}**) provides instant, drug-free comfort:\n\n• **3 Adjustable Heating Levels (45°C - 65°C)**: Soothes cramped muscles within minutes\n• **Multi-Mode Vibration Massage**: Relaxes abdominal tension and improves circulation\n• **Discreet & Comfortable**: Wearable under clothing at work, school, or home\n• **USB Rechargeable**: Long-lasting rechargeable lithium battery\n\nClick **"Order Now"** on the card below to place your order with fast doorstep delivery!`,
        context: { ...updatedContext, lastProduct: crampProduct },
        productCard: crampProduct,
        action: crampProduct ? { type: 'VIEW_PRODUCT', productId: crampProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' } : undefined
      };
    }

    if (matchedProblem.problemType === 'power_bank') {
      const pbProduct = findProductByKey('powerbank', liveProducts);
      const priceStr = pbProduct ? `${Number(pbProduct.price).toLocaleString()} ETB` : '4,500 ETB';
      const pName = isAmharicResponse && pbProduct?.name_am ? pbProduct.name_am : (isAmharicResponse ? 'F-max TD-301 30,000mAh ፈጣን ፓወር ባንክ' : (pbProduct?.name_en || 'F-max TD-301 30,000mAh Power Bank'));
      const isAvailable = pbProduct?.is_available !== false;

      if (!isAvailable) {
        return {
          text: isAmharicResponse
            ? `🔋 **ስልክዎ ቻርጅ ቶሎ እንዳያልቅ አስተማማኝ መፍትሄ!**\n\nለጉዞ፣ ለመብራት መጥፋት እና ስልክዎ ሁልጊዜ ሙሉ እንዲሆን **${pName}** (**${priceStr}**) እንመክራለን፡\n\n• **30,000mAh እውነተኛ አቅም**፡ ስማርት ስልኮችን ከ6 እስከ 8 ጊዜ ሙሉ በሙሉ ይሞላል\n• **ፈጣን ቻርጅ (Fast USB Outputs)**፡ በርካታ ስልኮችን በአንድ ጊዜ መሙላት ይችላል\n• **የዲጂታል ስክሪን መቶኛ**፡ የቀረውን የባትሪ መጠን በቁጥር ያሳያል\n• **ደማቅ የአደጋ ጊዜ ፍላሽ መብራት**፡ በመብራት መጥፋት ጊዜ ያገለግላል\n\n⚠️ **የክምችት ማስታወሻ**፡ ይህ ፓወር ባንክ ለጊዜው **አልቋል (Out of Stock)**፤ በቅርቡ አዲስ ክምችት ይመለሳል!`
            : `🔋 **Heavy-Duty Mobile Power Solution!**\n\nIf your phone battery is draining quickly or you are traveling, the **${pName}** (**${priceStr}**) is the ultimate power solution:\n\n• **Genuine 30,000mAh Capacity**: Charges modern smartphones 6 to 8 full times\n• **Multiple Fast USB Outputs**: Charge multiple devices simultaneously\n• **LED Digital Display**: Shows exact battery percentage\n• **Built-in Emergency Flashlight**: Perfect for sudden power outages\n\n⚠️ **Stock Notice**: This power bank is temporarily **Out of Stock** right now, but will be back in stock soon!`,
          context: { ...updatedContext, lastProduct: pbProduct },
          productCard: pbProduct,
          action: pbProduct ? { type: 'VIEW_PRODUCT', productId: pbProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' } : undefined
        };
      }

      return {
        text: isAmharicResponse
          ? `🔋 **ስልክዎ ቻርጅ ቶሎ እንዳያልቅ አስተማማኝ መፍትሄ!**\n\nለጉዞ፣ ለመብራት መጥፋት እና ስልክዎ ሁልጊዜ ሙሉ እንዲሆን **${pName}** (**${priceStr}**) እንመክራለን፡\n\n• **30,000mAh እውነተኛ አቅም**፡ ስማርት ስልኮችን ከ6 እስከ 8 ጊዜ ሙሉ በሙሉ ይሞላል\n• **ፈጣን ቻርጅ (Fast USB Outputs)**፡ በርካታ ስልኮችን በአንድ ጊዜ መሙላት ይችላል\n• **የዲጂታል ስክሪን መቶኛ**፡ የቀረውን የባትሪ መጠን በቁጥር ያሳያል\n• **ደማቅ የአደጋ ጊዜ ፍላሽ መብራት**፡ በመብራት መጥፋት ጊዜ ያገለግላል\n\nከታች ያለውን **"አሁን እዘዝ"** በመጫን ማዘዝ ይችላሉ!`
          : `🔋 **Heavy-Duty Mobile Power Solution!**\n\nIf your phone battery is draining quickly or you are traveling, the **F-max TD-301 30,000mAh Power Bank** (**${priceStr}**) is the ultimate power solution:\n\n• **Genuine 30,000mAh Capacity**: Charges modern smartphones 6 to 8 full times\n• **Multiple Fast USB Outputs**: Charge multiple devices simultaneously\n• **LED Digital Display**: Shows exact battery percentage\n• **Built-in Emergency Flashlight**: Perfect for sudden power outages\n\nClick **"Order Now"** below to get it delivered today!`,
        context: { ...updatedContext, lastProduct: pbProduct },
        productCard: pbProduct,
        action: pbProduct ? { type: 'VIEW_PRODUCT', productId: pbProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' } : undefined
      };
    }

    if (matchedProblem.problemType === 'honey') {
      const honeyProduct = findProductByKey('honey', liveProducts);
      const priceStr = honeyProduct ? `${Number(honeyProduct.price).toLocaleString()} ETB` : '3,000 ETB';
      const pName = isAmharicResponse && honeyProduct?.name_am ? honeyProduct.name_am : (isAmharicResponse ? '100% ኦርጅናል የየመን ሲድር ማር' : (honeyProduct?.name_en || 'Original Yemeni Sidr Honey'));
      const isAvailable = honeyProduct?.is_available !== false;

      if (!isAvailable) {
        return {
          text: isAmharicResponse
            ? `🍯 **ለጉንፋን፣ ሳል እና የሰውነት በሽታ መከላከያ ተፈጥሯዊ መድኃኒት!**\n\nለጉንፋን፣ ለሳል፣ ለጉሮሮ ህመም እና ለተፈጥሮ በሽታ መከላከያ **${pName}** (**${priceStr}**) ተመራጭ ነው፡\n\n• **100% ንጹህ እና ያልተበረዘ**፡ ከተፈጥሮ የሲድር ዛፍ የተገኘ ንጹህ ማር\n• **ለጉሮሮ ህመም እና ሳል ፈጣን እፎይታ**፡ ባክቴሪያን የሚከላከል የተፈጥሮ ሃይል አለው\n• **የሰውነት በሽታ የመከላከል አቅምን (Immunity) ያሳድጋል**\n• በባዶ ሆድ ወይም ለብ ባለ ውሃ ከሎሚ ጋር አዋህዶ መውሰድ ይመከራል\n\n⚠️ **የክምችት ማስታወሻ**፡ ይህ ማር ለጊዜው **አልቋል (Out of Stock)**፤ በቅርቡ አዲስ ክምችት ይመለሳል!`
            : `🍯 **Natural Healing for Colds, Coughs & Immunity!**\n\nFor sore throat, cough, cold recovery, and natural vitality, our **${pName}** (**${priceStr}**) is one of nature's most powerful remedies:\n\n• **100% Pure & Authentic**: Harvested from Yemeni Sidr nectar with zero additives\n• **Throat Soothing & Cough Relief**: Proven antibacterial and anti-inflammatory properties\n• **Boosts Immune System & Stamina**\n• Take 1–2 teaspoons daily or mix with warm water and lemon\n\n⚠️ **Stock Notice**: This honey is temporarily **Out of Stock** right now, but will be back soon!`,
          context: { ...updatedContext, lastProduct: honeyProduct },
          productCard: honeyProduct,
          action: honeyProduct ? { type: 'VIEW_PRODUCT', productId: honeyProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' } : undefined
        };
      }

      return {
        text: isAmharicResponse
          ? `🍯 **ለጉንፋን፣ ሳል እና የሰውነት በሽታ መከላከያ ተፈጥሯዊ መድኃኒት!**\n\nለጉንፋን፣ ለሳል፣ ለጉሮሮ ህመም እና ለተፈጥሮ በሽታ መከላከያ **${pName}** (**${priceStr}**) ተመራጭ ነው፡\n\n• **100% ንጹህ እና ያልተበረዘ**፡ ከተፈጥሮ የሲድር ዛፍ የተገኘ ንጹህ ማር\n• **ለጉሮሮ ህመም እና ሳል ፈጣን እፎይታ**፡ ባክቴሪያን የሚከላከል የተፈጥሮ ሃይል አለው\n• **የሰውነት በሽታ የመከላከል አቅምን (Immunity) ያሳድጋል**\n• በባዶ ሆድ ወይም ለብ ባለ ውሃ ከሎሚ ጋር አዋህዶ መውሰድ ይመከራል\n\nከታች ያለውን **"አሁን እዘዝ"** በመጫን በቀጥታ ማዘዝ ይችላሉ!`
          : `🍯 **Natural Healing for Colds, Coughs & Immunity!**\n\nFor sore throat, cough, cold recovery, and natural vitality, our **Original Yemeni Sidr Honey** (**${priceStr}**) is one of nature's most powerful remedies:\n\n• **100% Pure & Authentic**: Harvested from Yemeni Sidr nectar with zero additives\n• **Throat Soothing & Cough Relief**: Proven antibacterial and anti-inflammatory properties\n• **Boosts Immune System & Stamina**\n• Take 1–2 teaspoons daily or mix with warm water and lemon\n\nClick **"Order Now"** below to order 100% pure authentic honey today!`,
        context: { ...updatedContext, lastProduct: honeyProduct },
        productCard: honeyProduct,
        action: honeyProduct ? { type: 'VIEW_PRODUCT', productId: honeyProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' } : undefined
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 8: PRODUCT AUTHENTICITY & ORIGINALITY GUARANTEE
  // e.g. "are your products original", "is it fake or real", "genuine"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingAuthenticity =
    !isDirectProductInquiry && (
      cleanText.includes('are products original') ||
      cleanText.includes('are your products original') ||
      cleanText.includes('is it original') ||
      cleanText.includes('is it fake') ||
      cleanText.includes('real or fake') ||
      cleanText.includes('fake or real') ||
      cleanText.includes('authentic or fake') ||
      cleanText.includes('genuine or fake') ||
      cleanText.includes('fake') ||
      cleanText.includes('guarantee') ||
      cleanText.includes('warranty') ||
      cleanText.includes('authenticity') ||
      cleanText.includes('originality') ||
      (tokens.includes('authenticity') && !matchedProduct) ||
      ((cleanText.includes('original') || cleanText.includes('authentic') || cleanText.includes('genuine')) &&
       (cleanText.includes('are') || cleanText.includes('is') || cleanText.includes('how') || cleanText.includes('guarantee') || cleanText.includes('sure') || !matchedProduct)) ||
      cleanText.includes('ኦርጅናል ናቸው') ||
      cleanText.includes('ኦሪጅናል ናቸው') ||
      cleanText.includes('ትክክለኛ ናቸው') ||
      cleanText.includes('የውሸት')
    );

  if (isAskingAuthenticity) {
    return {
      text: isAmharicResponse
        ? `⭐ **100% ኦርጅናል እና የጥራት ዋስትና**፡\n\nበአብደላ ኦንላይን ሾፒንግ የሚገኙ ምርቶች በሙሉ ኦርጅናልነታቸው እና ጥንካሬያቸው የተረጋገጠ ነው፡\n• **ኦርጅናል የየመን ሲድር ማር** — 100% ንጹህ የተፈጥሮ ማር\n• **F-max 30,000mAh ፓወር ባንክ** — ሙሉ አቅም ያለው እና ፈጣን ቻርጀር\n• **የሴቶች የወር አበባ ህመም መቀነሻ** — ጥራት ያለው ኤሌክትሪክ ማሞቂያ እና ማሳጅ\n• **የዋይፋይ ራውተር ፓወር ኬብል** — መብራት ሲጠፋ ራውተር የሚያሰራ አስተማማኝ ኬብል\n\nእያንዳንዱ እቃ ከመላኩ በፊት በጥንቃቄ ይመረመራል። በተጨማሪም በደረሰኝ ጊዜ በጥሬ ገንዘብ ሲከፍሉ እቃውን በአካል አይተው መረከብ ይችላሉ!`
        : `⭐ **100% Genuine & Quality Guarantee**:\n\nAll products at Abdela Online Shopping are strictly guaranteed authentic and durable:\n• **Original Yemeni Sidr Honey** — 100% pure, natural harvest\n• **F-max TD-301 30,000mAh Power Bank** — Genuine high-capacity battery with fast charging\n• **Electric Women's Period Cramp Relief Heating Belt** — Certified thermal massage relief\n• **WiFi Router Power Boost Cable** — Heavy-duty boost converter for uninterrupted internet during power cuts\n\nEvery item is thoroughly tested before dispatch. Plus, with Cash on Delivery, you can inspect your package when it arrives!`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  const isAskingProducts =
    cleanText.includes('product') ||
    cleanText.includes('products') ||
    cleanText.includes('item') ||
    cleanText.includes('items') ||
    cleanText.includes('good') ||
    cleanText.includes('goods') ||
    cleanText.includes('catalog') ||
    cleanText.includes('እቃ') ||
    cleanText.includes('እቃዎች') ||
    cleanText.includes('ምርት') ||
    cleanText.includes('ምርቶች');

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 8.4: ALL PRODUCTS CATALOG INQUIRY
  // e.g. "tell me about abdi products", "what products do you sell", "abdi products", "show me products", "catalog", "browse products", "ስለ አብዲ እቃዎች"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingCatalog =
    cleanText.includes('what products') ||
    cleanText.includes('what do you sell') ||
    cleanText.includes('what items') ||
    cleanText.includes('show products') ||
    cleanText.includes('show me products') ||
    cleanText.includes('show me your products') ||
    cleanText.includes('list products') ||
    cleanText.includes('list of products') ||
    cleanText.includes('browse products') ||
    cleanText.includes('all products') ||
    cleanText.includes('product list') ||
    cleanText.includes('available products') ||
    cleanText.includes('what is in store') ||
    cleanText.includes('what do you have') ||
    cleanText.includes('catalog') ||
    cleanText.includes('tell me about abdela products') ||
    cleanText.includes('tell me about abdi products') ||
    cleanText.includes('tell me about products') ||
    cleanText.includes('tell me about your products') ||
    cleanText.includes('tell me about our products') ||
    cleanText.includes('about abdela products') ||
    cleanText.includes('about abdi products') ||
    cleanText.includes('about products') ||
    cleanText.includes('about your products') ||
    cleanText.includes('abdela products') ||
    cleanText.includes('abdela product') ||
    cleanText.includes('abdi products') ||
    cleanText.includes('abdi product') ||
    cleanText.includes('your products') ||
    cleanText.includes('our products') ||
    cleanText.includes('store products') ||
    cleanText.includes('shop products') ||
    cleanText.includes('what are your products') ||
    cleanText.includes('what are the products') ||
    cleanText.includes('what are abdela products') ||
    cleanText.includes('what are abdi products') ||
    cleanText === 'products' ||
    cleanText === 'product' ||
    cleanText === 'items' ||
    cleanText === 'goods' ||
    cleanText.includes('ምን እቃዎች') ||
    cleanText.includes('ምን ምርቶች') ||
    cleanText.includes('ያሉ እቃዎች') ||
    cleanText.includes('የምርቶች ዝርዝር') ||
    cleanText.includes('የእቃዎች ዝርዝር') ||
    cleanText.includes('ምን አለ') ||
    cleanText.includes('ምን ትሸጣላችሁ') ||
    cleanText.includes('ስለ አብደላ እቃዎች') ||
    cleanText.includes('ስለ አብደላ ምርቶች') ||
    cleanText.includes('የአብደላ እቃዎች') ||
    cleanText.includes('የአብደላ ምርቶች') ||
    cleanText.includes('ስለ አብዲ እቃዎች') ||
    cleanText.includes('ስለ አብዲ ምርቶች') ||
    cleanText.includes('የአብዲ እቃዎች') ||
    cleanText.includes('የአብዲ ምርቶች') ||
    cleanText.includes('ስለ ምርቶች') ||
    cleanText.includes('ስለ እቃዎች') ||
    cleanText.includes('የሚሸጡ እቃዎች') ||
    cleanText.includes('የሚሸጡ ምርቶች') ||
    cleanText.includes('ምርቶቻችሁ') ||
    cleanText.includes('እቃዎቻችሁ') ||
    cleanText === 'ምርቶች' ||
    cleanText === 'እቃዎች';

  if (!matchedProduct && isAskingCatalog && !tokens.includes('order') && !tokens.includes('payment')) {
    const productList = liveProducts.map((p) => {
      const name = isAmharicResponse && p.name_am ? p.name_am : p.name_en;
      const status = p.is_available !== false
        ? (isAmharicResponse ? '✅ በክምችት አለ' : '✅ In Stock')
        : (isAmharicResponse ? '⚠️ ለጊዜው አልቋል' : '⚠️ Out of Stock');
      return `• **${name}** — **${Number(p.price).toLocaleString()} ETB** (${status})`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `🛍️ **በአብደላ ኦንላይን ሾፒንግ በአሁን ሰዓት የሚገኙ 100% ኦርጅናል ምርቶች**፡\n\n${productList}\n\nየፈለጉትን ምርት ከታች ካሉት ካርዶች በመምረጥ ዝርዝሩን መመልከት እና በቀጥታ ማዘዝ ይችላሉ (በደሴ እና ቧንቧ ውሃ ከ1–2 ሰዓት ውስጥ ደጃፍዎ ይደርሳል)!`
        : `🛍️ **Products Available at Abdela Online Shopping**:\n\nHere is our current catalog of 100% genuine and verified products:\n\n${productList}\n\nClick on any product card below to view full details or place your order directly with fast doorstep delivery!`,
      context: updatedContext,
      productCards: liveProducts,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 8.5: WHY ABDELA IS SPECIAL / WHY CHOOSE ABDELA / ABOUT ABDELA
  // e.g. "why abdela is so special", "what makes abdela special", "why choose abdela", "who is abdela", "ምን ልዩ ያደርገዋል"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingWhySpecial =
    !isAskingProducts &&
    !matchedProduct && (
      cleanText.includes('special') ||
      cleanText.includes('why abdela') ||
      cleanText.includes('why is abdela') ||
      cleanText.includes('what makes abdela') ||
      cleanText.includes('why abdi') ||
      cleanText.includes('why is abdi') ||
      cleanText.includes('what makes abdi') ||
      cleanText.includes('what makes you special') ||
      cleanText.includes('why choose') ||
      cleanText.includes('why buy from') ||
      cleanText.includes('why should i buy') ||
      cleanText.includes('why should i choose') ||
      cleanText.includes('what is special') ||
      cleanText.includes('unique') ||
      cleanText.includes('who is abdela') ||
      cleanText.includes('what is abdela') ||
      cleanText === 'about abdela' ||
      cleanText === 'tell me about abdela' ||
      cleanText.includes('about brother abdela') ||
      cleanText.includes('who is abdi') ||
      cleanText.includes('what is abdi') ||
      cleanText === 'about abdi' ||
      cleanText === 'tell me about abdi' ||
      cleanText.includes('about brother abdi') ||
      cleanText.includes('about the company') ||
      cleanText.includes('about the store') ||
      cleanText.includes('about your shop') ||
      cleanText.includes('about your store') ||
      cleanText === 'ስለ አብደላ' ||
      cleanText === 'ስለ አብደላ ንገረኝ' ||
      cleanText.includes('ስለ ወንድም አብደላ') ||
      cleanText.includes('አብደላ ማነው') ||
      cleanText.includes('አብደላ ማን ነው') ||
      cleanText.includes('የአብደላ ልዩነት') ||
      cleanText.includes('ለምን ከአብደላ') ||
      cleanText === 'ስለ አብዲ' ||
      cleanText === 'ስለ አብዲ ንገረኝ' ||
      cleanText.includes('ስለ ወንድም አብዲ') ||
      cleanText.includes('አብዲ ማነው') ||
      cleanText.includes('አብዲ ማን ነው') ||
      cleanText.includes('ምን ልዩ ያደርገዋል') ||
      cleanText.includes('ልዩ የሚያደርገው') ||
      cleanText.includes('የአብዲ ልዩነት') ||
      cleanText.includes('ለምን ከአብዲ') ||
      cleanText.includes('ልዩነት')
    );

  if (isAskingWhySpecial) {
    return {
      text: isAmharicResponse
        ? `🌟 **አብደላ ኦንላይን ሾፒንግን (Abdela Online Shopping) ምን ልዩ እና ተመራጭ ያደርገዋል?**\n\nአብደላ ኦንላይን ሾፒንግ በኢትዮጵያ ውስጥ ደንበኞች በሙሉ እምነት፣ ምቾት እና ደህንነት የሚገበያዩበት ዘመናዊ የኢ-ኮሜርስ መደብር ነው፡\n\n1. 🛡️ **100% ኦርጅናል እና የተፈተነ ጥራት**\nምንም አይነት የውሸት (Fake) ወይም አጠራጣሪ እቃ አንሸጥም። እያንዳንዱ እቃ (ኦርጅናል የየመን ሲድር ማር፣ እውነተኛ 30,000mAh ፓወር ባንክ፣ የህመም መቀነሻ ቀበቶ እና የዋይፋይ ኬብል) ከመላኩ በፊት ጥራቱ በተግባር ተፈትሾ የተረጋገጠ ነው።\n\n2. 🚚 **መንደር እና ደጃፍ ድረስ ፈጣን ማድረስ**\nፖስታ ቤት ወይም መናኸሪያ ድረስ ሄደው ሳይደክሙ በደሴ ከተማ ውስጥ (ቧንቧ ውሃ፣ ፒያሳ፣ አራዳ፣ ሆቴ፣ ሮቢት እና ሁሉንም መንደሮች ጨምሮ) **ከ1–2 ሰዓት ባነሰ ጊዜ ውስጥ ደጃፍዎ ድረስ** እናደርሳለን። በመላው ኢትዮጵያም በ1–3 ቀናት ውስጥ በአስተማማኝ ሁኔታ ይደርሳል።\n\n3. 🔍 **እቃውን አይተው የሚከፍሉበት አስተማማኝ አሰራር (Cash on Delivery)**\nእቃው እጅዎ ሲደርስ በዓይንዎ አይተው እና ፈትሸው ካረጋገጡ በኋላ ብቻ ቀሪውን በጥሬ ገንዘብ መክፈል ይችላሉ። ምንም አይነት የማጭበርበር ስጋት የለም።\n\n4. 🤖 **ብልህ የደንበኞች ረዳት (Abdela AI)**\nበአማርኛ እና በእንግሊዝኛ አቀላጥፎ የሚረዳ፣ የትዕዛዝ ሁኔታን የሚያሳይ፣ የእቃ አጠቃቀም መመሪያዎችን የሚሰጥ እና እንደ መብራት መጥፋት ላሉ የዕለት ተዕለት ችግሮች መፍትሄ የሚጠቁም ቴክኖሎጂ የታጠቀ ነው።\n\n5. 🤝 **ቀጥተኛ ተጠያቂነት እና ቅርብ አገልግሎት**\nከማይታወቅ የኦንላይን ሻጭ ሳይሆን ከወንድም አብደላ እና ቡድኑ ጋር በስልክ (**0931862253**) እና በቴሌግራም በቀጥታ መገናኘት እና መተማመን ይችላሉ።`
        : `🌟 **What Makes Abdela Online Shopping So Special?**\n\nAbdela Online Shopping is built to give customers in Ethiopia complete trust, convenience, and superior service:\n\n1. 🛡️ **100% Genuine & Pre-Tested Quality**\nWe strictly reject counterfeit or substandard goods. Every product (authentic Yemeni Sidr Honey, genuine 30,000mAh F-max Power Bank, certified Period Cramp Relief Belt, and WiFi Router Cable) is physically tested and inspected before dispatch.\n\n2. 🚚 **Hyper-Local Village & Doorstep Delivery**\nUnlike other couriers that make you pick up packages at central post offices or bus terminals, we deliver **directly to your specific village and neighborhood** across Dessie (including Buanbuha, Robit, Piassa, Arada, etc.) in **just 1 to 2 hours (same day)**, plus reliable courier delivery nationwide.\n\n3. 🔍 **Inspect Before You Pay (Cash on Delivery)**\nZero scam risk. You inspect the product with your own hands when our delivery rider arrives before paying the remaining balance.\n\n4. 🤖 **AI-Powered Customer Assistant (Abdela AI)**\nEthiopia's first localized shopping assistant that understands natural English and Amharic, tracks orders in real-time, provides step-by-step usage guides, and solves real-life problems (like WiFi during power outages).\n\n5. 🤝 **Personal Accountability & Direct Founder Support**\nYou deal with real, accountable people. Brother Abdela and the team are directly reachable via hotline (**0931862253**) and Telegram for any guidance.`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 9: DIRECT CUSTOMER SUPPORT PHONE / CALL / TELEGRAM
  // e.g. "what is your phone number", "how to call Brother Abdela", "call"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingContact =
    (tokens.includes('contact') ||
    cleanText.includes('phone') ||
    cleanText.includes('call') ||
    cleanText.includes('hotline') ||
    cleanText.includes('telegram') ||
    cleanText.includes('how to reach') ||
    cleanText.includes('speak to') ||
    hasAmharicMatch(cleanText, 'contact') ||
    cleanText.includes('ስልክ') ||
    cleanText.includes('መደወል') ||
    cleanText.includes('ቴሌግራም')) &&
    !cleanText.includes('special') &&
    !cleanText.includes('why');

  if (isAskingContact) {
    return {
      text: isAmharicResponse
        ? `📞 **የአብደላ ኦንላይን ሾፒንግ ቀጥታ አድራሻ እና ስልክ ቁጥር**፡\n\n• **የደንበኞች አገልግሎት ስልክ**፡ **0931862253** (ወንድም አብደላ)\n• **ቴሌግራም**፡ ቀጥታ መልእክት መላክ ይችላሉ\n• **አድራሻ**፡ ደሴ፣ ኢትዮጵያ\n\nለማንኛውም ልዩ ትዕዛዝ፣ የማድረሻ ጥያቄ ወይም ፈጣን ድጋፍ በ**0931862253** በነፃነት ይደውሉልን!`
        : `📞 **Abdela Online Shopping Direct Contact & Customer Support**:\n\n• **Phone / Hotline**: **0931862253** (Brother Abdela)\n• **Telegram**: Direct messaging available\n• **Location**: Dessie, Ethiopia\n\nFeel free to call **0931862253** directly for any questions, order follow-ups, or special delivery inquiries!`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 10: DOORSTEP INSPECTION BEFORE PAYING & RETURNS
  // e.g. "can i check before paying", "can i inspect it", "what if it is damaged"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingDoorstepInspection =
    tokens.includes('inspection') ||
    cleanText.includes('check before') ||
    cleanText.includes('inspect') ||
    cleanText.includes('see before paying') ||
    cleanText.includes('look before') ||
    cleanText.includes('if it is damaged') ||
    cleanText.includes('damaged') ||
    cleanText.includes('broken') ||
    cleanText.includes('return') ||
    cleanText.includes('refund') ||
    cleanText.includes('exchange') ||
    hasAmharicMatch(cleanText, 'inspection') ||
    cleanText.includes('አይቼ') ||
    cleanText.includes('ካላማረኝ') ||
    cleanText.includes('መመለስ') ||
    cleanText.includes('ብላሽ');

  if (isAskingDoorstepInspection) {
    return {
      text: isAmharicResponse
        ? `🛡️ **እቃውን አይቶ የመክፈል እና የመመለስ መመሪያ**፡\n\n• **በደረሰኝ ጊዜ መክፈል (Cash on Delivery)**፡ እቃው ደጃፍዎ ሲደርስ እሽጉን ከፍተው ትክክለኛነቱን እና ጥራቱን ካረጋገጡ በኋላ ቀሪውን በጥሬ ገንዘብ መክፈል ይችላሉ።\n• **የተበላሸ ወይም የተሳሳተ እቃ ቢሆንስ?** እቃው ላይ ማንኛውም ችግር ካለ ወዲያውኑ ለዴሊቨሪ ሰራተኛው መመለስ ወይም ለወንድም አብደላ በ**0931862253** ደውለው ወዲያውኑ መቀየር ይችላሉ!`
        : `🛡️ **Doorstep Inspection & Protection Policy**:\n\n• **Inspect Before Paying**: With Cash on Delivery, you are welcome to inspect your package upon delivery at your doorstep before paying the remaining balance.\n• **What if there is an issue?**: If an item does not match or has any defect, you can decline it with the delivery agent or immediately call Brother Abdela at **0931862253** for an immediate free exchange!`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 11: DISCOUNTS & WHOLESALE INQUIRIES
  // e.g. "discount", "can you reduce the price", "wholesale", "cheaper"
  // ─────────────────────────────────────────────────────────────────────────
  const isAskingDiscounts =
    tokens.includes('discount') ||
    cleanText.includes('discount') ||
    cleanText.includes('reduce price') ||
    cleanText.includes('lower price') ||
    cleanText.includes('cheaper') ||
    cleanText.includes('bargain') ||
    cleanText.includes('wholesale') ||
    hasAmharicMatch(cleanText, 'discount') ||
    cleanText.includes('ቅናሽ') ||
    cleanText.includes('መቀነስ') ||
    cleanText.includes('ቀንስ');

  if (isAskingDiscounts) {
    return {
      text: isAmharicResponse
        ? `💰 **ስለ ቅናሽ እና የጅምላ ዋጋ**፡\n\nበአብደላ ኦንላይን ሾፒንግ የሚገኙ ዋጋዎች ያለ ደላላ በቀጥታ የተመደቡ ትክክለኛና ተመጣጣኝ ዋጋዎች ናቸው።\n\nበብዛት (በጅምላ) ማዘዝ ከፈለጉ ወይም ልዩ የዋጋ ቅናሽ ለመጠየቅ በቀጥታ ለወንድም አብደላ በ**0931862253** ደውለው መነጋገር ይችላሉ!`
        : `💰 **Discounts & Wholesale Inquiries**:\n\nOur listed prices are already direct, fair retail prices in ETB with zero middleman markups.\n\nFor bulk orders, wholesale purchases, or special volume discounts, feel free to contact Brother Abdela directly at **0931862253**!`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 12: SPECIFIC PRODUCT AVAILABILITY, STOCK, PRICE & DETAILS (Live Store State)
  // e.g. "Can I order honey?", "How much is power bank?", "why i cant order period relief", "tell me about honey"
  // ─────────────────────────────────────────────────────────────────────────
  if (matchedProduct) {
    const pName = isAmharicResponse && matchedProduct.name_am ? matchedProduct.name_am : matchedProduct.name_en;
    const isAvailable = matchedProduct.is_available !== false;
    const formattedPrice = `${Number(matchedProduct.price || 0).toLocaleString()} ETB`;
    const desc = isAmharicResponse
      ? (matchedProduct.description_am || matchedProduct.description_en || '')
      : (matchedProduct.description_en || matchedProduct.description_am || '');

    // Sub-Intent 12A: Why can't I order / Stock & Availability Inquiry / Can I order
    // (e.g. "why i cant order original womens period cramp relief product", "can i order honey", "is it in stock", "when will it be back")
    const isStockOrOrderQuery =
      concepts.isWhyCantOrderIdea ||
      concepts.isAvailabilityIdea ||
      tokens.includes('available') ||
      cleanText.includes('can i order') ||
      cleanText.includes('can i buy') ||
      cleanText.includes('cant order') ||
      cleanText.includes("can't order") ||
      cleanText.includes('cannot order') ||
      cleanText.includes('why cant') ||
      cleanText.includes("why can't") ||
      cleanText.includes('why i cant') ||
      cleanText.includes("why i can't") ||
      cleanText.includes('in stock') ||
      cleanText.includes('out of stock') ||
      cleanText.includes('sold out') ||
      cleanText.includes('restock') ||
      cleanText.includes('ማዘዝ አልቻልኩም') ||
      cleanText.includes('ለምን ማዘዝ') ||
      cleanText.includes('አለ ወይ') ||
      cleanText.includes('አለወይ') ||
      cleanText.includes('በክምችት');

    if (isStockOrOrderQuery) {
      if (!isAvailable) {
        return {
          text: isAmharicResponse
            ? `ይቅርታ፣ ለጊዜው የ**${pName}** ክምችት ስላለቀ (**አልቋል / Out of Stock**) ስለዚህ አሁን ማዘዝ አይችሉም። ነገር ግን በቅርቡ አዲስ ክምችት ገብቶ ዳግም መደበኛ አገልግሎት መስጠት ይጀምራል!\n\n📞 እቃው እንደገባ እንዲገለጽልዎ ወይም ለተጨማሪ መረጃ ለወንድም አብደላ በስልክ **0931862253** መደወል ይችላሉ።`
            : `Sorry, for now there is no stock for **${pName}** (it is currently out of stock / **Out of Stock**), which is why you cannot place an order right now. But don't worry, it will be back in stock soon! Once our new shipment arrives, ordering will reopen immediately.\n\n📞 If you would like to be notified as soon as it arrives, or for any questions, you can contact Brother Abdela directly at **0931862253**!`,
          context: updatedContext,
          productCard: matchedProduct,
          action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      } else {
        return {
          text: isAmharicResponse
            ? `አዎ! **${pName}** አሁን **በክምችት አለ (In Stock)**! ዋጋው **${formattedPrice}** ነው።\n\nከታች **"አሁን እዘዝ" (Order Now)** የሚለውን በመጫን ወዲያውኑ ማዘዝ ይችላሉ (በደሴ እና ቧንቧ ውሃ ከ1–2 ሰዓት ውስጥ ደጃፍዎ ይደርሳል)!`
            : `Yes! **${pName}** is currently in stock (✅ **In Stock**) and available for **${formattedPrice}**! You can click **"Order Now"** on the card below to place your order with fast doorstep delivery (within 1–2 hours in Dessie & Buanbuha)!`,
          context: updatedContext,
          productCard: matchedProduct,
          action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
        };
      }
    }

    // Sub-Intent 12B: Price Inquiry for this specific product
    // (e.g. "how much is honey", "price of cramp relief")
    const isPriceQuery =
      concepts.isPriceIdea ||
      tokens.includes('price') ||
      hasAmharicMatch(cleanText, 'price') ||
      cleanText.includes('how much') ||
      cleanText.includes('cost of') ||
      cleanText.includes('ዋጋ');

    if (isPriceQuery) {
      if (!isAvailable) {
        return {
          text: isAmharicResponse
            ? `የ**${pName}** ዋጋ **${formattedPrice}** ነው፤ ነገር ግን ምርቱ ለጊዜው **⚠️ አልቋል (Out of Stock)**። አሁን ማዘዝ ባይቻልም በቅርቡ አዲስ ክምችት ይመለሳል!\n\nለበለጠ መረጃ በ**0931862253** መደወል ይችላሉ።`
            : `The price of **${pName}** is **${formattedPrice}**, but please note it is currently **⚠️ Out of Stock** (temporarily sold out). Orders are paused for now, but it will be back in stock soon!\n\nFeel free to call **0931862253** for restock updates.`,
          context: updatedContext,
          productCard: matchedProduct,
          action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
        };
      } else {
        return {
          text: isAmharicResponse
            ? `የ**${pName}** ዋጋ **${formattedPrice}** ነው (✅ **በክምችት አለ**)።\n\nከታች **"አሁን እዘዝ"** የሚለውን በመጫን በቀጥታ ማዘዝ ይችላሉ!`
            : `The price of **${pName}** is **${formattedPrice}** (✅ **In Stock**).\n\nClick **"Order Now"** on the card below to place your order with fast doorstep delivery!`,
          context: updatedContext,
          productCard: matchedProduct,
          action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
        };
      }
    }

    // Sub-Intent 12C: Product Explanation / Description / "Tell me about..."
    // (e.g. "tell me about Yemen honey", "what is cramp relief", "tell me about power bank", or just typing product name)
    const stockStatusEn = isAvailable ? '✅ In Stock' : '⚠️ Out of Stock (Will be back soon!)';
    const stockStatusAm = isAvailable ? '✅ በክምችት አለ' : '⚠️ ለጊዜው አልቋል (በቅርቡ ይመለሳል!)';

    if (!isAvailable) {
      return {
        text: isAmharicResponse
          ? `**${pName}**\n• ዋጋ፡ **${formattedPrice}**\n• ሁኔታ፡ **${stockStatusAm}**\n\n${desc ? `📝 **ዝርዝር መረጃ**፡\n${desc}\n\n` : ''}⚠️ **ማስታወሻ**፡ ይቅርታ፣ ለጊዜው የዚህ እቃ ክምችት ስላለቀ አሁን ማዘዝ አይቻልም፤ ነገር ግን በቅርቡ አዲስ ክምችት ይመለሳል! በስልክ **0931862253** ደውለው ማረጋገጥ ይችላሉ።`
          : `**${pName}**\n• Price: **${formattedPrice}**\n• Availability: **${stockStatusEn}**\n\n${desc ? `📝 **Details & Benefits**:\n${desc}\n\n` : ''}⚠️ **Restock Notice**: Sorry, for now there is no stock for this product so ordering is temporarily unavailable, but it will be back soon! Call **0931862253** for restock updates.`,
        context: updatedContext,
        productCard: matchedProduct,
        action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'ዝርዝር ይመልከቱ' : 'View Details' }
      };
    }

    return {
      text: isAmharicResponse
        ? `**${pName}**\n• ዋጋ፡ **${formattedPrice}**\n• ሁኔታ፡ **${stockStatusAm}**\n\n${desc ? `📝 **ዝርዝር መረጃ**፡\n${desc}\n\n` : ''}ከታች **"አሁን እዘዝ"** የሚለውን በመጫን በቀጥታ ማዘዝ ይችላሉ!`
        : `**${pName}**\n• Price: **${formattedPrice}**\n• Availability: **${stockStatusEn}**\n\n${desc ? `📝 **Details & Benefits**:\n${desc}\n\n` : ''}Click **"Order Now"** on the card below to place your order directly!`,
      context: updatedContext,
      productCard: matchedProduct,
      action: { type: 'VIEW_PRODUCT', productId: matchedProduct.id, label: isAmharicResponse ? 'አሁን እዘዝ' : 'Order Now' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 12.5: GENERAL CONCEPTUAL PRICE INQUIRY (All Products)
  // e.g. "tell me the price of product", "price of product", "how much are products", "ዋጋ ንገረኝ"
  // ─────────────────────────────────────────────────────────────────────────
  if (concepts.isPriceIdea) {
    const productList = liveProducts.map((p) => {
      const name = isAmharicResponse && p.name_am ? p.name_am : p.name_en;
      const status = p.is_available !== false ? (isAmharicResponse ? 'በክምችት አለ' : 'In Stock') : (isAmharicResponse ? 'አልቋል' : 'Out of Stock');
      return `• **${name}** — **${Number(p.price).toLocaleString()} ETB** (${status})`;
    }).join('\n');

    return {
      text: isAmharicResponse
        ? `በአብደላ ኦንላይን ሾፒንግ በአሁን ሰዓት የሚገኙ የምርቶች ዋጋ ዝርዝር፡\n\n${productList}\n\nየፈለጉትን እቃ ከታች በመምረጥ **"አሁን እዘዝ"** በሚለው ቁልፍ ወዲያውኑ ማዘዝ ይችላሉ!`
        : `Here are the current prices for products at Abdela Online Shopping:\n\n${productList}\n\nYou can click **"Order Now"** on any item below to place your order directly!`,
      context: updatedContext,
      productCards: liveProducts,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 14: SCREENSHOT / PAYMENT PROOF REQUIREMENTS
  // e.g. "what screenshot can i upload", "upload receipt", "screenshot"
  // ─────────────────────────────────────────────────────────────────────────
  if (tokens.includes('screenshot') || hasAmharicMatch(cleanText, 'screenshot') || cleanText.includes('upload') || cleanText.includes('proof')) {
    return {
      text: isAmharicResponse
        ? `የክፍያ ደረሰኝ ስክሪንሾት (ደረሰኝ) መስፈርቶች (ቴሌብር / CBE / አቢሲኒያ / የቅድመ ክፍያ)፡\n• **የፋይል አይነቶች**፡ JPEG, JPG, PNG ወይም WEBP\n• **ከፍተኛው መጠን**፡ 5MB (ሜጋባይት)\n• **የሚያስፈልገው መረጃ**፡ የተከፈለው መጠን፣ ቀን እና የግብይት ቁጥር (Transaction ID) በግልጽ መታየት አለባቸው።\n\nክፍያውን ከፈጸሙ በኋላ በስልኮ የወሰዱትን ስክሪንሾት በትዕዛዝ መስኮቱ ላይ አያይዘው ይላኩ።`
        : `Payment Screenshot / Receipt Proof Requirements (Telebirr / CBE / BoA / Cash Deposit):\n• **Supported Formats**: JPEG, JPG, PNG, or WEBP\n• **Maximum File Size**: 5MB\n• **Clarity**: The transaction ID, transferred amount, recipient name, and date must be clearly readable.\n\nAfter making your transfer, attach the receipt screenshot in the checkout popup and submit your order!`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 15: PAYMENT METHODS (TELEBIRR, CBE, ABYSSINIA, CASH ON DELIVERY)
  // e.g. "how do i pay", "can i pay cash", "telebir", "cbe", "abyssinia", "paymant"
  // ─────────────────────────────────────────────────────────────────────────
  if (
    tokens.includes('payment') ||
    tokens.includes('telebirr') ||
    tokens.includes('cbe') ||
    tokens.includes('abyssinia') ||
    tokens.includes('cash') ||
    cleanText.includes('cbe') ||
    cleanText.includes('abyssinia') ||
    cleanText.includes('ንግድ') ||
    cleanText.includes('አቢሲኒያ') ||
    cleanText.includes('ቅድመ') ||
    cleanText.includes('advance') ||
    cleanText.includes('deposit') ||
    hasAmharicMatch(cleanText, 'payment') ||
    hasAmharicMatch(cleanText, 'telebirr') ||
    hasAmharicMatch(cleanText, 'cash')
  ) {
    return {
      text: isAmharicResponse
        ? `በአብደላ ኦንላይን ሾፒንግ 4 አይነት አስተማማኝ የክፍያ አማራጮች አሉ፡\n\n1. 📱 **በቴሌብር (Telebirr Transfer)**:\n• ቁጥር፡ **0931862253** (ስም፡ Nuru)\n• ትክክለኛውን የትዕዛዝ ዋጋ ይላኩና የደረሰኙን ስክሪንሾት በማያያዝ ትዕዛዙን ያጠናቁ።\n\n2. 🏦 **በኢትዮጵያ ንግድ ባንክ (CBE)**:\n• ሂሳብ ቁጥር፡ **1000584744573** (ስም፡ Behrdin seid)\n• ክፍያ ፈጽመው የደረሰኙን ስክሪንሾት በማያያዝ ይላኩ።\n\n3. 🏦 **በአቢሲኒያ ባንክ (Bank of Abyssinia)**:\n• ሂሳብ ቁጥር፡ **251444412** (ስም፡ Abdulhafiz sani)\n• ክፍያ ፈጽመው የደረሰኙን ስክሪንሾት በማያያዝ ይላኩ።\n\n4. 💵 **በደረሰኝ ጊዜ በጥሬ ገንዘብ (Cash on Delivery)**:\n• **200 ብር ቅድመ ክፍያ (Advance Security Deposit)**፡ ትዕዛዝዎን ለማረጋገጥ 200 ብር በቴሌብር፣ በCBE ወይም በአቢሲኒያ አስቀድመው ይክፈሉ እና የደረሰኙን ስክሪንሾት ያያይዙ።\n• ቀሪውን ሂሳብ እቃው ደጃፍዎ ሲደርስ በጥሬ ገንዘብ ይክፈሉ።`
        : `Abdela Online Shopping offers 4 secure payment options:\n\n1. 📱 **Telebirr Transfer**:\n• Account: **0931862253** (Name: Nuru)\n• Transfer full amount and attach receipt screenshot.\n\n2. 🏦 **Commercial Bank of Ethiopia (CBE)**:\n• Account Number: **1000584744573** (Name: Behrdin seid)\n• Transfer full amount and attach receipt screenshot.\n\n3. 🏦 **Bank of Abyssinia (BoA)**:\n• Account Number: **251444412** (Name: Abdulhafiz sani)\n• Transfer full amount and attach receipt screenshot.\n\n4. 💵 **Cash on Delivery**:\n• **200 ETB Advance Deposit**: A small 200 ETB security deposit is required via Telebirr, CBE, or BoA with receipt screenshot attached.\n• Pay the remaining balance in cash directly to our delivery courier upon delivery!`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 16: HOW TO ORDER / ORDERING JOURNEY
  // e.g. "how can i make an oder", "how to buy", "orderr"
  // ─────────────────────────────────────────────────────────────────────────
  if (tokens.includes('order') || hasAmharicMatch(cleanText, 'order') || cleanText.includes('how to buy') || cleanText.includes('make an order')) {
    return {
      text: isAmharicResponse
        ? `በአብደላ ኦንላይን ሾፒንግ እቃ ለማዘዝ የሚከተሉትን ቀላል ደረጃዎች ይከተሉ፡\n\n1. **ምርት ይምረጡ**፡ በዋናው ገጽ ላይ ያሉትን እቃዎች ያስሱ።\n2. **ዝርዝሩን ይመልከቱ**፡ የሚፈልጉትን እቃ ነክተው ፎቶውን፣ ዋጋውን እና መረጃውን ያንብቡ።\n3. **"አሁን እዘዝ" (Order Now) የሚለውን ይጫኑ**።\n4. **መረጃዎን ያስገቡ**፡ ሙሉ ስም፣ ስልክ ቁጥር እና ከተማዎን ከተለየ ሰፈር/መንደርዎ ጋር (ለምሳሌ፦ **ደሴ፣ ቧንቧ ውሃ**) ይሙሉ፤ የሚፈልጉትን ብዛት (እስከ 5 እቃ) ይምረጡ።\n5. **የክፍያ ዘዴ ይምረጡ**፡ ከ4ቱ አማራጮች (ቴሌብር፣ CBE፣ አቢሲኒያ ወይም በደረሰኝ መክፈል ከ200 ብር ቅድመ ክፍያ ጋር) አንዱን መርጠው የደረሰኝ ስክሪንሾት በማያያዝ ትዕዛዝዎን ይላኩ!\n\nትዕዛዝዎ ከተላከ በኋላ በ**"የእኔ ትዕዛዞች" (My Orders)** ክፍል መከታተል ይችላሉ።`
        : `Ordering from Abdela Online Shopping is easy and takes just a minute:\n\n1. **Browse Products**: Explore our catalog on the storefront.\n2. **Open Details**: Click on any product to view full specifications, photos, and live stock.\n3. **Click "Order Now"**.\n4. **Enter Your Details**: Provide your name, phone number, and delivery address with your city and specific village/area (e.g. **Dessie, Buanbuha**), and select quantity (up to 5 items).\n5. **Choose Payment Method**: Select Telebirr, CBE, Bank of Abyssinia, or Cash on Delivery (with 200 ETB deposit), attach your payment screenshot, and submit!\n\nOnce placed, your order appears instantly in **My Orders** so you can track its progress!`,
      context: updatedContext,
      action: { type: 'SCROLL_SECTION', targetId: 'products', label: isAmharicResponse ? 'ምርቶችን ያስሱ' : 'Browse Products' }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 17: STORE ABOUT & GENERAL INFORMATION
  const isAskingStoreAbout =
    !matchedProduct &&
    !isAskingProducts && (
      cleanText.includes('who is abdela') ||
      cleanText.includes('what is abdela') ||
      cleanText.includes('about abdela') ||
      cleanText.includes('about brother abdela') ||
      cleanText.includes('who is abdi') ||
      cleanText.includes('what is abdi') ||
      cleanText.includes('about the shop') ||
      cleanText.includes('about the store') ||
      cleanText.includes('about this shop') ||
      cleanText.includes('about this store') ||
      cleanText === 'about abdi' ||
      cleanText === 'tell me about abdi' ||
      cleanText.includes('about brother abdi') ||
      cleanText === 'about' ||
      cleanText === 'about us' ||
      cleanText === 'ስለ አብደላ' ||
      cleanText === 'ስለ አብደላ ንገረኝ' ||
      cleanText.includes('ስለ ወንድም አብደላ') ||
      cleanText === 'ስለ አብዲ' ||
      cleanText === 'ስለ አብዲ ንገረኝ' ||
      cleanText.includes('ስለ ወንድም አብዲ') ||
      cleanText.includes('ስለ ሱቁ')
    );

  if (isAskingStoreAbout) {
    return {
      text: isAmharicResponse
        ? `**አብደላ ኦንላይን ሾፒንግ (Abdela Online Shopping)** ዋና መቀመጫውን በደሴ ከተማ ያደረገ፣ ጥራት ያላቸው ኦርጅናል የጤና እና የውበት ምርቶች፣ ኤሌክትሮኒክስ እና የቤት ውስጥ እቃዎችን የሚያቀርብ ታማኝ የኢ-ኮሜርስ መደብር ነው።\n\n• **የማድረስ አገልግሎት**፡ በደሴ ከተማ (ቧንቧ ውሃ፣ ፒያሳ፣ አራዳ፣ ሆቴ፣ ሮቢት እና ሁሉንም ሰፈሮች ጨምሮ) እንዲሁም በመላው ኢትዮጵያ በፍጥነት እናደርሳለን።\n• **የአድራሻ አሞላል**፡ እቃ ሲያዙ የከተማ ስም ብቻ ሳይሆን መንደርዎን ጭምር ይጥቀሱ (ለምሳሌ፦ **ደሴ፣ ቧንቧ ውሃ**)\n• **ክፍያ**፡ በቴሌብር፣ በCBE፣ በአቢሲኒያ ባንክ እና ሲደርስ በጥሬ ገንዘብ (ከ200 ብር ቅድመ ክፍያ ጋር) መክፈል ይቻላል።`
        : `**Abdela Online Shopping** is a trusted Ethiopian online shopping store based in Dessie, providing 100% authentic health and beauty items, electronics, and household goods.\n\n• **Fast Delivery**: We deliver promptly within Dessie (including Buanbuha, Piassa, Arada, Hote, Robit, and all neighborhoods) and across all regions of Ethiopia.\n• **Address Guidance**: When ordering, please enter your city and specific village/area (e.g. **Dessie, Buanbuha**).\n• **Payment Methods**: Telebirr, Commercial Bank of Ethiopia (CBE), Bank of Abyssinia, and Cash on Delivery (with 200 ETB deposit).\n• **Quality Guarantee**: All products are thoroughly inspected for originality and durability.`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 18: LANGUAGE SETTINGS
  // e.g. "how to change language", "amharic"
  // ─────────────────────────────────────────────────────────────────────────
  if (tokens.includes('language') || hasAmharicMatch(cleanText, 'language')) {
    return {
      text: isAmharicResponse
        ? `የድረ-ገጹን ቋንቋ ለመቀየር ከላይ ባለው ማውጫ (Header) ላይ የሚገኘውን **"EN / አማ"** የሚለውን ቁልፍ ይጫኑ። እኔም አብሬው ቋንቋዬን እቀይራለሁ!`
        : `To change the website language, click the **"EN / አማ"** language switcher button located at the top right of the navigation bar. I will automatically adapt to your chosen language!`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT 19: GREETINGS & CASUAL HELLO
  // e.g. "hello", "hi", "hey", "selam", "ሰላም"
  // ─────────────────────────────────────────────────────────────────────────
  const isGreeting = tokens.some(t => ['hello', 'hi', 'hey', 'selam', 'greetings'].includes(t)) ||
                     cleanText.includes('ሰላም') || cleanText.includes('እንደምን');
  if (isGreeting) {
    return {
      text: isAmharicResponse
        ? `ሰላም! እኔ **Abdela AI** ነኝ 👋\nየአብደላ ኦንላይን ሾፒንግ ረዳትዎ። ስለ ምርቶች፣ ዋጋ፣ አያያዝ፣ የክፍያ መንገዶች (ቴሌብር፣ CBE፣ አቢሲኒያ፣ ካሽ) እና የትዕዛዝ ሁኔታ ማንኛውንም ጥያቄ መጠየቅ ይችላሉ። ዛሬ በምን ልርዳዎት?`
        : `Hello! I'm **Abdela AI** 👋\nYour official shopping and help assistant for Abdela Online Shopping. I can help you with product prices, stock availability, placing an order, payment options (Telebirr, CBE, Abyssinia, Cash), and order tracking. How can I help you today?`,
      context: updatedContext
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FALLBACK: INTELLIGENT HELPFUL SUMMARY & GUIDANCE
  // ─────────────────────────────────────────────────────────────────────────
  return {
    text: isAmharicResponse
      ? `እርስዎን በደንብ ለመርዳት ዝግጁ ነኝ! የሚከተሉትን ጥያቄዎች ሊጠይቁኝ ይችላሉ፡\n\n• **"እቃዬ መንደር ድረስ ይደርሳል?"** (Village delivery in Dessie)\n• **"እንዴት ማዘዝ እችላለሁ?"** (How do I order?)\n• **"የክፍያ ዘዴዎች ምንድን ናቸው?"** (Payment methods: Telebirr, CBE, BoA, Cash)\n• **"ትዕዛዜ የት ደረሰ?"** (Track my orders)\n• **"ስለ ምርቶች ዋጋ እና ክምችት"** (Product availability & prices)\n\nከላይ ከተዘረዘሩት አንዱን ይምረጡ ወይም ጥያቄዎን በግልጽ ይጻፉልኝ!`
      : `I'm here to help you with anything on Abdela Online Shopping! You can ask me:\n\n• **"Can I get my product in my village?"** — Village delivery across Dessie\n• **"How do I place an order?"** — Complete checkout guidance\n• **"How do I pay?"** — Payment methods & receipt screenshot upload help\n• **"Where is my order?"** — Check your order status and history\n• **"Is [product] in stock?"** — Real-time price and availability check\n\nFeel free to choose a suggestion below or type your question!`,
    context: updatedContext
  };
}

/**
 * Returns localized quick suggestion pills
 */
export function getQuickSuggestions(language = 'en') {
  if (language === 'am') {
    return [
      { text: '📍 መንደር ድረስ ይደርሳል?', query: 'በመንደሬ እቃዬን ማግኘት እችላለሁ ደሴ ቧንቧ ውሃ' },
      { text: '🛍️ እንዴት ማዘዝ እችላለሁ?', query: 'እንዴት ማዘዝ እችላለሁ' },
      { text: '💳 የክፍያ አማራጮች', query: 'የክፍያ አማራጮች' },
      { text: '📦 የቅርብ ጊዜ ትዕዛዜ', query: 'የቅርብ ጊዜ ትዕዛዜ ምንድን ነው' },
      { text: '⭐ ምርቶቻችሁ ኦርጅናል ናቸው?', query: 'ምርቶቻችሁ ኦርጅናል ናቸው ወይ' },
      { text: '🍯 የየመን ማር ዋጋ ስንት ነው?', query: 'የየመን ማር ዋጋ እና ክምችት' }
    ];
  }

  return [
    { text: '📍 Village delivery in Dessie?', query: 'Can I get my product in my village Dessie Buanbuha' },
    { text: '🛍️ How do I order?', query: 'How do I place an order' },
    { text: '💳 How do I pay?', query: 'What are the payment methods' },
    { text: '📦 Latest order status', query: 'What is my latest order' },
    { text: '⭐ Are products original?', query: 'Are your products original' },
    { text: '🍯 Yemeni Honey price?', query: 'How much is Yemeni Honey' }
  ];
}
