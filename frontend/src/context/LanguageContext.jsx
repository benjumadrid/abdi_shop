import { useState, useEffect, useMemo, useCallback } from 'react';
import { LanguageContext } from './language-context';
import { t as translate, getProductName as localizeName, getProductDescription as localizeDesc, formatPrice as localizePrice } from '../i18n';

const STORAGE_KEY = 'abdi_lang';
const DEFAULT_LANG = 'en';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'am' || saved === 'en' ? saved : DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });

  // Sync document language attribute for screen readers & font rendering
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (err) {
      console.warn('Could not persist language preference:', err);
    }
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang) => {
    if (lang === 'en' || lang === 'am') {
      setLanguageState(lang);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'am' : 'en'));
  }, []);

  const t = useCallback(
    (path) => translate(path, language),
    [language]
  );

  const getProductName = useCallback(
    (product) => localizeName(product, language),
    [language]
  );

  const getProductDescription = useCallback(
    (product) => localizeDesc(product, language),
    [language]
  );

  const formatPrice = useCallback(
    (amount) => localizePrice(amount, language),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      isAmharic: language === 'am',
      t,
      getProductName,
      getProductDescription,
      formatPrice
    }),
    [language, setLanguage, toggleLanguage, t, getProductName, getProductDescription, formatPrice]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageProvider;
