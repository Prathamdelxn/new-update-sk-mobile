import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    async function checkState() {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const isLayoutRestart = await SecureStore.getItemAsync('isLayoutRestart');
        const hasSelectedLanguage = await SecureStore.getItemAsync('hasSelectedLanguage');

        if (token) {
          setInitialRoute('/(tabs)/dashboard');
        } else if (isLayoutRestart) {
          await SecureStore.deleteItemAsync('isLayoutRestart');
          setInitialRoute('/onboarding');
        } else if (hasSelectedLanguage) {
          setInitialRoute('/onboarding');
        } else {
          setInitialRoute('/onboarding');
        }
      } catch (error) {
        setInitialRoute('/onboarding');
      }
    }
    checkState();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <Redirect href={initialRoute} />;
}
