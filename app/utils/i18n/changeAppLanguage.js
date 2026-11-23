// Switch the whole app between English and Arabic (same steps as Construction
// Settings / the first-launch language screen): save the choice, set the layout
// direction and reload, so every screen — including tr() text — re-renders.
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';
import i18n from '../../../i18n';

export async function changeAppLanguage(lng, onReloadFailed) {
  if (lng === i18n.language) return;
  await i18n.changeLanguage(lng);
  await SecureStore.setItemAsync('settings.lang', lng);
  const rtl = lng === 'ar';
  if (rtl !== I18nManager.isRTL) {
    I18nManager.forceRTL(rtl);
    I18nManager.allowRTL(rtl);
  }
  setTimeout(async () => {
    try {
      if (__DEV__) {
        const { NativeModules } = require('react-native');
        NativeModules.DevSettings.reload();
      } else {
        await Updates.reloadAsync();
      }
    } catch (e) {
      onReloadFailed?.(e);
    }
  }, 400);
}

export default changeAppLanguage;
