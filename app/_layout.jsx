import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SplashScreen } from 'expo-router';
import { I18nManager } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SocketProvider } from './context/SocketContext';
import { SuperAdminProvider } from './context/SuperAdminContext';
import i18n from '../i18n';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
//hfmhfggjhgf
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-Black': Inter_900Black,
  });
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    async function restoreLanguage() {
      try {
        const savedLang = await SecureStore.getItemAsync('settings.lang');
        const isLayoutRestart = await SecureStore.getItemAsync('isLayoutRestart');

        if (savedLang) {
          if (savedLang !== i18n.language) {
            await i18n.changeLanguage(savedLang);
          }

          const shouldBeRTL = savedLang === 'ar';
          // If RTL state doesn't match saved language and we haven't already tried restarting
          if (shouldBeRTL !== I18nManager.isRTL && !isLayoutRestart) {
            I18nManager.forceRTL(shouldBeRTL);
            I18nManager.allowRTL(shouldBeRTL);
            await SecureStore.setItemAsync('isLayoutRestart', 'true');
            try {
              if (__DEV__) {
                const { NativeModules } = require('react-native');
                NativeModules.DevSettings.reload();
              } else {
                await Updates.reloadAsync();
              }
            } catch (e) {}
            return; // wait for restart, don't set langReady
          }
        }
      } catch (e) {
        // ignore, fall back to default
      }
      setLangReady(true);
    }
    restoreLanguage();
  }, []);

  useEffect(() => {
    if ((loaded || error) && langReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, langReady]);

  const router = import('expo-router').then(r => r.useRouter?.() || null).catch(() => null);
  
  useEffect(() => {
    import('expo-notifications').then(Notifications => {
      const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
        const data = response.notification.request.content.data;
        
        // Handle Quick Reply
        if (response.actionIdentifier === 'reply' && response.userText) {
          try {
            const SecureStore = await import('expo-secure-store');
            const token = await SecureStore.getItemAsync('userToken');
            if (token && data?.projectId) {
              await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${data.projectId}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: response.userText })
              });
            }
          } catch (e) {
            console.error('Quick reply failed', e);
          }
          return; // Do not open the app
        }

        // Default Tap Action: Open App to Chat
        if (data?.projectId) {
          import('expo-router').then(({ router }) => {
            setTimeout(() => {
              router.push({ pathname: `/project/${data.projectId}`, params: { initialTab: data.screen || 'Chat' } });
            }, 500);
          });
        }
      });
      return () => subscription.remove();
    }).catch(() => {});
  }, []);

  if ((!loaded && !error) || !langReady) {
    return null;
  }

  return (
    <SuperAdminProvider>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {/* All screens will appear here automatically */}
            </Stack>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </SuperAdminProvider>
  );
}