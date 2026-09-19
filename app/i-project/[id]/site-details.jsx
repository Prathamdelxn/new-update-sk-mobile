import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const ROOM_PRESETS = [
  'Living Room',
  'Master Bedroom',
  'Kitchen',
  'Dining Room',
  'Kids Bedroom',
  'Guest Bedroom',
  'Foyer / Entryway',
  'Balcony',
  'Pooja Room',
  'Study / Home Office',
  'Bathroom',
];

const DESIGN_STYLE_PRESETS = [
  'Modern Minimalist',
  'Contemporary Luxury',
  'Scandinavian',
  'Neo-Classical',
  'Industrial Chic',
  'Bohemian Warmth',
  'Traditional Heritage',
  'Art Deco',
  'Japandi',
];

const INTERIOR_TYPE_PRESETS = ['Residential', 'Commercial', 'Hospitality', 'Retail'];

// Detail fields rendered as compact label/value rows (short values).
const MEASURE_DETAIL_FIELDS = [
  { key: 'roomDimensions', label: 'Room Dimensions (L × W)' },
  { key: 'floorToCeilingHeight', label: 'Floor-to-Ceiling Height' },
  { key: 'doorDimensions', label: 'Door Dimensions' },
  { key: 'windowDimensions', label: 'Window Dimensions' },
  { key: 'wallThickness', label: 'Wall Thickness' },
  { key: 'columnBeamDimensions', label: 'Column / Beam Dimensions' },
  { key: 'rooms', label: 'Target Configuration' },
];

// Note-style fields rendered as labeled paragraph boxes (longer free text).
const MEASURE_NOTE_FIELDS = [
  { key: 'electricalPoints', label: 'Existing Electrical Points', color: '#D97706' },
  { key: 'plumbingPoints', label: 'Plumbing Points', color: '#0891B2' },
  { key: 'acLocations', label: 'AC Locations & Piping', color: '#059669' },
  { key: 'furnitureDimensions', label: 'Existing Furniture Dimensions', color: '#059669' },
  { key: 'siteConstraints', label: 'Site Constraints & Limitations', color: '#E11D48' },
  { key: 'notes', label: 'Additional Site Notes', color: '#7C3AED' },
];

const MEASURE_FORM_DEFAULT = {
  carpetArea: '',
  ceilingHeight: '',
  roomDimensions: '',
  floorToCeilingHeight: '',
  rooms: '',
  doorDimensions: '',
  windowDimensions: '',
  wallThickness: '',
  columnBeamDimensions: '',
  electricalPoints: '',
  plumbingPoints: '',
  acLocations: '',
  furnitureDimensions: '',
  siteConstraints: '',
  notes: '',
};

const REQ_FORM_DEFAULT = {
  roomName: 'Living Room',
  interiorType: 'Residential',
  designStyle: 'Contemporary Luxury',
  description: '',
  // Functional
  roomUsage: '',
  furnitureRequirements: '',
  storage: '',
  electricalPoints: '',
  lightingRequirements: '',
  plumbingRequirements: '',
  circulation: '',
  // Aesthetic
  colours: '',
  materials: '',
  flooring: '',
  ceiling: '',
  wallFinishes: '',
  furnitureStyle: '',
};

