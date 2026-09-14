import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export default function AdminLoginPage() {
  const { isAuthenticated, login, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // If already authenticated in memory, redirect to admin
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your admin email address.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your admin password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(cleanEmail, password);
      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Admin login error:', err);
      const message =
        err?.data?.message ||
        err?.message ||
        'Invalid admin credentials. Please verify your email and password.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 font-sans antialiased flex flex-col lg:flex-row">
      {/* ── LEFT BRAND PANEL (Desktop) ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-ink-950 text-white relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top brand */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-lg shadow-brand-glow">
              A
            </div>
            <div>
              <span className="font-black text-xl tracking-tight block text-white">Abdela</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-400 block -mt-1">
                Online Shop
              </span>
            </div>
          </Link>
        </div>

        {/* Central editorial content */}
        <div className="relative z-10 max-w-md my-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Store Management System
          </div>
          <h1 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
            Centralized operations for orders, payments & catalog.
          </h1>
          <p className="text-sm text-surface-300 leading-relaxed font-normal">
            Real-time management portal for Abdela customer fulfillment in Dessie and across Ethiopia.
          </p>

          <div className="pt-4 space-y-3.5 text-xs text-surface-300">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-brand-300 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Live order dispatch and customer tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-brand-300 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Telebirr payment proof review & Cash on Delivery</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-brand-300 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Bilingual product catalog & inventory control</span>
            </div>
          </div>
        </div>

        {/* Bottom footer notice */}
        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-[11px] text-surface-400">
          <span>Protected Administrator Access</span>
          <span className="font-mono">v2.0 • Production</span>
        </div>
      </div>

      {/* ── RIGHT LOGIN FORM PANEL ── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16">
        {/* Mobile top branding */}
        <div className="lg:hidden flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              A
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-ink-950 block leading-tight">Abdela</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-600 block">Admin Portal</span>
            </div>
          </Link>

          <Link
            to="/"
            className="text-xs font-semibold text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            Storefront →
          </Link>
        </div>

        {/* Centered Login Card */}
        <div className="max-w-md w-full mx-auto my-auto py-6">
          <div className="mb-8">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200/60 inline-block mb-3">
              Secure Sign In
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight">
              Admin Portal
            </h2>
            <p className="text-xs sm:text-sm text-ink-500 mt-1.5 leading-relaxed">
              Enter your authorized email and password to manage store operations.
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-xs font-medium text-rose-800 flex items-start gap-3">
              <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 leading-relaxed">
                <strong className="font-bold block text-rose-900">Authentication Failed</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  disabled={submitting}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-300 focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-xs sm:text-sm font-medium text-ink-950 placeholder:text-ink-400 bg-white transition outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-ink-800">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-bold text-ink-500 hover:text-ink-900 transition cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={submitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-surface-300 focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-xs sm:text-sm font-medium text-ink-950 placeholder:text-ink-400 bg-white transition outline-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-ink-950 hover:bg-ink-900 active:scale-[0.99] text-white font-bold text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Sign In to Dashboard</span>
                )}
              </button>
            </div>
          </form>

          {/* Privacy Note */}
          <p className="mt-5 text-center text-[11px] text-ink-400">
            For privacy, admin credentials are required upon every new browser session or page reload.
          </p>
        </div>

        {/* Bottom Links */}
        <div className="pt-6 text-center">
          <Link
            to="/"
            className="text-xs font-bold text-ink-600 hover:text-ink-950 transition inline-flex items-center gap-1.5"
          >
            ← Return to Customer Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
