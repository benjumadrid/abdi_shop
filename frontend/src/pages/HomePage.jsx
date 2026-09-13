import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { getProducts, getCachedProducts, subscribeToStoreUpdates } from "../services/api";
import ProductCard from "../components/common/ProductCard";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import Button from "../components/common/Button";
import MyOrdersSection from "../components/common/MyOrdersSection";
import onlineImg from "../assets/online.jpg";

/* ================================================================
   ANIMATED HERO SECTION
================================================================ */
function HeroSection({ onShopNow, t }) {
  return (
    <section className="relative overflow-hidden pt-10 sm:pt-14 pb-20 sm:pb-24 lg:pt-14 lg:pb-28 flex items-center">

      {/* ── Deep layered background ─────────────────────── */}
      {/* Base dark-to-brand gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-brand-950 to-brand-900" />
      {/* Mesh grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-accent-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-brand-400/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 lg:py-4 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-6 items-center">

          {/* ── LEFT: Text Content ──────────────────────── */}
          <div
            className="text-center lg:text-left space-y-7 max-w-2xl mx-auto lg:mx-0"
            style={{ animation: "heroFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            {/* Live pill badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-brand-200 text-xs font-bold tracking-wider backdrop-blur-md shadow-lg">
              <span className="flex h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
              <span>{t("hero.badge")}</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-5xl sm:text-6xl lg:text-[68px] font-black tracking-tight leading-[1.06]">
                <span className="text-white">{t("hero.titleStart")}</span>
                <br />
                <span
                  style={{
                    background: "linear-gradient(135deg, #38b582 0%, #f9c23a 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {t("hero.titleHighlight")}
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-surface-300 leading-relaxed max-w-md mx-auto lg:mx-0">
              {t("hero.description")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-1">
              <button
                onClick={onShopNow}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-ink-950 shadow-accent-glow hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                style={{ background: "linear-gradient(135deg, #f9c23a, #f5a800)" }}
              >
                <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {t("hero.shopNow")}
              </button>

              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl border border-white/20 bg-white/10 text-white font-semibold text-base hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
              >
                {t("hero.howItWorks")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>

            {/* Stats Strip */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center lg:text-left">
              {[
                { val: t("hero.stats.authentic"), label: t("hero.stats.authenticDesc") },
                { val: t("hero.stats.delivery"),  label: t("hero.stats.deliveryDesc") },
                { val: t("hero.stats.payments"),  label: t("hero.stats.paymentsDesc") },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center lg:items-start">
                  <span className="text-base sm:text-lg font-extrabold text-white leading-tight">{s.val}</span>
                  <span className="text-[11px] text-surface-400 font-medium mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Floating shopping image ─────────── */}
          <div
            className="relative flex items-center justify-center lg:justify-end"
            style={{ animation: "heroFloatIn 1s cubic-bezier(0.22,1,0.36,1) 0.2s both" }}
          >
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{ background: "radial-gradient(circle, #38b582 0%, transparent 70%)" }}
            />

            {/* Image container — floating animation */}
            <div
              className="relative z-10 rounded-3xl overflow-hidden shadow-float border border-white/10"
              style={{
                animation: "floatUpDown 4s ease-in-out infinite",
                maxWidth: "440px",
                width: "100%",
              }}
            >
              <img
                src={onlineImg}
                alt="Abdi Online Shopping"
                className="w-full h-auto object-cover"
                draggable={false}
              />

              {/* Glass badge — Order confirmed floating chip */}
              <div
                className="absolute top-5 left-5 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl backdrop-blur-md bg-white/90 shadow-float-sm border border-white/60"
                style={{ animation: "floatUpDown 3s ease-in-out 0.5s infinite" }}
              >
                <span className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white text-sm font-black">✓</span>
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-black text-ink-900">Order Placed!</span>
                  <span className="text-[10px] text-brand-700 font-semibold">Dessie Delivery</span>
                </div>
              </div>

              {/* Glass badge — Telebirr chip */}
              <div
                className="absolute bottom-8 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md bg-white/90 shadow-float-sm border border-white/60"
                style={{ animation: "floatUpDown 3.5s ease-in-out 1s infinite" }}
              >
                <span className="w-6 h-6 rounded-lg bg-[#005fb2] text-white flex items-center justify-center font-black text-[10px]">TB</span>
                <span className="text-[11px] font-bold text-ink-900">Telebirr Ready</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom wave divider */}
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none">
        <svg viewBox="0 0 1440 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M0 64L1440 64L1440 24C1200 64 960 0 720 0C480 0 240 64 0 24L0 64Z" fill="#f8f6f1" />
        </svg>
      </div>
    </section>
  );
}

/* ================================================================
   VALUE PROPOSITIONS
================================================================ */
const FEATURE_ICONS = {
  quality: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  ordering: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  payments: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  delivery: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  ),
};

function FeaturesSection({ t }) {
  const features = t("features.items");
  return (
    <section id="why-abdi" className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <span className="inline-flex text-xs font-extrabold text-brand-700 uppercase tracking-widest px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200/70 mb-3 sm:mb-4">
          {t("features.badge")}
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-black text-ink-900 tracking-tight">
          {t("features.title")}
        </h2>
        <p className="text-sm sm:text-base text-ink-500 mt-3 leading-relaxed">{t("features.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-7">
        {features.map((feature, i) => (
          <div
            key={feature.id}
            className="relative bg-white rounded-3xl border border-surface-200/90 p-7 sm:p-8 min-h-[250px] sm:min-h-[270px] shadow-card hover:shadow-card-lift hover:-translate-y-1.5 hover:border-brand-500/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
          >
            <span className="absolute top-4 right-5 text-7xl sm:text-8xl font-black text-surface-100/90 leading-none select-none group-hover:text-brand-50 transition-colors">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-brand-50 border border-brand-100 text-brand-700 flex items-center justify-center mb-5 sm:mb-6 shadow-sm relative z-10">
                {FEATURE_ICONS[feature.id]}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-ink-900 mb-2 sm:mb-3 relative z-10 leading-snug">{feature.title}</h3>
              <p className="text-xs sm:text-[13.5px] text-ink-500 leading-relaxed relative z-10">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ================================================================
   HOW IT WORKS — dark section
================================================================ */
function HowItWorksSection({ t }) {
  const steps = t("howItWorks.steps");
  return (
    <section id="how-it-works" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-surface-950 to-brand-950" />
      <div className="absolute top-0 right-1/3 w-96 h-72 bg-brand-800/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-accent-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-16 sm:py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-600/30 mb-4">
            {t("howItWorks.badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {t("howItWorks.title")}
          </h2>
          <p className="text-sm text-surface-400 mt-3 leading-relaxed">{t("howItWorks.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative">
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[55%] w-[90%] h-px bg-gradient-to-r from-brand-700/60 to-transparent z-0" />
              )}
              <div className="relative bg-white/5 border border-white/10 rounded-3xl p-7 backdrop-blur-sm hover:bg-white/8 transition-colors z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-black text-xl flex items-center justify-center shadow-brand-glow mb-6">
                  {step.number}
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   CTA BANNER
================================================================ */
function CTASection({ onShopNow, t }) {
  return (
    <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="relative rounded-4xl overflow-hidden bg-gradient-to-r from-brand-800 via-brand-700 to-brand-900 p-10 sm:p-14 lg:p-16 text-center shadow-float">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-ink-950/40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-xl mx-auto space-y-5">
          <span className="inline-flex text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full bg-white/10 text-accent-300 border border-white/10">
            {t("cta.badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            {t("cta.title")}
          </h2>
          <p className="text-sm sm:text-base text-brand-100/80 leading-relaxed">
            {t("cta.description")}
          </p>
          <div className="pt-2">
            <button
              onClick={onShopNow}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base text-ink-950 shadow-accent-glow hover:scale-[1.03] transition-all duration-200"
              style={{ background: "linear-gradient(135deg, #f9c23a, #f5a800)" }}
            >
              {t("cta.button")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   PAGE ROOT
================================================================ */
export default function HomePage() {
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
      console.error("Failed to load products:", err);
      if (!silent && (!getCachedProducts() || getCachedProducts().length === 0)) {
        setError(err.message || "Could not connect to store.");
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

  const scrollToProducts = () => {
    const el = document.getElementById("featured-products");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFloatIn {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatUpDown {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
      `}</style>

      {/* 1. Hero */}
      <HeroSection onShopNow={scrollToProducts} t={t} />

      <div className="space-y-12 sm:space-y-16 md:space-y-20 pb-24">
        {/* 2. Featured Products */}
        <section id="featured-products" className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-2 sm:pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <span className="inline-flex text-xs font-extrabold text-brand-700 uppercase tracking-widest px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200/70 mb-2">
                {t("products.badge")}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-black text-ink-900 tracking-tight">
                {t("products.title")}
              </h2>
              <p className="text-sm sm:text-base text-ink-500 mt-1">{t("products.subtitle")}</p>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-brand-700 hover:text-brand-800 transition shrink-0 self-start sm:self-auto group"
            >
              {t("products.viewAll")}
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {loading && <LoadingSkeleton count={4} />}

          {error && !loading && (
            <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center max-w-md mx-auto shadow-card">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-1">{t("products.errorTitle")}</h3>
              <p className="text-xs text-ink-500 mb-6">{t("products.errorDesc")}</p>
              <Button size="sm" variant="primary" onClick={fetchProducts}>{t("products.retry")}</Button>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="bg-white rounded-3xl border border-surface-200 p-14 text-center max-w-md mx-auto shadow-card">
              <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-1">{t("products.emptyTitle")}</h3>
              <p className="text-xs text-ink-500">{t("products.emptyDesc")}</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-7">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* 3. Features */}
        <FeaturesSection t={t} />

        {/* 4. How It Works */}
        <HowItWorksSection t={t} />

        {/* 5. My Orders / Order History */}
        <MyOrdersSection />

        {/* 6. CTA */}
        <CTASection onShopNow={scrollToProducts} t={t} />
      </div>
    </>
  );
}
