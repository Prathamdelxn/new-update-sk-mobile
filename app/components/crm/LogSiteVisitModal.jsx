import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { interiorCrmService } from '../../services/interiorCrmService';

function SectionHeader({ iconName, iconColor, title }) {
  return (
    <View style={s.sectionHeaderRow}>
      <Ionicons name={iconName} size={16} color={iconColor} />
      <Text style={s.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function InputField({ label, value, onChangeText, placeholder, required = false, keyboardType = 'default', multiline = false, icon = null, iconColor = '#7C3AED' }) {
  return (
    <View style={s.inputContainer}>
      <View style={s.labelRow}>
        {icon && <Ionicons name={icon} size={13} color={iconColor} style={{ marginRight: 4 }} />}
        <Text style={s.label}>{label}</Text>
        {required && <Text style={s.requiredAsterisk}> *</Text>}
      </View>
      <TextInput
        style={[s.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const SECTIONS = [
  { id: 'All', label: 'All Sections' },
  { id: 'Dimensions', label: 'Dimensions' },
  { id: 'Openings', label: 'Openings & Structural' },
  { id: 'MEP', label: 'MEP & Services' },
  { id: 'Constraints', label: 'Constraints' },
  { id: 'Photos', label: 'Photos' }
];

export default function LogSiteVisitModal({ 
  visible, 
  onClose, 
  customerId, 
  initialMeasurements, 
  initialPhotos, 
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('All');

  const [measurements, setMeasurements] = useState({
    roomDimensions: '',
    ceilingHeight: '',
    floorToCeilingHeight: '',
    carpetArea: '',
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
    notes: ''
  });

  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (visible) {
      if (initialMeasurements) {
        setMeasurements({
          roomDimensions: initialMeasurements.roomDimensions || '',
          ceilingHeight: initialMeasurements.ceilingHeight ? String(initialMeasurements.ceilingHeight) : '',
          floorToCeilingHeight: initialMeasurements.floorToCeilingHeight ? String(initialMeasurements.floorToCeilingHeight) : '',
          carpetArea: initialMeasurements.carpetArea ? String(initialMeasurements.carpetArea) : '',
          rooms: initialMeasurements.rooms || '',
          doorDimensions: initialMeasurements.doorDimensions || '',
          windowDimensions: initialMeasurements.windowDimensions || '',
          wallThickness: initialMeasurements.wallThickness || '',
          columnBeamDimensions: initialMeasurements.columnBeamDimensions || '',
          electricalPoints: initialMeasurements.electricalPoints || '',
          plumbingPoints: initialMeasurements.plumbingPoints || '',
          acLocations: initialMeasurements.acLocations || '',
          furnitureDimensions: initialMeasurements.furnitureDimensions || '',
          siteConstraints: initialMeasurements.siteConstraints || '',
          notes: initialMeasurements.notes || ''
        });
      } else {
        setMeasurements({
          roomDimensions: '',
          ceilingHeight: '',
          floorToCeilingHeight: '',
          carpetArea: '',
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
          notes: ''
        });
      }
      setPhotos(initialPhotos || []);
      setActiveSection('All');
    }
  }, [visible, initialMeasurements, initialPhotos]);

  const updateField = (field, val) => {
    setMeasurements(prev => ({ ...prev, [field]: val }));
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are required to upload site photos.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
        allowsMultipleSelection: true
      });

      if (!result.canceled && result.assets) {
        const uris = result.assets.map(a => a.uri);
        setPhotos(prev => [...prev, ...uris]);
      }
    } catch (error) {
      console.log('Error picking image', error);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // --- Required field validation ---
    if (!measurements.ceilingHeight || !measurements.ceilingHeight.trim()) {
      Alert.alert('Required Field', 'Please enter the Ceiling Height before saving.');
      return;
    }
    if (!measurements.carpetArea || !measurements.carpetArea.trim()) {
      Alert.alert('Required Field', 'Please enter the Carpet Area before saving.');
      return;
    }
    if (!measurements.rooms || !measurements.rooms.trim()) {
      Alert.alert('Required Field', 'Please enter the Rooms to Design (e.g. 3BHK) before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatePayload = {
        status: 'Measurement Done',
        siteMeasurements: measurements,
        sitePhotos: photos,
      };

      await interiorCrmService.updateCustomer(customerId, updatePayload);

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Site Visit',
        status: 'Completed',
        remarks: 'Recorded spatial dimensions, openings, structural elements, MEP points, and site photos.',
        completedDate: new Date()
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving site measurements:', error);
      Alert.alert('Error', 'Failed to save site visit details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalContent}>
          {/* Header */}
          <View style={s.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
              <View style={s.headerIconBox}>
                <Ionicons name="location-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle} numberOfLines={1}>Log Site Visit & Measurements</Text>
                <Text style={s.modalSub}>Record spatial dimensions, openings, MEP points, and site photos.</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Quick Section Filter Tabs */}
          <View style={s.sectionTabs}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {SECTIONS.map(sec => (
                <TouchableOpacity 
                  key={sec.id} 
                  style={[s.secTab, activeSection === sec.id && s.secTabActive]}
                  onPress={() => setActiveSection(sec.id)}
                >
                  <Text style={[s.secTabText, activeSection === sec.id && s.secTabTextActive]}>
                    {sec.id === 'Photos' ? `Photos (${photos.length})` : sec.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* 1. ROOM & SPATIAL DIMENSIONS */}
            {(activeSection === 'All' || activeSection === 'Dimensions') && (
              <View style={s.sectionCard}>
                <SectionHeader iconName="pencil-outline" iconColor="#7C3AED" title="ROOM & SPATIAL DIMENSIONS" />
                
                <InputField
                  label="Room Length × Width"
                  value={measurements.roomDimensions}
                  onChangeText={(val) => updateField('roomDimensions', val)}
                  placeholder="e.g. Living: 18'x12', Bed: 14'x11'"
                  icon="expand-outline"
                  iconColor="#7C3AED"
                />

                <InputField
                  label="Ceiling Height (Ft)"
                  value={measurements.ceilingHeight}
                  onChangeText={(val) => updateField('ceilingHeight', val)}
                  placeholder="e.g. 10.5"
                  required
                  keyboardType="numeric"
                  icon="layers-outline"
                  iconColor="#7C3AED"
                />

                <InputField
                  label="Floor-to-Ceiling Height"
                  value={measurements.floorToCeilingHeight}
                  onChangeText={(val) => updateField('floorToCeilingHeight', val)}
                  placeholder="e.g. 9.8 ft finish to slab"
                  icon="layers-outline"
                  iconColor="#7C3AED"
                />

                <InputField
                  label="Carpet Area (Sq.Ft)"
                  value={measurements.carpetArea}
                  onChangeText={(val) => updateField('carpetArea', val)}
                  placeholder="e.g. 1200"
                  required
                  keyboardType="numeric"
                  icon="contract-outline"
                  iconColor="#059669"
                />

                <InputField
                  label="Rooms to Design (e.g. 3BHK)"
                  value={measurements.rooms}
                  onChangeText={(val) => updateField('rooms', val)}
                  placeholder="e.g. Living, Foyer, Kitchen, Master Bedroom, Kids Bedroom"
                  required
                  icon="grid-outline"
                  iconColor="#2563EB"
                />
              </View>
            )}

            {/* 2. OPENINGS & STRUCTURAL ELEMENTS */}
            {(activeSection === 'All' || activeSection === 'Openings') && (
              <View style={s.sectionCard}>
                <SectionHeader iconName="construct-outline" iconColor="#4F46E5" title="OPENINGS & STRUCTURAL ELEMENTS" />
                
                <InputField
                  label="Door Dimensions"
                  value={measurements.doorDimensions}
                  onChangeText={(val) => updateField('doorDimensions', val)}
                  placeholder="e.g. Main 4'x7', Bedroom 3'x7'"
                  icon="exit-outline"
                  iconColor="#4F46E5"
                />

                <InputField
                  label="Window Dimensions"
                  value={measurements.windowDimensions}
                  onChangeText={(val) => updateField('windowDimensions', val)}
                  placeholder="e.g. Living 6'x5', Bed 4'x5'"
                  icon="browsers-outline"
                  iconColor="#4F46E5"
                />

                <InputField
                  label="Wall Thickness"
                  value={measurements.wallThickness}
                  onChangeText={(val) => updateField('wallThickness', val)}
                  placeholder="e.g. Outer 9 inch, Inner 4 inch"
                  icon="reorder-two-outline"
                  iconColor="#4F46E5"
                />

                <InputField
                  label="Column & Beam Dimensions"
                  value={measurements.columnBeamDimensions}
                  onChangeText={(val) => updateField('columnBeamDimensions', val)}
                  placeholder="e.g. Beam drop 18 inch in living room, Column 12x12 near dining"
                  multiline
                  icon="cube-outline"
                  iconColor="#4F46E5"
                />
              </View>
            )}

            {/* 3. MEP & SERVICES (ELECTRICAL, PLUMBING, AC) */}
            {(activeSection === 'All' || activeSection === 'MEP') && (
              <View style={s.sectionCard}>
                <SectionHeader iconName="flash-outline" iconColor="#D97706" title="MEP & SERVICES (ELECTRICAL, PLUMBING, AC)" />
                
                <InputField
                  label="Existing Electrical Points"
                  value={measurements.electricalPoints}
                  onChangeText={(val) => updateField('electricalPoints', val)}
                  placeholder="e.g. DB near entrance, 6A/16A points on TV wall, bedside 2-way switches"
                  multiline
                  icon="flash-outline"
                  iconColor="#D97706"
                />

                <InputField
                  label="Plumbing Points"
                  value={measurements.plumbingPoints}
                  onChangeText={(val) => updateField('plumbingPoints', val)}
                  placeholder="e.g. Kitchen sink inlet/drain, RO water point, washbasin trap locations"
                  multiline
                  icon="water-outline"
                  iconColor="#0284C7"
                />

                <InputField
                  label="AC Locations & Piping"
                  value={measurements.acLocations}
                  onChangeText={(val) => updateField('acLocations', val)}
                  placeholder="e.g. Split AC provision on north wall, copper piping route, outdoor unit in utility"
                  multiline
                  icon="snow-outline"
                  iconColor="#0D9488"
                />
              </View>
            )}

            {/* 4. EXISTING FURNITURE & SITE CONSTRAINTS */}
            {(activeSection === 'All' || activeSection === 'Constraints') && (
              <View style={s.sectionCard}>
                <SectionHeader iconName="cube-outline" iconColor="#059669" title="EXISTING FURNITURE & SITE CONSTRAINTS" />
                
                <InputField
                  label="Existing Furniture Dimensions"
                  value={measurements.furnitureDimensions}
                  onChangeText={(val) => updateField('furnitureDimensions', val)}
                  placeholder="e.g. Client retaining king bed 6'x6.5', 6-seater dining table 5'x3'"
                  multiline
                  icon="cube-outline"
                  iconColor="#059669"
                />

                <InputField
                  label="Any Site Constraints"
                  value={measurements.siteConstraints}
                  onChangeText={(val) => updateField('siteConstraints', val)}
                  placeholder="e.g. No heavy drilling allowed after 6 PM, 4th floor staircase only, dampness on east wall"
                  multiline
                  icon="warning-outline"
                  iconColor="#DC2626"
                />

                <InputField
                  label="Additional Site Notes / Observations"
                  value={measurements.notes}
                  onChangeText={(val) => updateField('notes', val)}
                  placeholder="Enter any additional remarks, client preferences observed on site..."
                  multiline
                  icon="document-text-outline"
                  iconColor="#64748B"
                />
              </View>
            )}

            {/* 5. SITE PHOTOS */}
            {(activeSection === 'All' || activeSection === 'Photos') && (
              <View style={s.sectionCard}>
                <SectionHeader iconName="images-outline" iconColor="#059669" title={`SITE PHOTOS (${photos.length})`} />
                
                <TouchableOpacity style={s.addPhotoBtn} onPress={handlePickPhoto}>
                  <Ionicons name="cloud-upload-outline" size={28} color="#2563EB" />
                  <Text style={s.addPhotoTitle}>Click or tap to upload photos</Text>
                  <Text style={s.addPhotoSub}>High resolution images of rooms, walls, electrical boards, windows & site condition</Text>
                </TouchableOpacity>

                {photos.length > 0 ? (
                  <View style={s.photoGrid}>
                    {photos.map((uri, idx) => (
                      <View key={idx} style={s.photoWrapper}>
                        <Image source={{ uri }} style={s.photoImage} />
                        <TouchableOpacity style={s.photoRemoveBtn} onPress={() => removePhoto(idx)}>
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noPhotosText}>No site photos attached yet.</Text>
                )}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save Site Visit Measurements</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2, lineHeight: 15 },
  closeBtn: { padding: 4 },
  sectionTabs: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 },
  secTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  secTabActive: { backgroundColor: '#2563EB' },
  secTabText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  secTabTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },
  modalBody: { flex: 1 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sectionHeaderText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', letterSpacing: 0.3, flex: 1, flexWrap: 'wrap' },
  inputContainer: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', flexShrink: 1 },
  requiredAsterisk: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#EF4444' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC' },
  addPhotoBtn: { alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', gap: 4 },
  addPhotoTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  addPhotoSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', maxWidth: 260 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoWrapper: { width: 75, height: 75, borderRadius: 8, position: 'relative' },
  photoImage: { width: '100%', height: '100%', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  photoRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noPhotosText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', paddingVertical: 10 },
  footer: { flexDirection: 'row', padding: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569' },
  saveBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' }
});
