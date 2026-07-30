import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, StatusBar, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AdaptiveGlass from './components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const formatCompact = (num) => {
  if (num == null || isNaN(num)) return '0';
  return Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
};

const { width } = Dimensions.get('window');

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function ViewTemplateScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [template, setTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTemplateDetails();
  }, [params.id]);

  const fetchTemplateDetails = async () => {
    if (!params.id || params.id === 'undefined') {
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/templates/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setTemplate(data);
      } else {
        showToast(data.message || 'Could not load template', 'error');
      }
    } catch (e) {
      showToast(t('networkError'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Template not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#3B82F6', marginTop: 10 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleEdit = () => {
    router.push({
      pathname: '/create-template',
      params: {
        isEditing: 'true',
        id: template._id,
        name: template.name,
        categoryId: template.category?._id,
        categoryName: template.category?.name,
        minBudget: template.minBudget?.toString(),
        maxBudget: template.maxBudget?.toString(),
        area: template.area?.toString(),
        description: template.description || ''
      }
    });
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />
      
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerPreTitle}>Viewing Template</Text>
            <Text style={styles.headerTitle}>{template.name}</Text>
          </View>
        </View>

        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
          
          {/* Main Display Ribbon */}
          <AdaptiveGlass intensity={20} tint="light" style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cube-outline" size={32} color="#2563EB" />
              </View>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>
                  {template.category?.name || 'Uncategorized'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.heroTitle}>{template.name}</Text>
            {template.description ? (
              <Text style={styles.heroDesc}>{template.description}</Text>
            ) : (
              <Text style={styles.heroDesc}>
                A professional template designed for {template.category?.name || 'standard'} projects.
              </Text>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Budget range</Text>
                <Text style={styles.statValue}>
                  ${formatCompact(template.minBudget)} - ${formatCompact(template.maxBudget)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Est. Area</Text>
                <Text style={styles.statValue}>{template.area?.toLocaleString()} sqft</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Timeline</Text>
                <Text style={styles.statValue}>{template.estimatedDays || '--'} Days</Text>
              </View>
            </View>
          </AdaptiveGlass>

          {/* Media Gallery */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos & Visuals</Text>
            {template.images && template.images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageGallery}>
                {template.images.map((img, idx) => (
                  <TouchableOpacity key={idx} activeOpacity={0.9} style={styles.galleryItem}>
                    <Image source={{ uri: img }} style={styles.galleryImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <AdaptiveGlass intensity={10} tint="light" style={styles.emptyStateCard}>
                <Ionicons name="images-outline" size={28} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No photos uploaded</Text>
              </AdaptiveGlass>
            )}
          </View>

          {/* Plan Files */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Plan Files & Blueprints</Text>
            {template.files && template.files.length > 0 ? (
              <View style={styles.fileList}>
                {template.files.map((file, idx) => (
                  <AdaptiveGlass key={idx} intensity={10} tint="light" style={styles.fileCard}>
                    <View style={styles.fileIconBox}>
                      <Ionicons name="document-text" size={20} color="#3B82F6" />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        Project File {idx + 1}
                      </Text>
                      <Text style={styles.fileSize}>Architectural Plan</Text>
                    </View>
                    <TouchableOpacity style={styles.downloadBtn}>
                      <Ionicons name="download-outline" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </AdaptiveGlass>
                ))}
              </View>
            ) : (
              <AdaptiveGlass intensity={10} tint="light" style={styles.emptyStateCard}>
                <Ionicons name="document-text-outline" size={28} color="#3B82F6" />
                <Text style={styles.emptyTitle}>No files attached</Text>
              </AdaptiveGlass>
            )}
          </View>
        </ScrollView>

        {/* Floating Edit Button */}
        {/* <View style={[styles.footerActions, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={handleEdit}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.editBtnGradient}>
              <Ionicons name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.editBtnText}>Edit Template</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View> */}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerPreTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPill: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryPillText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyStateCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
  },
  emptyIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  phaseList: {
    gap: 12,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
  },
  phaseIdBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phaseIdText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
  },
  phaseName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  imageGallery: {
    paddingRight: 20,
    gap: 12,
  },
  galleryItem: {
    width: 280,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fileList: {
    gap: 12,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  fileSize: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerActions: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  editBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  editBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 10,
  },
  editBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});
