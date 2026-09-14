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
                  Abdela<span className="text-accent-400">.</span>
                </span>
                <span className="text-[10px] font-semibold text-surface-500 mt-0.5 tracking-wide">
                  አብደላ ኦንላይን ሾፒንግ
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
            <ul className="space-y-3 text-sm text-surface-400">
              <li>
                <a
                  href={`tel:${t("footer.supportPhone").replace(/\s/g, "")}`}
                  className="hover:text-white transition-colors font-semibold text-white/90 inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {t("footer.supportPhone")}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("footer.supportHours")}</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t("footer.location")}</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Payment Methods */}
          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-4">
              {t("footer.paymentMethodsTitle")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {/* Telebirr */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-900/80 border border-surface-800/80 hover:border-brand-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#005fb2] flex items-center justify-center font-black text-white text-[11px] tracking-wider shrink-0 shadow-float-sm">
                  TB
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white">{t("footer.telebirrBadge")}</span>
                  <span className="text-[10px] text-brand-400 font-medium">0931862253</span>
                </div>
              </div>

              {/* CBE */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-900/80 border border-surface-800/80 hover:border-purple-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#581C87] flex items-center justify-center shrink-0 shadow-float-sm p-1 border border-purple-500/40">
                  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#F59E0B" strokeWidth="6" strokeDasharray="5.89 5.89" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="41" fill="#F59E0B" />
                    <circle cx="50" cy="50" r="35" fill="#581C87" />
                    <circle cx="50" cy="50" r="32" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
                    <path d="M 64 28 A 20 20 0 1 0 64 72 L 64 64 A 12 12 0 1 1 64 36 Z" fill="#F59E0B" />
                    <rect x="36" y="31" width="6.5" height="38" rx="1" fill="#F59E0B" />
                    <path d="M 42.5 31 H 53.5 C 57.5 31 60.5 33.5 60.5 38 C 60.5 42.5 57.5 45 53.5 45 H 42.5 Z M 48 35.5 V 40.5 H 53 C 54.5 40.5 55.5 39.5 55.5 38 C 55.5 36.5 54.5 35.5 53 35.5 Z" fill="#F59E0B" />
                    <path d="M 42.5 44 H 55 C 59.5 44 62.5 47 62.5 52 C 62.5 57 59.5 60 55 60 H 42.5 Z M 48 48.5 V 55.5 H 54 C 55.8 55.5 57 54 57 52 C 57 50 55.8 48.5 54 48.5 Z" fill="#F59E0B" />
                    <rect x="52" y="46.5" width="13" height="4.5" rx="0.5" fill="#F59E0B" />
                    <rect x="52" y="62.5" width="12" height="4.5" rx="0.5" fill="#F59E0B" />
                  </svg>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white">{t("footer.cbeBadge")}</span>
                  <span className="text-[10px] text-purple-300 font-medium">1000584744573</span>
                </div>
              </div>

              {/* Bank of Abyssinia */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-900/80 border border-surface-800/80 hover:border-amber-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0 shadow-float-sm p-1 border border-amber-500/40">
                  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                    <g transform="translate(50, 50)">
                      {[0, 60, 120, 180, 240, 300].map((deg) => (
                        <g key={deg} transform={`rotate(${deg})`}>
                          <polygon points="0,-46 -13,-23 0,-4.5" fill="#FDE047" />
                          <polygon points="0,-46 13,-23 0,-4.5" fill="#D97706" />
                        </g>
                      ))}
                      <circle cx="0" cy="0" r="3" fill="#D97706" />
                    </g>
                  </svg>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white">{t("footer.abyssiniaBadge")}</span>
                  <span className="text-[10px] text-amber-300 font-medium">251444412</span>
                </div>
              </div>

              {/* Cash on Delivery */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-900/80 border border-surface-800/80 hover:border-emerald-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0 shadow-float-sm">
                  <span className="text-xs">💵</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white">{t("footer.cashBadge")}</span>
                  <span className="text-[10px] text-surface-400 font-medium">200 ETB advance deposit</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-surface-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-surface-600 gap-3">
          <p>© {year} {t("footer.copyright")}</p>
          <p className="text-surface-700">
            Abdela Online Shop &nbsp;·&nbsp; Dessie, Ethiopia
          </p>
        </div>
      </div>
    </footer>
  );
}
