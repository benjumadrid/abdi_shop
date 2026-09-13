import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';

export default function MaintenancePage() {
  const { language, toggleLanguage, t } = useLanguage();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = () => {
    setChecking(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-50 via-surface-100/40 to-surface-50 flex flex-col justify-between text-ink-900 selection:bg-brand-500 selection:text-white">
      {/* ── Top Bar ───────────────────────────────────────────── */}
      <header className="w-full border-b border-surface-200/80 bg-surface-50/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-float-sm">
              <span className="text-white font-black text-base tracking-tight select-none">A</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10 pointer-events-none" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black text-ink-900 tracking-tight leading-none">
                Abdi<span className="text-accent-500">.</span>
              </span>
              <span className="text-[10px] font-semibold text-ink-400 tracking-wide mt-0.5 leading-none">
                አብዲ ኦንላይን ሾፒንግ
              </span>
            </div>
          </div>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-200 bg-surface-50 hover:bg-surface-100 text-xs font-semibold text-ink-700 transition-colors shadow-xs"
            aria-label="Switch Language"
          >
            <span className="text-sm">🌐</span>
            <span>{language === 'en' ? 'አማርኛ' : 'English'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Container ────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 md:py-16">
        <div className="w-full max-w-2xl mx-auto text-center">
          {/* Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-800 text-xs sm:text-sm font-semibold mb-6 shadow-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
            <span>{t('maintenance.statusBadge')}</span>
          </div>

          {/* Hero Illustration Icon */}
          <div className="mx-auto mb-6 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-brand-50 to-accent-50/50 border border-brand-200/60 flex items-center justify-center shadow-float-sm">
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-brand-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>

          {/* Main Headings */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-ink-900 tracking-tight leading-tight mb-4">
            {t('maintenance.title')}
          </h1>

          <p className="text-base sm:text-lg text-ink-600 leading-relaxed max-w-xl mx-auto mb-8 font-medium">
            {t('maintenance.subtitle')}
          </p>

          {/* Reassurance Card */}
          <div className="bg-white rounded-2xl border border-surface-200/80 p-5 sm:p-6 mb-8 text-left shadow-float-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-lg">
              🚚
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-900 mb-1">
                {t('maintenance.reassuranceTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                {t('maintenance.reassuranceDesc')}
              </p>
            </div>
          </div>

          {/* Support / Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8 text-left">
            {/* Phone Support */}
            <a
              href="tel:+251931862253"
              className="bg-white hover:bg-brand-50/50 p-4 rounded-xl border border-surface-200/80 hover:border-brand-300 transition-all group flex flex-col justify-between shadow-xs"
            >
              <div className="flex items-center gap-2 text-ink-400 group-hover:text-brand-600 transition-colors mb-2">
                <span className="text-base">📞</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  {t('maintenance.phoneLabel')}
                </span>
              </div>
              <span className="text-sm font-bold text-ink-900 group-hover:text-brand-600 transition-colors">
                {t('maintenance.phoneValue')}
              </span>
            </a>

            {/* Operating Hours */}
            <div className="bg-white p-4 rounded-xl border border-surface-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2 text-ink-400 mb-2">
                <span className="text-base">🕒</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  {t('maintenance.hoursLabel')}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-ink-800 leading-tight">
                {t('maintenance.hoursValue')}
              </span>
            </div>

            {/* Location */}
            <div className="bg-white p-4 rounded-xl border border-surface-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2 text-ink-400 mb-2">
                <span className="text-base">📍</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  {t('maintenance.locationLabel')}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-ink-800 leading-tight">
                {t('maintenance.locationValue')}
              </span>
            </div>
          </div>

          {/* Action Button: Check Status */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-sm shadow-brand-glow hover:shadow-brand-glow-lg transition-all disabled:opacity-60"
            >
              <svg
                className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{checking ? t('maintenance.checking') : t('maintenance.checkStatus')}</span>
            </button>
          </div>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="w-full border-t border-surface-200/80 bg-surface-50 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-500">
          <p>{t('maintenance.copyright')}</p>

          {/* Direct Admin Login Link */}
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 text-ink-500 hover:text-brand-600 transition-colors font-medium hover:underline"
          >
            <span>🔐</span>
            <span>{t('maintenance.adminAccess')}</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
