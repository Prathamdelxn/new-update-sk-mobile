import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, useWindowDimensions,
  Animated, StatusBar, PanResponder, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ProjectScene, BlueprintScene, FinanceScene } from './components/OnboardingIllustrations';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const SLIDES = [
    {
      title: t('onboardingSlide1Title', 'Manage Your Villa,\nInterior & Building Projects'),
      description: t('onboardingSlide1Desc', 'Streamline villa, interior, and building management with real-time collaboration'),
      Scene: ProjectScene,
    },
    {
      title: t('onboardingSlide2Title', 'Stay in Control of Every\nProject Task'),
      description: t('onboardingSlide2Desc', 'Monitor progress, assign tasks, and approve updates from anywhere, effortlessly.'),
      Scene: BlueprintScene,
    },
    {
      title: t('onboardingSlide3Title', 'Connect, Collaborate &\nSimplify Project'),
      description: t('onboardingSlide3Desc', 'Work with teams, share designs, and manage projects all in one place.'),
      Scene: FinanceScene,
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // Dynamic dimensions based on actual screen size
  const isSmallScreen = height < 700;
  const isTallScreen = height > 850;
  
  // Base scaling off the smaller of width/height ratios to maintain aspect ratio
  const phoneWidth = Math.min(width * 0.48, height * 0.25);
  const phoneHeight = phoneWidth * 2.1;
  const phoneRadius = phoneWidth * 0.15;
  const screenRadius = phoneWidth * 0.12;

  // Dynamic Island scaling
  const islandWidth = phoneWidth * 0.38;
  const islandHeight = islandWidth * 0.3;
  const islandTop = phoneHeight * 0.04;
  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textTranslate = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
 
  // Entry animation on mount
  const entryAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(entryAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);
 
  const animateTransition = (newIndex) => {
    const direction = newIndex > currentIndex ? 1 : -1;
 
    // Animate out
    Animated.parallel([
      Animated.timing(imageScale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(textTranslate, { toValue: -30 * direction, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex(newIndex);
 
      // Animate in
      textTranslate.setValue(30 * direction);
      Animated.parallel([
        Animated.spring(imageScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(textTranslate, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    });
 
    // Dot animation
    Animated.spring(dotAnim, { toValue: newIndex, tension: 60, friction: 10, useNativeDriver: false }).start();
  };
 
  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      animateTransition(currentIndex + 1);
    } else {
      router.replace('/auth/login');
    }
  };
 
  const handleSkip = () => {
    router.replace('/auth/login');
  };
 
  // Swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50 && currentIndex < SLIDES.length - 1) {
          animateTransition(currentIndex + 1);
        } else if (gs.dx > 50 && currentIndex > 0) {
          animateTransition(currentIndex - 1);
        }
      },
    })
  ).current;
 
  const currentSlide = SLIDES[currentIndex];
  const SceneComponent = currentSlide.Scene;
 
  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
 
      {/* Main content */}
      <Animated.View style={[
        styles.mainContent,
        {
          opacity: entryAnim,
          transform: [{
            translateY: entryAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [40, 0],
            }),
          }],
        },
      ]}>
       
        {/* Background blobs (like in the image) */}
        <View style={styles.backgroundBlobs}>
          <View style={[styles.blobMain, { width: width * 0.85, height: width * 0.85, borderRadius: width * 0.425 }]} />
          <View style={styles.blobSmall1} />
          <View style={styles.blobSmall2} />
        </View>
 
        {/* Scene / Image wrapped in a phone mockup */}
        <Animated.View style={[
          styles.imageContainer,
          { 
            transform: [{ scale: imageScale }],
            marginBottom: isSmallScreen ? 20 : (isTallScreen ? 40 : 30),
            marginTop: isSmallScreen ? 5 : (isTallScreen ? 20 : 10),
          },
        ]}>
          <View style={styles.phoneFrameOuter}>
            <View style={[
              styles.phoneFrame,
              {
                width: phoneWidth,
                height: phoneHeight,
                borderRadius: phoneRadius,
                padding: isSmallScreen ? 6 : 8,
              }
            ]}>
              <View style={[
                styles.phoneScreen,
                { borderRadius: screenRadius }
              ]}>
                <SceneComponent />
              </View>
              {/* Dynamic Island / Notch */}
              <View style={[
                styles.dynamicIsland,
                {
                  width: islandWidth,
                  height: islandHeight,
                  top: islandTop,
                  borderRadius: islandHeight / 2,
                }
              ]}>
                <View style={[styles.islandSensor, { width: islandHeight * 0.38, height: islandHeight * 0.38, borderRadius: islandHeight * 0.19 }]} />
                <View style={[styles.islandCamera, { width: islandHeight * 0.38, height: islandHeight * 0.38, borderRadius: islandHeight * 0.19 }]} />
              </View>
            </View>
          </View>
        </Animated.View>
 
        {/* Text content */}
        <Animated.View style={[
          styles.textSection,
          {
            opacity: textOpacity,
            transform: [{ translateX: textTranslate }],
            marginBottom: isSmallScreen ? 10 : (isTallScreen ? 40 : 25),
          },
        ]}>
          <Text style={[styles.title, { 
            fontSize: isSmallScreen ? 22 : (isTallScreen ? 26 : 24),
            lineHeight: isSmallScreen ? 30 : (isTallScreen ? 34 : 32),
            marginBottom: isSmallScreen ? 8 : (isTallScreen ? 16 : 12),
          }]}>
            {currentSlide.title}
          </Text>
          <Text style={[styles.description, {
            fontSize: isSmallScreen ? 13 : (isTallScreen ? 15 : 14),
            lineHeight: isSmallScreen ? 20 : (isTallScreen ? 24 : 22),
          }]}>{currentSlide.description}</Text>
        </Animated.View>
      </Animated.View>
 
      {/* Footer */}
      <View style={[styles.footer, { 
        paddingBottom: Platform.OS === 'ios' ? (isSmallScreen ? 25 : 45) : (isSmallScreen ? 20 : 35) 
      }]}>
        {/* Pagination */}
        <View style={[styles.pagination, { marginBottom: isSmallScreen ? 20 : 35 }]}>
          {SLIDES.map((_, index) => {
            const dotWidth = dotAnim.interpolate({
              inputRange: [index - 1, index, index + 1],
              outputRange: [8, 20, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = dotAnim.interpolate({
              inputRange: [index - 1, index, index + 1],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: '#1C64F2',
                  },
                ]}
              />
            );
          })}
        </View>
 
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.skipBtn, { paddingVertical: isSmallScreen ? 14 : 18 }]} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>{t('skip', 'Skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.nextBtn, { paddingVertical: isSmallScreen ? 14 : 18 }]} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextText}>{t('next', 'Next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
 
  // Main content
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    position: 'relative',
  },
 
  // Background Blobs
  backgroundBlobs: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  blobMain: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    position: 'absolute',
    top: '10%',
  },
  blobSmall1: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    position: 'absolute',
    top: '8%',
    left: '5%',
  },
  blobSmall2: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    position: 'absolute',
    top: '35%',
    right: '5%',
  },
 
  // Image / Scene
  imageContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  phoneFrameOuter: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.12,
    shadowRadius: 35,
    elevation: 20,
    transform: [
      { perspective: 1000 },
      { rotateY: '-12deg' },
      { rotateZ: '3deg' },
      { rotateX: '4deg' }
    ],
  },
  phoneFrame: {
    backgroundColor: '#0F172A', // Dark bezel
    borderWidth: 1.5,
    borderColor: '#334155', // Subtle metallic rim
    alignItems: 'center',
  },
  phoneScreen: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dynamicIsland: {
    position: 'absolute',
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '12%',
  },
  islandSensor: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  islandCamera: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
 
  // Text section
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
     fontFamily: 'Inter-Black',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: 16,
     fontFamily: 'Inter-Medium',
  },
 
  // Footer
  footer: {
    paddingHorizontal: 24,
  },
 
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
 
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    alignItems: 'center',
  },
  skipText: {
    color: '#475569',
    fontSize: 16,
     fontFamily: 'Inter-Bold',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
     fontFamily: 'Inter-Bold',
  },
});
 
 