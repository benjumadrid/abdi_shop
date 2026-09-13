import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  const navLinkClass = ({ isActive }) =>
    `relative text-sm font-semibold transition-colors duration-150 ${
      isActive
        ? "text-brand-600"
        : "text-ink-600 hover:text-ink-900"
    }`;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-surface-50/95 backdrop-blur-lg shadow-float-sm border-b border-surface-200"
          : "bg-surface-50/98 backdrop-blur-sm border-b border-surface-200/60"
      }`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-[68px]">

          {/* ── Brand Wordmark ───────────────────────────── */}
          <Link to="/" onClick={closeMenu} className="flex items-center gap-3 group shrink-0">
            {/* Logo mark */}
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-float-sm group-hover:shadow-brand-glow transition-shadow duration-300">
              <span className="text-white font-black text-lg tracking-tight select-none">A</span>
              {/* Subtle shine */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10 pointer-events-none" />
            </div>

            {/* Wordmark */}
            <div className="flex flex-col leading-none">
              <span className="text-[22px] font-black text-ink-900 tracking-tight leading-none">
                Abdi<span className="text-accent-500">.</span>
              </span>
              <span className="text-[10.5px] font-semibold text-ink-400 tracking-wide mt-0.5 leading-none">
                አብዲ ኦንላይን ሾፒንግ
              </span>
            </div>
          </Link>

          {/* ── Desktop Nav ──────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <span className="px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors block">
                {t("nav.home")}
              </span>
            </NavLink>
            <NavLink to="/products" className={navLinkClass}>
              <span className="px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors block">
                {t("nav.products")}
              </span>
            </NavLink>
          </nav>

          {/* ── Desktop Actions ──────────────────────────── */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              title={language === "en" ? "Switch to Amharic" : "ወደ እንግሊዝኛ ቀይር"}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-surface-300 bg-white hover:bg-surface-100 text-ink-700 text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-card"
            >
              <span className="text-base leading-none">{language === "en" ? "🇬🇧" : "🇪🇹"}</span>
              <span>{language === "en" ? "English" : "አማርኛ"}</span>
              <span className="text-ink-400">·</span>
              <span className="text-brand-600">{language === "en" ? "አማርኛ" : "English"}</span>
            </button>

            {/* Shop Now CTA */}
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-float-sm hover:shadow-brand-glow transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {t("nav.products")}
            </Link>
          </div>

          {/* ── Mobile Actions ───────────────────────────── */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="p-2 rounded-xl text-xs font-bold bg-surface-100 text-ink-800 border border-surface-200 hover:bg-surface-200 transition"
              aria-label="Toggle language"
            >
              {language === "en" ? "🇪🇹 አማ" : "🇬🇧 EN"}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-ink-700 hover:bg-surface-100 transition border border-surface-200 focus:outline-none"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Drawer ────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface-50 border-t border-surface-200 px-4 pt-2 pb-5 space-y-1 shadow-float">
          <NavLink
            to="/"
            end
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700 border border-brand-200/60"
                  : "text-ink-700 hover:bg-surface-100"
              }`
            }
          >
            {t("nav.home")}
          </NavLink>

          <NavLink
            to="/products"
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700 border border-brand-200/60"
                  : "text-ink-700 hover:bg-surface-100"
              }`
            }
          >
            {t("nav.products")}
          </NavLink>

          <div className="pt-3 border-t border-surface-200 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm bg-surface-100 text-brand-700 border border-surface-300 transition hover:bg-surface-200"
            >
              <span>{language === "en" ? "🇬🇧 English" : "🇪🇹 አማርኛ"}</span>
              <span className="text-ink-400">⇄</span>
              <span>{language === "en" ? "አማርኛ" : "English"}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
