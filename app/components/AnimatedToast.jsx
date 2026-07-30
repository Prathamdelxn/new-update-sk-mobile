// import React, { useEffect, useRef } from 'react';
// import { Animated, Text, StyleSheet, Platform, View, Easing, Dimensions } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';

// const { width: SCREEN_WIDTH } = Dimensions.get('window');
// const FULL_WIDTH = SCREEN_WIDTH - 32; 
// const CIRCLE_WIDTH = 56; 

// export default function AnimatedToast({ visible, message, type = 'success', onHide }) {
//   const translateY = useRef(new Animated.Value(-150)).current;
//   const containerWidth = useRef(new Animated.Value(CIRCLE_WIDTH)).current;
//   const iconScale = useRef(new Animated.Value(0)).current;
  
//   const textTranslateX = useRef(new Animated.Value(15)).current;
//   const textOpacity = useRef(new Animated.Value(0)).current;

//   const insets = useSafeAreaInsets();

//   useEffect(() => {
//     if (visible) {
//       // Reset state for entry
//       iconScale.setValue(0);
//       textTranslateX.setValue(15);
//       textOpacity.setValue(0);
//       containerWidth.setValue(CIRCLE_WIDTH);

//       Animated.sequence([
//         // Step 1: Smooth precise pop down
//         Animated.parallel([
//           Animated.timing(translateY, {
//             toValue: Platform.OS === 'ios' ? (insets.top || 44) : ((insets.top || 20) + 16),
//             useNativeDriver: false,
//             duration: 350,
//             easing: Easing.out(Easing.back(1.5))
//           }),
//           Animated.timing(iconScale, {
//             toValue: 1,
//             useNativeDriver: false,
//             duration: 350,
//             easing: Easing.out(Easing.back(1.8))
//           })
//         ]),
        
//         // Let the eye catch the circle briefly
//         Animated.delay(50),

//         // Step 2 & 3: Smooth, elegant horizontal expansion
//         Animated.parallel([
//           Animated.timing(containerWidth, {
//             toValue: FULL_WIDTH,
//             useNativeDriver: false,
//             duration: 300,
//             easing: Easing.out(Easing.cubic)
//           }),
//           Animated.timing(textOpacity, {
//             toValue: 1,
//             duration: 250,
//             easing: Easing.inOut(Easing.ease),
//             useNativeDriver: false
//           }),
//           Animated.timing(textTranslateX, {
//             toValue: 0,
//             useNativeDriver: false,
//             duration: 300,
//             easing: Easing.out(Easing.cubic)
//           })
//         ])
//       ]).start();

//       const timer = setTimeout(() => {
//         hideToast();
//       }, 1500);

//       return () => clearTimeout(timer);
//     }
//   }, [visible]);

//   const hideToast = () => {
//     Animated.sequence([
//       Animated.timing(textOpacity, {
//         toValue: 0,
//         duration: 150,
//         useNativeDriver: false
//       }),
//       Animated.timing(containerWidth, {
//         toValue: CIRCLE_WIDTH,
//         useNativeDriver: false,
//         duration: 250,
//         easing: Easing.out(Easing.cubic)
//       }),
//       Animated.parallel([
//         Animated.timing(translateY, {
//           toValue: -150,
//           duration: 300,
//           easing: Easing.in(Easing.back(1.2)),
//           useNativeDriver: false
//         }),
//         Animated.timing(iconScale, {
//           toValue: 0,
//           duration: 300,
//           easing: Easing.in(Easing.ease),
//           useNativeDriver: false
//         })
//       ])
//     ]).start(() => {
//       if (onHide) onHide();
//     });
//   };

//   const getIconConfig = () => {
//     switch(type) {
//       case 'success': return { name: 'checkmark-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
//       case 'delete': return { name: 'trash', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
//       case 'error': return { name: 'alert-circle', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)' };
//       default: return { name: 'information-circle', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
//     }
//   };

//   const config = getIconConfig();

//   return (
//     <Animated.View style={[
//       styles.container, 
//       { 
//         transform: [{ translateY }], 
//         width: containerWidth 
//       }
//     ]} pointerEvents="none">
//       <View style={styles.solidMask}>
//         <View style={styles.solidWrapper}>

//           <Animated.View style={[
//             styles.iconContainer, 
//             { 
//               backgroundColor: config.bg,
//               transform: [{ scale: iconScale }] 
//             }
//           ]}>
//             <Ionicons name={config.name} size={18} color={config.color} />
//           </Animated.View>

//           <Animated.View style={[
//             styles.textContainer, 
//             { 
//               opacity: textOpacity, 
//               transform: [{ translateX: textTranslateX }] 
//             }
//           ]}>
//             <Text style={styles.title}>{type === 'success' ? 'Success' : type === 'delete' ? 'Deleted' : 'Action Failed'}</Text>
//             <Text style={styles.message} numberOfLines={1}>{message}</Text>
//           </Animated.View>

