/**
 * Abdi Online Shop - API Client
 *
 * Configured with base URL from environment or defaults to '/api'
 * (which is proxied by Vite to http://localhost:5000 in development).
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_API_BASE_URL) || (typeof window !== 'undefined' && window.location ? '/api' : 'http://localhost:5000/api');

/**
 * Generic fetch wrapper with JSON parsing and standardized error handling.
 */
export const ADMIN_TOKEN_KEY = 'abdi_admin_token';
export const ADMIN_USER_KEY = 'abdi_admin_user';

// In-memory admin session (never persisted to localStorage or sessionStorage)
// This ensures that whenever the page is refreshed or closed and reopened,
// the admin session is cleared and the login page prompts for credentials for privacy.
let inMemoryAdminToken = null;
let inMemoryAdminUser = null;

// Immediately purge any old or persisted admin tokens from browser storage
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  }
} catch {
  // ignore
}

export function getAdminToken() {
  return inMemoryAdminToken;
}

export function setAdminToken(token) {
  inMemoryAdminToken = token || null;
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  } catch {
    // ignore
  }
}

export function getAdminUser() {
  return inMemoryAdminUser;
}

export function setAdminUser(user) {
  inMemoryAdminUser = user || null;
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  } catch {
    // ignore
  }
}

export function removeAdminToken() {
  inMemoryAdminToken = null;
  inMemoryAdminUser = null;
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Generic fetch wrapper with JSON parsing and standardized error handling.
 */
export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Automatically attach Admin JWT token if available
  const token = options.token !== undefined ? options.token : getAdminToken();
  if (token && !defaultHeaders['Authorization'] && !defaultHeaders['authorization']) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type if uploading FormData (browser sets boundary automatically)
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  const response = await fetch(url, {
    ...options,
    headers: defaultHeaders
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (data && data.message) || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// In-memory cache for instant navigation without re-fetching delays
let productsCache = null;
const productDetailsCache = new Map();

/**
 * Preloads image URLs into the browser cache in the background.
 */
export function preloadImages(urls) {
  if (typeof Image === 'undefined' || !Array.isArray(urls)) return;
  urls.forEach((url) => {
    if (typeof url === 'string' && url) {
      const img = new Image();
      img.src = url;
    }
  });
}

/**
 * Returns cached products array synchronously if available.
 */
export function getCachedProducts() {
  return productsCache;
}

/**
 * Returns cached product details synchronously if available.
 */
export function getCachedProductById(id) {
  if (productDetailsCache.has(id)) {
    return productDetailsCache.get(id);
  }
  if (productsCache) {
    return productsCache.find((p) => p.id === id) || null;
  }
  return null;
}

async function fetchProductsFresh(options = {}) {
  const queryParams = new URLSearchParams();
  if (options.includeUnavailable) {
    queryParams.set('include_unavailable', 'true');
  }

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/products?${queryString}` : '/products';
  const response = await apiRequest(endpoint);
  const products = response.data || [];

  if (!options.includeUnavailable) {
    productsCache = products;
    const mediaUrls = [];
    products.forEach((p) => {
      productDetailsCache.set(p.id, p);
      if (p.image_url) mediaUrls.push(p.image_url);
      if (Array.isArray(p.media)) {
        p.media.forEach((m) => {
          if (m.url) mediaUrls.push(m.url);
        });
      }
    });
    preloadImages(mediaUrls);
  }

  return products;
}

/**
 * Fetches available products from the backend API.
 * Uses in-memory cache for instant rendering when navigating.
 * GET /api/products
 * @returns {Promise<Array>} Array of product records
 */
export async function getProducts(options = {}) {
  if (options.forceFresh) {
    productsCache = null;
  }
  if (!options.includeUnavailable && productsCache && productsCache.length > 0 && !options.forceFresh) {
    fetchProductsFresh(options).catch(() => {});
    return productsCache;
  }
  return fetchProductsFresh(options);
}

/**
 * Fetches single product details by UUID.
 * Returns cached product immediately if available.
 * GET /api/products/:id
 */
export async function getProductById(id) {
  const cached = getCachedProductById(id);
  if (cached && Array.isArray(cached.media) && cached.media.length > 0) {
    apiRequest(`/products/${id}`).then((res) => {
      if (res?.data) {
        productDetailsCache.set(id, res.data);
      }
    }).catch(() => {});
    return cached;
  }

  const response = await apiRequest(`/products/${id}`);
  const product = response.data || null;
  if (product) {
    productDetailsCache.set(id, product);
    if (Array.isArray(product.media)) {
      preloadImages(product.media.map((m) => m.url));
    }
  }
  return product;
}

/**
 * Submits a new customer order.
 * POST /api/orders
 */
export async function createOrder(orderData) {
  const response = await apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
  return response.data || null;
}

/**
 * Fetches configured payment methods (Telebirr account details and Cash on delivery).
 * GET /api/payment-methods
 */
export async function getPaymentMethods() {
  const response = await apiRequest('/payment-methods');
  return response.data || null;
}

/**
 * Submits payment proof for an order (supports FormData for Telebirr screenshot or JSON for cash).
 * POST /api/payments
 */
export async function submitPayment(paymentData) {
  const isFormData = paymentData instanceof FormData;
  const options = {
    method: 'POST',
    body: isFormData ? paymentData : JSON.stringify(paymentData)
  };
  const response = await apiRequest('/payments', options);
  return response.data || null;
}

/**
 * Health check helper to verify backend connectivity.
 * GET /api/health
 */
export async function checkBackendHealth() {
  return apiRequest('/health');
}


/* ============================================================
   ADMIN AUTHENTICATION APIS
============================================================ */
export async function adminLogin({ email, password }) {
  const response = await apiRequest('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (response?.data?.token) {
    setAdminToken(response.data.token);
    if (response.data.admin) {
      setAdminUser(response.data.admin);
    }
  }
  return response?.data || null;
}

export async function adminGetMe() {
  const response = await apiRequest('/admin/auth/me', {
    method: 'GET'
  });
  if (response?.data) {
    setAdminUser(response.data);
  }
  return response?.data || null;
}

export async function adminLogout() {
  try {
    await apiRequest('/admin/auth/logout', { method: 'POST' });
  } catch {
    // discard client state even if network fails
  } finally {
    removeAdminToken();
  }
}

export async function adminUpdateCredentials({ currentPassword, newEmail, newPassword, name }) {
  const response = await apiRequest('/admin/auth/credentials', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newEmail, newPassword, name })
  });
  if (response?.data?.token) {
    setAdminToken(response.data.token);
    if (response.data.admin) {
      setAdminUser(response.data.admin);
    }
  }
  return response?.data || null;
}

/* ============================================================
   ADMIN ORDERS APIS
============================================================ */
export async function adminGetOrders({ page = 1, limit = 20, status = null, date = null } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (status && status !== 'all') params.set('status', status);
  if (date) params.set('date', date);

  const queryString = params.toString();
  const endpoint = queryString ? `/admin/orders?${queryString}` : '/admin/orders';
  const response = await apiRequest(endpoint);
  return {
    orders: response?.data || [],
    pagination: response?.pagination || { total: 0, page: Number(page), limit: Number(limit), total_pages: 1 }
  };
}

export async function adminGetOrderById(id) {
  const response = await apiRequest(`/admin/orders/${id}`);
  return response?.data || null;
}

export async function adminUpdateOrderStatus(id, status) {
  const response = await apiRequest(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  notifyStoreUpdated('ORDER_STATUS_UPDATED');
  return response?.data || null;
}

export async function adminUpdateOrderNote(id, admin_note) {
  const response = await apiRequest(`/admin/orders/${id}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ admin_note })
  });
  return response?.data || null;
}

