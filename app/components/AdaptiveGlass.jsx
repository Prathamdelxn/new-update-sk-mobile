import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * A platform-agnostic Glass component to solve Android rendering crashes.
 * On iOS: Renders premium native BlurView.
 * On Android: Renders specialized semi-transparent View to prevent hardware bitmap errors.
 */
const AdaptiveGlass = ({ intensity = 30, tint = 'light', style, children }) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }

  // Android Fallback: Solid glass effect with higher opacity for the border-first look
  const getBackgroundColor = () => {
    switch (tint) {
      case 'dark':
        return 'rgba(15, 23, 42, 0.95)';
      case 'light':
        return 'rgba(255, 255, 255, 0.92)'; // More solid professional light
      default:
        return 'rgba(255, 255, 255, 0.9)';
    }
  };

  return (
    <View 
      style={[
        { 
          backgroundColor: getBackgroundColor(),
          borderWidth: 1,
          borderColor: tint === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1', // Crisp Slate Border
        },
        style
      ]}
    >
      {children}
    </View>
  );
};

export default AdaptiveGlass;
