import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { getProductById, getCachedProductById, subscribeToStoreUpdates } from "../services/api";
import Button from "../components/common/Button";
import OrderModal from "../components/common/OrderModal";

/* ============================================================
   IMAGE GALLERY — shows all product media with thumbnails
============================================================ */
function ImageGallery({ media, name }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [mainError, setMainError] = useState(false);

  // Reset index when media changes
  useEffect(() => {
    setActiveIdx(0);
    setMainError(false);
  }, [media]);

  const images = Array.isArray(media) && media.length > 0 ? media : [];
  const activeUrl = images[activeIdx]?.url || null;

  const handleThumbClick = (idx) => {
    if (idx === activeIdx) return;
    setActiveIdx(idx);
    setMainError(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Main Image ────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden bg-surface-100 border border-surface-200/80 shadow-card">
        <div className="relative w-full aspect-square">
          {activeUrl && !mainError ? (
            <img
              src={activeUrl}
              alt={name}
              fetchPriority="high"
              decoding="async"
              onError={() => setMainError(true)}
              className="w-full h-full object-cover object-center transition-all duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-surface-100 to-surface-200 p-8">
              <svg className="w-20 h-20 text-surface-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-surface-500 text-center">{name}</span>
            </div>
          )}

          {/* Image counter badge (only when multiple) */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-ink-900/70 text-white text-[11px] font-bold backdrop-blur-sm pointer-events-none">
              {activeIdx + 1} / {images.length}
            </div>
          )}
        </div>
      </div>

      {/* ── Thumbnails (only when 2+ images) ─────── */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => handleThumbClick(idx)}
              className={`shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all duration-200 focus:outline-none ${
                idx === activeIdx
                  ? "border-brand-600 shadow-brand-glow scale-[1.04]"
                  : "border-surface-200 hover:border-brand-300 opacity-70 hover:opacity-100"
              }`}
              aria-label={`Image ${idx + 1}`}
            >
              <img
                src={img.url}
                alt={`${name} ${idx + 1}`}
                className="w-full h-full object-cover object-center"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LOADING SKELETON
============================================================ */
function DetailSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-10 md:py-16">
      <div className="animate-pulse space-y-8">
        <div className="h-3.5 bg-surface-200 rounded w-52" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <div className="space-y-4">
            <div className="aspect-square rounded-3xl bg-surface-200" />
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-20 h-20 rounded-2xl bg-surface-200" />
              ))}
            </div>
          </div>
          <div className="space-y-5 pt-2">
            <div className="h-8 bg-surface-200 rounded-xl w-3/4" />
            <div className="h-6 bg-surface-200 rounded-xl w-1/3" />
            <div className="h-24 bg-surface-200 rounded-2xl" />
            <div className="h-14 bg-surface-200 rounded-2xl" />
            <div className="h-14 bg-surface-200 rounded-2xl w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */
