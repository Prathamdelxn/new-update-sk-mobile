

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList, Image, Linking } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AdaptiveGlass from './components/AdaptiveGlass';
import LocationMapViewer from './components/LocationMapViewer';

import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from './context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from './services/cloudinaryService';
import { useToast } from './context/ToastContext';
import { useTranslation } from 'react-i18next';
import countriesData from './data/countries.json';
import * as Location from 'expo-location';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function CreateProjectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const isCustom = params.isCustom === 'true';
  const templateId = params.templateId;
  const templateName = params.templateName;
  const [selectedCategoryName, setSelectedCategoryName] = useState(params.categoryName || 'General');

  const [projectName, setProjectName] = useState(templateName || '');
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState('sqft');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [selectedCountryFlag, setSelectedCountryFlag] = useState('🇦🇪');
  const [countries, setCountries] = useState(countriesData);
  const [filteredCountries, setFilteredCountries] = useState(countriesData);
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [estimatedDays, setEstimatedDays] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({ projectName: false, location: false });
  const [startDate, setStartDate] = useState(new Date());
  const [targetDate, setTargetDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [projectType, setProjectType] = useState('Construction');
  const [siteLat, setSiteLat] = useState('');
  const [siteLng, setSiteLng] = useState('');
  const [attendanceRadius, setAttendanceRadius] = useState('100');
  const [needSurvey, setNeedSurvey] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDrawing, setIsUploadingDrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);


  // Sync flag when countries list loads (important for edit mode)
  useEffect(() => {
    if (countries.length > 0 && currency) {
      const match = countries.find(c => c.currencyCode === currency);
      if (match) setSelectedCountryFlag(match.flag);
    }
  }, [countries, currency]);

  // Removed fetchCountries since we now use bundled JSON data directly

  useEffect(() => {
    if (currencySearch) {
      const q = currencySearch.toLowerCase();
      setFilteredCountries(countries.filter(c => c.name.toLowerCase().includes(q) || c.currencyCode.toLowerCase().includes(q)));
    } else {
      setFilteredCountries(countries);
    }
  }, [currencySearch, countries]);

  useEffect(() => {
    if (params.isEditing === 'true' && params.id) {
      setProjectName(params.projectName || '');
      setLocation(params.location || '');
      if (params.area) setArea(params.area);
      if (params.budget) setBudget(params.budget);
      if (params.currency) setCurrency(params.currency);

      if (params.startDate) setStartDate(new Date(params.startDate));
      if (params.targetDate) setTargetDate(new Date(params.targetDate));

      fetchProjectDetails();
    } else if (templateId) {
      fetchTemplateDetails();
    }
  }, [params.id, templateId, token]);

  const fetchProjectDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/projects/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setProjectName(data.name || '');

        // Restore location from dedicated field or fallback to description parsing
        if (data.location) {
          setLocation(data.location);
        } else if (data.description) {
          const locMatch = data.description.match(/Location:\s*(.*?)(?:\.|$)/);
          if (locMatch) setLocation(locMatch[1].trim());
        }

        if (data.area) setArea(data.area.toString());
        if (data.budget) setBudget(data.budget.toString());
        setDocuments(data.documents || []);
        if (data.budget !== undefined && data.budget !== null) setBudget(data.budget.toString());
        if (data.area !== undefined && data.area !== null) setArea(data.area.toString());
        if (data.areaUnit) setAreaUnit(data.areaUnit);
        if (data.startDate) setStartDate(new Date(data.startDate));
        if (data.endDate) setTargetDate(new Date(data.endDate));
        if (data.siteLocation) {
          if (data.siteLocation.latitude) setSiteLat(data.siteLocation.latitude.toString());
          if (data.siteLocation.longitude) setSiteLng(data.siteLocation.longitude.toString());
        }
        if (data.attendanceRadius) setAttendanceRadius(data.attendanceRadius.toString());
        if (data.needSiteSurvey !== undefined) setNeedSurvey(data.needSiteSurvey);
        if (data.projectType) setProjectType(data.projectType);
        if (data.currency) {
          setCurrency(data.currency);
          // Restore the flag for the selected currency
          const match = countries.find(c => c.currencyCode === data.currency);
          if (match) setSelectedCountryFlag(match.flag);
        }
        if (data.category) setSelectedCategoryName(data.category.name || 'General');
      }
    } catch (e) {
      console.error('Fetch project details error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplateDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setArea(data.area?.toString() || '');
        setBudget(data.maxBudget?.toString() || '');
        const days = data.estimatedDays || 0;
        setEstimatedDays(days);

        // Auto-calculate target date if template has estimated days
        if (days > 0 && startDate) {
          const newTarget = new Date(startDate);
          newTarget.setDate(newTarget.getDate() + days);
          setTargetDate(newTarget);
        }
      }
    } catch (e) {
      console.error('Fetch template details error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (event, selectedDate, type) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
      setShowEndPicker(false);
    }

    if (selectedDate) {
      if (type === 'start') {
        setStartDate(selectedDate);
        setFieldErrors(prev => ({ ...prev, startDate: false }));
        // Automatically calculate target date based on estimated days
        if (estimatedDays > 0) {
          const newTarget = new Date(selectedDate);
          newTarget.setDate(newTarget.getDate() + estimatedDays);
          setTargetDate(newTarget);
          setFieldErrors(prev => ({ ...prev, targetDate: false }));
        }
      } else {
        setTargetDate(selectedDate);
        setFieldErrors(prev => ({ ...prev, targetDate: false }));
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        setIsUploading(true);
        try {
          const uploadedUrl = await cloudinaryService.uploadFile(
            file.uri,
            file.name,
            file.mimeType || 'application/octet-stream'
          );

          setDocuments(prev => [...prev, {
            url: uploadedUrl,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
          }]);
        } catch (uploadError) {
          showToast('There was an error uploading your file to Cloudinary.', 'error');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      console.error('Pick document error', err);
    }
  };

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const pickDrawing = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        setIsUploadingDrawing(true);
        try {
          const uploadedUrl = await cloudinaryService.uploadFile(
            file.uri,
            file.name,
            file.mimeType || 'application/octet-stream'
          );

          setDrawings(prev => [...prev, {
            url: uploadedUrl,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
          }]);
        } catch (uploadError) {
          showToast('There was an error uploading your drawing to Cloudinary.', 'error');
        } finally {
          setIsUploadingDrawing(false);
        }
      }
    } catch (err) {
      console.error('Pick drawing error', err);
    }
  };

  const removeDrawing = (index) => {
    setDrawings(prev => prev.filter((_, i) => i !== index));
  };

  const handleGetCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Location permission is required.', 'error');
        setIsFetchingLocation(false);
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setSiteLat(loc.coords.latitude.toString());
      setSiteLng(loc.coords.longitude.toString());
      showToast('Location fetched successfully!', 'success');
    } catch (err) {
      console.log("Location Error:", err);
      showToast('Failed to fetch location.', 'error');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleCreateProject = async () => {
    const errors = {
      projectName: !projectName.trim(),
      location: !location.trim(),
    };
    if (errors.projectName || errors.location) {
      setFieldErrors(prev => ({ ...prev, projectName: errors.projectName, location: errors.location }));
      showToast(t('pleaseFillRequiredFields'), 'error');
      return;
    }
    setFieldErrors(prev => ({ ...prev, projectName: false, location: false }));

    if (startDate && targetDate) {
      const start = new Date(startDate);
      const end = new Date(targetDate);
      // Reset times to compare just the dates
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (end < start) {
        showToast('Target End Date cannot be earlier than Start Date.', 'error');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const payload = {
        name: projectName,
        description: `Location: ${location}`,
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(targetDate && { endDate: targetDate.toISOString() }),
        documents: documents,
        drawings: drawings,
        budget: budget,
        area: area,
        areaUnit: areaUnit,
        currency: currency,
        needSiteSurvey: needSurvey,
        projectType,
        category: params.categoryId,
        siteLocation: {
          latitude: parseFloat(siteLat) || 0,
          longitude: parseFloat(siteLng) || 0,
          address: location
        },
        attendanceRadius: parseInt(attendanceRadius, 10) || 100,
      };

      if (startDate) payload.startDate = startDate.toISOString();
      if (targetDate) payload.endDate = targetDate.toISOString();

      if (params.isEditing === 'true') {
        payload.updatedBy = user?.id || params.userId;
      } else {
        payload.createdBy = user?.id || params.userId || '69dca9886241ba74d7515764';
      }

      const url = params.isEditing === 'true'
        ? `${API_BASE_URL}/projects/${params.id}`
        : `${API_BASE_URL}/projects`;

      const method = params.isEditing === 'true' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast('Project created successfully!', 'success');
        router.replace('/(tabs)/project');
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to create project', 'error');
      }
    } catch (e) {
      showToast(t('networkErrorCheckServer'), 'error');
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
    >
      <View style={styles.outerContainer}>
        <LinearGradient
          colors={['#F8FAFF', '#F0F9FF']}
          style={StyleSheet.absoluteFill}
        />

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
              <Text style={styles.headerPreTitle}>{params.isEditing === 'true' ? t('editProject') : t('newProject')}</Text>
              <Text style={styles.headerTitle}>{params.isEditing === 'true' ? t('updateDetails') : t('configureSetup')}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 160 }}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>{t('synchronizingWorkspace')}</Text>
              </View>
            ) : (
              <>
                {/* Selection Info (Single Container) */}
                <AdaptiveGlass intensity={15} tint="light" style={[styles.infoCard, { flexDirection: 'column', alignItems: 'stretch', padding: 0, marginBottom: 12, gap: 0 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                    <View style={[styles.infoIconBox, { backgroundColor: '#EFF6FF', width: 48, height: 48, borderRadius: 14 }]}>
                      <MaterialIcons
                        name="folder-open"
                        size={24}
                        color="#3B82F6"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>{t('projectCategory')}</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>{selectedCategoryName}</Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: '#E0F2FE' }} />

                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                    <View style={[styles.infoIconBox, { backgroundColor: isCustom ? '#FFFBEB' : '#EFF6FF', width: 48, height: 48, borderRadius: 14 }]}>
                      <MaterialIcons
                        name={isCustom ? "bolt" : "description"}
                        size={24}
                        color={isCustom ? "#F59E0B" : "#3B82F6"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>{t('configuration')}</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {isCustom ? t('customBuild') : `${t('templatePrefix')} ${templateName}`}
                      </Text>
                    </View>
                  </View>
                </AdaptiveGlass>

                {/* --- 1. Basic Details Card --- */}
                <AdaptiveGlass intensity={15} tint="light" style={styles.bentoCard}>
                  <Text style={styles.bentoSectionTitle}>{t('basicDetails', 'Basic Details')}</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {t('projectNameLabel')} <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, fieldErrors.projectName && styles.inputError]}
                      placeholder={t('egSkylineResidency')}
                      placeholderTextColor="#94A3B8"
                      value={projectName}
                      onChangeText={(v) => {
                        setProjectName(v);
                        if (fieldErrors.projectName) setFieldErrors(prev => ({ ...prev, projectName: false }));
                      }}
                    />
                    {fieldErrors.projectName && (
                      <Text style={styles.errorHint}>{t('projectNameRequired')}</Text>
                    )}
                  </View>

                  {params.isEditing !== 'true' && (
                    <View style={[styles.inputGroup, { marginTop: 16 }]}>
                      <Text style={styles.inputLabel}>{t('projectType')}</Text>
                      <View style={styles.typeToggleRow}>
                        <TouchableOpacity
                          style={[styles.typeToggleBtn, projectType === 'Construction' && styles.typeToggleBtnActive]}
                          onPress={() => setProjectType('Construction')}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="construction" size={18} color={projectType === 'Construction' ? '#FFFFFF' : '#64748B'} />
                          <Text style={[styles.typeToggleText, projectType === 'Construction' && styles.typeToggleTextActive]}>{t('construction')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.typeToggleBtn, projectType === 'Interior' && styles.typeToggleBtnInterior]}
                          onPress={() => setProjectType('Interior')}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="weekend" size={18} color={projectType === 'Interior' ? '#FFFFFF' : '#64748B'} />
                          <Text style={[styles.typeToggleText, projectType === 'Interior' && styles.typeToggleTextActive]}>{t('interior')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </AdaptiveGlass>

                {/* --- 2. Location & Specs Card --- */}
                <AdaptiveGlass intensity={15} tint="light" style={styles.bentoCard}>
                  <Text style={styles.bentoSectionTitle}>{t('locationAndSpecs', 'Location & Specs')}</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {t('siteLocation')} <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, fieldErrors.location && styles.inputError]}
                      placeholder={t('egLuxuryAve')}
                      placeholderTextColor="#94A3B8"
                      value={location}
                      onChangeText={(v) => {
                        setLocation(v);
                        if (fieldErrors.location) setFieldErrors(prev => ({ ...prev, location: false }));
                      }}
                    />
                    {fieldErrors.location && (
                      <Text style={styles.errorHint}>{t('siteLocationRequired')}</Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { marginLeft: 0, color: '#334155' }]}>Pinpoint on Map</Text>
                      {siteLat && siteLng ? (
                        <Text style={{fontSize: 12, fontFamily: 'Inter-Medium', color: '#10B981', marginTop: 2}}>
                          {parseFloat(siteLat).toFixed(4)}, {parseFloat(siteLng).toFixed(4)}
                        </Text>
                      ) : (
                        <Text style={{fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 2}}>
                          Optional for attendance tracking
                        </Text>
                      )}
                    </View>
                    
                    <View style={{flexDirection: 'row', gap: 8}}>
                      <TouchableOpacity 
                        style={[styles.getLocationBtn, { height: 36, paddingHorizontal: 12, borderRadius: 10 }]} 
                        onPress={handleGetCurrentLocation}
                        disabled={isFetchingLocation}
                      >
                        {isFetchingLocation ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <MaterialIcons name="my-location" size={18} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.getLocationBtn, { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', height: 36, paddingHorizontal: 12, borderRadius: 10 }]} 
                        onPress={() => setIsMapModalVisible(true)}
                      >
                        <MaterialIcons name="map" size={18} color="#475569" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { marginTop: 16 }]}>
                    <Text style={styles.inputLabel}>{t('projectArea')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingRight: 8 }}>
                      <TextInput
                        style={{ flex: 1, height: '100%', paddingHorizontal: 16, fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' }}
                        placeholder="e.g. 2400"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={area}
                        onChangeText={(v) => setArea(v.replace(/[^0-9]/g, ''))}
                      />
                      <View style={{
                        flexDirection: 'row',
                        backgroundColor: '#F1F5F9',
                        borderRadius: 8,
                        padding: 4,
                      }}>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: areaUnit === 'sqft' ? '#FFFFFF' : 'transparent',
                            shadowColor: areaUnit === 'sqft' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 1,
                            elevation: areaUnit === 'sqft' ? 1 : 0,
                          }}
                          onPress={() => setAreaUnit('sqft')}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: areaUnit === 'sqft' ? '#0F172A' : '#64748B' }}>SQFT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: areaUnit === 'sqm' ? '#FFFFFF' : 'transparent',
                            shadowColor: areaUnit === 'sqm' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 1,
                            elevation: areaUnit === 'sqm' ? 1 : 0,
                          }}
                          onPress={() => setAreaUnit('sqm')}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: areaUnit === 'sqm' ? '#0F172A' : '#64748B' }}>SQM</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { marginTop: 16 }]}>
                    <Text style={styles.inputLabel}>Attendance Radius</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 100"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={attendanceRadius}
                      onChangeText={setAttendanceRadius}
                    />
                  </View>
                </AdaptiveGlass>

                {/* --- 3. Financials & Timeline Card --- */}
                <AdaptiveGlass intensity={15} tint="light" style={styles.bentoCard}>
                  <Text style={styles.bentoSectionTitle}>{t('financialsTimeline', 'Financials & Timeline')}</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {t('estBudget')}
                      {params.isEditing === 'true' && (
                        <Text style={styles.readonlyTag}> (read-only)</Text>
                      )}
                    </Text>
                    <View style={[styles.budgetRow, params.isEditing === 'true' && styles.budgetRowReadonly]}>
                      <TouchableOpacity
                        style={styles.currencyPrefix}
                        activeOpacity={params.isEditing === 'true' ? 1 : 0.7}
                        onPress={() => params.isEditing !== 'true' && setIsCurrencyModalVisible(true)}
                      >
                        <Text style={styles.currencyPrefixFlag}>{selectedCountryFlag}</Text>
                        <Text style={styles.currencyPrefixCode}>{currency}</Text>
                        {params.isEditing !== 'true' && (
                          <MaterialIcons name="arrow-drop-down" size={18} color="#64748B" />
                        )}
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.budgetInput, params.isEditing === 'true' && styles.budgetInputReadonly]}
                        placeholder="e.g. 50000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={budget}
                        onChangeText={(v) => setBudget(v.replace(/[^0-9]/g, ''))}
                        editable={params.isEditing !== 'true'}
                      />
                    </View>
                  </View>

                  <View style={[styles.row, { marginTop: 16 }]}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>{t('startDate')}</Text>
                      <TouchableOpacity
                        style={styles.dateInput}
                        activeOpacity={0.7}
                        onPress={() => setShowStartPicker(true)}
                      >
                        <MaterialIcons name="calendar-today" size={18} color="#3B82F6" />
                        <Text style={[styles.dateInputText, !startDate && { color: '#94A3B8' }]}>{formatDate(startDate)}</Text>
                      </TouchableOpacity>
                      {showStartPicker && (
                        <DateTimePicker
                          value={startDate || new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(e, d) => handleDateChange(e, d, 'start')}
                        />
                      )}
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>{t('targetEndDate')}</Text>
                      <TouchableOpacity
                        style={styles.dateInput}
                        activeOpacity={0.7}
                        onPress={() => setShowEndPicker(true)}
                      >
                        <MaterialIcons name="calendar-today" size={18} color="#3B82F6" />
                        <Text style={[styles.dateInputText, !targetDate && { color: '#94A3B8' }]}>{formatDate(targetDate)}</Text>
                      </TouchableOpacity>
                      {showEndPicker && (
                        <DateTimePicker
                          value={targetDate && (!startDate || targetDate >= startDate) ? targetDate : (startDate || new Date())}
                          mode="date"
                          minimumDate={startDate || undefined}
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(e, d) => handleDateChange(e, d, 'end')}
                        />
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.checkboxRow, (params.isEditing === 'true' && params.status && params.status !== 'Initialized') && { opacity: 0.6 }, { marginTop: 20 }]}
                    activeOpacity={0.7}
                    onPress={() => setNeedSurvey(!needSurvey)}
                    disabled={params.isEditing === 'true' && params.status && params.status !== 'Initialized'}
                  >
                    <View style={[styles.checkbox, needSurvey && styles.checkboxActive]}>
                      {needSurvey && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.checkboxLabel}>{t('needSiteSurveyLabel')}</Text>
                  </TouchableOpacity>
                </AdaptiveGlass>

                {/* --- 4. Technical Drawings Card --- */}
                <AdaptiveGlass intensity={15} tint="light" style={styles.bentoCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.bentoSectionTitle}>Technical Drawings</Text>
                    <TouchableOpacity
                      style={styles.addDocBtn}
                      onPress={pickDrawing}
                      disabled={isUploadingDrawing}
                    >
                      <MaterialIcons name="add-circle" size={20} color="#3B82F6" />
                      <Text style={styles.addDocText}>{t('addFile')}</Text>
                    </TouchableOpacity>
                  </View>

                  {isUploadingDrawing && (
                    <View style={styles.uploadingBox}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={styles.uploadingText}>Uploading Drawing...</Text>
                    </View>
                  )}

                  <View style={styles.docList}>
                    {drawings.map((doc, index) => (
                      <AdaptiveGlass key={index} intensity={10} tint="light" style={styles.docItem}>
                        <View style={styles.docIconBox}>
                          <MaterialIcons
                            name={doc.mimeType?.includes('image') ? "image" : "picture-as-pdf"}
                            size={20}
                            color="#3B82F6"
                          />
                        </View>
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                          <Text style={styles.docSize}>{(doc.size / 1024).toFixed(1)} KB</Text>
                        </View>
                        <TouchableOpacity onPress={() => setPreviewDoc(doc)} style={styles.docActionBtn}>
                          <MaterialIcons name="visibility" size={20} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeDrawing(index)} style={styles.docActionBtn}>
                          <MaterialIcons name="delete" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </AdaptiveGlass>
                    ))}
                    {drawings.length === 0 && !isUploadingDrawing && (
                      <Text style={styles.emptyDocText}>No drawings attached</Text>
                    )}
                  </View>
                </AdaptiveGlass>

                {/* --- 5. Documents & Media Card --- */}
                <AdaptiveGlass intensity={15} tint="light" style={styles.bentoCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.bentoSectionTitle} >{t('projectDocuments')}</Text>
                    <TouchableOpacity
                      style={styles.addDocBtn}
                      onPress={pickDocument}
                      disabled={isUploading}
                    >
                      <MaterialIcons name="add-circle" size={20} color="#3B82F6" />
                      <Text style={styles.addDocText}>{t('addFile')}</Text>
                    </TouchableOpacity>
                  </View>

                  {isUploading && (
                    <View style={styles.uploadingBox}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={styles.uploadingText}>{t('uploadingToCloudinary')}</Text>
                    </View>
                  )}

                  <View style={styles.docList}>
                    {documents.map((doc, index) => (
                      <AdaptiveGlass key={index} intensity={10} tint="light" style={styles.docItem}>
                        <View style={styles.docIconBox}>
                          <MaterialIcons
                            name={doc.mimeType?.includes('image') ? "image" : "description"}
                            size={20}
                            color="#3B82F6"
                          />
                        </View>
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                          <Text style={styles.docSize}>{(doc.size / 1024).toFixed(1)} KB</Text>
                        </View>
                        <TouchableOpacity onPress={() => setPreviewDoc(doc)} style={styles.docActionBtn}>
                          <MaterialIcons name="visibility" size={20} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeDocument(index)} style={styles.docActionBtn}>
                          <MaterialIcons name="delete" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </AdaptiveGlass>
                    ))}
                    {documents.length === 0 && !isUploading && (
                      <Text style={styles.emptyDocText}>{t('noDocumentsAttached')}</Text>
                    )}
                  </View>
                </AdaptiveGlass>
              </>
            )}
          </ScrollView>

      {/* Full Screen Map Overlay - Replaced Modal to prevent Android crashes */}
      {isMapModalVisible && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F8FAFC', zIndex: 9999, elevation: 9999 }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
               <Text style={{ fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' }}>Choose Location</Text>
               <TouchableOpacity onPress={() => setIsMapModalVisible(false)} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2563EB', borderRadius: 8 }}>
                 <Text style={{ color: '#fff', fontFamily: 'Inter-SemiBold' }}>Confirm</Text>
               </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <LocationMapViewer 
                mode="admin"
                fullScreen={true}
                centerLat={parseFloat(siteLat) || 25.2048}
                centerLng={parseFloat(siteLng) || 55.2708}
                radius={parseInt(attendanceRadius, 10) || 100}
                onLocationSelect={(lat, lng) => {
                  setSiteLat(lat.toString());
                  setSiteLng(lng.toString());
                }}
              />
            </View>
          </SafeAreaView>
        </View>
      )}

          {/* Document Preview Modal */}
          <Modal
            visible={!!previewDoc}
            animationType="fade"
            transparent
            onRequestClose={() => setPreviewDoc(null)}
          >
            <View style={styles.previewOverlay}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle} numberOfLines={1}>{previewDoc?.name}</Text>
                <TouchableOpacity onPress={() => setPreviewDoc(null)}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {previewDoc?.mimeType?.includes('image') ? (
                <Image
                  source={{ uri: previewDoc.url }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.previewPdfBox}>
                  <MaterialIcons name="picture-as-pdf" size={64} color="#EF4444" />
                  <Text style={styles.previewPdfName} numberOfLines={2}>{previewDoc?.name}</Text>
                  <TouchableOpacity
                    style={styles.previewOpenBtn}
                    onPress={() => Linking.openURL(previewDoc?.url)}
                  >
                    <MaterialIcons name="open-in-browser" size={20} color="#FFFFFF" />
                    <Text style={styles.previewOpenText}>Open in Browser</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Modal>

          <Modal
            visible={isCurrencyModalVisible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setIsCurrencyModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Currency</Text>
                <TouchableOpacity onPress={() => setIsCurrencyModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search country or currency..."
                  placeholderTextColor="#94A3B8"
                  value={currencySearch}
                  onChangeText={setCurrencySearch}
                />
                {currencySearch ? (
                  <TouchableOpacity onPress={() => setCurrencySearch('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.cca2 + item.currencyCode}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.countryItem, currency === item.currencyCode && styles.countryItemSelected]}
                    onPress={() => {
                      setCurrency(item.currencyCode);
                      setSelectedCountryFlag(item.flag);
                      setIsCurrencyModalVisible(false);
                      setCurrencySearch('');
                    }}
                  >
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <View style={styles.countryInfo}>
                      <Text style={styles.countryName}>{item.name}</Text>
                      <Text style={styles.countryCurrency}>{item.currencyCode} · {item.currencyName}</Text>
                    </View>
                    {currency === item.currencyCode && (
                      <MaterialIcons name="check-circle" size={20} color="#3B82F6" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </Modal>

          {/* Action Button */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.8}
              onPress={handleCreateProject}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                style={styles.submitGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitText}>{params.isEditing === 'true' ? t('updateProject') : t('createProject', 'Create Project')}</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 32,
  },
  bentoCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 12,
  },
  bentoSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 16,
  },
  infoIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  getLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  getLocationText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  infoDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  formSection: {
    gap: 20,
  },
  sectionLabel: {
    fontSize: 18,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  inputGroup: {
    gap: 8,
    minWidth: 140,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
  },
  typeToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeToggleBtn: { flex: 1, minWidth: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  typeToggleBtnActive: { backgroundColor: '#3B82F6', borderColor: '#2563EB' },
  typeToggleBtnInterior: { backgroundColor: '#7C3AED', borderColor: '#6D28D9' },
  typeToggleText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#64748B' },
  typeToggleTextActive: { color: '#FFFFFF' },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    marginLeft: 4,
  },
  requiredStar: {
    color: '#EF4444',
    fontFamily: 'Inter-Bold',
  },
  input: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  errorHint: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
    marginLeft: 4,
    marginTop: 4,
  },
  dateInput: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateInputText: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  submitBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  submitGradient: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitText: {
    fontSize: 16,
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
  },
  documentSection: {
    marginTop: 12,
  },
  addDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  addDocText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  uploadingText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  docList: {
    marginTop: 12,
    gap: 10,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  docSize: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  emptyDocText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center',
    marginTop: 40,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
    textAlign: 'center',
  },
  docActionBtn: {
    padding: 6,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  previewTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginRight: 12,
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewPdfBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  previewPdfName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  previewOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  previewOpenText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  readonlyTag: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  budgetRowReadonly: {
    backgroundColor: '#F8FAFF',
    borderColor: '#E2E8F0',
    opacity: 0.8,
  },
  budgetInputReadonly: {
    color: '#64748B',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  currencyPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFF',
    gap: 3,
  },
  currencyPrefixFlag: {
    fontSize: 18,
  },
  currencyPrefixCode: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  budgetInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  countryItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  countryFlag: {
    fontSize: 26,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  countryCurrency: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeToggleBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  typeToggleBtnInterior: {
    backgroundColor: '#8B5CF6',
    borderColor: '#7C3AED',
  },
  typeToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
  },
  typeToggleTextActive: {
    color: '#FFFFFF',
  },
});