import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminGetOrders } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';

function getCleanDeliveryNote(rawNote) {
  if (!rawNote || typeof rawNote !== 'string') return null;
  const cleaned = rawNote
    .replace(/^\[Payment:\s*[^\]]+\]\s*/i, '')
    .replace(/^\(Payment:\s*[^)]+\)\s*/i, '')
    .trim();
  return cleaned || null;
}

export default function AdminDashboardPage() {
  const { formatPrice } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real backend statistics
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    paymentReviewOrders: 0,
    confirmedOrders: 0
  });

  const [recentOrders, setRecentOrders] = useState([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Query backend for real count metadata in parallel
      const [
        totalRes,
        pendingRes,
        reviewRes,
        confirmedRes,
        recentRes
      ] = await Promise.all([
        adminGetOrders({ limit: 1 }),
        adminGetOrders({ status: 'pending', limit: 1 }),
        adminGetOrders({ status: 'payment_review', limit: 1 }),
        adminGetOrders({ status: 'confirmed', limit: 1 }),
        adminGetOrders({ limit: 5 })
      ]);

      setStats({
        totalOrders: totalRes.pagination?.total || 0,
        pendingOrders: pendingRes.pagination?.total || 0,
        paymentReviewOrders: reviewRes.pagination?.total || 0,
        confirmedOrders: confirmedRes.pagination?.total || 0
      });

      setRecentOrders(recentRes.orders || []);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      setError(err?.message || 'Could not load dashboard data from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Standard status badges
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        );
      case 'payment_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Payment Review
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Confirmed
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-800 border border-violet-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            Out for Delivery
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            Delivered
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Cancelled'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-ink-700 border border-surface-200">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* ── TOP BANNER / HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-surface-200/70">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">
              {getGreeting()}, Abdi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-ink-500">
            Store operations overview • <span className="text-ink-700 font-medium">{todayFormatted}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-semibold text-ink-700 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : 'text-ink-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadDashboardData}
            className="text-xs font-bold underline text-rose-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Orders */}
        <div className="p-5 rounded-xl bg-white border border-surface-200/80 shadow-2xs hover:border-surface-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-ink-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight">
              {loading ? '...' : stats.totalOrders}
            </span>
            <p className="mt-1 text-[11px] text-ink-400 font-medium">
              All lifetime orders recorded
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="p-5 rounded-xl bg-white border border-surface-200/80 shadow-2xs hover:border-amber-200/80 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              Pending Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight">
              {loading ? '...' : stats.pendingOrders}
            </span>
            <p className="mt-1 text-[11px] text-amber-700/80 font-medium">
              Awaiting packaging & dispatch
            </p>
          </div>
        </div>

        {/* Payment Reviews */}
        <div className="p-5 rounded-xl bg-white border border-surface-200/80 shadow-2xs hover:border-sky-200/80 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-800">
              Payment Reviews
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-sky-800 tracking-tight">
              {loading ? '...' : stats.paymentReviewOrders}
            </span>
            <p className="mt-1 text-[11px] text-sky-700/80 font-medium">
              Telebirr receipts to verify
            </p>
          </div>
        </div>

        {/* Confirmed Orders */}
        <div className="p-5 rounded-xl bg-white border border-surface-200/80 shadow-2xs hover:border-emerald-200/80 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">
              Confirmed Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight">
              {loading ? '...' : stats.confirmedOrders}
            </span>
            <p className="mt-1 text-[11px] text-emerald-700/80 font-medium">
              Verified and ready for delivery
            </p>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/admin/products"
            className="p-4 rounded-xl bg-white border border-surface-200/80 hover:border-ink-300 hover:shadow-xs transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-100 group-hover:bg-brand-50 text-ink-700 group-hover:text-brand-700 transition flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-950 group-hover:text-brand-700 transition">Manage Products</p>
                <p className="text-[11px] text-ink-400">Add or edit catalog</p>
              </div>
            </div>
            <span className="text-ink-400 group-hover:text-ink-700 transition text-sm">→</span>
          </Link>

          <Link
            to="/admin/payments?status=pending"
            className="p-4 rounded-xl bg-white border border-surface-200/80 hover:border-ink-300 hover:shadow-xs transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-100 group-hover:bg-sky-50 text-ink-700 group-hover:text-sky-700 transition flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-950 group-hover:text-sky-700 transition">Review Payments</p>
                <p className="text-[11px] text-ink-400">Verify Telebirr proofs</p>
              </div>
            </div>
            <span className="text-ink-400 group-hover:text-ink-700 transition text-sm">→</span>
          </Link>

          <Link
            to="/admin/orders"
            className="p-4 rounded-xl bg-white border border-surface-200/80 hover:border-ink-300 hover:shadow-xs transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-100 group-hover:bg-amber-50 text-ink-700 group-hover:text-amber-700 transition flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-950 group-hover:text-amber-700 transition">View Orders</p>
                <p className="text-[11px] text-ink-400">Fulfill customer orders</p>
              </div>
            </div>
            <span className="text-ink-400 group-hover:text-ink-700 transition text-sm">→</span>
          </Link>
        </div>
      </div>

      {/* ── RECENT ORDERS ── */}
      <div className="bg-white rounded-xl border border-surface-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-200/70 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink-950">Recent Orders</h2>
            <p className="text-xs text-ink-400 mt-0.5">Latest customer orders submitted to the store</p>
          </div>
          <Link
            to="/admin/orders"
            className="text-xs font-bold text-brand-700 hover:text-brand-800 transition inline-flex items-center gap-1"
          >
            View All Orders →
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-ink-400 text-xs font-medium">
            <svg className="w-5 h-5 animate-spin mx-auto mb-2 text-ink-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading recent orders...
          </div>
        ) : recentOrders.length === 0 ? (
          /* Polished Empty State */
          <div className="p-10 sm:p-14 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto text-ink-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">No orders yet</h3>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                Orders placed by customers will appear here automatically.
              </p>
            </div>
            <div className="pt-1">
              <Link
                to="/admin/products"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-xs font-semibold text-ink-700 transition shadow-2xs"
              >
                <span>View Products Catalog</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  <th className="py-3 px-5">Order</th>
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Items</th>
                  <th className="py-3 px-5">Total</th>
                  <th className="py-3 px-5">Payment</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {recentOrders.map((order) => {
                  const itemsCount = order.items?.length || 1;
                  const firstItem = order.items?.[0];
                  const activePayment = order.active_payment || (order.payments && order.payments[0]);
                  const isTelebirr = activePayment?.method === 'telebirr' || order.customer_note?.toUpperCase().includes('TELEBIRR');

                  return (
                    <tr key={order.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-ink-950">
                        {order.order_number}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-ink-900 leading-tight">
                          {order.customer?.name || 'Customer'}
                        </div>
                        <div className="text-[11px] text-ink-400 font-mono mt-0.5">
                          {order.customer?.phone || '-'}
                        </div>
                        {getCleanDeliveryNote(order.customer_note) && (
                          <div
                            className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] font-semibold max-w-[200px]"
                            title={`Delivery Note: "${getCleanDeliveryNote(order.customer_note)}"`}
                          >
                            <span className="shrink-0 text-xs">📝</span>
                            <span className="truncate">Note: "{getCleanDeliveryNote(order.customer_note)}"</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-ink-600">
                        {firstItem?.product_name_en ? (
                          <div className="max-w-[160px] truncate" title={firstItem.product_name_en}>
                            {firstItem.product_name_en}
                            {itemsCount > 1 && (
                              <span className="text-ink-400 ml-1">+{itemsCount - 1}</span>
                            )}
                          </div>
                        ) : (
                          <span>{itemsCount} item{itemsCount > 1 ? 's' : ''}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-extrabold text-ink-950">
                        {formatPrice(order.total_amount)}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center text-xs text-ink-700 font-medium">
                          {isTelebirr ? 'Telebirr' : 'Cash on Delivery'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-5 text-ink-500 whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/orders?highlight=${order.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-ink-700 text-xs font-semibold transition shadow-2xs"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
