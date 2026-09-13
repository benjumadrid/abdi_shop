import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  adminGetProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUploadProductMedia,
  adminDeleteProductMedia
} from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';
import { useToast } from '../../hooks/useToast';

export default function AdminProductsPage() {
  const { formatPrice } = useLanguage();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown state for Stock Status selection per row
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Modal State (Create or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentProduct, setCurrentProduct] = useState(null);

  // Form Fields
  const [nameEn, setNameEn] = useState('');
  const [nameAm, setNameAm] = useState('');
  const [price, setPrice] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [descEn, setDescEn] = useState('');
  const [descAm, setDescAm] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Media file upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState(null);

  // Quick toggle loading state tracking by productId
  const [togglingId, setTogglingId] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.stock-dropdown-container')) {
        setOpenDropdownId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError(err?.message || 'Could not load products from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchEn = (p.name_en || '').toLowerCase().includes(q);
      const matchAm = (p.name_am || '').toLowerCase().includes(q);
      return matchEn || matchAm;
    });
  }, [products, searchQuery]);

  // Inventory stats
  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.is_available !== false).length;
    const outOfStock = total - inStock;
    return { total, inStock, outOfStock };
  }, [products]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setCurrentProduct(null);
    setNameEn('');
    setNameAm('');
    setPrice('');
    setIsAvailable(true);
    setDescEn('');
    setDescAm('');
    setImageUrl('');
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (product) => {
    setModalMode('edit');
    setCurrentProduct(product);
    setNameEn(product.name_en || '');
    setNameAm(product.name_am || '');
    setPrice(String(product.price || ''));
    setIsAvailable(product.is_available !== false);
    setDescEn(product.description_en || '');
    setDescAm(product.description_am || '');

    // Only populate External Image URL if it is an actual external/custom URL,
    // not an internal uploaded media URL (/api/products/media/...)
    const existingUrl = product.image_url || '';
    const isInternalMedia = existingUrl.startsWith('/api/products/media/') || existingUrl.startsWith('/api/media/');
    setImageUrl(isInternalMedia ? '' : existingUrl);

    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setModalError(null);
  };

  // Handle image file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (5MB)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setModalError('Please select a valid JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setModalError('Image file size cannot exceed 5 MB.');
      return;
    }

    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    setModalError(null);
  };

  // Save product (Create or Edit)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setModalError(null);

    const cleanNameEn = nameEn.trim();
    const cleanNameAm = nameAm.trim();
    const cleanPrice = parseFloat(price);

    if (!cleanNameEn) {
      setModalError('Product English name is required.');
      return;
    }
    if (!cleanNameAm) {
      setModalError('Product Amharic name is required.');
      return;
    }
    if (isNaN(cleanPrice) || cleanPrice < 0) {
      setModalError('Please enter a valid price greater than or equal to 0.');
      return;
    }

    setModalSubmitting(true);
    try {
      const cleanImageUrl = imageUrl.trim();
      const isInternalMediaUrl = cleanImageUrl.startsWith('/api/products/media/') || cleanImageUrl.startsWith('/api/media/');

      const payload = {
        name_en: cleanNameEn,
        name_am: cleanNameAm,
        price: cleanPrice,
        is_available: isAvailable,
        description_en: descEn.trim() || null,
        description_am: descAm.trim() || null,
        image_url: (cleanImageUrl && !isInternalMediaUrl) ? cleanImageUrl : null
      };

      let savedProduct;
      if (modalMode === 'create') {
        savedProduct = await adminCreateProduct(payload);
        const msg = `Product "${cleanNameEn}" created successfully.`;
        setActionSuccess(msg);
        toast.success(msg, 'Product Created');
      } else {
        savedProduct = await adminUpdateProduct(currentProduct.id, payload);
        const msg = `Product "${cleanNameEn}" updated successfully.`;
        setActionSuccess(msg);
        toast.success(msg, 'Product Updated');
      }

      // If a new media image file was selected, upload using existing POST /api/products/:id/media
      const targetId = savedProduct?.id || currentProduct?.id;
      if (selectedFile && targetId) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('is_primary', 'true');
        formData.append('sort_order', '0');
        await adminUploadProductMedia(targetId, formData);
      }

      handleCloseModal();
      loadProducts();
    } catch (err) {
      console.error('Failed to save product:', err);
      const errMsg = err?.message || 'Could not save product.';
      setModalError(errMsg);
      toast.error(errMsg, 'Save Failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Stock Status selection from dropdown: In Stock vs Out of Stock
  const handleSetStockStatus = async (product, newStatus) => {
    if (product.is_available === newStatus) {
      setOpenDropdownId(null);
      return;
    }
    setTogglingId(product.id);
    setOpenDropdownId(null);
    setActionSuccess(null);
    try {
      await adminUpdateProduct(product.id, { is_available: newStatus });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: newStatus } : p))
      );
      const msg = `"${product.name_en}" set to ${newStatus ? 'In Stock' : 'Out of Stock'}.`;
      setActionSuccess(msg);
      toast.success(msg, 'Stock Updated');
    } catch (err) {
      console.error('Failed to update stock status:', err);
      const errMsg = err?.message || 'Could not update stock status.';
      setError(errMsg);
      toast.error(errMsg, 'Update Failed');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete product handler (runs upon explicit confirmation)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionSuccess(null);
    try {
      await adminDeleteProduct(deleteTarget.id);
      const msg = `Product "${deleteTarget.name_en}" deleted successfully.`;
      setActionSuccess(msg);
      toast.success(msg, 'Product Deleted');
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      const errMsg = err?.message || 'Could not delete product.';
      setError(errMsg);
      toast.error(errMsg, 'Delete Failed');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Delete media item from product
  const handleDeleteMedia = async (mediaId) => {
    if (!currentProduct) return;
    setDeletingMediaId(mediaId);
    setModalError(null);
    try {
      await adminDeleteProductMedia(mediaId, currentProduct.id);
      // Update local modal state
      setCurrentProduct((prev) => ({
        ...prev,
        media: prev.media.filter((m) => m.id !== mediaId)
      }));
      loadProducts();
    } catch (err) {
      console.error('Failed to delete media:', err);
      setModalError(err?.message || 'Failed to remove media item.');
    } finally {
      setDeletingMediaId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-10">
      {/* ── TOP PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight">
            Products Catalog
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            Manage your store catalog, pricing, localized descriptions, and product media
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadProducts}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs font-bold text-ink-700 shadow-sm transition cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* ── METRIC TILES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-surface-200/80 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-ink-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wider block">Total Catalog</span>
            <span className="text-xl font-black text-ink-950">{stats.total} Products</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200/80 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wider block">In Stock</span>
            <span className="text-xl font-black text-emerald-700">{stats.inStock} Available</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200/80 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wider block">Out of Stock</span>
            <span className="text-xl font-black text-amber-700">{stats.outOfStock} Out of Stock</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button type="button" onClick={loadProducts} className="text-xs font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── TOOLBAR / SEARCH ── */}
      <div className="bg-white rounded-2xl border border-surface-200/80 p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by English or Amharic name..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-surface-200 text-xs text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 bg-surface-50/50"
          />
        </div>
        <div className="text-xs text-ink-400 font-medium px-1">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* ── PRODUCTS TABLE CARD ── */}
      <div className="bg-white rounded-2xl border border-surface-200/80 shadow-sm overflow-visible">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-ink-400">Loading store catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 text-ink-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                {searchQuery ? 'No products match your search query' : 'Catalog is currently empty'}
              </h3>
              <p className="text-xs text-ink-500 mt-1">
                {searchQuery
                  ? `No products found for "${searchQuery}". Clear the search query to see all products.`
                  : 'Start adding products to your store to make them available for customer orders.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-sm hover:bg-brand-700 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Your First Product</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/50 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    <th className="py-3.5 px-6">Product</th>
                    <th className="py-3.5 px-6">Amharic (ስም)</th>
                    <th className="py-3.5 px-6">Unit Price</th>
                    <th className="py-3.5 px-6">Stock Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-xs">
                  {filteredProducts.map((product) => {
                    const primaryUrl =
                      product.image_url ||
                      (Array.isArray(product.media) && product.media.find((m) => m.is_primary)?.url) ||
                      (Array.isArray(product.media) && product.media[0]?.url) ||
                      null;

                    const isProductInStock = product.is_available !== false;

                    return (
                      <tr key={product.id} className="hover:bg-surface-50/70 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            {primaryUrl ? (
                              <img
                                src={primaryUrl}
                                alt={product.name_en}
                                className="w-12 h-12 rounded-xl object-contain bg-surface-50 border border-surface-200/80 p-0.5 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-surface-100 border border-surface-200 flex items-center justify-center text-ink-400 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div>
                              <span className="font-extrabold text-ink-950 text-sm block">
                                {product.name_en}
                              </span>
                              {product.description_en && (
                                <span className="text-[11px] text-ink-400 line-clamp-1 max-w-xs mt-0.5">
                                  {product.description_en}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-medium text-ink-600">
                          {product.name_am}
                        </td>
                        <td className="py-4 px-6 font-black text-brand-700 text-sm">
                          {formatPrice(product.price)}
                        </td>

                        {/* STOCK STATUS CELL WITH INTERACTIVE DROPDOWN */}
                        <td className="py-4 px-6">
                          <div className="relative inline-block text-left stock-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === product.id ? null : product.id);
                              }}
                              disabled={togglingId === product.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer border shadow-xs ${
                                isProductInStock
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80'
                                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/80'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isProductInStock ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span>{isProductInStock ? 'In Stock' : 'Out of Stock'}</span>
                              <svg className="w-3 h-3 text-ink-400 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {openDropdownId === product.id && (
                              <div className="absolute left-0 mt-1.5 w-40 rounded-2xl bg-white border border-surface-200/90 shadow-float z-30 py-1 text-xs animate-fade-up">
                                <button
                                  type="button"
                                  onClick={() => handleSetStockStatus(product, true)}
                                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-surface-50 cursor-pointer font-bold ${
                                    isProductInStock ? 'text-emerald-700 bg-emerald-50/50' : 'text-ink-700'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>In Stock</span>
                                  </span>
                                  {isProductInStock && <span className="text-emerald-600 text-xs">✓</span>}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetStockStatus(product, false)}
                                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-surface-50 cursor-pointer font-bold ${
                                    !isProductInStock ? 'text-amber-800 bg-amber-50/50' : 'text-ink-700'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span>Out of Stock</span>
                                  </span>
                                  {!isProductInStock && <span className="text-amber-700 text-xs">✓</span>}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(product)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-100 text-ink-800 text-xs font-bold transition cursor-pointer shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(product)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-surface-100">
              {filteredProducts.map((product) => {
                const primaryUrl =
                  product.image_url ||
                  (Array.isArray(product.media) && product.media.find((m) => m.is_primary)?.url) ||
                  (Array.isArray(product.media) && product.media[0]?.url) ||
                  null;

                const isProductInStock = product.is_available !== false;

                return (
                  <div key={product.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3.5">
                      {primaryUrl ? (
                        <img
                          src={primaryUrl}
                          alt={product.name_en}
                          className="w-16 h-16 rounded-2xl object-contain bg-surface-50 border border-surface-200 p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-surface-100 border border-surface-200 flex items-center justify-center text-ink-400 shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-ink-950 text-sm leading-tight truncate">
                          {product.name_en}
                        </h3>
                        <p className="text-xs text-ink-500 font-medium truncate mt-0.5">{product.name_am}</p>
                        <p className="text-sm font-black text-brand-700 mt-1">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Mobile Stock Status Dropdown */}
                      <div className="relative inline-block text-left stock-dropdown-container">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === product.id ? null : product.id);
                          }}
                          disabled={togglingId === product.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isProductInStock
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border-amber-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isProductInStock ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>{isProductInStock ? 'In Stock' : 'Out of Stock'}</span>
                          <svg className="w-3 h-3 text-ink-400 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {openDropdownId === product.id && (
                          <div className="absolute left-0 mt-1.5 w-36 rounded-xl bg-white border border-surface-200 shadow-float z-30 py-1 text-xs">
                            <button
                              type="button"
                              onClick={() => handleSetStockStatus(product, true)}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between font-bold ${
                                isProductInStock ? 'text-emerald-700 bg-emerald-50/50' : 'text-ink-700'
                              }`}
                            >
                              <span>In Stock</span>
                              {isProductInStock && <span>✓</span>}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetStockStatus(product, false)}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between font-bold ${
                                !isProductInStock ? 'text-amber-800 bg-amber-50/50' : 'text-ink-700'
                              }`}
                            >
                              <span>Out of Stock</span>
                              {!isProductInStock && <span>✓</span>}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(product)}
                          className="px-3 py-1.5 rounded-xl border border-surface-200 text-xs font-bold text-ink-800 hover:bg-surface-50 shadow-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(product)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── CREATE / EDIT PRODUCT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={handleCloseModal} />

          {/* Modal Container */}
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-float border border-surface-200/80 overflow-hidden my-8 z-10 animate-fade-up max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-surface-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h2 className="text-lg font-black text-ink-950">
                  {modalMode === 'create' ? 'Add New Product' : `Edit Product: ${currentProduct?.name_en}`}
                </h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  Fill in product details in both English and Amharic for store visitors
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-ink-400 hover:bg-surface-100 hover:text-ink-800 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveProduct} noValidate className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-surface-50/30">
              {modalError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {modalError}
                </div>
              )}

              {/* Names: English & Amharic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs">
                  <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                    English Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Traditional Coffee Set"
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border-2 border-surface-300 text-sm font-medium text-ink-900 bg-white outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition shadow-2xs"
                  />
                </div>
                <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs">
                  <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                    Amharic Name (ስም) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAm}
                    onChange={(e) => setNameAm(e.target.value)}
                    placeholder="e.g. የቡና ጀበና እና ሲኒ"
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border-2 border-surface-300 text-sm font-medium text-ink-900 bg-white outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Price & Stock Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs">
                  <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                    Price (ETB / ብር) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">
                      ETB
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="1200.00"
                      className="w-full pl-14 pr-4 py-2.5 sm:py-3 rounded-xl border-2 border-surface-300 text-sm font-bold text-ink-900 bg-white outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs flex flex-col justify-center">
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">
                    Stock Availability
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAvailable(true)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isAvailable
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                          : 'bg-surface-50 border-surface-200 text-ink-500 hover:bg-surface-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>In Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAvailable(false)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        !isAvailable
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                          : 'bg-surface-50 border-surface-200 text-ink-500 hover:bg-surface-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Out of Stock</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs">
                  <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                    Description (English)
                  </label>
                  <textarea
                    rows={3}
                    value={descEn}
                    onChange={(e) => setDescEn(e.target.value)}
                    placeholder="Product highlights, sizing, and details in English..."
                    className="w-full p-3.5 rounded-xl border-2 border-surface-300 text-sm text-ink-900 bg-white outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 resize-none font-medium transition shadow-2xs"
                  />
                </div>

                <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs">
                  <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                    Description (Amharic / መግለጫ)
                  </label>
                  <textarea
                    rows={3}
                    value={descAm}
                    onChange={(e) => setDescAm(e.target.value)}
                    placeholder="የምርቱ ዝርዝር መረጃ እና ባህሪያት በአማርኛ..."
                    className="w-full p-3.5 rounded-xl border-2 border-surface-300 text-sm text-ink-900 bg-white outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 resize-none font-medium transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Primary Image URL */}
              <div className="bg-white p-4 rounded-2xl border-2 border-surface-200/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-ink-900">
                    External Image URL (Optional)
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      Clear URL
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... or /assets/... (Optional)"
                    className="w-full px-4 py-2.5 sm:py-3 pr-10 rounded-xl border-2 border-surface-300 text-sm font-medium text-ink-900 bg-white outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition shadow-2xs"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      title="Clear URL"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* MEDIA FILE UPLOAD */}
              <div className="bg-white p-4 rounded-2xl border border-surface-200/80 shadow-sm space-y-3">
                <div>
                  <label className="block text-xs font-bold text-ink-800">
                    Upload Product Image File
                  </label>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    Accepts JPG, PNG, WEBP (Max 5 MB). Uploads securely via backend product media API.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!selectedFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 rounded-2xl border-2 border-dashed border-surface-300 hover:border-brand-500 hover:bg-brand-50/30 text-xs font-bold text-ink-600 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-ink-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <span>Click to browse and upload product image</span>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl border border-surface-200 bg-surface-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {filePreview && (
                        <img src={filePreview} alt="Preview" className="w-12 h-12 rounded-xl object-contain bg-white border border-surface-200 p-0.5 shadow-xs" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-ink-900 truncate max-w-[220px]">{selectedFile.name}</p>
                        <p className="text-[11px] text-ink-400">{Math.round(selectedFile.size / 1024)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (filePreview) URL.revokeObjectURL(filePreview);
                        setFilePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Existing media items display when editing */}
                {modalMode === 'edit' && Array.isArray(currentProduct?.media) && currentProduct.media.length > 0 && (
                  <div className="pt-2 border-t border-surface-100">
                    <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wider block mb-2">
                      Existing Uploaded Media ({currentProduct.media.length})
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {currentProduct.media.map((m) => (
                        <div key={m.id} className="relative group w-16 h-16 rounded-xl border border-surface-200 overflow-hidden bg-white shadow-xs">
                          <img src={m.url} alt="Media" className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(m.id)}
                            disabled={deletingMediaId === m.id}
                            title="Delete photo"
                            className="absolute inset-0 bg-rose-950/80 text-white font-bold text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer disabled:opacity-100"
                          >
                            {deletingMediaId === m.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              <span>Delete</span>
                            )}
                          </button>
                          {/* Visible delete badge on touch screens */}
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(m.id)}
                            disabled={deletingMediaId === m.id}
                            title="Delete photo"
                            className="sm:hidden absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[9px] flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-surface-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={modalSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-xs font-bold text-ink-700 hover:bg-surface-50 cursor-pointer shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Saving Product...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'create' ? 'Create Product' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-float border border-surface-200/80 space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-ink-950">Delete Product?</h3>
              <p className="text-xs text-ink-500">
                Are you sure you want to permanently delete <span className="font-bold text-ink-800">{deleteTarget.name_en}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="w-1/2 py-2.5 rounded-xl border border-surface-200 bg-white text-xs font-bold text-ink-700 hover:bg-surface-50 cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