export default function InteriorSiteDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'measurements' | 'requirements' | 'photos'

  // Modals
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [savingMeasurements, setSavingMeasurements] = useState(false);
  const [measureForm, setMeasureForm] = useState(MEASURE_FORM_DEFAULT);
  const [sitePhotosList, setSitePhotosList] = useState([]);

  const [showReqModal, setShowReqModal] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [reqForm, setReqForm] = useState(REQ_FORM_DEFAULT);

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const loadSiteData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get('/crm/customers');
      const customers = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      const found = customers.find((c) => {
        if (!c.linkedProject) return false;
        const linkedId =
          typeof c.linkedProject === 'object' && c.linkedProject?._id
            ? String(c.linkedProject._id)
            : String(c.linkedProject);
        return linkedId === String(projectId);
      });

      if (found) {
        setCustomer(found);
        const sm = found.siteMeasurements || {};
        setMeasureForm({
          carpetArea: sm.carpetArea ? String(sm.carpetArea) : '',
          ceilingHeight: sm.ceilingHeight ? String(sm.ceilingHeight) : '',
          roomDimensions: sm.roomDimensions || '',
          floorToCeilingHeight: sm.floorToCeilingHeight || '',
          rooms: sm.rooms || '',
          doorDimensions: sm.doorDimensions || '',
          windowDimensions: sm.windowDimensions || '',
          wallThickness: sm.wallThickness || '',
          columnBeamDimensions: sm.columnBeamDimensions || '',
          electricalPoints: sm.electricalPoints || '',
          plumbingPoints: sm.plumbingPoints || '',
          acLocations: sm.acLocations || '',
          furnitureDimensions: sm.furnitureDimensions || '',
          siteConstraints: sm.siteConstraints || '',
          notes: sm.notes || '',
        });
        setSitePhotosList(found.sitePhotos || []);
      } else {
        setCustomer(null);
      }
    } catch (e) {
      console.error('Failed to load site details', e);
      showToast('Failed to load site details', 'error');
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useFocusEffect(useCallback(() => { loadSiteData(); }, [loadSiteData]));

  const requirements = useMemo(() => customer?.requirements || [], [customer]);
  const siteMeasurements = customer?.siteMeasurements;
  const sitePhotos = useMemo(() => customer?.sitePhotos || [], [customer]);
  const hasRequirements = requirements.length > 0;
  const hasMeasurements = !!siteMeasurements && (!!siteMeasurements.carpetArea || !!siteMeasurements.ceilingHeight);
  const hasPhotos = sitePhotos.length > 0;

  // Handle Photo Picker
  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Camera roll permission is required to upload site photos', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        setSitePhotosList((prev) => [...prev, dataUri]);
      }
    } catch (e) {
      showToast(e.message || 'Failed to pick photo', 'error');
    }
  };

  const handleRemovePhoto = (index) => {
    setSitePhotosList((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Measurements
  const handleSaveMeasurements = async () => {
    if (!customer?._id) return;
    setSavingMeasurements(true);
    try {
      const payload = {
        siteMeasurements: {
          carpetArea: parseFloat(measureForm.carpetArea) || 0,
          ceilingHeight: parseFloat(measureForm.ceilingHeight) || 0,
          roomDimensions: measureForm.roomDimensions.trim(),
          floorToCeilingHeight: measureForm.floorToCeilingHeight.trim(),
          rooms: measureForm.rooms.trim(),
          doorDimensions: measureForm.doorDimensions.trim(),
          windowDimensions: measureForm.windowDimensions.trim(),
          wallThickness: measureForm.wallThickness.trim(),
          columnBeamDimensions: measureForm.columnBeamDimensions.trim(),
          electricalPoints: measureForm.electricalPoints.trim(),
          plumbingPoints: measureForm.plumbingPoints.trim(),
          acLocations: measureForm.acLocations.trim(),
          furnitureDimensions: measureForm.furnitureDimensions.trim(),
          siteConstraints: measureForm.siteConstraints.trim(),
          notes: measureForm.notes.trim(),
        },
        sitePhotos: sitePhotosList,
      };

      await interiorApiClient.patch(`/crm/customers/${customer._id}`, payload);
      showToast('Site measurements updated successfully!', 'success');
      setShowMeasureModal(false);
      loadSiteData();
    } catch (e) {
      showToast(e.message || 'Failed to update measurements', 'error');
    } finally {
      setSavingMeasurements(false);
    }
  };

  // Save Room Requirement
  const handleSaveRequirement = async () => {
    if (!customer?._id) return;
    if (!reqForm.roomName.trim()) {
      showToast('Please specify a room name', 'error');
      return;
    }

    setSavingReq(true);
    try {
      const newReq = {
        roomName: reqForm.roomName.trim(),
        interiorType: reqForm.interiorType.trim(),
        designStyle: reqForm.designStyle,
        description: reqForm.description.trim(),
        roomUsage: reqForm.roomUsage.trim(),
        furnitureRequirements: reqForm.furnitureRequirements.trim(),
        storage: reqForm.storage.trim(),
        electricalPoints: reqForm.electricalPoints.trim(),
        lightingRequirements: reqForm.lightingRequirements.trim(),
        plumbingRequirements: reqForm.plumbingRequirements.trim(),
        circulation: reqForm.circulation.trim(),
        colours: reqForm.colours.trim(),
        materials: reqForm.materials.trim(),
        flooring: reqForm.flooring.trim(),
        ceiling: reqForm.ceiling.trim(),
        wallFinishes: reqForm.wallFinishes.trim(),
        furnitureStyle: reqForm.furnitureStyle.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedReqs = [...requirements, newReq];
      await interiorApiClient.patch(`/crm/customers/${customer._id}`, {
        requirements: updatedReqs,
      });

      showToast(`Added requirement for ${reqForm.roomName}!`, 'success');
      setShowReqModal(false);
      setReqForm(REQ_FORM_DEFAULT);
      loadSiteData();
    } catch (e) {
      showToast(e.message || 'Failed to add requirement', 'error');
    } finally {
      setSavingReq(false);
    }
  };

  const handleDeleteRequirement = (index, roomTitle) => {
    Alert.alert(
      'Delete Room Requirement',
      `Are you sure you want to remove the brief for "${roomTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = requirements.filter((_, i) => i !== index);
              await interiorApiClient.patch(`/crm/customers/${customer._id}`, { requirements: updated });
              showToast('Requirement removed', 'success');
              loadSiteData();
            } catch (e) {
              showToast(e.message || 'Failed to remove requirement', 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* --- HEADER --- */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Site Details & Specs</Text>
            <Text style={s.headerSub}>Survey measurements, room briefs & site photo records</Text>
          </View>
        </View>

        {/* --- KPI QUICK STATS BANNER --- */}
        <View style={s.kpiRow}>
          <View style={s.kpiItem}>
            <Text style={s.kpiNumber}>{siteMeasurements?.carpetArea || 0}</Text>
            <Text style={s.kpiLabel}>Carpet Sq.Ft</Text>
          </View>
          <View style={s.kpiDivider} />
          <View style={s.kpiItem}>
            <Text style={s.kpiNumber}>{siteMeasurements?.ceilingHeight || 0}</Text>
            <Text style={s.kpiLabel}>Ceiling Ft</Text>
          </View>
          <View style={s.kpiDivider} />
          <View style={s.kpiItem}>
            <Text style={[s.kpiNumber, { color: '#059669' }]}>{requirements.length}</Text>
            <Text style={s.kpiLabel}>Rooms</Text>
          </View>
          <View style={s.kpiDivider} />
          <View style={s.kpiItem}>
            <Text style={[s.kpiNumber, { color: '#7C3AED' }]}>{sitePhotos.length}</Text>
            <Text style={s.kpiLabel}>Photos</Text>
          </View>
        </View>

        {/* --- FILTER TABS --- */}
        <View style={s.tabSegmentRow}>
          {[
            { id: 'all', label: 'All Specs', icon: 'grid-outline' },
            { id: 'measurements', label: 'Measurements', icon: 'resize-outline' },
            { id: 'requirements', label: 'Rooms Brief', icon: 'list-outline' },
            { id: 'photos', label: 'Photos', icon: 'images-outline' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tabItem, activeTab === tab.id && s.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={13}
                color={activeTab === tab.id ? '#2563EB' : '#64748B'}
              />
              <Text style={[s.tabItemText, activeTab === tab.id && s.tabItemTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : !customer ? (
          <View style={s.empty}>
            <Ionicons name="clipboard-outline" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No CRM Link Found</Text>
            <Text style={s.emptySub}>
              This project does not have an associated CRM customer record linked yet.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* ------------------------------------------------------------- */}
            {/* SECTION: MEASUREMENTS */}
            {/* ------------------------------------------------------------- */}
            {(activeTab === 'all' || activeTab === 'measurements') && (
              <View style={s.sectionBlock}>
                <View style={s.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="resize-outline" size={16} color="#7C3AED" />
                    <Text style={s.sectionTitle}>Physical Site Measurements</Text>
                  </View>
                  <TouchableOpacity
                    style={s.sectionEditBtn}
                    onPress={() => setShowMeasureModal(true)}
                  >
                    <Ionicons name="pencil" size={12} color="#2563EB" />
                    <Text style={s.sectionEditBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {hasMeasurements ? (
                  <View style={s.measureCard}>
                    <View style={s.measureGrid}>
                      <View style={s.measureTile}>
                        <Text style={s.tileLabel}>Carpet Area</Text>
                        <Text style={s.tileValue}>
                          {siteMeasurements.carpetArea || 0} <Text style={s.tileUnit}>Sq.Ft</Text>
                        </Text>
                      </View>
                      <View style={s.measureTile}>
                        <Text style={s.tileLabel}>Ceiling Height</Text>
                        <Text style={s.tileValue}>
                          {siteMeasurements.ceilingHeight || 0} <Text style={s.tileUnit}>Ft</Text>
                        </Text>
                      </View>
                    </View>

                    {MEASURE_DETAIL_FIELDS.filter((f) => !!siteMeasurements[f.key]).map((f) => (
                      <View key={f.key} style={s.measureDetailRow}>
                        <Text style={s.measureDetailLabel}>{f.label}:</Text>
                        <Text style={s.measureDetailVal}>{siteMeasurements[f.key]}</Text>
                      </View>
                    ))}

                    {MEASURE_NOTE_FIELDS.filter((f) => !!siteMeasurements[f.key]).map((f) => (
                      <View key={f.key} style={[s.measureNotesBox, { borderLeftColor: f.color }]}>
                        <Text style={[s.measureNotesLabel, { color: f.color }]}>{f.label}:</Text>
                        <Text style={s.measureNotesText}>{siteMeasurements[f.key]}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.emptyPromptBox}
                    onPress={() => setShowMeasureModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={24} color="#7C3AED" />
                    <Text style={s.emptyPromptTitle}>No measurements logged</Text>
                    <Text style={s.emptyPromptSub}>Tap here to log carpet area, ceiling height, and structural notes</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SECTION: SITE PHOTOS */}
            {/* ------------------------------------------------------------- */}
            {(activeTab === 'all' || activeTab === 'photos') && (
              <View style={s.sectionBlock}>
                <View style={s.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="images-outline" size={16} color="#059669" />
                    <Text style={[s.sectionTitle, { color: '#059669' }]}>Site Inspection Photos ({sitePhotos.length})</Text>
                  </View>
                  <TouchableOpacity
                    style={s.sectionEditBtn}
                    onPress={() => setShowMeasureModal(true)}
                  >
                    <Ionicons name="camera-outline" size={13} color="#2563EB" />
                    <Text style={s.sectionEditBtnText}>Manage</Text>
                  </TouchableOpacity>
                </View>

                {hasPhotos ? (
                  <View style={s.photoGrid}>
                    {sitePhotos.map((photo, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={s.photoThumb}
                        onPress={() => setLightboxPhoto(photo)}
                      >
                        <Image source={{ uri: photo }} style={s.photoImg} />
                        <View style={s.photoOverlayBadge}>
                          <Ionicons name="scan-outline" size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.emptyPromptBox}
                    onPress={() => setShowMeasureModal(true)}
                  >
                    <Ionicons name="camera-outline" size={24} color="#059669" />
                    <Text style={[s.emptyPromptTitle, { color: '#059669' }]}>No inspection photos attached</Text>
                    <Text style={s.emptyPromptSub}>Tap to capture or upload on-site survey photos</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SECTION: ROOM REQUIREMENTS */}
            {/* ------------------------------------------------------------- */}
            {(activeTab === 'all' || activeTab === 'requirements') && (
              <View style={s.sectionBlock}>
                <View style={s.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="list-outline" size={16} color="#2563EB" />
                    <Text style={[s.sectionTitle, { color: '#2563EB' }]}>Room-by-Room Design Brief ({requirements.length})</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.sectionEditBtn, { backgroundColor: '#EFF6FF' }]}
                    onPress={() => setShowReqModal(true)}
                  >
                    <Ionicons name="add" size={14} color="#2563EB" />
                    <Text style={s.sectionEditBtnText}>Add Room</Text>
                  </TouchableOpacity>
                </View>

                {hasRequirements ? (
                  <View style={{ gap: 10 }}>
                    {requirements.map((req, idx) => {
                      const functionalRows = [
                        ['Usage', req.roomUsage],
                        ['Furniture', req.furnitureRequirements],
                        ['Storage', req.storage],
                        ['Electrical', req.electricalPoints],
                        ['Lighting', req.lightingRequirements],
                        ['Plumbing', req.plumbingRequirements],
                        ['Circulation', req.circulation],
                      ].filter(([, v]) => !!v);
                      const aestheticRows = [
                        ['Colours', req.colours],
                        ['Materials', req.materials],
                        ['Flooring', req.flooring],
                        ['Ceiling', req.ceiling],
                        ['Wall Finishes', req.wallFinishes],
                        ['Furniture Style', req.furnitureStyle],
                      ].filter(([, v]) => !!v);

                      return (
                        <View key={idx} style={s.reqCard}>
                          <View style={s.reqTopRow}>
                            <Text style={s.reqRoom}>{req.roomName || 'General Requirement'}</Text>
                            {!!(req.designStyle || req.theme) && (
                              <View style={s.themeBadge}>
                                <Text style={s.themeBadgeText}>{req.designStyle || req.theme}</Text>
                              </View>
                            )}
                            <TouchableOpacity
                              onPress={() => handleDeleteRequirement(idx, req.roomName)}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="trash-outline" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>

                          {!!req.interiorType && (
                            <View style={s.interiorTypeBadge}>
                              <Text style={s.interiorTypeBadgeText}>{req.interiorType}</Text>
                            </View>
                          )}

                          {!!req.description && <Text style={s.reqDesc}>{req.description}</Text>}

                          {functionalRows.length > 0 && (
                            <View style={s.reqSubSection}>
                              <Text style={s.reqSubSectionLabel}>Functional Requirements</Text>
                              {functionalRows.map(([label, value]) => (
                                <View key={label} style={s.reqFieldRow}>
                                  <Text style={s.reqFieldLabel}>{label}: </Text>
                                  <Text style={s.reqFieldValue}>{value}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {aestheticRows.length > 0 && (
                            <View style={[s.reqSubSection, { backgroundColor: '#FAF5FF' }]}>
                              <Text style={[s.reqSubSectionLabel, { color: '#7C3AED' }]}>Aesthetic Requirements</Text>
                              {aestheticRows.map(([label, value]) => (
                                <View key={label} style={s.reqFieldRow}>
                                  <Text style={s.reqFieldLabel}>{label}: </Text>
                                  <Text style={s.reqFieldValue}>{value}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.emptyPromptBox}
                    onPress={() => setShowReqModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={24} color="#2563EB" />
                    <Text style={[s.emptyPromptTitle, { color: '#2563EB' }]}>No room requirements recorded</Text>
                    <Text style={s.emptyPromptSub}>Tap here to define styling briefs and finish requirements</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Edit Site Measurements & Photos */}
      {/* ========================================================================= */}
      <Modal visible={showMeasureModal} animationType="slide" transparent onRequestClose={() => setShowMeasureModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Update Site Measurements</Text>
                <Text style={s.modalSubtitle}>Survey dimensions and structural field observations</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMeasureModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalGroupLabel}>Room & Spatial Dimensions</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Carpet Area (Sq.Ft) *</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="numeric"
                    placeholder="e.g. 1450"
                    placeholderTextColor="#94A3B8"
                    value={measureForm.carpetArea}
                    onChangeText={(t) => setMeasureForm((f) => ({ ...f, carpetArea: t }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Ceiling Height (Ft) *</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="numeric"
                    placeholder="e.g. 10.5"
                    placeholderTextColor="#94A3B8"
                    value={measureForm.ceilingHeight}
                    onChangeText={(t) => setMeasureForm((f) => ({ ...f, ceilingHeight: t }))}
                  />
                </View>
              </View>

              <Text style={s.label}>Room Dimensions (Length × Width)</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 18ft x 14ft"
                placeholderTextColor="#94A3B8"
                value={measureForm.roomDimensions}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, roomDimensions: t }))}
              />

              <Text style={s.label}>Floor-to-Ceiling Height</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 10.2 ft"
                placeholderTextColor="#94A3B8"
                value={measureForm.floorToCeilingHeight}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, floorToCeilingHeight: t }))}
              />

              <Text style={s.label}>Configuration / Target Rooms</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 3BHK + Servant Room + Balcony"
                placeholderTextColor="#94A3B8"
                value={measureForm.rooms}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, rooms: t }))}
              />

              <Text style={s.modalGroupLabel}>Openings & Structural Specs</Text>
              <Text style={s.label}>Door Dimensions</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Main door 4ft x 7ft"
                placeholderTextColor="#94A3B8"
                value={measureForm.doorDimensions}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, doorDimensions: t }))}
              />

              <Text style={s.label}>Window Dimensions</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Living room window 6ft x 4ft"
                placeholderTextColor="#94A3B8"
                value={measureForm.windowDimensions}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, windowDimensions: t }))}
              />

              <Text style={s.label}>Wall Thickness</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 6 inches"
                placeholderTextColor="#94A3B8"
                value={measureForm.wallThickness}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, wallThickness: t }))}
              />

              <Text style={s.label}>Column / Beam Dimensions</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 9x9 inch column near entrance"
                placeholderTextColor="#94A3B8"
                value={measureForm.columnBeamDimensions}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, columnBeamDimensions: t }))}
              />

              <Text style={s.modalGroupLabel}>MEP & Utility Services</Text>
              <Text style={s.label}>Existing Electrical Points</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. 2 switchboards near entrance, main DB at foyer"
                placeholderTextColor="#94A3B8"
                value={measureForm.electricalPoints}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, electricalPoints: t }))}
              />

              <Text style={s.label}>Plumbing Points</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Kitchen sink inlet on north wall"
                placeholderTextColor="#94A3B8"
                value={measureForm.plumbingPoints}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, plumbingPoints: t }))}
              />

              <Text style={s.label}>AC Locations & Piping</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Split AC outdoor unit on balcony, copper piping along false ceiling"
                placeholderTextColor="#94A3B8"
                value={measureForm.acLocations}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, acLocations: t }))}
              />

              <Text style={s.modalGroupLabel}>Furniture & Site Constraints</Text>
              <Text style={s.label}>Existing Furniture Dimensions</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Existing wardrobe 6ft to be retained"
                placeholderTextColor="#94A3B8"
                value={measureForm.furnitureDimensions}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, furnitureDimensions: t }))}
              />

              <Text style={s.label}>Site Constraints & Limitations</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Narrow staircase access, limited material lift window"
                placeholderTextColor="#94A3B8"
                value={measureForm.siteConstraints}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, siteConstraints: t }))}
              />

              <Text style={s.label}>Structural / Survey Notes</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Beam drop of 18 inches across living corridor. Main electrical board located at entrance."
                placeholderTextColor="#94A3B8"
                value={measureForm.notes}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, notes: t }))}
              />

              {/* Photos Management */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 }}>
                <Text style={s.label}>Site Inspection Photos ({sitePhotosList.length})</Text>
                <TouchableOpacity style={s.addPhotoBtn} onPress={handlePickPhoto}>
                  <Ionicons name="camera" size={13} color="#2563EB" />
                  <Text style={s.addPhotoBtnText}>+ Add Photo</Text>
                </TouchableOpacity>
              </View>

              {sitePhotosList.length > 0 ? (
                <View style={s.modalPhotoGrid}>
                  {sitePhotosList.map((uri, idx) => (
                    <View key={idx} style={s.modalPhotoThumb}>
                      <Image source={{ uri }} style={s.modalPhotoImg} />
                      <TouchableOpacity
                        style={s.removePhotoBtn}
                        onPress={() => handleRemovePhoto(idx)}
                      >
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <TouchableOpacity style={s.photoPickerBox} onPress={handlePickPhoto}>
                  <Ionicons name="images-outline" size={24} color="#94A3B8" />
                  <Text style={s.photoPickerBoxText}>Tap to pick inspection photos from device</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[s.saveBtn, savingMeasurements && { opacity: 0.7 }]}
                onPress={handleSaveMeasurements}
                disabled={savingMeasurements}
              >
                {savingMeasurements ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Save Site Measurements</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Add Room Requirement */}
      {/* ========================================================================= */}
      <Modal visible={showReqModal} animationType="slide" transparent onRequestClose={() => setShowReqModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Add Room Requirement</Text>
                <Text style={s.modalSubtitle}>Functional and aesthetic specs for room execution</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReqModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Select Room Preset</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {ROOM_PRESETS.map((rm) => (
                  <TouchableOpacity
                    key={rm}
                    style={[s.presetChip, reqForm.roomName === rm && s.presetChipActive]}
                    onPress={() => setReqForm((f) => ({ ...f, roomName: rm }))}
                  >
                    <Text style={[s.presetChipText, reqForm.roomName === rm && s.presetChipTextActive]}>
                      {rm}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Room Name *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Master Bedroom"
                placeholderTextColor="#94A3B8"
                value={reqForm.roomName}
                onChangeText={(t) => setReqForm((f) => ({ ...f, roomName: t }))}
              />

              <Text style={s.label}>Interior Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {INTERIOR_TYPE_PRESETS.map((it) => (
                  <TouchableOpacity
                    key={it}
                    style={[s.presetChip, reqForm.interiorType === it && s.presetChipActive]}
                    onPress={() => setReqForm((f) => ({ ...f, interiorType: it }))}
                  >
                    <Text style={[s.presetChipText, reqForm.interiorType === it && s.presetChipTextActive]}>
                      {it}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Design Style / Theme</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {DESIGN_STYLE_PRESETS.map((th) => (
                  <TouchableOpacity
                    key={th}
                    style={[s.presetChip, reqForm.designStyle === th && s.presetChipActive]}
                    onPress={() => setReqForm((f) => ({ ...f, designStyle: th }))}
                  >
                    <Text style={[s.presetChipText, reqForm.designStyle === th && s.presetChipTextActive]}>
                      {th}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.modalGroupLabel}>Functional Requirements</Text>

              <Text style={s.label}>Room Usage</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Primary bedroom for parents, needs reading nook"
                placeholderTextColor="#94A3B8"
                value={reqForm.roomUsage}
                onChangeText={(t) => setReqForm((f) => ({ ...f, roomUsage: t }))}
              />

              <Text style={s.label}>Furniture Requirements</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. King bed, 2 bedside units, dresser"
                placeholderTextColor="#94A3B8"
                value={reqForm.furnitureRequirements}
                onChangeText={(t) => setReqForm((f) => ({ ...f, furnitureRequirements: t }))}
              />

              <Text style={s.label}>Storage</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 6-door floor-to-ceiling wardrobe"
                placeholderTextColor="#94A3B8"
                value={reqForm.storage}
                onChangeText={(t) => setReqForm((f) => ({ ...f, storage: t }))}
              />

              <Text style={s.label}>Electrical Points</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. TV point, 2 bed-side 2-way switches"
                placeholderTextColor="#94A3B8"
                value={reqForm.electricalPoints}
                onChangeText={(t) => setReqForm((f) => ({ ...f, electricalPoints: t }))}
              />

              <Text style={s.label}>Lighting Requirements</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Warm 3000K magnetic track lights"
                placeholderTextColor="#94A3B8"
                value={reqForm.lightingRequirements}
                onChangeText={(t) => setReqForm((f) => ({ ...f, lightingRequirements: t }))}
              />

              <Text style={s.label}>Plumbing Requirements</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Attached bathroom, geyser point"
                placeholderTextColor="#94A3B8"
                value={reqForm.plumbingRequirements}
                onChangeText={(t) => setReqForm((f) => ({ ...f, plumbingRequirements: t }))}
              />

              <Text style={s.label}>Circulation</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Clear 3ft walkway from door to bed"
                placeholderTextColor="#94A3B8"
                value={reqForm.circulation}
                onChangeText={(t) => setReqForm((f) => ({ ...f, circulation: t }))}
              />

              <Text style={s.modalGroupLabel}>Aesthetic Requirements</Text>

              <Text style={s.label}>Colours</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Muted sage green with warm oak accents"
                placeholderTextColor="#94A3B8"
                value={reqForm.colours}
                onChangeText={(t) => setReqForm((f) => ({ ...f, colours: t }))}
              />

              <Text style={s.label}>Materials</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Smoked oak veneer, fluted charcoal panels, brass accents"
                placeholderTextColor="#94A3B8"
                value={reqForm.materials}
                onChangeText={(t) => setReqForm((f) => ({ ...f, materials: t }))}
              />

              <Text style={s.label}>Flooring</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Herringbone wooden flooring"
                placeholderTextColor="#94A3B8"
                value={reqForm.flooring}
                onChangeText={(t) => setReqForm((f) => ({ ...f, flooring: t }))}
              />

              <Text style={s.label}>Ceiling</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Perimeter cove false ceiling"
                placeholderTextColor="#94A3B8"
                value={reqForm.ceiling}
                onChangeText={(t) => setReqForm((f) => ({ ...f, ceiling: t }))}
              />

              <Text style={s.label}>Wall Finishes</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Textured paint accent wall behind headboard"
                placeholderTextColor="#94A3B8"
                value={reqForm.wallFinishes}
                onChangeText={(t) => setReqForm((f) => ({ ...f, wallFinishes: t }))}
              />

              <Text style={s.label}>Furniture Style</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Low-profile upholstered, matte finish"
                placeholderTextColor="#94A3B8"
                value={reqForm.furnitureStyle}
                onChangeText={(t) => setReqForm((f) => ({ ...f, furnitureStyle: t }))}
              />

              <Text style={s.label}>Detailed Functional Brief</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Client requires king-size bed backrest with integrated reading lights."
                placeholderTextColor="#94A3B8"
                value={reqForm.description}
                onChangeText={(t) => setReqForm((f) => ({ ...f, description: t }))}
              />

              <TouchableOpacity
                style={[s.saveBtn, savingReq && { opacity: 0.7 }]}
                onPress={handleSaveRequirement}
                disabled={savingReq}
              >
                {savingReq ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Save Room Requirement</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Full Screen Photo Lightbox */}
      {/* ========================================================================= */}
      <Modal visible={!!lightboxPhoto} transparent animationType="fade" onRequestClose={() => setLightboxPhoto(null)}>
        <View style={s.lightboxOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.lightboxHeader}>
              <Text style={s.lightboxTitle}>Site Inspection Photo</Text>
              <TouchableOpacity style={s.lightboxCloseBtn} onPress={() => setLightboxPhoto(null)}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={s.lightboxBody}>
              {lightboxPhoto && (
                <Image
                  source={{ uri: lightboxPhoto }}
                  style={s.lightboxImage}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={s.lightboxFooter}>
              <TouchableOpacity
                style={s.lightboxOpenExternalBtn}
                onPress={() => {
                  if (lightboxPhoto) Linking.openURL(lightboxPhoto);
                }}
              >
                <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                <Text style={s.lightboxOpenExternalText}>Open in High Quality</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  kpiItem: { alignItems: 'center', flex: 1 },
  kpiNumber: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A' },
  kpiLabel: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 1 },
  kpiDivider: { width: 1, height: 24, backgroundColor: '#F1F5F9' },

  tabSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabItemActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  tabItemText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  tabItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  sectionBlock: { gap: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionEditBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  measureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    gap: 10,
  },
  measureGrid: { flexDirection: 'row', gap: 10 },
  measureTile: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  tileValue: { fontSize: 16, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },
  tileUnit: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  measureDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  measureDetailLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  measureDetailVal: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },

  measureNotesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  measureNotesLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#7C3AED', textTransform: 'uppercase' },
  measureNotesText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#475569', marginTop: 3, lineHeight: 16 },

  emptyPromptBox: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  emptyPromptTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#475569' },
  emptyPromptSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: {
    width: '31.3%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoOverlayBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 4,
    borderRadius: 6,
  },

  reqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    gap: 8,
  },
  reqTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  reqRoom: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  themeBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  themeBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase' },
  interiorTypeBadge: { alignSelf: 'flex-start', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  interiorTypeBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#475569', textTransform: 'uppercase' },
  reqDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#475569', lineHeight: 17 },

  reqSubSection: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, gap: 3 },
  reqSubSectionLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  reqFieldRow: { flexDirection: 'row', flexWrap: 'wrap' },
  reqFieldLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B' },
  reqFieldValue: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#0F172A', flexShrink: 1 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  modalGroupLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },

  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addPhotoBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  modalPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  modalPhotoThumb: {
    width: 65,
    height: 65,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPhotoImg: { width: '100%', height: '100%' },
  removePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickerBox: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    marginVertical: 4,
  },
  photoPickerBoxText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  presetChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  presetChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  presetChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  saveBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  saveBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Lightbox
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lightboxTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  lightboxCloseBtn: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  lightboxBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxFooter: { padding: 16, alignItems: 'center' },
  lightboxOpenExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  lightboxOpenExternalText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});
