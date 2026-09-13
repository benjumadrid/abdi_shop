import { useState, useEffect, useCallback } from 'react';
import { AdminAuthContext } from './admin-auth-context';
import {
  getAdminToken,
  getAdminUser,
  setAdminToken,
  setAdminUser,
  removeAdminToken,
  adminLogin as apiLogin,
  adminGetMe as apiGetMe,
  adminLogout as apiLogout,
  adminUpdateCredentials as apiUpdateCredentials
} from '../services/api';

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => getAdminUser());
  const [token, setToken] = useState(() => getAdminToken());
  const [loading, setLoading] = useState(() => Boolean(getAdminToken()));

  // Verify session on mount if token exists
  useEffect(() => {
    let isMounted = true;
    const initialToken = getAdminToken();

    if (!initialToken) {
      setLoading(false);
      return;
    }

    apiGetMe()
      .then((profile) => {
        if (isMounted && profile) {
          setAdmin(profile);
          setAdminUser(profile);
        }
      })
      .catch((err) => {
        console.warn('Admin session validation failed:', err?.message || err);
        if (isMounted) {
          removeAdminToken();
          setAdmin(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin({ email, password });
    if (data?.token) {
      setToken(data.token);
      setAdminToken(data.token);
      if (data.admin) {
        setAdmin(data.admin);
        setAdminUser(data.admin);
      }
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Discard client state even if server logout endpoint fails
    } finally {
      removeAdminToken();
      setToken(null);
      setAdmin(null);
    }
  }, []);

  const updateCredentials = useCallback(async (payload) => {
    const data = await apiUpdateCredentials(payload);
    if (data?.token) {
      setToken(data.token);
      setAdminToken(data.token);
    }
    if (data?.admin) {
      setAdmin(data.admin);
      setAdminUser(data.admin);
    }
    return data;
  }, []);

  const value = {
    admin,
    token,
    isAuthenticated: Boolean(token && admin),
    loading,
    login,
    logout,
    updateCredentials
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export default AdminAuthProvider;
