import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, StatusBar, TextInput, Platform, KeyboardAvoidingView, Image, DeviceEventEmitter, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AdaptiveGlass from './components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from './services/cloudinaryService';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const { width } = Dimensions.get('window');

const CATEGORIES = ['Interior', 'Civil', 'Safety'];

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function CreateTemplateScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const { showToast } = useToast();
  const isEditing = params.isEditing === 'true';

  const [templateName, setTemplateName] = useState(params.name || params.title || '');
  const [description, setDescription] = useState(params.description || '');

  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [activeCategory, setActiveCategory] = useState(params.categoryId || params.category || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState([]);
  const [planFiles, setPlanFiles] = useState([]);
  const [minBudget, setMinBudget] = useState(params.minBudget || '');
  const [maxBudget, setMaxBudget] = useState(params.maxBudget || '');
  const [area, setArea] = useState(params.area || '');
  const [estimatedDays, setEstimatedDays] = useState('');

  useEffect(() => {
    if (isEditing && params.id) {
      fetchTemplateDetails();
    }
  }, [params.id]);

  const fetchTemplateDetails = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/templates/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTemplateName(data.name);
        setDescription(data.description || '');
        setActiveCategory(data.category?._id || data.category);
        setMinBudget(data.minBudget?.toString() || '');
        setMaxBudget(data.maxBudget?.toString() || '');
        setArea(data.area?.toString() || '');
        setEstimatedDays(data.estimatedDays?.toString() || '');
        
        // Load existing images
        if (data.images) setImages(data.images);
        
        // Load existing files
        if (data.files) {
          setPlanFiles(data.files.map(f => ({
            name: f.name,
            uri: f.url,
            size: f.size
          })));
        }
      }
    } catch (e) {
      console.error('Fetch template details error', e);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);
        const response = await fetch(`${API_BASE_URL}/template-categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          setCategories(data);
          // Only set default category if we aren't editing or already have one
          if (!activeCategory && !isEditing && data.length > 0) {
            setActiveCategory(data[0]._id);
          }
        }
      } catch (e) {
        console.error('Fetch categories error', e);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };


  const pickDocument = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      const newFiles = result.assets.map(asset => ({ name: asset.name, uri: asset.uri, size: asset.size }));
      setPlanFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removePlanFile = (indexToRemove) => {
    setPlanFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleCreate = async () => {
    if (!templateName.trim() || !activeCategory) {
      showToast(t('pleaseEnterNameAndCategory'), 'error');
      return;
    }

    const minB = Number(minBudget) || 0;
    const maxB = Number(maxBudget) || 0;

    if (minB < 0 || maxB < 0) {
      showToast('Budget values cannot be negative.', 'error');
      return;
    }

    if (maxB > 0 && minB > maxB) {
      showToast('Minimum budget cannot be greater than maximum budget.', 'error');
      return;
    }

    setIsSubmitting(true); // General loading overlay
    
    try {
      let uploadedImageUrls = [];
      let uploadedFileUrls = [];

      // 1. Upload Images to Cloudinary
      for (const uri of images) {
        // Only upload local URIs, ignore existing URLs (if editing)
        if (uri.startsWith('http')) {
          uploadedImageUrls.push(uri);
        } else {
          try {
            const url = await cloudinaryService.uploadFile(uri, 'template_image', 'image/jpeg');
            uploadedImageUrls.push(url);
          } catch (err) {
            console.error('Image upload failed', err);
          }
        }
      }

      // 2. Upload Plan Files to Cloudinary
      for (const file of planFiles) {
        if (file.uri.startsWith('http')) {
          uploadedFileUrls.push({ name: file.name, url: file.uri, size: file.size });
        } else {
          try {
            // Determine type or use auto
            const url = await cloudinaryService.uploadFile(file.uri, file.name || 'document', 'application/octet-stream');
            uploadedFileUrls.push({ name: file.name, url: url, size: file.size });
          } catch (err) {
            console.error('File upload failed', err);
          }
        }
      }

      // 3. Prepare Final Payload
      const payload = {
        name: templateName,
        category: activeCategory, // This is an ID now
        description: description,
        minBudget: Number(minBudget) || 0,
        maxBudget: Number(maxBudget) || 0,
        area: Number(area) || 0,
        estimatedDays: Number(estimatedDays) || 0,
        images: uploadedImageUrls,
        files: uploadedFileUrls,
      };

      // 4. Submit to Backend
      const url = isEditing ? `${API_BASE_URL}/templates/${params.id}` : `${API_BASE_URL}/templates`;
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        showToast(isEditing ? 'Template updated' : 'Template created successfully', 'success');
        DeviceEventEmitter.emit('new_template', result);
        router.back();
      } else {
        showToast(result.message || 'Failed to save template', 'error');
      }
    } catch (error) {
      console.error('HandleCreate Error:', error);
      showToast('Something went wrong during template creation.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : null}>
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
              <Text style={styles.headerPreTitle}>{isEditing ? t('editProject') : t('newProject')}</Text>
              <Text style={styles.headerTitle}>{t('template')}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]} 
              activeOpacity={0.8} 
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>{isEditing ? t('save') : t('createBtn')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {isSubmitting && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>{t('uploadingAssets')}</Text>
                <Text style={styles.loadingSubtext}>{t('dontCloseApp')}</Text>
              </View>
            </View>
          )}

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            {/* Form Fields */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('templateNameLabel')}</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="document-text-outline" size={20} color="#3B82F6" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('egShoppingMall')}
                  placeholderTextColor="#94A3B8"
                  value={templateName}
                  onChangeText={setTemplateName}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroller}>
                {isLoadingCategories ? (
                  <View style={{ paddingVertical: 10, paddingHorizontal: 20 }}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                  </View>
                ) : categories.length > 0 ? (
                  categories.map(item => (
                    <TouchableOpacity
                      key={item._id}
                      activeOpacity={0.7}
                      onPress={() => setActiveCategory(item._id)}
                      style={[
                        styles.categoryPill,
                        activeCategory === item._id ? styles.activePill : null
                      ]}
                    >
                      <Text style={[
                        styles.categoryText,
                        activeCategory === item._id ? styles.activeCategoryText : null
                      ]}>{item.name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{ color: '#94A3B8', fontFamily: 'Inter-SemiBold', paddingHorizontal: 20 }}>{t('noCategoriesAvailable')}</Text>
                )}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('description')}</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={styles.textArea}
                  placeholder={t('describeTemplateScope')}
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                />
              </View>
            </View>

            {/* Budget Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('estimatedBudgetLabel')}</Text>
              <View style={styles.rowContainer}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.prefixText}>{t('minBudget')}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={minBudget}
                    onChangeText={setMinBudget}
                  />
                </View>

                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.prefixText}>{t('maxBudget')}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="100,000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={maxBudget}
                    onChangeText={setMaxBudget}
                  />
                </View>
              </View>
            </View>

            {/* Area & Days Section */}
            <View style={styles.section}>
              <View style={styles.rowContainer}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.sectionLabel}>{t('areaSqFt')}</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="map-outline" size={20} color="#3B82F6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 1500"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={area}
                      onChangeText={setArea}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.sectionLabel}>{t('estDays')}</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="time-outline" size={20} color="#3B82F6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 45"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={estimatedDays}
                      onChangeText={setEstimatedDays}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{t('referenceImages')}</Text>
                <TouchableOpacity onPress={pickImages}>
                  <Text style={styles.sectionAddAction}>{t('addImageBtn')}</Text>
                </TouchableOpacity>
              </View>

              {images.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroller}>
                  {images.map((uri, index) => (
                    <View key={index} style={styles.imageWrapper}>
                      <Image source={{ uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={pickImages} style={styles.addImageSquare}>
                    <Ionicons name="add" size={24} color="#3B82F6" />
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <TouchableOpacity
                  onPress={pickImages}
                  activeOpacity={0.7}
                >
                  <View style={styles.uploadCard}>
                    <Ionicons name="image-outline" size={28} color="#3B82F6" />
                    <Text style={styles.uploadText}>{t('selectImages')}</Text>
                    <Text style={styles.uploadSubtext}>{t('uploadReferencesBluePrints')}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Plan Files Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{t('projectPlanFiles')}</Text>
                <TouchableOpacity onPress={pickDocument}>
                  <Text style={styles.sectionAddAction}>{t('addFile')}</Text>
                </TouchableOpacity>
              </View>

              {planFiles.length > 0 ? (
                <View style={styles.fileListWrapper}>
                  {planFiles.map((file, index) => (
                    <View key={index} style={styles.fileRowItem}>
                      <View style={styles.fileRowIcon}>
                        <Ionicons name="document-text-outline" size={20} color="#3B82F6" />
                      </View>
                      <View style={styles.fileRowTextContainer}>
                        <Text style={styles.fileRowName} numberOfLines={1}>{file.name}</Text>
                        {file.size && <Text style={styles.fileRowSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</Text>}
                      </View>
                      <TouchableOpacity
                        style={styles.removeFileBtn}
                        onPress={() => removePlanFile(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={pickDocument}>
                    <Text style={styles.addMoreFilesText}>{t('uploadAnotherFile')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={pickDocument}
                  activeOpacity={0.7}
                >
                  <View style={styles.uploadCard}>
                    <Ionicons name="document-attach-outline" size={28} color="#3B82F6" />
                    <Text style={styles.uploadText}>{t('uploadPlans')}</Text>
                    <Text style={styles.uploadSubtext}>{t('pdfDwgOrZip')}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

           

          </ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerPreTitle: {
    fontSize: 12,
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 14,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionAddAction: {
    fontSize: 13,
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  textAreaContainer: {
    height: 120,
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  textArea: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    width: '100%',
  },
  categoryScroller: {
    gap: 12,
  },
  categoryPill: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  activePill: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  imageScroller: {
    gap: 12,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageSquare: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
  },
  uploadText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prefixText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#94A3B8',
    marginRight: 8,
  },
  fileListWrapper: {
    gap: 12,
  },
  fileRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  fileRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileRowTextContainer: {
    flex: 1,
  },
  fileRowName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  fileRowSize: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  removeFileBtn: {
    padding: 8,
  },
  addMoreFilesText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
    textAlign: 'center',
    marginTop: 8,
  },
  boqOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  boqOptionBtn: {
    flex: 1,
  },
  boqOptionCard: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  boqOptionText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingCard: {
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
});
