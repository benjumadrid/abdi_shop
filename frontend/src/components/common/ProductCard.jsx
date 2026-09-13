import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";

export default function ProductCard({ product }) {
  const { isAmharic, getProductName, formatPrice, t } = useLanguage();
  const [imageError, setImageError] = useState(false);

  if (!product) return null;

  const name = getProductName(product);
  const description = isAmharic
    ? product.description_am || ""
    : product.description_en || "";
  const priceFormatted = formatPrice(product.price);
  const isAvailable = product.is_available !== false;

  const rawImageUrl =
    product.image_url ||
    (Array.isArray(product.media) && product.media.find((m) => m.is_primary)?.url) ||
    (Array.isArray(product.media) && product.media[0]?.url) ||
    null;

  const hasImage = rawImageUrl && !imageError;

  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-card hover:shadow-card-lift transition-all duration-300 ease-out hover:-translate-y-1.5 border border-surface-200/90 hover:border-brand-500/40"
    >
      {/* ── Image Zone ──────────────────────────────── */}
      <div className="relative overflow-hidden bg-surface-100" style={{ aspectRatio: "4/3" }}>
        {hasImage ? (
          <img
            src={rawImageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-100 to-surface-200 text-surface-400">
            <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-surface-500 px-4 text-center line-clamp-2">{name}</span>
          </div>
        )}

        {/* Badge Row */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2 pointer-events-none z-10">
          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink-900/80 text-white backdrop-blur-sm shadow-sm">
            <svg className="w-2.5 h-2.5 text-accent-400 fill-current" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
            {t("products.authenticTag")}
          </span>

          <span
            className={`inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm ${
              isAvailable ? "bg-brand-600/90 text-white" : "bg-amber-600/95 text-white border border-amber-400/40"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isAvailable ? "bg-white" : "bg-amber-200 animate-pulse"}`} />
            {isAvailable ? t("products.inStock") : t("products.outOfStock")}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      {/* ── Card Body ───────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <h3 className="font-bold text-ink-900 text-[15px] sm:text-base leading-snug line-clamp-2 group-hover:text-brand-700 transition-colors duration-200 mb-2">
          {name}
        </h3>

        {description && (
          <p className="text-xs sm:text-[13px] text-ink-500 line-clamp-2 leading-relaxed mb-4 flex-1">
            {description}
          </p>
        )}

        {/* Out of Stock Notice */}
        {!isAvailable && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200 text-[11px] font-semibold text-amber-900 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-tight">{t("products.outOfStockNotice")}</span>
          </div>
        )}

        {/* Price + View Details */}
        <div className="mt-auto pt-4 border-t border-surface-100 flex items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] sm:text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
              {t("products.price")}
            </span>
            <span className="text-[18px] sm:text-[20px] font-extrabold text-brand-700 tracking-tight mt-0.5">
              {priceFormatted}
            </span>
          </div>

          {/* "View Details" button */}
          <span
            className="inline-flex items-center justify-center gap-1.5 font-bold text-xs px-4 py-2.5 rounded-xl transition-all duration-200 shrink-0 bg-brand-600 group-hover:bg-brand-700 text-white shadow-float-sm group-hover:shadow-brand-glow"
          >
            {t("products.details")}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
