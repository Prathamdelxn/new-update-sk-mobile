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


const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const INTERIOR_API_URL = `${(process.env.EXPO_PUBLIC_INTERIOR_API_URL || '').replace(/\/+$/, '')}/api/v1`;

import { registerForPushNotificationsAsync } from '../../utils/pushNotifications';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const logoutRef = useRef(null);
  const isLoggingOutRef = useRef(false);
  const userRef = useRef(null);
  userRef.current = user;

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
        let parsedUser = null;
        try {
          parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          userRef.current = parsedUser;
        } catch {
          await SecureStore.deleteItemAsync('userData');
        }
        // Register push token for existing logged in user — no push-token
        // endpoint exists on the interior-os backend yet, so skip for those.
        if (parsedUser?.organization?.industryType !== 'interior') {
          registerDeviceToken(savedToken);
        }
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

  // Stores a session (from either backend) under the single shared token/user
  // keys so the rest of the app (dashboard, tabs, etc.) doesn't need to know
  // which backend it came from. Interior sessions embed `organization` into
  // `user.organization` so `user?.organization?.industryType === 'interior'`
  // checks (e.g. dashboard) work the same as the construction flow.
  const persistSession = useCallback(async (authToken, refreshToken, userObj) => {
    userRef.current = userObj;
    await SecureStore.setItemAsync('userToken', authToken);
    if (refreshToken) await SecureStore.setItemAsync('refreshToken', refreshToken);
    else await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.setItemAsync('userData', JSON.stringify(userObj));
    setToken(authToken);
    setUser(userObj);
    // No push-token endpoint exists on the interior-os backend yet.
    if (userObj?.organization?.industryType !== 'interior') {
      registerDeviceToken(authToken);
    }
  }, [registerDeviceToken]);

  const loginInterior = useCallback(async (email, password) => {
    console.log(`[interior login] ${INTERIOR_API_URL}/auth/login`);
    try {
      const response = await fetch(`${INTERIOR_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const { user, organization, tokens } = data.data;
        const mergedUser = { ...user, organization: { ...organization, industryType: 'interior' } };
        await persistSession(tokens.accessToken, tokens.refreshToken, mergedUser);
        return { success: true };
      } else {
        return { success: false, message: data.error || data.message || 'Login failed' };
      }
    } catch (e) {
      console.error('Interior login error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, [persistSession]);

  const login = useCallback(async (email, password, industryType = 'construction') => {
    if (industryType === 'interior') {
      return loginInterior(email, password);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const { token, refreshToken, user } = data;
        await persistSession(token, refreshToken, user);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (e) {
      console.error('Login error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, [loginInterior, persistSession]);

  const registerInterior = useCallback(async ({ organizationName, firstName, lastName, email, password }) => {
    try {
      const response = await fetch(`${INTERIOR_API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName, firstName, lastName, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error || data.message || 'Registration failed' };
      }
    } catch (e) {
      console.error('Interior register error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, []);

  const register = useCallback(async (name, email, password, phoneNumber, industryType = 'construction', interiorFields = {}) => {
    if (industryType === 'interior') {
      return registerInterior({ ...interiorFields, email, password });
    }

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
  }, [registerInterior]);

  const verifyInteriorOtp = useCallback(async (email, otp) => {
    try {
      const response = await fetch(`${INTERIOR_API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        const { user, organization, tokens } = data.data;
        const mergedUser = { ...user, organization: { ...organization, industryType: 'interior' } };
        await persistSession(tokens.accessToken, tokens.refreshToken, mergedUser);
        return { success: true };
      } else {
        return { success: false, message: data.error || data.message || 'OTP Verification failed' };
      }
    } catch (e) {
      console.error('Interior verify OTP error', e);
      return { success: false, message: 'Network error. Check server/IP.' };
    }
  }, [persistSession]);

  const verifyRegistrationOtp = useCallback(async (email, otp, password, industryType = 'construction') => {
    if (industryType === 'interior') {
      return verifyInteriorOtp(email, otp);
    }

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
  }, [login, verifyInteriorOtp]);

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
      // Interior sessions carry an interior-os JWT, not a construction one.
      // Any call to the construction API would 401 and trip the auto-logout
      // flow below, bouncing the user back to login — so block it here,
      // globally, instead of relying on every screen to remember to guard.
      const isInteriorSession = userRef.current?.organization?.industryType === 'interior';
      const isConstructionCall = typeof url === 'string' && (
        (API_BASE_URL && url.startsWith(API_BASE_URL)) ||
        url.includes('new-update-two.vercel.app') ||
        url.includes('sky-lite-api.vercel.app')
      );

      if (isInteriorSession && isConstructionCall) {
        console.warn('[blocked] construction API call from interior session:', url);
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let response = await originalFetch(url, options);

      // If 401 Unauthorized, and it's an API request (not login, refresh, or logout)
      if (
        response.status === 401 &&
        isConstructionCall &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/refresh') &&
        !url.includes('/auth/logout')
      ) {
        // Never logout an interior session due to a construction API 401!
        if (isInteriorSession) {
          console.warn('[ignored 401] Construction API 401 ignored for interior session:', url);
          return response;
        }

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

      // Same idea for interior-os sessions, but that backend's refresh
      // endpoint returns { data: { accessToken, refreshToken } } instead of
      // { token } — handled separately since the shapes differ.
      if (
        response.status === 401 &&
        typeof url === 'string' &&
        url.startsWith(INTERIOR_API_URL) &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/refresh') &&
        !url.includes('/auth/signup') &&
        !url.includes('/auth/verify-email')
      ) {
        const currentRefreshToken = await SecureStore.getItemAsync('refreshToken');

        if (currentRefreshToken) {
          try {
            const refreshResponse = await originalFetch(`${INTERIOR_API_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: currentRefreshToken }),
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              const newAccessToken = data?.data?.accessToken;
              const newRefreshToken = data?.data?.refreshToken;
              if (!newAccessToken) {
                logoutRef.current();
                return response;
              }
              await SecureStore.setItemAsync('userToken', newAccessToken);
              if (newRefreshToken) await SecureStore.setItemAsync('refreshToken', newRefreshToken);
              setToken(newAccessToken);

              // interiorApiClient always sends headers as a plain object.
              const newOptions = { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${newAccessToken}` } };
              return await originalFetch(url, newOptions);
            } else {
              logoutRef.current();
            }
          } catch (e) {
            console.error('Interior auto-refresh network error:', e);
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
