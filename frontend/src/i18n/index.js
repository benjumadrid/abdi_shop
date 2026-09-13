import en from './en.js';
import am from './am.js';

export const dictionaries = {
  en,
  am
};

/**
 * Resolves a nested translation key path (e.g. 'hero.titleStart').
 * @param {string} path - Dot-separated path like 'nav.home'
 * @param {string} lang - 'en' or 'am'
 * @returns {string} Translated text or path fallback
 */
export function t(path, lang = 'en') {
  const dict = dictionaries[lang] || dictionaries.en;
  const segments = path.split('.');

  let current = dict;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      // Fallback to English dictionary if key missing in target language
      let fallback = dictionaries.en;
      for (const fbSegment of segments) {
        if (fallback && typeof fallback === 'object' && fbSegment in fallback) {
          fallback = fallback[fbSegment];
        } else {
          return path;
        }
      }
      return fallback;
    }
  }

  return current !== undefined ? current : path;
}

/**
 * Returns the localized product name based on active language.
 * Prefers name_am for Amharic with fallback to name_en.
 */
export function getProductName(product, lang = 'en') {
  if (!product) return '';
  if (lang === 'am' && product.name_am && product.name_am.trim()) {
    return product.name_am.trim();
  }
  return product.name_en ? product.name_en.trim() : '';
}

/**
 * Returns the localized product description based on active language.
 * Dynamically returns description_am for Amharic and description_en for English.
 */
export function getProductDescription(product, lang = 'en') {
  if (!product) return '';
  return lang === 'am' ? (product.description_am || '') : (product.description_en || '');
}

/**
 * Formats monetary amounts in Ethiopian Birr.
 * @param {number|string} amount
 * @param {string} lang - 'en' or 'am'
 * @returns {string} Formatted price string (e.g. "3,000 ETB" or "3,000 ብር")
 */
export function formatPrice(amount, lang = 'en') {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  return lang === 'am' ? `${formatted} ብር` : `${formatted} ETB`;
}

export default {
  dictionaries,
  t,
  getProductName,
  getProductDescription,
  formatPrice
};
