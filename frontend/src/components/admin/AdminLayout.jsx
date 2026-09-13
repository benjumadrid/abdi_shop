import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import AdminAI from './AdminAI';
import AdminSecurityModal from './AdminSecurityModal';

export default function AdminLayout() {
  const { admin, isAuthenticated, loading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  // Close mobile sidebar on route change
  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  // Loading screen while verifying existing session
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/10 text-brand-600 flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-ink-800">Verifying Admin Session</h2>
        <p className="text-xs text-ink-500 mt-1">Please wait a moment...</p>
      </div>
    );
  }

  // If not authenticated, redirect to /admin/login
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const navItems = [
    {
      to: '/admin',
      end: true,
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      to: '/admin/orders',
      end: false,
      label: 'Orders',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      )
    },
    {
      to: '/admin/payments',
      end: false,
      label: 'Payments',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      to: '/admin/products',
      end: false,
      label: 'Products',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col md:flex-row text-ink-950 font-sans antialiased">
      {/* ── MOBILE BACKDROP ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-ink-950/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── SIDEBAR NAVIGATION ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-200/80 flex flex-col justify-between transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:w-64 shrink-0 ${
          mobileOpen ? 'translate-x-0 shadow-float' : '-translate-x-full'
        }`}
      >
        {/* Top Logo / Brand */}
        <div>
          <div className="h-16 px-5 border-b border-surface-200/70 flex items-center justify-between">
            <Link to="/admin" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-ink-950 flex items-center justify-center text-white font-black text-sm shadow-2xs">
                A
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-ink-950 leading-none">
                    Abdi
                  </span>
                  <span className="text-[10px] font-semibold text-ink-400">
                    Store
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-accent-600 mt-0.5">
                  Admin Portal
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-ink-400 hover:bg-surface-100 hover:text-ink-800 transition"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="text-[10px] font-bold text-ink-400 uppercase tracking-widest px-3 py-1.5">
              Management
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-ink-950 text-white shadow-2xs font-bold'
                      : 'text-ink-600 hover:text-ink-950 hover:bg-surface-100/80'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}

            <div className="pt-3 mt-3 border-t border-surface-200/70">
              <div className="text-[10px] font-bold text-ink-400 uppercase tracking-widest px-3 py-1.5">
                Customer View
              </div>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-ink-600 hover:text-ink-950 hover:bg-surface-100/80 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-ink-400 group-hover:text-ink-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>View Shop</span>
                </div>
                <span className="text-[10px] text-ink-400 group-hover:text-ink-700">↗</span>
              </a>
            </div>
          </nav>
        </div>

        {/* Bottom User Area & Logout */}
        <div className="p-3 border-t border-surface-200/70 bg-surface-50/60">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-600/10 text-brand-700 font-bold flex items-center justify-center text-xs shrink-0 border border-brand-200/50">
              {(admin?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink-950 truncate leading-tight">
                {admin?.name || 'Administrator'}
              </p>
              <p className="text-[10px] text-ink-400 truncate">
                {admin?.email || 'admin'}
              </p>
            </div>
          </div>

          {/* Account & Security Button */}
          <button
            type="button"
            onClick={() => setSecurityModalOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 mb-1.5 rounded-lg bg-white hover:bg-brand-50/80 border border-surface-200/80 hover:border-brand-300 text-ink-700 hover:text-brand-700 transition-all cursor-pointer group shadow-2xs"
            title="Change login email and private password"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xs font-semibold truncate">Account & Security</span>
            </div>
            <span className="text-[10px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Edit →</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-600 hover:text-rose-600 hover:bg-rose-50/60 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-surface-200/70 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-ink-600 hover:bg-surface-100 cursor-pointer"
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
              <span className="hidden sm:inline">Abdi Back-Office</span>
              <span className="hidden sm:inline text-ink-300">/</span>
              <span className="text-ink-950 font-semibold capitalize">
                {location.pathname === '/admin' ? 'Dashboard' : location.pathname.replace('/admin/', '')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Header Account & Security Button */}
            <button
              type="button"
              onClick={() => setSecurityModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-surface-200 hover:border-brand-300 text-xs font-semibold text-ink-700 hover:text-brand-600 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              title="Change email and password"
            >
              <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="hidden sm:inline">Account & Security</span>
            </button>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-[11px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live System</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Global Admin AI Assistant Copilot */}
        <AdminAI />

        {/* Account & Security Modal */}
        <AdminSecurityModal
          isOpen={securityModalOpen}
          onClose={() => setSecurityModalOpen(false)}
        />
      </div>
    </div>
  );
}
