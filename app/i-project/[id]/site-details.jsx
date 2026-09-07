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

const THEME_PRESETS = [
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
  const [measureForm, setMeasureForm] = useState({
    carpetArea: '',
    ceilingHeight: '',
    rooms: '',
    notes: '',
  });
  const [sitePhotosList, setSitePhotosList] = useState([]);

  const [showReqModal, setShowReqModal] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [reqForm, setReqForm] = useState({
    roomName: 'Living Room',
    theme: 'Contemporary Luxury',
    description: '',
    materials: '',
    lighting: '',
    flooring: '',
  });

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
        setMeasureForm({
          carpetArea: found.siteMeasurements?.carpetArea ? String(found.siteMeasurements.carpetArea) : '',
          ceilingHeight: found.siteMeasurements?.ceilingHeight ? String(found.siteMeasurements.ceilingHeight) : '',
          rooms: found.siteMeasurements?.rooms || '',
          notes: found.siteMeasurements?.notes || '',
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
          rooms: measureForm.rooms.trim(),
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
        theme: reqForm.theme,
        description: reqForm.description.trim(),
        materials: reqForm.materials.trim(),
        lighting: reqForm.lighting.trim(),
        flooring: reqForm.flooring.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedReqs = [...requirements, newReq];
      await interiorApiClient.patch(`/crm/customers/${customer._id}`, {
        requirements: updatedReqs,
      });

      showToast(`Added requirement for ${reqForm.roomName}!`, 'success');
      setShowReqModal(false);
      setReqForm({
        roomName: 'Living Room',
        theme: 'Contemporary Luxury',
        description: '',
        materials: '',
        lighting: '',
        flooring: '',
      });
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

                    {!!siteMeasurements.rooms && (
                      <View style={s.measureDetailRow}>
                        <Text style={s.measureDetailLabel}>Target Configuration:</Text>
                        <Text style={s.measureDetailVal}>{siteMeasurements.rooms}</Text>
                      </View>
                    )}

                    {!!siteMeasurements.notes && (
                      <View style={s.measureNotesBox}>
                        <Text style={s.measureNotesLabel}>Structural & Architectural Notes:</Text>
                        <Text style={s.measureNotesText}>{siteMeasurements.notes}</Text>
                      </View>
                    )}
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
                    {requirements.map((req, idx) => (
                      <View key={idx} style={s.reqCard}>
                        <View style={s.reqTopRow}>
                          <Text style={s.reqRoom}>{req.roomName || 'General Requirement'}</Text>
                          {!!req.theme && (
                            <View style={s.themeBadge}>
                              <Text style={s.themeBadgeText}>{req.theme}</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDeleteRequirement(idx, req.roomName)}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="trash-outline" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>

                        {!!req.description && <Text style={s.reqDesc}>{req.description}</Text>}

                        {/* Finishes & Scope Chips */}
                        <View style={s.reqFinishesWrap}>
                          {!!req.materials && (
                            <View style={s.finishTag}>
                              <Ionicons name="cube-outline" size={11} color="#475569" />
                              <Text style={s.finishTagText}>{req.materials}</Text>
                            </View>
                          )}
                          {!!req.lighting && (
                            <View style={s.finishTag}>
                              <Ionicons name="bulb-outline" size={11} color="#D97706" />
                              <Text style={[s.finishTagText, { color: '#D97706' }]}>{req.lighting}</Text>
                            </View>
                          )}
                          {!!req.flooring && (
                            <View style={s.finishTag}>
                              <Ionicons name="grid-outline" size={11} color="#059669" />
                              <Text style={[s.finishTagText, { color: '#059669' }]}>{req.flooring}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
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

              <Text style={s.label}>Configuration / Target Rooms</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 3BHK + Servant Room + Balcony"
                placeholderTextColor="#94A3B8"
                value={measureForm.rooms}
                onChangeText={(t) => setMeasureForm((f) => ({ ...f, rooms: t }))}
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
                <Text style={s.modalSubtitle}>Architectural styling and finish requirements</Text>
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

              <Text style={s.label}>Design Theme / Aesthetic</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {THEME_PRESETS.map((th) => (
                  <TouchableOpacity
                    key={th}
                    style={[s.presetChip, reqForm.theme === th && s.presetChipActive]}
                    onPress={() => setReqForm((f) => ({ ...f, theme: th }))}
                  >
                    <Text style={[s.presetChipText, reqForm.theme === th && s.presetChipTextActive]}>
                      {th}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Finishes & Materials Specification</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Smoked Oak veneer, Fluted charcoal panels, Brass accents"
                placeholderTextColor="#94A3B8"
                value={reqForm.materials}
                onChangeText={(t) => setReqForm((f) => ({ ...f, materials: t }))}
              />

              <Text style={s.label}>Lighting & Electrical Points</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Warm 3000K magnetic track lights, 2 bed-side 2-way switches"
                placeholderTextColor="#94A3B8"
                value={reqForm.lighting}
                onChangeText={(t) => setReqForm((f) => ({ ...f, lighting: t }))}
              />

              <Text style={s.label}>Flooring / Ceiling Preference</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Herringbone wooden flooring, perimeter cove false ceiling"
                placeholderTextColor="#94A3B8"
                value={reqForm.flooring}
                onChangeText={(t) => setReqForm((f) => ({ ...f, flooring: t }))}
              />

              <Text style={s.label}>Detailed Functional Brief</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Client requires king-size bed backrest with integrated reading lights and 6-door floor-to-ceiling wardrobe with tinted glass."
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
  },
  measureDetailLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  measureDetailVal: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },

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
    gap: 6,
  },
  reqTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  reqRoom: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  themeBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  themeBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase' },
  reqDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#475569', lineHeight: 17 },

  reqFinishesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  finishTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  finishTagText: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#475569' },

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
