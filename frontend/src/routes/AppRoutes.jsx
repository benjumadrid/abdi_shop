import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import HomePage from '../pages/HomePage';
import ProductsPage from '../pages/ProductsPage';
import ProductDetailPage from '../pages/ProductDetailPage';
import NotFoundPage from '../pages/NotFoundPage';
import MaintenancePage from '../pages/MaintenancePage';
import { useMaintenanceMode } from '../hooks/useMaintenanceMode';

// Admin Portal Pages & Layout
import AdminLayout from '../components/admin/AdminLayout';
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminOrdersPage from '../pages/admin/AdminOrdersPage';
import AdminPaymentsPage from '../pages/admin/AdminPaymentsPage';
import AdminProductsPage from '../pages/admin/AdminProductsPage';

export default function AppRoutes() {
  const { isMaintenance } = useMaintenanceMode();

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Public Route - Always Accessible */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected Admin Routes - Always Accessible */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="products" element={<AdminProductsPage />} />
        </Route>

        {/* Customer Facing Routes (Show Maintenance when active) */}
        {isMaintenance ? (
          <Route path="*" element={<MaintenancePage />} />
        ) : (
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
