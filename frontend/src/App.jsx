import { LanguageProvider } from './context/LanguageContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ToastProvider } from './context/ToastContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <LanguageProvider>
      <AdminAuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  );
}

