import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { getProducts, getCachedProducts, subscribeToStoreUpdates } from "../services/api";
import ProductCard from "../components/common/ProductCard";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import Button from "../components/common/Button";

export default function ProductsPage() {
  const { t } = useLanguage();
  const initialCached = getCachedProducts();
  const [products, setProducts] = useState(() => initialCached || []);
  const [loading, setLoading] = useState(() => !initialCached || initialCached.length === 0);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async (silent = false) => {
    // Only display skeleton loader on the very first initial load if products are not yet rendered
    if (!silent && (!getCachedProducts() || getCachedProducts().length === 0)) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getProducts({ forceFresh: true });
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to load products catalog:", err);
      if (!silent && (!getCachedProducts() || getCachedProducts().length === 0)) {
        setError(err.message || "Could not connect to backend store service.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProducts(false);
    // Background live updates are silent (stale-while-revalidate without skeleton flicker)
    const unsubscribe = subscribeToStoreUpdates(() => {
      fetchProducts(true);
    }, 10000);
    return () => unsubscribe();
  }, [fetchProducts]);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-10 md:py-16 space-y-10">

      {/* ── Page Header ──────────────────────────────── */}
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-ink-400">
          <Link to="/" className="hover:text-brand-600 transition-colors">
            {t("nav.home")}
          </Link>
          <svg className="w-3 h-3 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-ink-700">{t("nav.products")}</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-surface-200 pb-7">
          <div>
            <span className="inline-flex text-xs font-extrabold text-brand-700 uppercase tracking-widest px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200/70 mb-3">
              {t("products.badge")}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
              {t("productsPage.title")}
            </h1>
            <p className="mt-2 text-ink-500 text-[15px] max-w-xl leading-relaxed">
              {t("productsPage.subtitle")}
            </p>
          </div>

          {!loading && !error && (
            <div className="inline-flex items-center gap-2 text-xs font-bold text-ink-600 bg-surface-100 border border-surface-200 px-4 py-2.5 rounded-2xl self-start md:self-auto shrink-0">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-slow" />
              {products.length} {products.length === 1 ? "Product" : "Products"} Available
            </div>
          )}
        </div>
      </div>

      {/* ── Product Content ──────────────────────────── */}
      {loading ? (
        <LoadingSkeleton count={8} />
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-10 text-center max-w-lg mx-auto my-10">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-5">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-ink-900 mb-2">{t("products.errorTitle")}</h3>
          <p className="text-sm text-ink-500 mb-7">{t("products.errorDesc")}</p>
          <div className="flex justify-center gap-3">
            <Button variant="primary" size="sm" onClick={fetchProducts}>{t("products.retry")}</Button>
            <Link to="/">
              <Button variant="outline" size="sm">{t("productsPage.backHome")}</Button>
            </Link>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-surface-200 bg-surface-50 p-14 text-center max-w-md mx-auto my-10">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 text-surface-400 mx-auto flex items-center justify-center mb-5">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-ink-900 mb-2">{t("products.emptyTitle")}</h3>
          <p className="text-sm text-ink-500 mb-7">{t("products.emptyDesc")}</p>
          <Link to="/">
            <Button variant="primary" size="sm">{t("productsPage.backHome")}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
