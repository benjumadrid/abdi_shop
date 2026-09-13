import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  adminGetOrders,
  adminGetOrderById,
  adminUpdateOrderStatus,
  adminUpdateOrderNote,
  adminVerifyPayment,
  adminRejectPayment
} from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';
import { useToast } from '../../hooks/useToast';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'payment_review', label: 'Payment Review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
];

function getCleanDeliveryNote(rawNote) {
  if (!rawNote || typeof rawNote !== 'string') return null;
  const cleaned = rawNote
    .replace(/^\[Payment:\s*[^\]]+\]\s*/i, '')
    .replace(/^\(Payment:\s*[^)]+\)\s*/i, '')
    .trim();
  return cleaned || null;
}

export default function AdminOrdersPage() {
  const { formatPrice, isAmharic } = useLanguage();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const statusFilter = searchParams.get('status') || 'all';
  const pageFilter = parseInt(searchParams.get('page') || '1', 10);
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || '');

  // Detail Modal State
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [adminNoteText, setAdminNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [inlineStatusSuccess, setInlineStatusSuccess] = useState(null);
  const [inlinePaymentSuccess, setInlinePaymentSuccess] = useState(null);
  const [inlineNoteSuccess, setInlineNoteSuccess] = useState(null);

  // Payment Verification / Rejection State
  const [submittingPaymentAction, setSubmittingPaymentAction] = useState(false);
  const [showRejectPaymentForm, setShowRejectPaymentForm] = useState(false);
  const [paymentRejectReason, setPaymentRejectReason] = useState('The order payment pic is not real');

  // Load orders list
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetOrders({
        page: pageFilter,
        limit: 10,
        status: statusFilter,
        date: dateFilter || null
      });
      setOrders(res.orders || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 10, total_pages: 1 });
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError(err?.message || 'Could not load orders from server.');
    } finally {
      setLoading(false);
    }
  }, [pageFilter, statusFilter, dateFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Open order detail
  const openOrderDetail = async (orderId) => {
    setSelectedOrderId(orderId);
    setSelectedOrder(null);
    setDetailLoading(true);
    setDetailError(null);
    setActionSuccess(null);
    setInlineStatusSuccess(null);
    setInlinePaymentSuccess(null);
    setInlineNoteSuccess(null);
    setShowRejectPaymentForm(false);
    setPaymentRejectReason('The order payment pic is not real');
    try {
      const data = await adminGetOrderById(orderId);
      if (!data) {
        throw new Error('Order details could not be loaded from server.');
      }
      setSelectedOrder(data);
      setNewStatus(data.status || 'pending');
      setAdminNoteText(data.admin_note || '');
    } catch (err) {
      console.error('Failed to load order detail:', err);
      setDetailError(err?.message || 'Could not load order details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeOrderDetail = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setDetailError(null);
    setActionSuccess(null);
    setInlineStatusSuccess(null);
    setInlinePaymentSuccess(null);
    setInlineNoteSuccess(null);
    setShowRejectPaymentForm(false);
    if (searchParams.get('highlight')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('highlight');
      setSearchParams(newParams);
    }
  };

  // Check URL param highlight
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      openOrderDetail(highlightId);
    }
  }, [searchParams]);

  // Handle verify payment
  const handleVerifyPayment = async (paymentId) => {
    if (!selectedOrder || !paymentId) return;
    setSubmittingPaymentAction(true);
    setDetailError(null);
    setActionSuccess(null);
    setInlinePaymentSuccess(null);

    try {
      await adminVerifyPayment(paymentId);
      const msg = 'Payment verified successfully! The order is now confirmed and ready for delivery.';
      setActionSuccess(msg);
      setInlinePaymentSuccess(msg);
      toast.success(msg, 'Payment Verified');

      const refreshed = await adminGetOrderById(selectedOrder.id);
      setSelectedOrder(refreshed);
      setNewStatus(refreshed.status);
      loadOrders();
    } catch (err) {
      console.error('Failed to verify payment:', err);
      setDetailError(err?.message || 'Could not verify payment.');
      toast.error(err?.message || 'Could not verify payment.', 'Verification Failed');
    } finally {
      setSubmittingPaymentAction(false);
    }
  };

  // Handle reject payment
  const handleRejectPayment = async (e, paymentId) => {
    if (e) e.preventDefault();
    if (!selectedOrder || !paymentId) return;
    setSubmittingPaymentAction(true);
    setDetailError(null);
    setActionSuccess(null);
    setInlinePaymentSuccess(null);

    try {
      await adminRejectPayment(paymentId, {
        customer_message: paymentRejectReason.trim() || 'The order payment pic is not real'
      });
      const msg = 'Payment rejected successfully! Rejection notice is now visible to the customer in "My Orders".';
      setActionSuccess(msg);
      setInlinePaymentSuccess(msg);
      toast.success(msg, 'Payment Rejected');

      setShowRejectPaymentForm(false);
      const refreshed = await adminGetOrderById(selectedOrder.id);
      setSelectedOrder(refreshed);
      setNewStatus(refreshed.status);
      loadOrders();
    } catch (err) {
      console.error('Failed to reject payment:', err);
      setDetailError(err?.message || 'Could not reject payment.');
      toast.error(err?.message || 'Could not reject payment.', 'Rejection Failed');
    } finally {
      setSubmittingPaymentAction(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !newStatus || newStatus === selectedOrder.status) return;

    setUpdatingStatus(true);
    setDetailError(null);
    setActionSuccess(null);
    setInlineStatusSuccess(null);

    const statusLabels = {
      pending: 'Pending',
      payment_review: 'Payment Review',
      confirmed: 'Confirmed',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    const targetLabel = statusLabels[newStatus] || newStatus.replace(/_/g, ' ');

    try {
      const updated = await adminUpdateOrderStatus(selectedOrder.id, newStatus);
      setSelectedOrder(updated);
      const msg = `Order status successfully changed to "${targetLabel}".`;
      setActionSuccess(msg);
      setInlineStatusSuccess(msg);
      toast.success(msg, 'Status Updated');
      loadOrders();
    } catch (err) {
      console.error('Failed to update status:', err);
      setDetailError(err?.message || 'Failed to update order status.');
      toast.error(err?.message || 'Failed to update order status.', 'Update Failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle admin note update
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSavingNote(true);
    setDetailError(null);
    setActionSuccess(null);
    setInlineNoteSuccess(null);

    try {
      const updated = await adminUpdateOrderNote(selectedOrder.id, adminNoteText);
      setSelectedOrder(updated);
      const msg = 'Internal private admin note saved successfully.';
      setActionSuccess(msg);
      setInlineNoteSuccess(msg);
      toast.success(msg, 'Note Saved');
      loadOrders();
    } catch (err) {
      console.error('Failed to save note:', err);
      setDetailError(err?.message || 'Failed to save admin note.');
      toast.error(err?.message || 'Failed to save admin note.', 'Save Failed');
    } finally {
      setSavingNote(false);
    }
  };

  const handleStatusFilterChange = (status) => {
    const newParams = new URLSearchParams(searchParams);
    if (status && status !== 'all') {
      newParams.set('status', status);
    } else {
      newParams.delete('status');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
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

  // Status Badge Helper
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-surface-200/70">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">
            Orders
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">
            Manage customer purchases, fulfillment status, and delivery notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-semibold text-ink-700 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : 'text-ink-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── FILTER TABS BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-surface-200/80 shadow-2xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleStatusFilterChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-ink-950 text-white shadow-2xs font-bold'
                    : 'text-ink-600 hover:text-ink-950 hover:bg-surface-100'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('date', e.target.value);
              else newParams.delete('date');
              newParams.set('page', '1');
              setSearchParams(newParams);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-ink-800 bg-white outline-none focus:border-ink-900"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => {
                setDateFilter('');
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('date');
                newParams.set('page', '1');
                setSearchParams(newParams);
              }}
              className="text-xs text-ink-400 hover:text-ink-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadOrders} className="font-bold underline cursor-pointer">Retry</button>
        </div>
      )}

      {/* ── ORDERS TABLE ── */}
      <div className="bg-white rounded-xl border border-surface-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-ink-400 text-xs font-medium">
            <svg className="w-5 h-5 animate-spin mx-auto mb-2 text-ink-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          /* Polished Empty State */
          <div className="p-12 sm:p-16 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto text-ink-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">No orders found</h3>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                {statusFilter !== 'all'
                  ? `No orders matching status "${statusFilter.replace('_', ' ')}".`
                  : 'Customer orders will appear here once submitted.'}
              </p>
            </div>
            {statusFilter !== 'all' && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('all')}
                  className="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-semibold text-ink-700 hover:bg-surface-50"
                >
                  Clear Status Filter
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  <th className="py-3 px-5">Order Number</th>
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Items</th>
                  <th className="py-3 px-5">Total</th>
                  <th className="py-3 px-5">Payment</th>
                  <th className="py-3 px-5">Order Status</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {orders.map((order) => {
                  const itemsCount = order.items?.length || 1;
                  const firstItem = order.items?.[0];
                  const activePayment = order.active_payment || (order.payments && order.payments[0]);
                  const isTelebirr = activePayment?.method === 'telebirr' || (typeof order.customer_note === 'string' && order.customer_note.toUpperCase().includes('TELEBIRR'));

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
                            className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] font-semibold max-w-[220px]"
                            title={`Delivery Note: "${getCleanDeliveryNote(order.customer_note)}"`}
                          >
                            <span className="shrink-0 text-xs">📝</span>
                            <span className="truncate">Note: "{getCleanDeliveryNote(order.customer_note)}"</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-ink-600">
                        {firstItem?.product_name_en ? (
                          <div className="max-w-[150px] truncate" title={firstItem.product_name_en}>
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
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center text-xs text-ink-700 font-medium">
                            {isTelebirr ? 'Telebirr' : 'Cash on Delivery'}
                          </span>
                          {activePayment?.payment_proof_url && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                              <span>🧾</span> Receipt Attached
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-5 text-ink-500 whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openOrderDetail(order.id)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-ink-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.total > 0 && (
          <div className="p-3.5 sm:p-4 border-t border-surface-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-50/40 text-xs text-ink-500">
            <div>
              Showing <strong className="text-ink-900">{orders.length}</strong> of{' '}
              <strong className="text-ink-900">{pagination.total}</strong> orders
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-xs font-semibold text-ink-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-ink-600 font-medium">
                Page {pagination.page} of {pagination.total_pages || 1}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-xs font-semibold text-ink-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ORDER DETAIL MODAL / DRAWER ── */}
      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink-950/50 backdrop-blur-xs"
          onClick={closeOrderDetail}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-float border border-surface-200/80 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header & Sticky Notification */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-surface-200/70">
              <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-ink-950">
                      Order Details
                    </h3>
                    {selectedOrder && getStatusBadge(selectedOrder.status)}
                  </div>
                  <p className="text-xs text-ink-400 font-mono mt-0.5">
                    #{selectedOrder?.order_number || selectedOrderId} • {formatDate(selectedOrder?.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeOrderDetail}
                  className="w-8 h-8 rounded-lg bg-surface-100 text-ink-400 hover:text-ink-800 hover:bg-surface-200 flex items-center justify-center text-sm font-bold cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {/* Sticky Top Confirmation Banner */}
              {actionSuccess && (
                <div className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in duration-150 border-t border-emerald-500/50">
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
            </div>

            {/* Modal Content */}
            {detailLoading ? (
              <div className="p-12 text-center text-ink-400 text-xs font-medium">
                <svg className="w-5 h-5 animate-spin mx-auto mb-2 text-ink-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading details...
              </div>
            ) : detailError ? (
              <div className="p-6 text-center text-rose-700 text-xs font-semibold">
                {detailError}
              </div>
            ) : selectedOrder ? (
              <div className="p-5 sm:p-6 space-y-6">
                {/* Secondary In-Body Banner */}
                {actionSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">✓</span>
                      <span>{actionSuccess}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActionSuccess(null)}
                      className="text-emerald-700 hover:text-emerald-950 font-bold text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Customer & Delivery Information */}
                <div className="bg-surface-50/70 rounded-xl p-4 border border-surface-200/60 text-xs space-y-2.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    Customer & Fulfillment Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-ink-400 block text-[11px]">Customer Name</span>
                      <strong className="text-ink-900 font-bold">{selectedOrder.customer?.name || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-ink-400 block text-[11px]">Phone Number</span>
                      {selectedOrder.customer?.phone ? (
                        <a
                          href={`tel:${selectedOrder.customer.phone}`}
                          className="font-mono font-bold text-brand-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>📞</span>
                          <span>{selectedOrder.customer.phone}</span>
                        </a>
                      ) : (
                        <span className="text-ink-500">-</span>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-ink-400 block text-[11px]">Delivery Address</span>
                      <span className="text-ink-800 font-medium">{selectedOrder.customer?.address || '-'}</span>
                    </div>
                    {getCleanDeliveryNote(selectedOrder.customer_note) && (
                      <div className="sm:col-span-2 pt-2 border-t border-surface-200/60">
                        <span className="text-ink-500 block text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <span>📝</span> Delivery Note
                        </span>
                        <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-950 font-semibold text-xs leading-relaxed shadow-2xs">
                          "{getCleanDeliveryNote(selectedOrder.customer_note)}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Ordered Breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2.5">
                    Items Ordered ({selectedOrder.items?.length || 0})
                  </h4>
                  <div className="divide-y divide-surface-100 border border-surface-200 rounded-xl overflow-hidden">
                    {selectedOrder.items?.map((item) => (
                      <div key={item.id} className="p-3 sm:p-3.5 flex items-center justify-between text-xs bg-white">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name_en}
                              className="w-10 h-10 rounded-lg object-contain bg-surface-50 border border-surface-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-ink-400 shrink-0">
                              📦
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-ink-950 truncate">
                              {isAmharic && item.product_name_am ? item.product_name_am : item.product_name_en}
                            </p>
                            <p className="text-[11px] text-ink-400 font-mono mt-0.5">
                              {formatPrice(item.unit_price)} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-black text-ink-950 shrink-0 ml-3">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total Banner */}
                  <div className="flex items-center justify-between p-3.5 bg-surface-50 rounded-xl border border-surface-200/80 mt-3 text-xs">
                    <span className="font-bold text-ink-700">Total Order Amount:</span>
                    <span className="text-base font-black text-ink-950">
                      {formatPrice(selectedOrder.total_amount)}
                    </span>
                  </div>
                </div>

                {/* ── PAYMENT & RECEIPT VERIFICATION ── */}
                {(() => {
                  const activePayment = selectedOrder.active_payment || (selectedOrder.payments && selectedOrder.payments[0]);
                  const isTelebirr = activePayment?.method === 'telebirr' || (typeof selectedOrder.customer_note === 'string' && selectedOrder.customer_note.toUpperCase().includes('TELEBIRR'));

                  return (
                    <div className="rounded-xl border border-surface-200/90 bg-surface-50/70 p-4 sm:p-4.5 space-y-3.5 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                            Payment & Receipt Verification
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold text-ink-950 text-sm">
                              {isTelebirr ? 'Telebirr Transfer' : 'Cash on Delivery'}
                            </span>
                            {activePayment && (
                              <span className="font-mono text-ink-500 font-semibold text-xs">
                                ({formatPrice(activePayment.amount || selectedOrder.total_amount)})
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {/* Payment status badge */}
                          {activePayment ? (
                            activePayment.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Payment Verified
                              </span>
                            ) : activePayment.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Payment Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Awaiting Verification
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-100 text-ink-500">
                              No payment record
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attached Customer Screenshot */}
                      {activePayment?.payment_proof_url ? (
                        <div className="space-y-2 pt-2 border-t border-surface-200/60">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-ink-800 flex items-center gap-1.5">
                              <span>🧾</span> Customer Payment Proof Screenshot:
                            </span>
                            <a
                              href={activePayment.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Open Full Image</span>
                              <span>↗</span>
                            </a>
                          </div>
                          <div className="rounded-xl border border-surface-200 bg-white p-2 flex items-center justify-center overflow-hidden">
                            <a
                              href={activePayment.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Click to open full image"
                              className="cursor-zoom-in"
                            >
                              <img
                                src={activePayment.payment_proof_url}
                                alt="Payment Proof Screenshot"
                                className="max-h-64 w-auto max-w-full object-contain rounded-lg shadow-2xs hover:opacity-95 transition"
                              />
                            </a>
                          </div>
                        </div>
                      ) : isTelebirr ? (
                        <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/70 text-amber-800 text-[11px]">
                          ⚠️ No receipt screenshot file was uploaded with this Telebirr payment.
                        </div>
                      ) : (
                        <div className="text-[11px] text-ink-500 pt-1">
                          💵 Payment will be collected in cash upon physical delivery.
                        </div>
                      )}

                      {/* Rejection Notice if currently rejected */}
                      {activePayment?.status === 'rejected' && (
                        <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-rose-900">
                            <span>❌</span>
                            <span>Customer Rejection Notice (Visible in &quot;My Orders&quot;):</span>
                          </div>
                          <p className="text-[11px] pl-5 font-semibold text-rose-800">
                            &ldquo;{activePayment.customer_message || 'The order payment pic is not real'}&rdquo;
                          </p>
                          {activePayment.admin_note && (
                            <div className="pt-2 mt-2 border-t border-rose-200/60 text-[11px] text-rose-900">
                              <span className="font-bold">🔒 Private Admin Note: </span>
                              <span className="text-rose-700">{activePayment.admin_note}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inline Payment Action Feedback Banner */}
                      {inlinePaymentSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                            <span>{inlinePaymentSuccess}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInlinePaymentSuccess(null)}
                            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer p-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Action buttons (Verify / Reject) when pending */}
                      {activePayment && activePayment.status === 'pending' && (
                        <div className="pt-2 border-t border-surface-200/60 space-y-3">
                          {!showRejectPaymentForm ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleVerifyPayment(activePayment.id)}
                                disabled={submittingPaymentAction}
                                className="flex-1 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{submittingPaymentAction ? 'Verifying...' : 'Verify & Confirm Payment'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectPaymentForm(true)}
                                disabled={submittingPaymentAction}
                                className="py-2 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Reject Payment...</span>
                              </button>
                            </div>
                          ) : (
                            /* Rejection Sub-form */
                            <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50/90 border border-rose-200 text-xs space-y-3 animate-fade-in">
                              <div>
                                <span className="font-black text-rose-900 block text-xs">
                                  Reject Customer Payment
                                </span>
                                <span className="text-[11px] text-rose-700">
                                  Select or enter an explanation. This message is directly displayed to the customer in their &quot;My Orders&quot; tracker.
                                </span>
                              </div>

                              {/* Quick Explanation Chips */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block mb-1.5">
                                  Quick Explanations:
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    'The order payment pic is not real',
                                    'Payment screenshot is blurry or unreadable',
                                    'Payment amount does not match order total',
                                    'Duplicate or reused transaction receipt'
                                  ].map((reason) => (
                                    <button
                                      key={reason}
                                      type="button"
                                      onClick={() => setPaymentRejectReason(reason)}
                                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                                        paymentRejectReason === reason
                                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                          : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-100'
                                      }`}
                                    >
                                      {reason}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-rose-900 block mb-1">
                                  Customer Notice (Visible to customer in &quot;My Orders&quot;):
                                </label>
                                <input
                                  type="text"
                                  value={paymentRejectReason}
                                  onChange={(e) => setPaymentRejectReason(e.target.value)}
                                  placeholder="e.g. The order payment pic is not real"
                                  className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white text-xs font-medium text-ink-900 outline-none focus:border-rose-500 shadow-2xs"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setShowRejectPaymentForm(false)}
                                  disabled={submittingPaymentAction}
                                  className="px-3 py-1.5 rounded-lg border border-surface-300 bg-white text-ink-700 text-xs font-bold hover:bg-surface-50 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleRejectPayment(e, activePayment.id)}
                                  disabled={submittingPaymentAction || !paymentRejectReason.trim()}
                                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                                >
                                  {submittingPaymentAction ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Status Updater Form */}
                <form onSubmit={handleUpdateStatus} className="p-4 rounded-xl bg-surface-50/70 border border-surface-200/70 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-ink-800">
                      Update Order Status
                    </label>
                    <span className="text-[11px] text-ink-400">Current: {selectedOrder.status}</span>
                  </div>

                  {/* Inline Status Success Feedback */}
                  {inlineStatusSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                        <span>{inlineStatusSuccess}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInlineStatusSuccess(null)}
                        className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer p-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      disabled={updatingStatus}
                      className="flex-1 px-3 py-2 rounded-lg border border-surface-300 text-xs font-medium text-ink-900 bg-white outline-none focus:border-ink-900"
                    >
                      <option value="pending">Pending</option>
                      <option value="payment_review">Payment Review</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      type="submit"
                      disabled={updatingStatus || newStatus === selectedOrder.status}
                      className="px-4 py-2 rounded-lg bg-ink-950 hover:bg-ink-900 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {updatingStatus ? 'Updating...' : 'Update Status'}
                    </button>
                  </div>
                </form>

                {/* Internal Admin Note Form */}
                <form onSubmit={handleSaveNote} className="p-4 rounded-xl bg-surface-50/70 border border-surface-200/70 space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-ink-800 block mb-0.5">
                      Private Admin Note
                    </label>
                    <p className="text-[11px] text-ink-400">
                      Internal reference only. This is strictly private and never exposed to customers.
                    </p>
                  </div>

                  {/* Inline Note Success Feedback */}
                  {inlineNoteSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                        <span>{inlineNoteSuccess}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInlineNoteSuccess(null)}
                        className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer p-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <textarea
                    rows={2}
                    value={adminNoteText}
                    onChange={(e) => setAdminNoteText(e.target.value)}
                    placeholder="Internal notes regarding delivery, packaging, or customer calls..."
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 text-xs font-medium text-ink-900 bg-white outline-none focus:border-ink-900"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingNote}
                      className="px-4 py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-ink-800 font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      {savingNote ? 'Saving Note...' : 'Save Private Note'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