export default function ProductDetailPage() {
  const { id } = useParams();
  const { isAmharic, getProductName, formatPrice, t } = useLanguage();

  const initialCached = getCachedProductById(id);
  const [product, setProduct] = useState(() => initialCached || null);
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const fetchProduct = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent && !getCachedProductById(id)) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getProductById(id);
      if (!data) throw new Error("Product not found.");
      setProduct((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(data)) {
          return prev;
        }
        return data;
      });
    } catch (err) {
      console.error("Failed to load product details:", err);
      if (!silent && !getCachedProductById(id)) {
        setError(err.message || "Could not load product details.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchProduct(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Live sync product detail across tabs silently without skeleton flicker
    const unsubscribe = subscribeToStoreUpdates(() => {
      fetchProduct(true);
    }, 10000);

    return () => unsubscribe();
  }, [fetchProduct]);

  /* ── Loading ── */
  if (loading) return <DetailSkeleton />;

  /* ── Error / Not Found ── */
  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-6 text-2xl font-black">!</div>
        <h2 className="text-2xl font-bold text-ink-900">
          {isAmharic ? "ምርቱ አልተገኘም" : "Product Not Found"}
        </h2>
        <p className="text-sm text-ink-500 mt-3 mb-8 leading-relaxed">
          {isAmharic
            ? "የፈለጉት ምርት አልተገኘም ወይም ተሰርዟል።"
            : "The requested product could not be found or may have been removed."}
        </p>
        <Link to="/products">
          <Button variant="primary" size="md">
            {isAmharic ? "← ወደ ምርቶች ዝርዝር" : "← Back to Products"}
          </Button>
        </Link>
      </div>
    );
  }

  /* ── Derived values ── */
  const name = getProductName(product);
  const description = isAmharic
    ? product.description_am || ""
    : product.description_en || "";
  const priceFormatted = formatPrice(product.price);
  const isAvailable = product.is_available !== false;

  // Build ordered media array: primary first, then the rest
  const mediaItems = Array.isArray(product.media) ? product.media : [];
  const primaryMedia = mediaItems.find((m) => m.is_primary);
  const otherMedia   = mediaItems.filter((m) => !m.is_primary);
  const orderedMedia = primaryMedia
    ? [primaryMedia, ...otherMedia]
    : otherMedia;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 md:py-14">

      {/* ── Breadcrumbs ──────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-ink-400 mb-8">
        <Link to="/" className="hover:text-brand-600 transition-colors">{t("nav.home")}</Link>
        <svg className="w-3 h-3 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <Link to="/products" className="hover:text-brand-600 transition-colors">{t("nav.products")}</Link>
        <svg className="w-3 h-3 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-ink-700 line-clamp-1 max-w-[200px] sm:max-w-sm">{name}</span>
      </nav>

      {/* ── Two-column layout ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

        {/* LEFT — Image Gallery */}
        <div>
          <ImageGallery media={orderedMedia} name={name} />
        </div>

        {/* RIGHT — Product Info */}
        <div className="space-y-6 lg:pt-1">

          {/* Category badge + Title */}
          <div>
            <span className="inline-flex text-xs font-bold text-brand-700 px-3 py-1 rounded-full bg-brand-50 border border-brand-200/70 mb-3">
              {t("products.badge")}
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-black text-ink-950 tracking-tight leading-tight">
              {name}
            </h1>
          </div>

          {/* Availability */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                isAvailable
                  ? "bg-brand-50 text-brand-800 border border-brand-200/60"
                  : "bg-amber-50 text-amber-900 border border-amber-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-brand-500" : "bg-amber-500"}`} />
              {isAvailable ? t("products.inStock") : t("products.outOfStock")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-ink-50 text-ink-700 border border-ink-100">
              <svg className="w-2.5 h-2.5 text-accent-500 fill-current" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              </svg>
              {t("products.authenticTag")}
            </span>
          </div>

          {/* Price block */}
          <div className="rounded-3xl bg-surface-50 border border-surface-200/80 p-5 flex items-center justify-between shadow-card">
            <div>
              <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-widest block mb-1">
                {t("products.price")}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-brand-700 tracking-tight">
                {priceFormatted}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-ink-600 block">{t("footer.location")}</span>
              <span className="text-xs text-brand-600 font-semibold mt-0.5 block">
                {isAmharic ? "ፈጣን አድራሻ ማድረስ" : "Delivery Available"}
              </span>
            </div>
          </div>

          {/* Full Description */}
          {description && (
            <div className="border-t border-surface-200 pt-5 space-y-3">
              <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-ink-500">
                {isAmharic ? "የምርት ዝርዝር መረጃ" : "Product Details"}
              </h2>
              <p className="text-[15px] text-ink-700 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </div>
          )}

          {/* ── ORDER NOW ACTION ─────────────────────── */}
          {isAvailable ? (
            <div className="space-y-3">
              {/* Primary Order Now Button */}
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(true)}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-extrabold text-base sm:text-lg shadow-brand-glow hover:shadow-float-sm transition-all duration-200 cursor-pointer group"
              >
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>{t("products.orderNow")}</span>
              </button>

              {/* Direct Phone Call Alternative */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-ink-500 bg-surface-50 border border-surface-200/80 rounded-2xl py-3 px-4">
                <span>{isAmharic ? "ወይም በስልክ ማዘዝ ይፈልጋሉ?" : "Prefer to order by phone?"}</span>
                <a
                  href={`tel:${t("footer.supportPhone").replace(/\s/g, "")}`}
                  className="font-bold text-brand-700 hover:text-brand-800 hover:underline inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{t("footer.supportPhone")}</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-amber-50 border border-amber-200/90 p-6 text-center space-y-2 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{t("products.outOfStock")}</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-ink-900 leading-snug">
                {t("products.outOfStockNotice")}
              </p>
            </div>
          )}


          {/* Back to Products */}
          <Link to="/products">
            <Button variant="outline" size="md" fullWidth>
              {isAmharic ? "← ወደ ምርቶች ዝርዝር" : "← Back to Products"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Order Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        product={product}
      />
    </div>
  );
}
