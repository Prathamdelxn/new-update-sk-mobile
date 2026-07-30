import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';

const SuperAdminContext = createContext({
  saToken: null,
  superAdmin: null,
  saLogin: async () => {},
  saLogout: async () => {},
});

export const useSuperAdmin = () => useContext(SuperAdminContext);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const SuperAdminProvider = ({ children }) => {
  const [saToken, setSaToken] = useState(null);
  const [superAdmin, setSuperAdmin] = useState(null);

  const saLogin = useCallback(async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/superadmin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, message: data.message || 'Login failed' };

      await SecureStore.setItemAsync('saToken', data.saToken);
      setSaToken(data.saToken);
      setSuperAdmin(data.superAdmin);
      return { success: true };
    } catch {
      return { success: false, message: 'Network error. Check connection.' };
    }
  }, []);

  const saLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync('saToken');
    setSaToken(null);
    setSuperAdmin(null);
  }, []);

  // Helper: make an authenticated SA API call
  const saFetch = useCallback(async (path, options = {}) => {
    const token = saToken || (await SecureStore.getItemAsync('saToken'));
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  }, [saToken]);

  const contextValue = useMemo(() => ({
    saToken,
    superAdmin,
    saLogin,
    saLogout,
    saFetch,
  }), [saToken, superAdmin, saLogin, saLogout, saFetch]);

  return (
    <SuperAdminContext.Provider value={contextValue}>
      {children}
    </SuperAdminContext.Provider>
  );
};
