import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Dimensions, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import cloudinaryService from '../../services/cloudinaryService';
import { formatCompact, formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function SiteSurveyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { id, currentBudget, editMode, projectType, currency } = useLocalSearchParams();
  const isInterior = projectType === 'Interior';
  const { token } = useAuth();
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    accessibility: 'Good',
    powerAvailable: false,
    waterAvailable: false,
    terrainNotes: '',
    surveyorComments: '',
    affectsBudget: false,
    recommendedBudget: '',
    budgetReason: '',
    observationImage: '',
    // Interior-specific
    roomCount: '',
    ceilingHeight: '',
    naturalLighting: 'Good',
    ventilationAvailable: false,
    structuralModification: false,
    structuralNotes: '',
    clientStylePreference: '',
  });

  const [imageUri, setImageUri] = useState(null);
  const [additionalImageUris, setAdditionalImageUris] = useState([]);

  // Fetch existing survey data if in edit mode
  React.useEffect(() => {
    if (editMode === 'true') {
      const fetchExistingSurvey = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/projects/${id}/survey`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setFormData({
              accessibility: data.accessibility || 'Good',
              powerAvailable: data.powerAvailable || false,
              waterAvailable: data.waterAvailable || false,
              terrainNotes: data.terrainNotes || '',
              surveyorComments: data.surveyorComments || '',
              affectsBudget: data.affectsBudget || false,
              recommendedBudget: data.recommendedBudget?.toString() || '',
              budgetReason: data.budgetReason || '',
              observationImage: data.observationImage || '',
              roomCount: data.roomCount?.toString() || '',
              ceilingHeight: data.ceilingHeight || '',
              naturalLighting: data.naturalLighting || 'Good',
              ventilationAvailable: data.ventilationAvailable || false,
              structuralModification: data.structuralModification || false,
              structuralNotes: data.structuralNotes || '',
              clientStylePreference: data.clientStylePreference || '',
            });
            if (data.observationImage) setImageUri(data.observationImage);
            if (data.additionalPhotos?.length) setAdditionalImageUris(data.additionalPhotos);
          }
        } catch (error) {
          console.error('Error fetching existing survey:', error);
          showToast('Failed to load survey details', 'error');
        }
      };
      fetchExistingSurvey();
    }
  }, [editMode, id, token]);

  const accessibilityOptions = isInterior
    ? ['Good', 'Fair', 'Poor', 'Needs Work']
    : ['Good', 'Fair', 'Poor', 'Hazardous'];

  const handleToggle = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSelectAccessibility = (acc) => {
    setFormData(prev => ({ ...prev, accessibility: acc }));
  };

  const pickImage = async (useCamera = false) => {
    let result;
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showToast('Camera permission is required', 'error');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picking error:', error);
      showToast('Error picking image', 'error');
    }
  };

  const pickAdditionalPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled) setAdditionalImageUris(prev => [...prev, result.assets[0].uri]);
    } catch { showToast('Error picking image', 'error'); }
  };

  const removeAdditionalPhoto = (index) => {
    setAdditionalImageUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleImagePickChoice = () => {
    Alert.alert(
      'Select Image Source',
      'Choose how you want to provide the site photo',
      [
        { text: 'Take Photo', onPress: () => pickImage(true) },
        { text: 'Choose from Gallery', onPress: () => pickImage(false) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const uploadToCloudinary = async (uri) => {
    try {
      return await cloudinaryService.uploadFile(uri, 'survey_observation.jpg', 'image/jpeg');
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (formData.affectsBudget) {
      if (!formData.recommendedBudget || !formData.budgetReason.trim()) {
        showToast('Please provide the estimated budget and reason.', 'error');
        return;
      }
      if (Number(formData.recommendedBudget) === Number(currentBudget)) {
        showToast('New budget cannot be identical to the current budget. Disable the toggle instead.', 'error');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      let observationImageUrl = formData.observationImage;
      if (imageUri && imageUri !== formData.observationImage) {
        observationImageUrl = await uploadToCloudinary(imageUri);
      }

      const uploadedAdditional = await Promise.all(
        additionalImageUris.map(uri =>
          uri.startsWith('http') ? uri : uploadToCloudinary(uri)
        )
      );

      const url = `${API_BASE_URL}/projects/${id}/survey`;
      const method = editMode === 'true' ? 'PATCH' : 'POST';
      const body = {
        ...formData,
        roomCount: formData.roomCount ? Number(formData.roomCount) : undefined,
        observationImage: observationImageUrl,
        additionalPhotos: uploadedAdditional,
      };

      if (editMode === 'true') {
        body.action = 'UpdateDetails';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        showToast(editMode === 'true' ? 'Site survey updated!' : 'Site survey completely lodged!', 'success');
        router.replace(`/(tabs)/project`);
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to submit survey', 'error');
      }
    } catch (e) {
      showToast('Network request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <Text style={styles.preTitle}>{t('reportEntry', 'REPORT ENTRY')}</Text>
            <Text style={styles.title}>{editMode === 'true' ? `Edit ${isInterior ? 'Interior' : 'Site'} Survey` : (isInterior ? 'Interior Space Survey' : t('projectSiteSurvey', 'Project Site Survey'))}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 120 }]}>
          
          <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
            <Text style={styles.sectionLabel}>{isInterior ? 'Space & Condition Assessment' : t('conditionsAndUtilities', 'Conditions & Utilities')}</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{isInterior ? 'Overall Space Condition' : t('overallAccessibility', 'Overall Accessibility')}</Text>
              <View style={styles.accessGrid}>
                {accessibilityOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    activeOpacity={0.8}
                    style={[styles.accessBtn, formData.accessibility === opt && styles.accessBtnActive]}
                    onPress={() => handleSelectAccessibility(opt)}
                  >
                    <Text style={[styles.accessText, formData.accessibility === opt && styles.accessTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text style={styles.toggleLabel}>{isInterior ? 'Electrical Points Accessible' : t('powerInfrastructureAvailable', 'Power Infrastructure Available')}</Text>
                <Text style={styles.toggleSub}>{isInterior ? 'Existing outlets and wiring in place' : t('existingGridConnections', 'Existing grid connections')}</Text>
              </View>
              <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle('powerAvailable')} style={[styles.switchTrack, formData.powerAvailable && styles.switchTrackActive]}>
                 <View style={[styles.switchThumb, formData.powerAvailable && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text style={styles.toggleLabel}>{isInterior ? 'Plumbing Accessible' : t('waterConnectionAvailable', 'Water Connection Available')}</Text>
                <Text style={styles.toggleSub}>{isInterior ? 'Kitchen/bathroom plumbing lines' : t('municipalOrWellConnection', 'Municipal or well connection')}</Text>
              </View>
              <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle('waterAvailable')} style={[styles.switchTrack, formData.waterAvailable && styles.switchTrackActive]}>
                 <View style={[styles.switchThumb, formData.waterAvailable && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>
          </AdaptiveGlass>

          <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
            <Text style={styles.sectionLabel}>{t('mediaObservations', 'Media Observations')}</Text>
            
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{isInterior ? 'Space Photo (Observation)' : t('sitePhotoObservation', 'Site Photo (Observation)')}</Text>
              <TouchableOpacity 
                style={styles.imagePickerBtn} 
                onPress={handleImagePickChoice}
                activeOpacity={0.7}
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera" size={32} color="#94A3B8" />
                    <Text style={styles.imagePickerText}>{t('selectSiteObservationImage', 'Select Site Observation Image')}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {imageUri && (
                <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
                  <Text style={styles.removeImageText}>{t('removeImage', 'Remove Image')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </AdaptiveGlass>

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>Room Details</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Room Count</Text>
                  <TextInput style={styles.textInput} placeholder="e.g. 4" placeholderTextColor="#94A3B8" keyboardType="numeric" value={formData.roomCount} onChangeText={(text) => setFormData(prev => ({ ...prev, roomCount: text }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ceiling Height</Text>
                  <TextInput style={styles.textInput} placeholder="e.g. 10 ft" placeholderTextColor="#94A3B8" value={formData.ceilingHeight} onChangeText={(text) => setFormData(prev => ({ ...prev, ceilingHeight: text }))} />
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Natural Lighting</Text>
                <View style={styles.accessGrid}>
                  {['Excellent', 'Good', 'Limited', 'None'].map(opt => (
                    <TouchableOpacity key={opt} activeOpacity={0.8} style={[styles.accessBtn, formData.naturalLighting === opt && styles.accessBtnActive]} onPress={() => setFormData(prev => ({ ...prev, naturalLighting: opt }))}>
                      <Text style={[styles.accessText, formData.naturalLighting === opt && styles.accessTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleLabel}>Ventilation / AC Available</Text>
                  <Text style={styles.toggleSub}>Existing ducting or split unit points</Text>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle('ventilationAvailable')} style={[styles.switchTrack, formData.ventilationAvailable && styles.switchTrackActive]}>
                  <View style={[styles.switchThumb, formData.ventilationAvailable && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>Structural & Design</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleLabel}>Structural Modifications Needed</Text>
                  <Text style={styles.toggleSub}>Wall removal, partition additions, beam work</Text>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle('structuralModification')} style={[styles.switchTrack, formData.structuralModification && styles.switchTrackActive]}>
                  <View style={[styles.switchThumb, formData.structuralModification && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
              {formData.structuralModification && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.fieldLabel}>Structural Notes</Text>
                  <TextInput style={[styles.textInput, styles.textArea]} placeholder="Describe required structural changes..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={formData.structuralNotes} onChangeText={(text) => setFormData(prev => ({ ...prev, structuralNotes: text }))} />
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Client Style Preference</Text>
                <TextInput style={[styles.textInput, styles.textArea, { minHeight: 80 }]} placeholder="e.g. Modern minimalist, warm tones, open-plan kitchen preferred..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={formData.clientStylePreference} onChangeText={(text) => setFormData(prev => ({ ...prev, clientStylePreference: text }))} />
              </View>
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>Additional Room Photos</Text>
              <View style={styles.additionalPhotoGrid}>
                {additionalImageUris.map((uri, idx) => (
                  <View key={idx} style={styles.additionalPhotoWrap}>
                    <Image source={{ uri }} style={styles.additionalPhoto} />
                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeAdditionalPhoto(idx)}>
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickAdditionalPhoto} activeOpacity={0.7}>
                  <Ionicons name="add" size={28} color="#3B82F6" />
                  <Text style={styles.addPhotoBtnText}>Add Photo</Text>
                </TouchableOpacity>
              </View>
            </AdaptiveGlass>
          )}

          <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
            <Text style={styles.sectionLabel}>{isInterior ? 'Space Observations' : t('technicalAssessment', 'Technical Assessment')}</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{isInterior ? 'Space & Condition Notes' : t('terrainSoilNotes', 'Terrain / Soil Notes')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={isInterior ? 'Describe wall condition, floor type, ceiling height, natural lighting...' : t('describeGradientsSoil', 'Describe gradients, soil composition, hazards...')}
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                value={formData.terrainNotes}
                onChangeText={(text) => setFormData(prev => ({...prev, terrainNotes: text}))}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('surveyorCommentsLabel', 'Surveyor Comments')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { minHeight: 120 }]}
                placeholder={isInterior ? 'Any design constraints, structural concerns, or client preferences?' : t('anyAdhocRequests', 'Any ad-hoc requests or major blockers?')}
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                value={formData.surveyorComments}
                onChangeText={(text) => setFormData(prev => ({...prev, surveyorComments: text}))}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text style={styles.toggleLabel}>{t('affectsInitialBudget', 'Affects Initial Budget?')}</Text>
                <Text style={styles.toggleSub}>{t('doesSurveyRequireBudgetChange', 'Does this survey require a budget change?')}</Text>
              </View>
              <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle('affectsBudget')} style={[styles.switchTrack, formData.affectsBudget && styles.switchTrackActive]}>
                 <View style={[styles.switchThumb, formData.affectsBudget && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            {formData.affectsBudget && (
              <View style={{ marginTop: 20, gap: 16 }}>
                <View style={styles.referenceBox}>
                  <Ionicons name="information-circle" size={16} color="#3B82F6" />
                  <Text style={styles.referenceText}>{t('currentActiveBudget', 'Current Active Budget:')} <Text style={{ fontFamily: 'Inter-Black' }}>{formatCurrency(Number(currentBudget), currency || 'AED')}</Text></Text>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>{t('newEstimatedBudget', 'New Estimated Budget')} ({currency || 'AED' || 'AED'})</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('egAmount', 'e.g. 150000')}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formData.recommendedBudget}
                    onChangeText={(text) => setFormData(prev => ({...prev, recommendedBudget: text}))}
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>{t('reasonForBudgetChange', 'Reason for Budget Change')}</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { minHeight: 80 }]}
                    placeholder={t('egRoughTerrain', 'e.g. Rough terrain requires special grading equipment...')}
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    value={formData.budgetReason}
                    onChangeText={(text) => setFormData(prev => ({...prev, budgetReason: text}))}
                  />
                </View>
              </View>
            )}
          </AdaptiveGlass>

        </ScrollView>

        <View style={[styles.floatingAction, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity 
            style={styles.submitBtn} 
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.submitGradient}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.submitText}>{editMode === 'true' ? t('updateReport', 'Update Report') : t('submitReport', 'Submit Report')}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F0F9FF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  titleWrapper: { flex: 1, marginLeft: 16 },
  preTitle: { fontSize: 10, fontFamily: 'Inter-Black', color: '#3B82F6', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A' },
  contentScroll: { paddingHorizontal: 20, paddingTop: 10, gap: 20 },
  sectionForm: { padding: 24, borderRadius: 28, borderWidth: 1, borderColor: '#E0F2FE', backgroundColor: 'rgba(255,255,255,0.7)' },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 10 },
  accessGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  accessBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  accessBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  accessText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  accessTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleTextCol: { flex: 1, paddingRight: 16 },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4 },
  toggleSub: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  switchTrack: { width: 52, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', padding: 2, justifyContent: 'center' },
  switchTrackActive: { backgroundColor: '#3B82F6' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  switchThumbActive: { transform: [{ translateX: 24 }] },
  textInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  floatingAction: { position: 'absolute', left: 20, right: 20 },
  submitBtn: { borderRadius: 20, overflow: 'hidden', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  submitGradient: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitText: { fontSize: 16, fontFamily: 'Inter-Black', color: '#FFFFFF' },
  referenceBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  referenceText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#1D4ED8' },
  imagePickerBtn: { width: '100%', height: 200, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  imagePickerPlaceholder: { alignItems: 'center', gap: 10 },
  imagePickerText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { marginTop: 10, alignSelf: 'center' },
  removeImageText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#EF4444' },
  additionalPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  additionalPhotoWrap: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  additionalPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  removePhotoBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: '#FFFFFF', borderRadius: 11 },
  addPhotoBtn: { width: 100, height: 100, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', gap: 4 },
  addPhotoBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#3B82F6' },
});
