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
import { hasPermissionOnProjectId } from '../../utils/permissions';

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
  const { token, user } = useAuth();
  // New survey needs Site Survey > Create; editing allows either Site Survey > Update or Create
  const canSubmitSurvey = hasPermissionOnProjectId(user, id, 'sitesurvey:create') || hasPermissionOnProjectId(user, id, 'sitesurvey:update');
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
    ceilingHeightUnit: 'ft',
    wallCondition: 'Solid Brick',
    dampnessObserved: false,
    dampnessNotes: '',
    electricalPhase: 'Single Phase',
    acPipingReady: false,
    plumbingDrainReady: false,
    elevatorAccessibility: 'Service Elevator Available',
    elevatorCapacityKg: '',
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
              ceilingHeightUnit: data.ceilingHeightUnit || 'ft',
              wallCondition: data.wallCondition || 'Solid Brick',
              dampnessObserved: data.dampnessObserved || false,
              dampnessNotes: data.dampnessNotes || '',
              electricalPhase: data.electricalPhase || 'Single Phase',
              acPipingReady: data.acPipingReady || false,
              plumbingDrainReady: data.plumbingDrainReady || false,
              elevatorAccessibility: data.elevatorAccessibility || 'Service Elevator Available',
              elevatorCapacityKg: data.elevatorCapacityKg?.toString() || '',
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

  const renderOptions = (label, field, options) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.accessGrid}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            activeOpacity={0.8}
            style={[styles.accessBtn, formData[field] === opt && styles.accessBtnActive]}
            onPress={() => setFormData(prev => ({ ...prev, [field]: opt }))}
          >
            <Text style={[styles.accessText, formData[field] === opt && styles.accessTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderToggle = (label, sub, field) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextCol}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle(field)} style={[styles.switchTrack, formData[field] && styles.switchTrackActive]}>
        <View style={[styles.switchThumb, formData[field] && styles.switchThumbActive]} />
      </TouchableOpacity>
    </View>
  );

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
      const {
        roomCount, ceilingHeight, ceilingHeightUnit, naturalLighting, ventilationAvailable, structuralModification,
        structuralNotes, clientStylePreference, wallCondition, dampnessObserved, dampnessNotes, electricalPhase,
        acPipingReady, plumbingDrainReady, elevatorAccessibility, elevatorCapacityKg, terrainNotes, ...common
      } = formData;
      const body = {
        ...common,
        observationImage: observationImageUrl,
        additionalPhotos: uploadedAdditional,
        ...(isInterior ? {
          roomCount: roomCount ? Number(roomCount) : undefined,
          ceilingHeight: ceilingHeight || undefined,
          ceilingHeightUnit,
          naturalLighting,
          ventilationAvailable,
          structuralModification,
          structuralNotes: structuralModification ? structuralNotes : undefined,
          clientStylePreference: clientStylePreference || undefined,
          wallCondition,
          dampnessObserved,
          dampnessNotes: dampnessObserved ? dampnessNotes : undefined,
          elevatorAccessibility,
          elevatorCapacityKg: elevatorCapacityKg ? Number(elevatorCapacityKg) : undefined,
          electricalPhase,
          acPipingReady,
          plumbingDrainReady,
        } : { terrainNotes }),
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

  if (user && !canSubmitSurvey) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#F8FAFC' }}>
        <Ionicons name="lock-closed-outline" size={56} color="#CBD5E1" />
        <Text style={{ marginTop: 16, fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A', textAlign: 'center' }}>
          {editMode === 'true' ? "You can't edit this survey" : "You can't submit a survey"}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', lineHeight: 20 }}>
          {editMode === 'true'
            ? 'Ask your admin to enable Site Survey Management → Update on your role.'
            : 'Ask your admin to enable Site Survey Management → Create on your role.'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EFF6FF' }}>
          <Text style={{ fontFamily: 'Inter-Bold', color: '#2563EB' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
            <Text style={styles.title}>
              {editMode === 'true'
                ? (isInterior ? t('editInteriorSurvey', 'Edit Interior Survey') : t('editSiteSurvey', 'Edit Site Survey'))
                : (isInterior ? t('recordInteriorSurvey', 'Record Interior Survey') : t('recordSiteSurvey', 'Record Site Survey'))}
            </Text>
            <Text style={styles.subTitle}>
              {isInterior
                ? t('surveyInteriorSubtitle', 'Space condition, MEP & architectural diagnostics')
                : t('surveySiteSubtitle', 'Physical terrain, MEP points & site conditions')}
            </Text>
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

          {!isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>{t('terrainAndSoil', 'Terrain & Soil')}</Text>
              <Text style={styles.fieldLabel}>{t('terrainSoilNotes', 'Terrain / Soil Notes')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={t('terrainSoilPlaceholder', 'Soil type, slope, clearing needed...')}
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                value={formData.terrainNotes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, terrainNotes: text }))}
              />
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>{t('roomDetails', 'Room Details')}</Text>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t('roomCount', 'Room Count')}</Text>
                <TextInput style={styles.textInput} placeholder="e.g. 8" placeholderTextColor="#94A3B8" keyboardType="numeric" value={formData.roomCount} onChangeText={(text) => setFormData(prev => ({ ...prev, roomCount: text }))} />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t('ceilingHeight', 'Ceiling Height')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={[styles.textInput, { flex: 1 }]} placeholder="e.g. 10.5" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" value={formData.ceilingHeight} onChangeText={(text) => setFormData(prev => ({ ...prev, ceilingHeight: text }))} />
                  <View style={styles.unitRow}>
                    {['ft', 'm', 'in', 'mm', 'cm'].map((u) => (
                      <TouchableOpacity key={u} style={[styles.unitBtn, formData.ceilingHeightUnit === u && styles.accessBtnActive]} onPress={() => setFormData(prev => ({ ...prev, ceilingHeightUnit: u }))}>
                        <Text style={[styles.unitText, formData.ceilingHeightUnit === u && styles.accessTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              {renderOptions(t('naturalLighting', 'Natural Lighting'), 'naturalLighting', ['Excellent', 'Good', 'Limited', 'None'])}
              <View style={styles.divider} />
              {renderToggle(t('ventilationAvailable', 'Ventilation / AC Available'), t('ventilationAvailableSub', 'Existing ducting or split unit points'), 'ventilationAvailable')}
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>{t('wallMoistureDiagnostics', 'Wall & Moisture Diagnostics')}</Text>
              {renderOptions(t('wallConstructionType', 'Wall Construction Type'), 'wallCondition', ['Solid Brick', 'Gypsum Drywall', 'RCC Concrete', 'Mixed'])}
              <View style={styles.divider} />
              {renderToggle(t('dampnessObserved', 'Dampness / Water Seepage Observed'), t('dampnessObservedSub', 'Check for water stains or damp walls before woodwork'), 'dampnessObserved')}
              {formData.dampnessObserved && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.fieldLabel}>{t('dampnessDetails', 'Dampness & Leakage Details')}</Text>
                  <TextInput style={[styles.textInput, styles.textArea]} placeholder="e.g. Seepage observed on Bedroom 2 outer wall..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={formData.dampnessNotes} onChangeText={(text) => setFormData(prev => ({ ...prev, dampnessNotes: text }))} />
                </View>
              )}
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>{t('mepServicesReadiness', 'MEP & Services Readiness')}</Text>
              {renderOptions(t('electricalSupplyPhase', 'Electrical Supply Phase'), 'electricalPhase', ['Single Phase', 'Three Phase', 'Unsure'])}
              <View style={styles.divider} />
              {renderToggle(t('acPipingReady', 'AC Copper Piping Laid'), t('acPipingReadySub', 'Internal refrigerant pipes pre-installed'), 'acPipingReady')}
              <View style={styles.divider} />
              {renderToggle(t('plumbingDrainReady', 'Plumbing & Waste Outlets Positioned'), t('plumbingDrainReadySub', 'Drainage points ready for kitchen/baths'), 'plumbingDrainReady')}
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>{t('materialAccessLogistics', 'Material Access & Freight Logistics')}</Text>
              {renderOptions(t('elevatorStairAccess', 'Elevator / Stair Access'), 'elevatorAccessibility', ['Service Elevator Available', 'Passenger Elevator Only', 'Stairs Only'])}
              {formData.elevatorAccessibility !== 'Stairs Only' && (
                <View>
                  <Text style={styles.fieldLabel}>{t('elevatorCapacityKg', 'Elevator Capacity (kg)')}</Text>
                  <TextInput style={styles.textInput} placeholder="e.g. 1000" placeholderTextColor="#94A3B8" keyboardType="numeric" value={formData.elevatorCapacityKg} onChangeText={(text) => setFormData(prev => ({ ...prev, elevatorCapacityKg: text }))} />
                </View>
              )}
            </AdaptiveGlass>
          )}

          {isInterior && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
              <Text style={styles.sectionLabel}>{t('structuralAndDesign', 'Structural & Design')}</Text>
              {renderToggle(t('structuralModificationNeeded', 'Structural Modifications Needed'), t('structuralModificationSub', 'Wall removal, partition additions, beam work'), 'structuralModification')}
              {formData.structuralModification && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.fieldLabel}>{t('structuralNotes', 'Structural Notes')}</Text>
                  <TextInput style={[styles.textInput, styles.textArea]} placeholder="Describe required structural changes..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={formData.structuralNotes} onChangeText={(text) => setFormData(prev => ({ ...prev, structuralNotes: text }))} />
                </View>
              )}
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>{t('clientStylePreference', 'Client Style Preference')}</Text>
              <TextInput style={[styles.textInput, styles.textArea, { minHeight: 80 }]} placeholder="e.g. Modern minimalist, warm tones, open-plan kitchen preferred..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={formData.clientStylePreference} onChangeText={(text) => setFormData(prev => ({ ...prev, clientStylePreference: text }))} />
            </AdaptiveGlass>
          )}

          <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
            <Text style={styles.sectionLabel}>{t('siteObservationMedia', 'Site Observation Media')}</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                {isInterior ? t('primarySpacePhoto', 'Primary Space Photo (Key Observation)') : t('primarySitePhoto', 'Primary Site Photo (Key Observation)')}
              </Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={handleImagePickChoice} activeOpacity={0.7}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera" size={32} color="#94A3B8" />
                    <Text style={styles.imagePickerText}>
                      {isInterior ? t('selectSpaceObservationImage', 'Select space observation image') : t('selectSiteObservationImage', 'Select site observation image')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {imageUri && (
                <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
                  <Text style={styles.removeImageText}>{t('removeImage', 'Remove Image')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {isInterior && (
              <View>
                <Text style={styles.fieldLabel}>{t('additionalSpacePhotos', 'Additional Space Photos')}</Text>
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
                    <Text style={styles.addPhotoBtnText}>{t('addPhoto', 'Add Photo')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </AdaptiveGlass>

          <AdaptiveGlass intensity={20} tint="light" style={styles.sectionForm}>
            <Text style={styles.sectionLabel}>{t('observationsAndRemarks', 'Observations & Remarks')}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { minHeight: 110 }]}
              placeholder={t('observationsPlaceholder', 'General observations, access notes, or site constraints...')}
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              value={formData.surveyorComments}
              onChangeText={(text) => setFormData(prev => ({ ...prev, surveyorComments: text }))}
            />

            <View style={styles.divider} />

            {renderToggle(t('affectsInitialBudget', 'Affects Initial Budget?'), t('surveyBudgetChangeSub', 'Does this survey identify scope changes requiring budget adjustment?'), 'affectsBudget')}

            {formData.affectsBudget && (
              <View style={{ marginTop: 20, gap: 16 }}>
                <View style={styles.referenceBox}>
                  <Ionicons name="information-circle" size={16} color="#3B82F6" />
                  <Text style={styles.referenceText}>{t('currentActiveBudget', 'Current Active Budget:')} <Text style={{ fontFamily: 'Inter-Black' }}>{formatCurrency(Number(currentBudget), currency || 'AED')}</Text></Text>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>{t('newEstimatedBudget', 'New Estimated Budget')} ({currency || 'AED'})</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 850000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formData.recommendedBudget}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, recommendedBudget: text }))}
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>{t('reason', 'Reason')}</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { minHeight: 80 }]}
                    placeholder={t('budgetReasonPlaceholder', 'e.g. Structural modifications required')}
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    value={formData.budgetReason}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, budgetReason: text }))}
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
  subTitle: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  unitRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  unitBtn: { paddingHorizontal: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  unitText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
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
