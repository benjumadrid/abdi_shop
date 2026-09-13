import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import {
  getMySavedOrders,
  getCustomerOrderById,
  MY_ORDERS_STORAGE_KEY
} from '../../services/api';

function getCleanDeliveryNote(rawNote) {
  if (!rawNote || typeof rawNote !== 'string') return null;
  const cleaned = rawNote
    .replace(/^\[Payment:\s*[^\]]+\]\s*/i, '')
    .replace(/^\(Payment:\s*[^)]+\)\s*/i, '')
    .trim();
  return cleaned || null;
}

export default function MyOrdersSection() {
  const { t, formatPrice, isAmharic } = useLanguage();

  const [savedOrders, setSavedOrders] = useState([]);
  const [ordersDetails, setOrdersDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  // Safe translation helper: guarantees no raw key like 'myOrders.title' ever renders
  const getTxt = (key, enFallback, amFallback) => {
    try {
      const val = t(key);
      if (val && typeof val === 'string' && !val.includes('.')) {
        return val;
      }
    } catch {
      // ignore
    }
    return isAmharic ? amFallback : enFallback;
  };

  // Sync saved orders with backend
  const loadOrderHistory = useCallback(async (mode = 'background') => {
    if (mode === 'manual') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);

    const saved = getMySavedOrders();
    setSavedOrders(saved);

    if (saved.length === 0) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const results = await Promise.allSettled(
        saved.map((item) => getCustomerOrderById(item.id))
      );

      const detailsMap = {};
      const activeSaved = [];
      results.forEach((res, idx) => {
        const item = saved[idx];
        if (res.status === 'fulfilled' && res.value) {
          // Merge fresh backend data into order object
          const freshOrder = { ...item, ...res.value };
          detailsMap[item.id] = freshOrder;
          activeSaved.push(freshOrder);
        } else {
          // CRITICAL: NEVER delete saved orders on network errors, server restarts, or background hiccups!
          // Maintain the cached order snapshot so orders persist reliably indefinitely.
          const fallback = detailsMap[item.id] || item;
          detailsMap[item.id] = fallback;
          activeSaved.push(fallback);
        }
      });

      setSavedOrders(activeSaved);
      setOrdersDetails(detailsMap);

      // Keep localStorage freshly updated with verified/delivered statuses without losing anything
      try {
        localStorage.setItem(MY_ORDERS_STORAGE_KEY, JSON.stringify(activeSaved.slice(0, 100)));
      } catch {
        // ignore quota errors
      }
    } catch (err) {
      console.warn('Could not sync order history with backend:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrderHistory('initial');

    const handleOrderSaved = () => {
      loadOrderHistory('background');
    };

    const handleFocus = () => {
      loadOrderHistory('background');
    };

    window.addEventListener('abdi_order_saved', handleOrderSaved);
    window.addEventListener('focus', handleFocus);

    // Auto-sync polling every 8 seconds so status changes reflect immediately without browser refresh
    const pollTimer = setInterval(() => {
      loadOrderHistory('background');
    }, 8000);

    return () => {
      window.removeEventListener('abdi_order_saved', handleOrderSaved);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollTimer);
    };
  }, [loadOrderHistory]);

  // Keep selectedOrder in sync when background fetch updates ordersDetails
  const selectedOrderId = selectedOrder?.id;
  useEffect(() => {
    if (selectedOrderId && ordersDetails[selectedOrderId]) {
      setSelectedOrder(ordersDetails[selectedOrderId]);
    }
  }, [ordersDetails, selectedOrderId]);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(isAmharic ? 'am-ET' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  // Helper to determine payment method and status
  const getPaymentInfo = (order) => {
    const activePayment = order?.active_payment || (order?.payments && order.payments[0]);
    const note = order?.customer_note || '';
    const isTelebirr = activePayment?.method === 'telebirr' || note.toUpperCase().includes('TELEBIRR');
    const proofUrl = activePayment?.payment_proof_url || null;

    if (isTelebirr) {
      const pStatus = activePayment?.status;
      const oStatus = order?.status;

      if (pStatus === 'verified' || oStatus === 'confirmed' || oStatus === 'out_for_delivery' || oStatus === 'delivered') {
        return {
          methodName: 'Telebirr',
          statusText: getTxt('myOrders.telebirrVerified', 'Payment Verified', 'ክፍያው ተረጋግጧል'),
          statusType: 'verified',
          customerMessage: null,
          proofUrl
        };
      }

      if (pStatus === 'rejected') {
        return {
          methodName: 'Telebirr',
          statusText: getTxt('myOrders.telebirrRejected', 'Payment Rejected', 'ክፍያው ተቀባይነት አላገኘም'),
          statusType: 'rejected',
          customerMessage: activePayment?.customer_message || (isAmharic
            ? 'የክፍያ ደረሰኝዎ ሊረጋገጥ አልቻለም። እባክዎ የግብይት ቁጥሩ በግልጽ የሚታይ መሆኑን ያረጋግጡ።'
            : 'Your payment screenshot could not be verified. Please make sure the transaction ID is readable.'),
          proofUrl
        };
      }

      return {
        methodName: 'Telebirr',
        statusText: getTxt('myOrders.telebirrPending', 'Payment submitted — Awaiting verification', 'ክፍያው ተልኳል — ማረጋገጫ በመጠባበቅ ላይ'),
        statusType: 'pending',
        customerMessage: null,
        proofUrl
      };
    }

    // Cash on Delivery
    return {
      methodName: getTxt('myOrders.cashOnDelivery', 'Cash on Delivery', 'በደረሰኝ ጊዜ የሚከፈል (በእጅ)'),
      statusText: getTxt('myOrders.cashOnDelivery', 'Cash on Delivery', 'በደረሰኝ ጊዜ የሚከፈል'),
      statusType: 'cash',
      customerMessage: null,
      proofUrl: null
    };
  };

  // Order status label helper
  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return getTxt('myOrders.statuses.pending', 'Pending', 'በመጠባበቅ ላይ');
      case 'payment_review':
        return getTxt('myOrders.statuses.payment_review', 'Payment Review', 'ክፍያ በግምገማ ላይ');
      case 'confirmed':
        return getTxt('myOrders.statuses.confirmed', 'Confirmed', 'ተረጋግጧል');
      case 'out_for_delivery':
        return getTxt('myOrders.statuses.out_for_delivery', 'Out for Delivery', 'በማድረስ ላይ');
      case 'delivered':
        return getTxt('myOrders.statuses.delivered', 'Delivered', 'ደርሷል');
      case 'cancelled':
        return getTxt('myOrders.statuses.cancelled', 'Cancelled', 'ተሰርዟል');
      case 'rejected':
        return getTxt('myOrders.statuses.rejected', 'Rejected', 'ውድቅ ተደርጓል');
      default:
        return status || '-';
    }
  };

  // Order status badge styling
  const getOrderStatusBadge = (status) => {
    const label = getOrderStatusLabel(status);
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">{label}</span>;
      case 'payment_review':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">{label}</span>;
      case 'confirmed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">{label}</span>;
      case 'out_for_delivery':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">{label}</span>;
      case 'delivered':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">{label}</span>;
      case 'cancelled':
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">{label}</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-100 text-ink-700 border border-surface-200">{label}</span>;
    }
  };

  // Rolling last 4 orders: always display the latest 4 orders by default;
  // If order 5 is placed, order 1 rolls off the default view but earlier orders remain fully accessible.
  const visibleOrders = showAllOrders ? savedOrders : savedOrders.slice(0, 4);
  const earlierOrdersCount = Math.max(0, savedOrders.length - 4);

  return (
    <section id="my-orders" className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-10 md:py-14 font-sans scroll-mt-20 md:scroll-mt-24">
      {/* ── Section Header (Clean, no tracking badges) ── */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight">
              {getTxt('myOrders.title', 'My Orders', 'የእኔ ትዕዛዞች')}
            </h2>
            {savedOrders.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-100 text-ink-700 border border-surface-200">
                {savedOrders.length > 4 && !showAllOrders
                  ? (isAmharic ? `የቅርብ 4 ከ ${savedOrders.length}` : `Latest 4 of ${savedOrders.length}`)
                  : (isAmharic ? `${savedOrders.length} ትዕዛዞች` : `${savedOrders.length} orders`)}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            {savedOrders.length > 4 && !showAllOrders
              ? (isAmharic
                  ? `የቅርብ 4 ትዕዛዞችዎ በመታየት ላይ ናቸው (ቀደም ሲል ያዘዟቸውን ለማየት ከታች ይጫኑ)`
                  : `Showing your latest 4 orders (earlier orders can be expanded below)`)
              : getTxt('myOrders.subtitle', 'Your previous orders', 'ቀደም ሲል ያዘዟቸው ትዕዛዞች')}
          </p>
        </div>

        {savedOrders.length > 0 && (
          <button
            type="button"
            onClick={() => loadOrderHistory('manual')}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-medium text-ink-600 transition cursor-pointer disabled:opacity-50 shadow-2xs"
            title={getTxt('myOrders.refresh', 'Refresh', 'አድስ')}
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">{getTxt('myOrders.refresh', 'Refresh', 'አድስ')}</span>
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="p-10 text-center text-xs text-ink-400 font-medium">
          {getTxt('myOrders.loading', 'Loading your orders...', 'የትዕዛዝ መረጃ በመጫን ላይ...')}
        </div>
      ) : savedOrders.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-surface-200/80 p-8 sm:p-12 text-center max-w-md mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto text-2xl mb-3 text-ink-500">
            🛍️
          </div>
          <h3 className="text-base font-bold text-ink-900">
            {getTxt('myOrders.emptyTitle', 'No orders yet', 'እስካሁን ምንም ትዕዛዝ የለም')}
          </h3>
          <p className="text-xs text-ink-500 mt-1 leading-relaxed">
            {getTxt('myOrders.emptyDesc', 'Your order history will appear here after you place an order.', 'ትዕዛዝ ሲያዙ የትዕዛዝ ታሪክዎ እዚህ ይታያል።')}
          </p>
        </div>
      ) : (
        /* Orders List / Card Grid */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {visibleOrders.map((saved) => {
            const order = ordersDetails[saved.id] || saved;
            const paymentInfo = getPaymentInfo(order);
            const items = order?.items || [];
            const primaryItem = items[0];

            return (
              <div
                key={saved.id}
                onClick={() => setSelectedOrder(order)}
                className="bg-white rounded-2xl border border-surface-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-card hover:border-brand-400/80 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Order # & Date */}
                  <div className="flex items-start justify-between gap-3 border-b border-surface-100 pb-3 mb-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-ink-900 block">
                        Order #{order.order_number || saved.order_number}
                      </span>
                      <span className="text-[11px] text-ink-400">
                        {formatDate(order.created_at || saved.created_at)}
                      </span>
                    </div>
                    <div>
                      {getOrderStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="flex items-center gap-3.5 mb-4">
                    {primaryItem?.image_url ? (
                      <img
                        src={primaryItem.image_url}
                        alt={primaryItem.product_name_en || 'Product'}
                        className="w-14 h-14 rounded-xl object-contain bg-surface-50 border border-surface-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-surface-100 flex items-center justify-center text-xl shrink-0">
                        📦
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-ink-950 truncate">
                        {primaryItem
                          ? (isAmharic && primaryItem.product_name_am ? primaryItem.product_name_am : primaryItem.product_name_en)
                          : (isAmharic ? 'የታዘዘ እቃ' : 'Ordered Product')}
                      </h4>
                      {items.length > 1 && (
                        <p className="text-[11px] text-ink-400 font-medium">
                          +{items.length - 1} {isAmharic ? 'ተጨማሪ እቃዎች' : 'more items'}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-ink-500 mt-1">
                        <span>
                          {getTxt('myOrders.qty', 'Qty', 'ብዛት')}: <strong className="text-ink-800">{primaryItem?.quantity || 1}</strong>
                        </span>
                        {primaryItem?.unit_price && (
                          <span>
                            {getTxt('myOrders.unitPrice', 'Unit Price', 'የአንዱ ዋጋ')}: <strong className="text-ink-800">{formatPrice(primaryItem.unit_price)}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Price */}
                  <div className="bg-surface-50/70 rounded-xl p-3 mb-4 flex items-center justify-between">
                    <span className="text-xs text-ink-500 font-medium">
                      {getTxt('myOrders.totalPrice', 'Total', 'ጠቅላላ ዋጋ')}:
                    </span>
                    <span className="text-sm font-black text-brand-700">
                      {formatPrice(order.total_amount || 0)}
                    </span>
                  </div>

                  {/* Payment Info */}
                  <div className="space-y-1.5 text-xs border-t border-surface-100 pt-3">
                    <div className="flex items-center justify-between text-ink-600">
                      <span className="text-ink-400">
                        {getTxt('myOrders.paymentMethod', 'Payment', 'የክፍያ ዘዴ')}:
                      </span>
                      <span className="font-semibold text-ink-900">
                        {paymentInfo.methodName}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-ink-400 shrink-0">
                        {getTxt('myOrders.paymentStatus', 'Payment status', 'የክፍያ ሁኔታ')}:
                      </span>
                      <span className={`font-semibold text-right ${
                        paymentInfo.statusType === 'verified'
                          ? 'text-emerald-700'
                          : paymentInfo.statusType === 'rejected'
                          ? 'text-rose-600'
                          : paymentInfo.statusType === 'pending'
                          ? 'text-amber-700'
                          : 'text-ink-800'
                      }`}>
                        {paymentInfo.statusText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink-600">
                      <span className="text-ink-400">
                        {getTxt('myOrders.orderStatus', 'Order status', 'የትዕዛዝ ሁኔታ')}:
                      </span>
                      <span className="font-semibold text-ink-900">
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  {/* Attached Payment Receipt Preview in Card */}
                  {paymentInfo.proofUrl && (
                    <div className="mt-3 pt-3 border-t border-surface-100 flex items-center justify-between gap-3 bg-surface-50/70 p-2.5 rounded-xl border border-surface-200/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={paymentInfo.proofUrl}
                          alt="Payment receipt screenshot"
                          className="w-10 h-10 object-cover rounded-lg border border-surface-200 bg-white shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-ink-900 block truncate">
                            {getTxt('myOrders.attachedReceipt', 'Attached Payment Receipt', 'የተያያዘው የክፍያ ደረሰኝ')}
                          </span>
                          <span className="text-[10px] text-ink-500">
                            {getTxt('myOrders.receiptUploaded', 'Receipt screenshot', 'ደረሰኝ ተያይዟል')}
                          </span>
                        </div>
                      </div>
                      <a
                        href={paymentInfo.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline shrink-0 flex items-center gap-0.5"
                      >
                        <span>{getTxt('myOrders.viewFull', 'View Full', 'ሙሉውን ይመልከቱ')}</span>
                        <span>↗</span>
                      </a>
                    </div>
                  )}

                  {/* Rejection Message if applicable */}
                  {paymentInfo.statusType === 'rejected' && paymentInfo.customerMessage && (
                    <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-800">
                        <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{getTxt('myOrders.rejectionReason', 'Payment Issue / Rejection Reason', 'ያልተረጋገጠበት ምክንያት')}:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed font-semibold pl-5 text-rose-800">
                        &ldquo;{paymentInfo.customerMessage}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Customer Delivery Note preview on card */}
                  {getCleanDeliveryNote(order.customer_note) && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
                      <span className="text-xs">📝</span>
                      <span className="truncate">
                        {getTxt('myOrders.deliveryNote', 'Delivery Note', 'የማድረሻ ማስታወሻ')}: "{getCleanDeliveryNote(order.customer_note)}"
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom View Details Link */}
                <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-end">
                  <span className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                    {getTxt('myOrders.viewDetails', 'View Details', 'ዝርዝር ይመልከቱ')} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toggle earlier orders if customer has more than 4 orders */}
        {savedOrders.length > 4 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllOrders((prev) => !prev)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs sm:text-sm font-bold text-brand-700 hover:text-brand-800 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            >
              {showAllOrders ? (
                <>
                  <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                  </svg>
                  <span>{getTxt('myOrders.showLatest4', 'Show latest 4 orders only', 'የቅርብ 4 ትዕዛዞችን ብቻ አሳይ')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>
                    {isAmharic
                      ? `የቀደሙ ትዕዛዞችን አሳይ (+${earlierOrdersCount})`
                      : `Show earlier orders (+${earlierOrdersCount})`}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </>
    )}

      {/* ── ORDER DETAILS MODAL ── */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-xs"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-float border border-surface-200 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-100 pb-4 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-ink-950">
                  {getTxt('myOrders.orderDetails', 'Order Details', 'የትዕዛዝ ዝርዝር')}
                </h3>
                <p className="text-xs text-ink-400 mt-0.5 font-mono">
                  Order #{selectedOrder.order_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-surface-100 text-ink-400 hover:text-ink-800 hover:bg-surface-200 flex items-center justify-center text-sm font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Customer & Delivery Information */}
            <div className="bg-surface-50/70 rounded-2xl p-4 mb-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-400">{getTxt('myOrders.orderDate', 'Order Date', 'የታዘዘበት ቀን')}:</span>
                <span className="font-semibold text-ink-800">{formatDate(selectedOrder.created_at)}</span>
              </div>
              {selectedOrder.customer?.name && (
                <div className="flex justify-between">
                  <span className="text-ink-400">{getTxt('myOrders.customerName', 'Customer Name', 'የደንበኛ ስም')}:</span>
                  <span className="font-semibold text-ink-800">{selectedOrder.customer.name}</span>
                </div>
              )}
              {selectedOrder.customer?.phone && (
                <div className="flex justify-between">
                  <span className="text-ink-400">{isAmharic ? 'ስልክ' : 'Phone'}:</span>
                  <span className="font-semibold text-ink-800">{selectedOrder.customer.phone}</span>
                </div>
              )}
              {selectedOrder.customer?.address && (
                <div className="flex justify-between">
                  <span className="text-ink-400">{getTxt('myOrders.deliveryAddress', 'Delivery Address', 'የማድረሻ አድራሻ')}:</span>
                  <span className="font-semibold text-ink-800 text-right max-w-[60%]">{selectedOrder.customer.address}</span>
                </div>
              )}
              {getCleanDeliveryNote(selectedOrder.customer_note) && (
                <div className="flex justify-between items-center pt-2 border-t border-surface-200/60">
                  <span className="text-ink-500 font-medium flex items-center gap-1 text-xs">
                    <span>📝</span> {getTxt('myOrders.deliveryNote', 'Delivery Note', 'የማድረሻ ማስታወሻ')}:
                  </span>
                  <span className="font-semibold text-amber-950 text-right max-w-[65%] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 text-xs shadow-2xs">
                    "{getCleanDeliveryNote(selectedOrder.customer_note)}"
                  </span>
                </div>
              )}
            </div>

            {/* Order Status & Payment Summary */}
            <div className="bg-surface-50/70 rounded-2xl p-4 mb-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-ink-400">{getTxt('myOrders.orderStatus', 'Order Status', 'የትዕዛዝ ሁኔታ')}:</span>
                <div>{getOrderStatusBadge(selectedOrder.status)}</div>
              </div>

              {(() => {
                const info = getPaymentInfo(selectedOrder);
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-400">{getTxt('myOrders.paymentMethod', 'Payment Method', 'የክፍያ ዘዴ')}:</span>
                      <span className="font-semibold text-ink-900">{info.methodName}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-ink-400 shrink-0">{getTxt('myOrders.paymentStatus', 'Payment Status', 'የክፍያ ሁኔታ')}:</span>
                      <span className={`font-semibold text-right ${
                        info.statusType === 'verified'
                          ? 'text-emerald-700'
                          : info.statusType === 'rejected'
                          ? 'text-rose-600'
                          : info.statusType === 'pending'
                          ? 'text-amber-700'
                          : 'text-ink-800'
                      }`}>
                        {info.statusText}
                      </span>
                    </div>

                    {/* Attached Customer Screenshot in Modal */}
                    {info.proofUrl && (
                      <div className="mt-3 pt-3 border-t border-surface-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink-800 flex items-center gap-1.5">
                            <span>🧾</span>
                            <span>{getTxt('myOrders.attachedReceipt', 'Attached Payment Receipt', 'የተያያዘው የክፍያ ደረሰኝ')}:</span>
                          </span>
                          <a
                            href={info.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
                          >
                            <span>{getTxt('myOrders.openFullSize', 'Open Full Size', 'በትልቅ መስኮት ክፈት')}</span>
                            <span>↗</span>
                          </a>
                        </div>
                        <div className="rounded-xl border border-surface-200 overflow-hidden bg-surface-100 flex items-center justify-center p-2">
                          <a
                            href={info.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-zoom-in"
                          >
                            <img
                              src={info.proofUrl}
                              alt="Payment receipt screenshot"
                              className="max-h-56 w-auto max-w-full object-contain rounded-lg shadow-2xs hover:opacity-95 transition"
                            />
                          </a>
                        </div>
                      </div>
                    )}

                    {info.statusType === 'rejected' && info.customerMessage && (
                      <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                        <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-800 text-xs">
                          <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>{getTxt('myOrders.rejectionReason', 'Payment Issue / Rejection Reason', 'ያልተረጋገጠበት ምክንያት')}:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed font-semibold pl-5 text-rose-800">
                          &ldquo;{info.customerMessage}&rdquo;
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Items Breakdown */}
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2.5">
                {getTxt('myOrders.items', 'Ordered Items', 'የታዘዙ እቃዎች')} ({selectedOrder.items?.length || 1})
              </h4>
              <div className="divide-y divide-surface-100 border border-surface-200 rounded-2xl overflow-hidden">
                {(selectedOrder.items && selectedOrder.items.length > 0) ? (
                  selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name_en || 'Product'}
                            className="w-11 h-11 rounded-xl object-contain bg-surface-50 border border-surface-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-surface-100 flex items-center justify-center text-sm shrink-0">
                            📦
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-ink-900">
                            {isAmharic && item.product_name_am ? item.product_name_am : item.product_name_en}
                          </p>
                          <p className="text-[11px] text-ink-400 mt-0.5">
                            {formatPrice(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-ink-900">
                        {formatPrice(item.subtotal || (item.unit_price * item.quantity))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 text-xs text-ink-500">
                    {formatPrice(selectedOrder.total_amount || 0)}
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-brand-50/60 rounded-2xl border border-brand-200/60 mb-5">
              <span className="text-xs sm:text-sm font-bold text-ink-900">
                {getTxt('myOrders.totalPrice', 'Total Amount', 'ጠቅላላ ዋጋ')}:
              </span>
              <span className="text-base sm:text-lg font-black text-brand-700">
                {formatPrice(selectedOrder.total_amount || 0)}
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="w-full py-3 rounded-xl bg-surface-100 hover:bg-surface-200 text-ink-800 text-xs font-bold transition cursor-pointer text-center"
            >
              {getTxt('myOrders.close', 'Close', 'ዝጋ')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
