import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminGetPayments, adminGetPaymentById, adminVerifyPayment, adminRejectPayment } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';
import { useToast } from '../../hooks/useToast';

export default function AdminPaymentsPage() {
  const { formatPrice } = useLanguage();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters from searchParams
  const statusFilter = searchParams.get('status') || 'all';
  const methodFilter = searchParams.get('method') || 'all';
  const pageFilter = parseInt(searchParams.get('page') || '1', 10);
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || '');

  // Detail Modal State
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Rejection Form State
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectAdminNote, setRejectAdminNote] = useState('');
  const [rejectCustomerMessage, setRejectCustomerMessage] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Load payments list
  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetPayments({
        page: pageFilter,
        limit: 10,
        status: statusFilter,
        method: methodFilter,
        date: dateFilter || null
      });
      setPayments(res.payments || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 10, total_pages: 1 });
    } catch (err) {
      console.error('Failed to load payments:', err);
      setError(err?.message || 'Could not load payments from server.');
    } finally {
      setLoading(false);
    }
  }, [pageFilter, statusFilter, methodFilter, dateFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Preload receipt screenshots in the background so they open instantly when clicked
  useEffect(() => {
    if (Array.isArray(payments)) {
      payments.forEach((p) => {
        if (p.payment_proof_url) {
          const img = new Image();
          img.src = p.payment_proof_url;
        }
      });
    }
  }, [payments]);

  const openPaymentDetail = async (paymentId) => {
    setSelectedPaymentId(paymentId);
    // Instant optimistic modal population
    const existing = payments.find((p) => p.id === paymentId);
    if (existing) {
      setSelectedPayment(existing);
    }
    setDetailLoading(!existing);
    setDetailError(null);
    setActionSuccess(null);
    setShowRejectForm(false);
    setRejectAdminNote('');
    setRejectCustomerMessage('');

    try {
      const data = await adminGetPaymentById(paymentId);
      setSelectedPayment(data);
    } catch (err) {
      console.error('Failed to load payment details:', err);
      if (!existing) {
        setDetailError(err?.message || 'Could not load payment details.');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closePaymentDetail = () => {
    setSelectedPaymentId(null);
    setSelectedPayment(null);
    setDetailError(null);
    setActionSuccess(null);
    setShowRejectForm(false);
  };

  // Verify payment action
  const handleVerify = async () => {
    if (!selectedPayment) return;
    setSubmittingAction(true);
    setDetailError(null);
    setActionSuccess(null);

    try {
      await adminVerifyPayment(selectedPayment.id);
      const msg = 'Payment verified successfully! The associated order is now confirmed and ready for delivery.';
      setActionSuccess(msg);
      toast.success(msg, 'Payment Verified');

      const refreshed = await adminGetPaymentById(selectedPayment.id);
      setSelectedPayment(refreshed);
      loadPayments();
    } catch (err) {
      console.error('Failed to verify payment:', err);
      setDetailError(err?.message || 'Could not verify payment.');
      toast.error(err?.message || 'Could not verify payment.', 'Verification Failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reject payment action
  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setSubmittingAction(true);
    setDetailError(null);
    setActionSuccess(null);

    try {
      await adminRejectPayment(selectedPayment.id, {
        admin_note: rejectAdminNote.trim() || null,
        customer_message: rejectCustomerMessage.trim() || 'Payment could not be verified'
      });
      const msg = 'Payment rejected successfully! Rejection notice sent to customer in "My Orders".';
      setActionSuccess(msg);
      toast.success(msg, 'Payment Rejected');

      setShowRejectForm(false);
      const refreshed = await adminGetPaymentById(selectedPayment.id);
      setSelectedPayment(refreshed);
      loadPayments();
    } catch (err) {
      console.error('Failed to reject payment:', err);
      setDetailError(err?.message || 'Could not reject payment.');
      toast.error(err?.message || 'Could not reject payment.', 'Rejection Failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleStatusFilterChange = (status) => {
    const newParams = new URLSearchParams(searchParams);
    if (status === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', status);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleMethodFilterChange = (method) => {
    const newParams = new URLSearchParams(searchParams);
    if (method === 'all') {
      newParams.delete('method');
    } else {
      newParams.set('method', method);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
  };

  const handleDateApply = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (dateFilter) {
      newParams.set('date', dateFilter);
    } else {
      newParams.delete('date');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleDateClear = () => {
    setDateFilter('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('date');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-100 text-ink-600 border border-surface-200">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const getMethodBadge = (method) => {
    if (method === 'telebirr') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
          <svg className="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Telebirr
        </span>
      );
    }
    if (method === 'cbe') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
          <span className="w-2 h-2 rounded-full bg-purple-600" />
          CBE (ንግድ ባንክ)
        </span>
      );
    }
    if (method === 'abyssinia') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
          <span className="w-2 h-2 rounded-full bg-amber-600" />
          Bank of Abyssinia
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Cash on Delivery
      </span>
    );
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const statusTabList = [
    { id: 'all', label: 'All Payments' },
    { id: 'pending', label: 'Pending' },
    { id: 'verified', label: 'Verified' },
    { id: 'rejected', label: 'Rejected' }
  ];

  const methodTabList = [
    { id: 'all', label: 'All Methods' },
    { id: 'telebirr', label: 'Telebirr' },
    { id: 'cbe', label: 'CBE (ንግድ ባንክ)' },
    { id: 'abyssinia', label: 'Abyssinia' },
    { id: 'cash', label: 'Cash on Delivery' }
  ];

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-10">
      {/* ── TOP PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight">
            Payments Management
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            Review Telebirr proof screenshots, verify receipts, and maintain transaction logs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-bold text-ink-700 shadow-sm transition cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-surface-200/80 p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-100/80 p-1 rounded-xl border border-surface-200/50">
            {statusTabList.map((t) => {
              const active = statusFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleStatusFilterChange(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-white text-ink-950 shadow-sm'
                      : 'text-ink-600 hover:text-ink-950'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Method Filter + Date Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Method Tabs */}
            <div className="flex items-center gap-1 bg-surface-100/80 p-1 rounded-xl border border-surface-200/50">
              {methodTabList.map((m) => {
                const active = methodFilter === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMethodFilterChange(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      active
                        ? 'bg-white text-ink-950 shadow-sm'
                        : 'text-ink-600 hover:text-ink-950'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Date Picker Filter */}
            <form onSubmit={handleDateApply} className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-surface-300 text-xs font-medium text-ink-800 bg-white outline-none focus:border-brand-500 shadow-sm"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-ink-900 hover:bg-ink-800 text-white text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Apply
              </button>
              {dateFilter && (
                <button
                  type="button"
                  onClick={handleDateClear}
                  className="px-2.5 py-1.5 rounded-xl border border-surface-300 text-ink-600 hover:text-ink-900 text-xs font-bold transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Server Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button type="button" onClick={loadPayments} className="text-xs font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── PAYMENTS TABLE CARD ── */}
      <div className="bg-white rounded-2xl border border-surface-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-ink-400">Loading payment transactions...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 text-ink-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-ink-900">No payment records found</h3>
            <p className="text-xs text-ink-500">
              {statusFilter !== 'all' || methodFilter !== 'all' || dateFilter
                ? 'No payments match your currently selected filters. Try changing or clearing filters.'
                : 'Customer payment submissions will appear here once orders are placed.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/50 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    <th className="py-3.5 px-6">Order Reference</th>
                    <th className="py-3.5 px-6">Customer</th>
                    <th className="py-3.5 px-6">Payment Method</th>
                    <th className="py-3.5 px-6">Amount</th>
                    <th className="py-3.5 px-6">Review Status</th>
                    <th className="py-3.5 px-6">Recorded At</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-xs">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-mono font-bold text-ink-950 bg-surface-100 px-2 py-0.5 rounded-md border border-surface-200/60">
                          {p.order_number}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-ink-900">{p.customer_name || 'Customer'}</div>
                        <div className="text-[11px] text-ink-400 mt-0.5">{p.customer_phone || '-'}</div>
                      </td>
                      <td className="py-4 px-6">
                        {getMethodBadge(p.method)}
                      </td>
                      <td className="py-4 px-6 font-black text-brand-700 text-sm">
                        {formatPrice(p.amount)}
                      </td>
                      <td className="py-4 px-6">
                        {getPaymentStatusBadge(p.status)}
                      </td>
                      <td className="py-4 px-6 text-ink-500 font-medium">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => openPaymentDetail(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-100 text-ink-800 text-xs font-bold transition cursor-pointer shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-surface-100">
              {payments.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-ink-950 text-xs bg-surface-100 px-2 py-0.5 rounded-md border border-surface-200/60">
                      {p.order_number}
                    </span>
                    {getPaymentStatusBadge(p.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-ink-900">{p.customer_name || 'Customer'}</p>
                      <p className="text-[11px] text-ink-400">{p.customer_phone || ''}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <div>{getMethodBadge(p.method)}</div>
                      <span className="font-black text-brand-700 text-sm block">
                        {formatPrice(p.amount)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPaymentDetail(p.id)}
                    className="w-full py-2 rounded-xl border border-surface-200 text-center text-xs font-bold text-ink-800 hover:bg-surface-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Review Payment Details</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 sm:p-5 border-t border-surface-100 flex items-center justify-between">
              <span className="text-xs text-ink-400 font-medium">
                Showing {payments.length} of {pagination.total} payments (Page {pagination.page} of {pagination.total_pages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3.5 py-1.5 rounded-xl border border-surface-200 text-xs font-bold text-ink-700 hover:bg-surface-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                  className="px-3.5 py-1.5 rounded-xl border border-surface-200 text-xs font-bold text-ink-700 hover:bg-surface-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── PAYMENT DETAIL MODAL ── */}
      {selectedPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={closePaymentDetail} />

          {/* Modal Container */}
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-float border border-surface-200/80 overflow-hidden my-8 z-10 animate-fade-up max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-surface-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-ink-950">
                    Payment Review
                  </h2>
                  <span className="font-mono font-bold text-xs bg-surface-100 px-2 py-0.5 rounded-md border border-surface-200/60 text-ink-700">
                    {selectedPayment?.order_number || '-'}
                  </span>
                </div>
                <p className="text-xs text-ink-500 mt-0.5">
                  Verify transaction authenticity before confirming order fulfillment
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentDetail}
                className="p-2 rounded-xl text-ink-400 hover:bg-surface-100 hover:text-ink-800 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Persistent Top Notification Banner */}
            {actionSuccess && (
              <div className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm shrink-0 animate-in fade-in duration-150 border-b border-emerald-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white text-[11px] font-black shrink-0">
                    ✓
                  </span>
                  <span className="truncate">{actionSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSuccess(null)}
                  className="text-white/80 hover:text-white text-xs font-bold cursor-pointer ml-2 shrink-0 p-1 hover:bg-white/10 rounded"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-surface-50/30">
              {detailLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-ink-400">Loading payment details...</p>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {detailError}
                </div>
              ) : selectedPayment ? (
                <>
                  {/* Action Success Alert */}
                  {actionSuccess && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{actionSuccess}</span>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white border border-surface-200/80 shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Method</span>
                      <div>{getMethodBadge(selectedPayment.method)}</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-surface-200/80 shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Amount</span>
                      <span className="text-sm font-black text-brand-700">{formatPrice(selectedPayment.amount)}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-surface-200/80 shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Status</span>
                      <div>{getPaymentStatusBadge(selectedPayment.status)}</div>
                    </div>
                  </div>

                  {/* Customer Information Card */}
                  {selectedPayment.customer && (
                    <div className="p-4 rounded-2xl bg-white border border-surface-200/80 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-ink-400 text-[11px] font-bold uppercase tracking-wider">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Customer Details</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-ink-400 block">Name</span>
                          <span className="font-bold text-ink-900">{selectedPayment.customer.name}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-ink-400 block">Phone</span>
                          <span className="font-bold text-ink-900">{selectedPayment.customer.phone}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-ink-400 block">Delivery Address</span>
                          <span className="font-bold text-ink-900">{selectedPayment.customer.address}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PAYMENT PROOF SCREENSHOT (Telebirr, CBE, Abyssinia, and Cash advance deposit) */}
                  {(selectedPayment.payment_proof_url || ['telebirr', 'cbe', 'abyssinia'].includes(selectedPayment.method)) && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          {selectedPayment.method === 'cash' ? '200 ETB Advance Deposit Receipt' : 'Payment Proof Screenshot'}
                        </span>
                        {selectedPayment.payment_proof_url && (
                          <a
                            href={selectedPayment.payment_proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                          >
                            <span>Open in Full Size</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>

                      {selectedPayment.payment_proof_url ? (
                        <div className="rounded-2xl border border-surface-200 bg-surface-900/5 p-3 overflow-hidden">
                          <img
                            src={selectedPayment.payment_proof_url}
                            alt="Payment Proof"
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            className="w-full max-h-96 object-contain rounded-xl mx-auto shadow-sm bg-white"
                          />
                        </div>
                      ) : (
                        <div className="p-8 rounded-2xl bg-white border border-dashed border-surface-300 text-center text-xs text-ink-400 font-medium">
                          No screenshot file was submitted with this payment.
                        </div>
                      )}
                    </div>
                  )}

                  {/* CASH ON DELIVERY INFORMATION */}
                  {selectedPayment.method === 'cash' && (
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-xs font-medium text-amber-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Cash on Delivery (200 ETB Advance Deposit)</span>
                      </div>
                      <p className="text-[11px] text-amber-700 pl-5">
                        Customer transferred a 200 ETB advance security deposit. Verify the deposit screenshot above. The remaining order balance will be collected in cash upon doorstep delivery.
                      </p>
                    </div>
                  )}

                  {/* EXISTING ADMIN NOTE / CUSTOMER MESSAGE */}
                  {selectedPayment.admin_note && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Internal Admin Note (Private)</span>
                      </div>
                      <p className="text-slate-600 pl-5">{selectedPayment.admin_note}</p>
                    </div>
                  )}

                  {selectedPayment.customer_message && (
                    <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800">
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span>Customer Rejection Reason (Visible to Customer)</span>
                      </div>
                      <p className="text-rose-700 pl-5">{selectedPayment.customer_message}</p>
                    </div>
                  )}

                  {/* REJECTION FORM */}
                  {showRejectForm && (
                    <form onSubmit={handleReject} className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-4 animate-fade-in">
                      <div>
                        <h4 className="text-xs font-black text-rose-900 tracking-tight flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Reject This Payment
                        </h4>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Please provide the context for this rejection below:
                        </p>
                      </div>

                      {/* Internal Admin Note */}
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-ink-700 mb-1">
                          <svg className="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>Internal Admin Note (Private — NEVER shown to customer)</span>
                        </label>
                        <input
                          type="text"
                          value={rejectAdminNote}
                          onChange={(e) => setRejectAdminNote(e.target.value)}
                          placeholder="e.g. Transaction code does not match Telebirr statement"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300/80 bg-white text-xs outline-none focus:border-rose-500 text-ink-900 shadow-sm"
                        />
                      </div>

                      {/* Customer Message */}
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-ink-700 mb-1">
                          <svg className="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                          <span>Customer Notice (Public — shown in customer order tracker)</span>
                        </label>
                        <input
                          type="text"
                          value={rejectCustomerMessage}
                          onChange={(e) => setRejectCustomerMessage(e.target.value)}
                          placeholder="e.g. Screenshot unreadable or incomplete. Please contact support to resubmit."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300/80 bg-white text-xs outline-none focus:border-rose-500 text-ink-900 shadow-sm"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowRejectForm(false)}
                          disabled={submittingAction}
                          className="px-3.5 py-2 rounded-xl border border-surface-300 bg-white text-ink-700 text-xs font-bold hover:bg-surface-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingAction}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                          {submittingAction ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer Action Buttons */}
            <div className="p-4 sm:p-5 border-t border-surface-100 bg-white flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={closePaymentDetail}
                className="px-4 py-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-bold text-ink-700 transition cursor-pointer shadow-sm"
              >
                Close
              </button>

              {/* Verify / Reject buttons available when pending */}
              {selectedPayment && selectedPayment.status === 'pending' && !showRejectForm && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    disabled={submittingAction}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                  >
                    Reject Payment
                  </button>
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={submittingAction}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{submittingAction ? 'Verifying...' : 'Verify Payment'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
