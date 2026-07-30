import React, { createContext, useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';

const AuthContext = createContext({
  user: null,
  token: null,
  login: async (email, password) => { },
  logout: async () => { },
  register: async (name, email, password) => { },
  verifyRegistrationOtp: async (email, otp, password) => { },
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);


const API_BASE_URL =process.env.EXPO_PUBLIC_API_BASE_URL;

import { registerForPushNotificationsAsync } from '../../utils/pushNotifications';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const logoutRef = useRef(null);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    loadStorageData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const isRoot = segments.length === 0 || (segments.length === 1 && segments[0] === '');
      const inAuthGroup = segments[0] === 'auth';
      const isOnboarding = segments[0] === 'onboarding';
      const isSuperAdmin = segments[0] === 'superadmin';

      if (isRoot) return; // Let index.jsx handle initial routing

      if (!token && !inAuthGroup && !isOnboarding && !isSuperAdmin) {
        // Not logged in and not in public screens? Go to login
        router.replace('/auth/login');
      } else if (token && (inAuthGroup || isOnboarding)) {
        // Logged in but on public/onboarding screens? Go to dashboard
        router.replace('/(tabs)/dashboard');
      }
    }
  }, [token, segments, isLoading]);

  async function loadStorageData() {
    try {
      const savedToken = await SecureStore.getItemAsync('userToken');
      const savedUser = await SecureStore.getItemAsync('userData');
      if (savedToken && savedUser) {
        setToken(savedToken);
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          await SecureStore.deleteItemAsync('userData');
        }
        // Register push token for existing logged in user
        registerDeviceToken(savedToken);
      }
    } catch (e) {
      console.error('Failed to load storage data', e);
    } finally {
      setIsLoading(false);
    }
  }

  const registerDeviceToken = useCallback(async (authToken) => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        await fetch(`${API_BASE_URL}/users/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ token: pushToken }),
        });
      }
    } catch (e) {
      console.warn('Failed to register device token', e);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    console.log(`${API_BASE_URL}/auth/login`);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const { token, refreshToken, user } = data;

        await SecureStore.setItemAsync('userToken', token);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
        await SecureStore.setItemAsync('userData', JSON.stringify(user));

        setToken(token);
        setUser(user);
        
        // Register push token
        registerDeviceToken(token);
        
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (e) {
      console.error('Login error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, [registerDeviceToken]);

  const register = useCallback(async (name, email, password, phoneNumber, industryType = 'construction') => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phoneNumber, industryType }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || 'Registration failed' };
      }
    } catch (e) {
      console.error('Register error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, []);

  const verifyRegistrationOtp = useCallback(async (email, otp, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        // Automatically log the user in after successful verification
        return await login(email, password);
      } else {
        return { success: false, message: data.message || 'OTP Verification failed' };
      }
    } catch (e) {
      console.error('Verify OTP error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, [login]);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    try {
      const currentToken = await SecureStore.getItemAsync('userToken');
      // Inform backend about logout for audit logging
      if (currentToken) {
        // Use original fetch if possible to avoid infinite loops, but standard fetch works too
        // since we check url.includes('/auth/logout') in the interceptor
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
      }
    } catch (e) {
      console.warn('Backend logout failed, proceeding with local logout', e);
    } finally {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('userData');
      setToken(null);
      setUser(null);
      router.replace('/auth/login');
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 1000);
    }
  }, [router]);

  // Keep ref pointing at latest logout so the fetch interceptor never captures a stale closure
  logoutRef.current = logout;

  useEffect(() => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options = {}) => {
      let response = await originalFetch(url, options);

      // If 401 Unauthorized, and it's an API request (not login, refresh, or logout)
      if (
        response.status === 401 &&
        typeof url === 'string' &&
        url.startsWith(API_BASE_URL) &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/refresh') &&
        !url.includes('/auth/logout')
      ) {
        const currentRefreshToken = await SecureStore.getItemAsync('refreshToken');

        if (currentRefreshToken) {
          try {
            const refreshResponse = await originalFetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: currentRefreshToken })
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              if (!data.token) {
                logoutRef.current();
                return response;
              }
              await SecureStore.setItemAsync('userToken', data.token);
              setToken(data.token);

              // Retry original request with new token
              const newOptions = { ...options };
              if (newOptions.headers) {
                if (typeof newOptions.headers.set === 'function') {
                  newOptions.headers.set('Authorization', `Bearer ${data.token}`);
                } else if (Array.isArray(newOptions.headers)) {
                  const authIndex = newOptions.headers.findIndex(h => h[0].toLowerCase() === 'authorization');
                  if (authIndex >= 0) newOptions.headers[authIndex][1] = `Bearer ${data.token}`;
                  else newOptions.headers.push(['Authorization', `Bearer ${data.token}`]);
                } else {
                  const headersCopy = { ...newOptions.headers };
                  delete headersCopy['authorization'];
                  delete headersCopy['Authorization'];
                  headersCopy['Authorization'] = `Bearer ${data.token}`;
                  newOptions.headers = headersCopy;
                }
              }

              return await originalFetch(url, newOptions);
            } else {
              logoutRef.current();
            }
          } catch (e) {
            console.error('Auto-refresh network error:', e);
            logoutRef.current();
          }
        } else {
          logoutRef.current();
        }
      }

      return response;
    };

    return () => {
      global.fetch = originalFetch;
    };
  }, []);

  const contextValue = useMemo(() => ({
    user,
    token,
    login,
    logout,
    register,
    verifyRegistrationOtp,
    isLoading
  }), [user, token, login, logout, register, verifyRegistrationOtp, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
