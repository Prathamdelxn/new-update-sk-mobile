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
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';

const INTERIOR_TYPES = ['Residential', 'Commercial', 'Office', 'Restaurant', 'Retail', 'Other'];

const POPULAR_STYLES = [
  'Modern Minimalist',
  'Contemporary',
  'Scandinavian',
  'Japandi',
  'Industrial Luxury',
  'Classic / Traditional',
  'Bohemian Chic',
  'Warm Neutral',
];

export default function LogRequirementsModal({ 
  visible, 
  onClose, 
  customerId, 
  initialBudgetRange,
  initialRequirements = [],
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [budgetRange, setBudgetRange] = useState('');
  const [requirements, setRequirements] = useState([]);
  
  // To track which tab is active per room: 'functional' | 'aesthetic' | 'notes'
  const [activeSubTabs, setActiveSubTabs] = useState({});

  useEffect(() => {
    if (visible) {
      setBudgetRange(initialBudgetRange || '');
      if (initialRequirements && initialRequirements.length > 0) {
        setRequirements(initialRequirements);
        const tabs = {};
        initialRequirements.forEach((_, i) => tabs[i] = 'functional');
        setActiveSubTabs(tabs);
      } else {
        setRequirements([createEmptyRoom()]);
        setActiveSubTabs({ 0: 'functional' });
      }
    }
  }, [visible, initialRequirements, initialBudgetRange]);

  const createEmptyRoom = () => ({
    roomName: '',
    interiorType: 'Residential',
    theme: '',
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
    designStyle: '',
    colours: '',
    materials: '',
    flooring: '',
    ceiling: '',
    wallFinishes: '',
    furnitureStyle: ''
  });

  const addRoom = () => {
    const newIdx = requirements.length;
    setRequirements([...requirements, createEmptyRoom()]);
    setActiveSubTabs({ ...activeSubTabs, [newIdx]: 'functional' });
  };

  const duplicateRoom = (index) => {
    const newIdx = requirements.length;
    const cloned = { ...requirements[index], roomName: `${requirements[index].roomName} (Copy)` };
    setRequirements([...requirements, cloned]);
    setActiveSubTabs({ ...activeSubTabs, [newIdx]: 'functional' });
  };

  const removeRoom = (index) => {
    if (requirements.length === 1) {
      Alert.alert('Error', 'You need at least one room requirement.');
      return;
    }
    setRequirements(requirements.filter((_, i) => i !== index));
    const newTabs = {};
    requirements.filter((_, i) => i !== index).forEach((_, i) => {
      newTabs[i] = 'functional';
    });
    setActiveSubTabs(newTabs);
  };

  const updateRoom = (index, field, value) => {
    const copy = [...requirements];
    copy[index][field] = value;
    setRequirements(copy);
  };

  const handleSubmit = async () => {
    if (requirements.length === 0) {
      Alert.alert('Error', 'Please add at least one room requirement.');
      return;
    }
    if (requirements.some(r => !r.roomName || !r.roomName.trim())) {
      Alert.alert('Error', 'Please specify a name for each room/space.');
      return;
    }

    setIsSubmitting(true);
    try {
      const sanitizedRequirements = requirements.map((r) => ({
        roomName: (r.roomName || '').trim(),
        interiorType: (r.interiorType || 'Residential').trim(),
        theme: (r.designStyle || r.theme || '').trim(),
        description: (r.description || '').trim(),

        // Functional
        roomUsage: (r.roomUsage || '').trim(),
        furnitureRequirements: (r.furnitureRequirements || '').trim(),
        storage: (r.storage || '').trim(),
        electricalPoints: (r.electricalPoints || '').trim(),
        lightingRequirements: (r.lightingRequirements || '').trim(),
        plumbingRequirements: (r.plumbingRequirements || '').trim(),
        circulation: (r.circulation || '').trim(),

        // Aesthetic
        designStyle: (r.designStyle || '').trim(),
        colours: (r.colours || '').trim(),
        materials: (r.materials || '').trim(),
        flooring: (r.flooring || '').trim(),
        ceiling: (r.ceiling || '').trim(),
        wallFinishes: (r.wallFinishes || '').trim(),
        furnitureStyle: (r.furnitureStyle || '').trim()
      }));

      const updatePayload = {
        status: 'Requirement Completed',
        budgetRange: budgetRange.trim(),
        requirements: sanitizedRequirements
      };

      await interiorCrmService.updateCustomer(customerId, updatePayload);

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Requirement Gathering',
        status: 'Completed',
        remarks: `Logged detailed functional & aesthetic requirements for ${sanitizedRequirements.length} rooms.`,
        completedDate: new Date()
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving requirements:', error);
      Alert.alert('Error', 'Failed to save requirements. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>Detailed Requirements</Text>
              <Text style={s.modalSubtitle}>Functional, Aesthetic & Observations</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 16 }}>
            <View style={s.overallBox}>
              <Text style={s.label}>Overall Budget Range (₹)</Text>
              <TextInput
                style={s.input}
                value={budgetRange}
                onChangeText={setBudgetRange}
                placeholder="e.g. 15L - 20L"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {requirements.map((room, idx) => (
              <View key={idx} style={s.roomCard}>
                <View style={s.roomHeader}>
                  <Text style={s.roomTitle}>Room {idx + 1}</Text>
                  <View style={s.roomActions}>
                    <TouchableOpacity onPress={() => duplicateRoom(idx)} style={{ marginRight: 12 }}>
                      <Ionicons name="copy-outline" size={18} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeRoom(idx)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={s.label}>Room Name *</Text>
                  <TextInput
                    style={s.input}
                    value={room.roomName}
                    onChangeText={(v) => updateRoom(idx, 'roomName', v)}
                    placeholder="e.g. Master Bedroom, Living Room, Kitchen"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Type of Interior Selector */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.label}>Type of Interior</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                    {INTERIOR_TYPES.map((type) => {
                      const isSel = (room.interiorType || 'Residential') === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[s.typeChip, isSel && s.typeChipActive]}
                          onPress={() => updateRoom(idx, 'interiorType', type)}
                        >
                          <Text style={[s.typeChipText, isSel && s.typeChipTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Sub Tabs for Functional vs Aesthetic vs Notes */}
                <View style={s.subTabs}>
                  <TouchableOpacity
                    style={[s.subTab, (activeSubTabs[idx] || 'functional') === 'functional' && s.subTabActive]}
                    onPress={() => setActiveSubTabs({ ...activeSubTabs, [idx]: 'functional' })}
                  >
                    <Ionicons name="options-outline" size={13} color={(activeSubTabs[idx] || 'functional') === 'functional' ? '#2563EB' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[s.subTabText, (activeSubTabs[idx] || 'functional') === 'functional' && s.subTabTextActive]}>Functional</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.subTab, activeSubTabs[idx] === 'aesthetic' && s.subTabActive]}
                    onPress={() => setActiveSubTabs({ ...activeSubTabs, [idx]: 'aesthetic' })}
                  >
                    <Ionicons name="color-palette-outline" size={13} color={activeSubTabs[idx] === 'aesthetic' ? '#2563EB' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[s.subTabText, activeSubTabs[idx] === 'aesthetic' && s.subTabTextActive]}>Aesthetic</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.subTab, activeSubTabs[idx] === 'notes' && s.subTabActive]}
                    onPress={() => setActiveSubTabs({ ...activeSubTabs, [idx]: 'notes' })}
                  >
                    <Ionicons name="document-text-outline" size={13} color={activeSubTabs[idx] === 'notes' ? '#2563EB' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[s.subTabText, activeSubTabs[idx] === 'notes' && s.subTabTextActive]}>Notes</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. Functional Tab */}
                {(activeSubTabs[idx] || 'functional') === 'functional' && (
                  <View style={s.tabContent}>
                    <Text style={s.label}>Room Usage & Primary Purpose</Text>
                    <TextInput
                      style={s.input}
                      value={room.roomUsage}
                      onChangeText={v => updateRoom(idx, 'roomUsage', v)}
                      placeholder="e.g. Master sleeping & dressing, Formal entertaining"
                      placeholderTextColor="#94A3B8"
                    />
                    
                    <Text style={s.label}>Furniture Requirements</Text>
                    <TextInput
                      style={[s.input, { height: 60 }]}
                      multiline
                      value={room.furnitureRequirements}
                      onChangeText={v => updateRoom(idx, 'furnitureRequirements', v)}
                      placeholder="e.g. King bed with hydraulic storage, 6-seater dining table, study desk"
                      placeholderTextColor="#94A3B8"
                    />
                    
                    <Text style={s.label}>Storage</Text>
                    <TextInput
                      style={s.input}
                      value={room.storage}
                      onChangeText={v => updateRoom(idx, 'storage', v)}
                      placeholder="e.g. Full-height wardrobe with loft, shoe rack, dresser"
                      placeholderTextColor="#94A3B8"
                    />
                    
                    <Text style={s.label}>Electrical Points & Automation</Text>
                    <TextInput
                      style={s.input}
                      value={room.electricalPoints}
                      onChangeText={v => updateRoom(idx, 'electricalPoints', v)}
                      placeholder="e.g. 2-way bedside switches, TV console points, EV/invertor"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={s.label}>Lighting Requirements</Text>
                    <TextInput
                      style={s.input}
                      value={room.lightingRequirements}
                      onChangeText={v => updateRoom(idx, 'lightingRequirements', v)}
                      placeholder="e.g. Profile lights, cove LED strip, pendant lights"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={s.label}>Plumbing Requirements</Text>
                    <TextInput
                      style={s.input}
                      value={room.plumbingRequirements}
                      onChangeText={v => updateRoom(idx, 'plumbingRequirements', v)}
                      placeholder="e.g. Basin mixer, geyser provision, RO point"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={s.label}>Circulation & Space Clearance</Text>
                    <TextInput
                      style={s.input}
                      value={room.circulation}
                      onChangeText={v => updateRoom(idx, 'circulation', v)}
                      placeholder="e.g. 3ft walkway around bed, wheelchair accessibility"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}

                {/* 2. Aesthetic Tab */}
                {activeSubTabs[idx] === 'aesthetic' && (
                  <View style={s.tabContent}>
                    <Text style={s.label}>Quick Style Presets</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                      {POPULAR_STYLES.map((style) => (
                        <TouchableOpacity
                          key={style}
                          style={[s.typeChip, room.designStyle === style && s.typeChipActive]}
                          onPress={() => updateRoom(idx, 'designStyle', style)}
                        >
                          <Text style={[s.typeChipText, room.designStyle === style && s.typeChipTextActive]}>{style}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={s.label}>Design Style / Theme</Text>
                    <TextInput
                      style={s.input}
                      value={room.designStyle}
                      onChangeText={v => updateRoom(idx, 'designStyle', v)}
                      placeholder="e.g. Modern Minimalist, Japandi, Industrial"
                      placeholderTextColor="#94A3B8"
                    />
                    
                    <Text style={s.label}>Colors & Palette</Text>
                    <TextInput
                      style={s.input}
                      value={room.colours}
                      onChangeText={v => updateRoom(idx, 'colours', v)}
                      placeholder="e.g. Warm beige, Olive green accent, Charcoal grey"
                      placeholderTextColor="#94A3B8"
                    />
                    
                    <Text style={s.label}>Materials & Finishes</Text>
                    <TextInput
                      style={s.input}
                      value={room.materials}
                      onChangeText={v => updateRoom(idx, 'materials', v)}
                      placeholder="e.g. Teak veneer, Fluted glass, Brushed brass, Matte PU"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={s.label}>Flooring Preferences</Text>
                    <TextInput
                      style={s.input}
                      value={room.flooring}
                      onChangeText={v => updateRoom(idx, 'flooring', v)}
                      placeholder="e.g. 4x2 Vitrified matte tiles, Hardwood laminate"
                      placeholderTextColor="#94A3B8"
                    />
                    
                    <Text style={s.label}>Ceiling & False Ceiling</Text>
                    <TextInput
                      style={s.input}
                      value={room.ceiling}
                      onChangeText={v => updateRoom(idx, 'ceiling', v)}
                      placeholder="e.g. Gypsum ceiling with shadow gap, wooden rafters"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={s.label}>Wall Finishes</Text>
                    <TextInput
                      style={s.input}
                      value={room.wallFinishes}
                      onChangeText={v => updateRoom(idx, 'wallFinishes', v)}
                      placeholder="e.g. Limewash texture, Charcoal louvers, Wallpaper accent"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={s.label}>Furniture Style</Text>
                    <TextInput
                      style={s.input}
                      value={room.furnitureStyle}
                      onChangeText={v => updateRoom(idx, 'furnitureStyle', v)}
                      placeholder="e.g. Low-profile modular frame, Curved Scandinavian"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}

                {/* 3. Observations & Notes Tab */}
                {activeSubTabs[idx] === 'notes' && (
                  <View style={s.tabContent}>
                    <Text style={s.label}>Observations & Notes</Text>
                    <Text style={s.helpText}>Custom requests, specific client instructions, or existing site constraints</Text>
                    <TextInput
                      style={[s.input, { height: 120, textAlignVertical: 'top' }]}
                      multiline
                      value={room.description}
                      onChangeText={v => updateRoom(idx, 'description', v)}
                      placeholder="Enter custom requests, specific dimensions, appliances to fit, client observations..."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={s.addBtn} onPress={addRoom}>
              <Ionicons name="add-circle-outline" size={20} color="#4F46E5" />
              <Text style={s.addBtnText}>Add Another Room</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save Requirements</Text>}
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
  modalTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  closeBtn: { padding: 4 },
  modalBody: { flex: 1 },
  overallBox: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 6 },
  helpText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 12 },
  roomCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  roomTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  roomActions: { flexDirection: 'row', alignItems: 'center' },
  typeChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  typeChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  typeChipText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  typeChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  subTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, marginBottom: 14 },
  subTab: { flex: 1, flexDirection: 'row', paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  subTabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  subTabText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  subTabTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  tabContent: { paddingTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#EEF2FF', borderRadius: 12, borderWidth: 1, borderColor: '#6366F1', borderStyle: 'dashed', gap: 8 },
  addBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#4F46E5' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' }
});
