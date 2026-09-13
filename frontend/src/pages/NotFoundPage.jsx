import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";

export default function NotFoundPage() {
  const { isAmharic, t } = useLanguage();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-24 text-center">
      {/* Big 404 number */}
      <div className="text-[120px] sm:text-[160px] font-black text-surface-200 leading-none select-none mb-6">
        404
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-2xl sm:text-3xl font-black text-ink-900">
          {t("notFound.title")}
        </h1>
        <p className="text-sm text-ink-500 leading-relaxed">
          {t("notFound.description")}
        </p>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-float-sm hover:shadow-brand-glow transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {t("notFound.backHome")}
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-surface-300 bg-white text-ink-700 font-semibold text-sm hover:bg-surface-50 transition-all duration-200"
          >
            {isAmharic ? "ምርቶችን ይመልከቱ" : "Browse Products"}
          </Link>
        </div>
      </div>
    </div>
  );
}
