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

export default function LogSiteVisitModal({ 
  visible, 
  onClose, 
  customerId, 
  initialMeasurements, 
  initialPhotos, 
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('Area');

  const [measurements, setMeasurements] = useState({
    carpetArea: '',
    roomDimensions: '',
    ceilingHeight: '',
    floorToCeilingHeight: '',
    doorDimensions: '',
    windowDimensions: '',
    wallThickness: '',
    columnBeamDimensions: '',
    electricalPoints: '',
    plumbingPoints: '',
    acLocations: '',
    furnitureDimensions: '',
    siteConstraints: '',
    rooms: '',
    notes: ''
  });

  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (visible) {
      if (initialMeasurements) {
        setMeasurements({
          carpetArea: initialMeasurements.carpetArea || '',
          roomDimensions: initialMeasurements.roomDimensions || '',
          ceilingHeight: initialMeasurements.ceilingHeight || '',
          floorToCeilingHeight: initialMeasurements.floorToCeilingHeight || '',
          doorDimensions: initialMeasurements.doorDimensions || '',
          windowDimensions: initialMeasurements.windowDimensions || '',
          wallThickness: initialMeasurements.wallThickness || '',
          columnBeamDimensions: initialMeasurements.columnBeamDimensions || '',
          electricalPoints: initialMeasurements.electricalPoints || '',
          plumbingPoints: initialMeasurements.plumbingPoints || '',
          acLocations: initialMeasurements.acLocations || '',
          furnitureDimensions: initialMeasurements.furnitureDimensions || '',
          siteConstraints: initialMeasurements.siteConstraints || '',
          rooms: initialMeasurements.rooms || '',
          notes: initialMeasurements.notes || ''
        });
      } else {
        // Reset
        setMeasurements(Object.keys(measurements).reduce((acc, key) => { acc[key] = ''; return acc; }, {}));
      }
      setPhotos(initialPhotos || []);
      setActiveSection('Area');
    }
  }, [visible, initialMeasurements, initialPhotos]);

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
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
        remarks: 'Detailed site measurements and photos logged.',
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

  const InputRow = ({ label, field, placeholder, keyboardType = 'default', multiline = false }) => (
    <View style={s.inputContainer}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={measurements[field]}
        onChangeText={(val) => setMeasurements(prev => ({ ...prev, [field]: val }))}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalContent}>
          {/* Header */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Log Site Measurements</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Section Tabs */}
          <View style={s.sectionTabs}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {['Area', 'Heights', 'Utilities', 'Constraints', 'Photos'].map(sec => (
                <TouchableOpacity 
                  key={sec} 
                  style={[s.secTab, activeSection === sec && s.secTabActive]}
                  onPress={() => setActiveSection(sec)}
                >
                  <Text style={[s.secTabText, activeSection === sec && s.secTabTextActive]}>{sec}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Body */}
          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 16 }}>
            {activeSection === 'Area' && (
              <View style={s.sectionCard}>
                <InputRow label="Carpet Area (Sq.Ft)" field="carpetArea" placeholder="e.g. 1200" keyboardType="numeric" />
                <InputRow label="Rooms Summary" field="rooms" placeholder="e.g. 3BHK, 2 Balconies" />
                <InputRow label="Room Dimensions" field="roomDimensions" placeholder="e.g. Master bed 12x14, Living 15x20" multiline />
                <InputRow label="Door Dimensions" field="doorDimensions" placeholder="e.g. Main 4x7, Others 3x7" />
                <InputRow label="Window Dimensions" field="windowDimensions" placeholder="e.g. Living 6x5, Bed 4x5" />
              </View>
            )}

            {activeSection === 'Heights' && (
              <View style={s.sectionCard}>
                <InputRow label="Slab Ceiling Height (Ft)" field="ceilingHeight" placeholder="e.g. 10.5" keyboardType="numeric" />
                <InputRow label="Floor to False Ceiling Height" field="floorToCeilingHeight" placeholder="e.g. 9.5" keyboardType="numeric" />
                <InputRow label="Wall Thickness" field="wallThickness" placeholder="e.g. Outer 9 inch, Inner 4 inch" />
                <InputRow label="Column & Beam Dimensions" field="columnBeamDimensions" placeholder="e.g. Beam drop 18 inch in living room" multiline />
              </View>
            )}

            {activeSection === 'Utilities' && (
              <View style={s.sectionCard}>
                <InputRow label="Electrical Points & Boards" field="electricalPoints" placeholder="e.g. Relocate main DB, Add 15A for AC" multiline />
                <InputRow label="Plumbing Points & Outlets" field="plumbingPoints" placeholder="e.g. RO inlet required, Shift sink trap" multiline />
                <InputRow label="AC Locations & Piping" field="acLocations" placeholder="e.g. Split AC in all rooms, core cutting needed" multiline />
              </View>
            )}

            {activeSection === 'Constraints' && (
              <View style={s.sectionCard}>
                <InputRow label="Existing Furniture Dimensions" field="furnitureDimensions" placeholder="e.g. Client retaining king bed 6x6.5" multiline />
                <InputRow label="Site Constraints / Rules" field="siteConstraints" placeholder="e.g. No drilling allowed 1pm-4pm, Service lift only" multiline />
                <InputRow label="Additional Remarks / Notes" field="notes" placeholder="Enter any extra observations" multiline />
              </View>
            )}

            {activeSection === 'Photos' && (
              <View style={s.sectionCard}>
                <TouchableOpacity style={s.addPhotoBtn} onPress={handlePickPhoto}>
                  <Ionicons name="camera-outline" size={24} color="#4F46E5" />
                  <Text style={s.addPhotoText}>Select Photos</Text>
                </TouchableOpacity>

                {photos.length > 0 ? (
                  <View style={s.photoGrid}>
                    {photos.map((uri, idx) => (
                      <View key={idx} style={s.photoWrapper}>
                        <Image source={{ uri }} style={s.photoImage} />
                        <TouchableOpacity style={s.photoRemoveBtn} onPress={() => removePhoto(idx)}>
                          <Ionicons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noPhotosText}>No photos attached yet.</Text>
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
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save Site Visit</Text>
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
  modalContent: { backgroundColor: '#F8FAFC', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  closeBtn: { padding: 4 },
  sectionTabs: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  secTab: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  secTabActive: { borderBottomColor: '#4F46E5' },
  secTabText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  secTabTextActive: { color: '#4F46E5', fontFamily: 'Inter-Bold' },
  modalBody: { flex: 1 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#EEF2FF', borderRadius: 12, borderWidth: 1, borderColor: '#6366F1', borderStyle: 'dashed', gap: 8, marginBottom: 16 },
  addPhotoText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#4F46E5' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrapper: { width: 80, height: 80, borderRadius: 8, position: 'relative' },
  photoImage: { width: '100%', height: '100%', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  photoRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noPhotosText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#475569' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' }
});