/* ============================================================
   ADMIN PAYMENTS APIS
============================================================ */
export async function adminGetPayments({ page = 1, limit = 20, status = null, method = null, date = null } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (status && status !== 'all') params.set('status', status);
  if (method && method !== 'all') params.set('method', method);
  if (date) params.set('date', date);

  const queryString = params.toString();
  const endpoint = queryString ? `/admin/payments?${queryString}` : '/admin/payments';
  const response = await apiRequest(endpoint);
  return {
    payments: response?.data || [],
    pagination: response?.pagination || { total: 0, page: Number(page), limit: Number(limit), total_pages: 1 }
  };
}

export async function adminGetPaymentById(id) {
  const response = await apiRequest(`/admin/payments/${id}`);
  return response?.data || null;
}

export async function adminVerifyPayment(id) {
  const response = await apiRequest(`/admin/payments/${id}/verify`, {
    method: 'PATCH'
  });
  notifyStoreUpdated('PAYMENT_VERIFIED');
  return response?.data || null;
}

export async function adminRejectPayment(id, { admin_note, customer_message } = {}) {
  const response = await apiRequest(`/admin/payments/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ admin_note, customer_message })
  });
  notifyStoreUpdated('PAYMENT_REJECTED');
  return response?.data || null;
}

/* ============================================================
   ADMIN ANALYTICS & INSIGHTS APIS
============================================================ */
export async function adminGetAnalyticsOverview() {
  const response = await apiRequest('/admin/analytics/overview');
  return response?.data || null;
}

/* ============================================================
   LIVE STORE REAL-TIME SYNCHRONIZATION
   Broadcasts product and catalog changes across tabs and windows.
============================================================ */
export const STORE_SYNC_CHANNEL = 'abdi_store_sync_channel';
export const STORE_UPDATE_STORAGE_KEY = 'abdi_store_last_update';

let syncBroadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncBroadcastChannel = new BroadcastChannel(STORE_SYNC_CHANNEL);
  } catch (e) {
    console.warn('BroadcastChannel initialization warning:', e);
  }
}

/**
 * Flushes in-memory cache and broadcasts that catalog items have updated.
 */
export function notifyStoreUpdated(type = 'PRODUCTS_UPDATED') {
  productsCache = null;
  productDetailsCache.clear();

  const timestamp = Date.now().toString();

  // 1. BroadcastChannel across tabs
  if (syncBroadcastChannel) {
    try {
      syncBroadcastChannel.postMessage({ type, timestamp });
    } catch {
      // Broadcast channel send error ignored
    }
  }

  // 2. Storage event across tabs
  try {
    localStorage.setItem(STORE_UPDATE_STORAGE_KEY, timestamp);
  } catch {
    // Storage access error ignored
  }

  // 3. Local DOM custom event for current window
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('abdi_store_update', { detail: { type, timestamp } }));
  }
}

/**
 * Subscribes a component to real-time store catalog updates.
 * Fires on:
 * - BroadcastChannel messages
 * - localStorage storage events from other tabs
 * - Window focus (user switching tabs back to the store)
 * - document visibilitychange
 * - Regular lightweight 3s polling fallback
 * 
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToStoreUpdates(callback, pollIntervalMs = 12000) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const handleUpdate = () => {
    callback();
  };

  // 1. BroadcastChannel listener (fires across tabs on any product or order update)
  const channelListener = (event) => {
    if (event?.data) {
      handleUpdate();
    }
  };
  if (syncBroadcastChannel) {
    syncBroadcastChannel.addEventListener('message', channelListener);
  }

  // 2. Storage event listener (fires in other tabs when localStorage changes)
  const storageListener = (e) => {
    if (e.key === STORE_UPDATE_STORAGE_KEY) {
      handleUpdate();
    }
  };
  window.addEventListener('storage', storageListener);

  // 3. Window custom event (same tab)
  window.addEventListener('abdi_store_update', handleUpdate);

  // 4. Visibility and focus listeners (re-check as soon as user returns to tab)
  const visibilityListener = () => {
    if (document.visibilityState === 'visible') {
      handleUpdate();
    }
  };
  document.addEventListener('visibilitychange', visibilityListener);
  window.addEventListener('focus', handleUpdate);

  // 5. Polling fallback
  let intervalId = null;
  if (pollIntervalMs > 0) {
    intervalId = setInterval(handleUpdate, pollIntervalMs);
  }

  return () => {
    if (syncBroadcastChannel) {
      syncBroadcastChannel.removeEventListener('message', channelListener);
    }
    window.removeEventListener('storage', storageListener);
    window.removeEventListener('abdi_store_update', handleUpdate);
    document.removeEventListener('visibilitychange', visibilityListener);
    window.removeEventListener('focus', handleUpdate);
    if (intervalId) clearInterval(intervalId);
  };
}

/* ============================================================
   ADMIN PRODUCTS APIS
============================================================ */
export async function adminGetProducts() {
  const response = await apiRequest('/products?include_unavailable=true');
  return response?.data || [];
}

export async function adminCreateProduct(productData) {
  const response = await apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(productData)
  });
  notifyStoreUpdated('PRODUCT_CREATED');
  return response?.data || null;
}

export async function adminUpdateProduct(id, productData) {
  const response = await apiRequest(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(productData)
  });
  notifyStoreUpdated('PRODUCT_UPDATED');
  return response?.data || null;
}

export async function adminDeleteProduct(id) {
  const response = await apiRequest(`/products/${id}`, {
    method: 'DELETE'
  });
  notifyStoreUpdated('PRODUCT_DELETED');
  return response?.data || null;
}

export async function adminUploadProductMedia(productId, formData) {
  const response = await apiRequest(`/products/${productId}/media`, {
    method: 'POST',
    body: formData
  });
  notifyStoreUpdated('MEDIA_UPLOADED');
  return response?.data || null;
}

export async function adminDeleteProductMedia(mediaId) {
  const response = await apiRequest(`/products/media/${mediaId}`, {
    method: 'DELETE'
  });
  notifyStoreUpdated('MEDIA_DELETED');
  return response?.data || null;
}


/* ============================================================
   CUSTOMER ORDER HISTORY & TRACKING (LOCAL PERSISTENCE + REAL DB SYNC)
============================================================ */
export const MY_ORDERS_STORAGE_KEY = 'abdi_customer_orders';

export function getMySavedOrders() {
  try {
    const raw = localStorage.getItem(MY_ORDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMyOrder(order) {
  if (!order || !order.id) return;
  try {
    const existing = getMySavedOrders();
    const filtered = existing.filter((o) => o.id !== order.id);
    const snapshot = {
      id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      status: order.status,
      items: order.items,
      customer: order.customer || {
        name: order.customer_name,
        phone: order.customer_phone,
        address: order.delivery_address
      },
      customer_name: order.customer?.name || order.customer_name,
      customer_phone: order.customer?.phone || order.customer_phone,
      delivery_address: order.customer?.address || order.delivery_address,
      active_payment: order.active_payment,
      payments: order.payments,
      customer_note: order.customer_note,
      created_at: order.created_at || new Date().toISOString()
    };
    const updated = [snapshot, ...filtered].slice(0, 100);
    localStorage.setItem(MY_ORDERS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abdi_order_saved', { detail: order }));
    }
  } catch (err) {
    console.warn('Could not save order to local storage:', err);
  }
}

export function removeMySavedOrder(orderId) {
  try {
    const existing = getMySavedOrders();
    const updated = existing.filter((o) => o.id !== orderId);
    localStorage.setItem(MY_ORDERS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abdi_order_saved', { detail: { id: orderId, removed: true } }));
    }
  } catch {
    // ignore
  }
}

export async function getCustomerOrderById(id) {
  const response = await apiRequest(`/orders/${id}`);
  return response?.data || null;
}

export async function lookupCustomerOrder({ order_number, phone }) {
  const response = await apiRequest('/orders/lookup', {
    method: 'POST',
    body: JSON.stringify({ order_number, phone })
  });
  const order = response?.data || null;
  if (order) {
    saveMyOrder(order);
  }
  return order;
}

/**
 * Check backend maintenance mode status
 * @returns {Promise<{ success: boolean, maintenance: boolean, message?: string }>}
 */
export async function getMaintenanceStatus() {
  try {
    const res = await fetch(`${API_BASE}/maintenance`);
    if (!res.ok) return { success: false, maintenance: false };
    return await res.json();
  } catch {
    return { success: false, maintenance: false };
  }
}

export default {
  getMaintenanceStatus,
  getMySavedOrders,
  saveMyOrder,
  removeMySavedOrder,
  getCustomerOrderById,
  lookupCustomerOrder,
  apiRequest,
  getProducts,
  getProductById,
  getCachedProducts,
  getCachedProductById,
  preloadImages,
  createOrder,
  getPaymentMethods,
  submitPayment,
  checkBackendHealth,
  getAdminToken,
  setAdminToken,
  getAdminUser,
  setAdminUser,
  removeAdminToken,
  adminLogin,
  adminGetMe,
  adminLogout,
  adminUpdateCredentials,
  adminGetOrders,
  adminGetOrderById,
  adminUpdateOrderStatus,
  adminUpdateOrderNote,
  adminGetPayments,
  adminGetPaymentById,
  adminVerifyPayment,
  adminRejectPayment,
  adminGetProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUploadProductMedia,
  adminDeleteProductMedia,
  notifyStoreUpdated,
  subscribeToStoreUpdates
};



