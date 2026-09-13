import { Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surface-950 text-surface-400 border-t border-surface-900/60 mt-auto relative overflow-hidden">

      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-64 bg-brand-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-48 bg-accent-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

          {/* Col 1: Brand */}
          <div className="lg:col-span-1 space-y-5">
            <Link to="/" className="flex items-center gap-3 group w-fit">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-brand-glow">
                <span className="text-white font-black text-lg">A</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-black text-white tracking-tight">
                  Abdi<span className="text-accent-400">.</span>
                </span>
                <span className="text-[10px] font-semibold text-surface-500 mt-0.5 tracking-wide">
                  አብዲ ኦንላይን ሾፒንግ
                </span>
              </div>
            </Link>

            <p className="text-sm text-surface-500 leading-relaxed max-w-[240px]">
              {t("footer.tagline")}
            </p>

            {/* Social / Contact hint */}
            <div className="flex items-center gap-2 text-sm font-semibold text-surface-300">
              <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="font-mono">{t("footer.supportPhone")}</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-5">
              {t("footer.navigationTitle")}
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/" className="text-surface-400 hover:text-white transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-surface-400 hover:text-white transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {t("nav.products")}
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="text-surface-400 hover:text-white transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {t("hero.howItWorks")}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Customer Care */}
          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-5">
              {t("footer.customerCareTitle")}
            </h4>
            <ul className="space-y-3.5 text-sm">
              <li className="flex items-start gap-3 text-surface-400">
                <svg className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("footer.supportHours")}</span>
              </li>
              <li className="flex items-start gap-3 text-surface-400">
                <svg className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t("footer.location")}</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Payment Methods */}
          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-5">
              {t("footer.paymentMethodsTitle")}
            </h4>
            <div className="space-y-3">
              {/* Telebirr */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface-900/80 border border-surface-800/80 hover:border-brand-800/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#005fb2] flex items-center justify-center font-black text-white text-xs tracking-wider shrink-0 shadow-float-sm">
                  TB
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white">{t("footer.telebirrBadge")}</span>
                  <span className="text-[11px] text-brand-400 font-medium mt-0.5">Mobile Transfer</span>
                </div>
              </div>

              {/* Cash on Delivery */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface-900/80 border border-surface-800/80 hover:border-brand-800/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center shrink-0 shadow-float-sm">
                  <svg className="w-4.5 h-4.5 text-white w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white">{t("footer.cashBadge")}</span>
                  <span className="text-[11px] text-surface-400 font-medium mt-0.5">Pay upon delivery</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-surface-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-surface-600 gap-3">
          <p>© {year} {t("footer.copyright")}</p>
          <p className="text-surface-700">
            Abdi Online Shop &nbsp;·&nbsp; Dessie, Ethiopia
          </p>
        </div>
      </div>
    </footer>
  );
}