//         </View>
//       </View>
//     </Animated.View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     position: 'absolute',
//     top: 0,
//     alignSelf: 'center', 
//     height: 52, // Ultra sleek height
//     zIndex: 9999,
//     // Deep, prominent professional shadow to make it float clearly
//     shadowColor: '#0F172A',
//     shadowOffset: { width: 0, height: 14 },
//     shadowOpacity: 0.25,
//     shadowRadius: 24,
//     elevation: 22,
//   },
//   solidMask: {
//     flex: 1,
//     borderRadius: 26, // Perfect pill
//     overflow: 'hidden', 
//     backgroundColor: '#FFFFFF', // Guaranteed sharp, no blur artifacting
//     borderWidth: 1,
//     borderColor: '#E2E8F0', // Clean silver border
//   },
//   solidWrapper: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingLeft: 6, // 6 left padding + 40 icon + 6 right margin = 52 exactly perfect
//   },
//   iconContainer: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   textContainer: {
//     position: 'absolute',
//     left: 56, // 6 padding + 40 icon + 10 gap
//     width: FULL_WIDTH - 56 - 16, 
//     justifyContent: 'center',
//   },
//   title: {
//     fontSize: 11,
//     fontFamily: 'Inter-Black',
//     color: '#0F172A',
//     textTransform: 'uppercase',
//     letterSpacing: 1.2,
//     marginBottom: 0,
//     opacity: 0.8,
//   },
//   message: {
//     fontSize: 12,
//     fontFamily: 'Inter-SemiBold',
//     color: '#475569',
//   }
// });
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, Platform, View, Easing, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FULL_WIDTH = SCREEN_WIDTH - 32;
const CIRCLE_WIDTH = 56;

export default function AnimatedToast({ visible, message, type = 'success', onHide }) {
  const { t } = useTranslation();
  const [internalVisible, setInternalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-150)).current;
  const containerWidth = useRef(new Animated.Value(CIRCLE_WIDTH)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  const textTranslateX = useRef(new Animated.Value(15)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      // Reset state for entry
      iconScale.setValue(0);
      textTranslateX.setValue(15);
      textOpacity.setValue(0);
      containerWidth.setValue(CIRCLE_WIDTH);

      Animated.sequence([
        // Step 1: Smooth precise pop down
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: Platform.OS === 'ios' ? (insets.top || 44) : ((insets.top || 20) + 16),
            useNativeDriver: false,
            duration: 350,
            easing: Easing.out(Easing.back(1.5))
          }),
          Animated.timing(iconScale, {
            toValue: 1,
            useNativeDriver: false,
            duration: 350,
            easing: Easing.out(Easing.back(1.8))
          })
        ]),

        // Let the eye catch the circle briefly
        Animated.delay(50),

        // Step 2 & 3: Smooth, elegant horizontal expansion
        Animated.parallel([
          Animated.timing(containerWidth, {
            toValue: FULL_WIDTH,
            useNativeDriver: false,
            duration: 300,
            easing: Easing.out(Easing.cubic)
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false
          }),
          Animated.timing(textTranslateX, {
            toValue: 0,
            useNativeDriver: false,
            duration: 300,
            easing: Easing.out(Easing.cubic)
          })
        ])
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.sequence([
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false
      }),
      Animated.timing(containerWidth, {
        toValue: CIRCLE_WIDTH,
        useNativeDriver: false,
        duration: 250,
        easing: Easing.out(Easing.cubic)
      }),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 300,
          easing: Easing.in(Easing.back(1.2)),
          useNativeDriver: false
        }),
        Animated.timing(iconScale, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false
        })
      ])
    ]).start(() => {
      setInternalVisible(false);
      if (onHide) onHide();
    });
  };

  const getIconConfig = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'delete': return { name: 'trash', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
      case 'error': return { name: 'alert-circle', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)' };
      default: return { name: 'information-circle', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
    }
  };

  const config = getIconConfig();

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      pointerEvents="box-none"
    >
      <View style={styles.modalOverlay} pointerEvents="box-none">
        <Animated.View style={[
          styles.container,
          {
            transform: [{ translateY }],
            width: containerWidth
          }
        ]} pointerEvents="none">
          <View style={styles.solidMask}>
            <View style={styles.solidWrapper}>

              <Animated.View style={[
                styles.iconContainer,
                {
                  backgroundColor: config.bg,
                  transform: [{ scale: iconScale }]
                }
              ]}>
                <Ionicons name={config.name} size={18} color={config.color} />
              </Animated.View>

              <Animated.View style={[
                styles.textContainer,
                {
                  opacity: textOpacity,
                  transform: [{ translateX: textTranslateX }]
                }
              ]}>
                <Text style={styles.title}>{type === 'success' ? t('toastSuccess') : type === 'delete' ? t('toastDeleted') : t('toastActionFailed')}</Text>
                <Text style={styles.message} numberOfLines={1}>{message}</Text>
              </Animated.View>

            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    height: 52, // Ultra sleek height
    zIndex: 9999,
    // Deep, prominent professional shadow to make it float clearly
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 22,
  },
  solidMask: {
    flex: 1,
    borderRadius: 26, // Perfect pill
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // Guaranteed sharp, no blur artifacting
    borderWidth: 1,
    borderColor: '#E2E8F0', // Clean silver border
  },
  solidWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6, // 6 left padding + 40 icon + 6 right margin = 52 exactly perfect
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    left: 56, // 6 padding + 40 icon + 10 gap
    width: FULL_WIDTH - 56 - 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 11,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 0,
    opacity: 0.8,
  },
  message: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
  }
});