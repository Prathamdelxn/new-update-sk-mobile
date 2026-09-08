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
  
  // To track which tab is active per room: 'functional' | 'aesthetic'
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
      newTabs[i] = 'functional'; // Reset tabs on delete to avoid shifting issues
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

        roomUsage: (r.roomUsage || '').trim(),
        furnitureRequirements: (r.furnitureRequirements || '').trim(),
        storage: (r.storage || '').trim(),
        electricalPoints: (r.electricalPoints || '').trim(),
        lightingRequirements: (r.lightingRequirements || '').trim(),
        plumbingRequirements: (r.plumbingRequirements || '').trim(),
        circulation: (r.circulation || '').trim(),

        designStyle: (r.designStyle || '').trim(),
        colours: (r.colours || '').trim(),
        materials: (r.materials || '').trim(),
        flooring: (r.flooring || '').trim(),
        ceiling: (r.ceiling || '').trim(),
        wallFinishes: (r.wallFinishes || '').trim(),
        furnitureStyle: (r.furnitureStyle || '').trim()
      }));

      const updatePayload = {
        status: 'Under Requirement',
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
            <Text style={s.modalTitle}>Detailed Requirements</Text>
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
                    placeholder="e.g. Master Bedroom, Kitchen"
                  />
                </View>

                {/* Sub Tabs for Functional vs Aesthetic */}
                <View style={s.subTabs}>
                  <TouchableOpacity
                    style={[s.subTab, activeSubTabs[idx] === 'functional' && s.subTabActive]}
                    onPress={() => setActiveSubTabs({ ...activeSubTabs, [idx]: 'functional' })}
                  >
                    <Text style={[s.subTabText, activeSubTabs[idx] === 'functional' && s.subTabTextActive]}>Functional</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.subTab, activeSubTabs[idx] === 'aesthetic' && s.subTabActive]}
                    onPress={() => setActiveSubTabs({ ...activeSubTabs, [idx]: 'aesthetic' })}
                  >
                    <Text style={[s.subTabText, activeSubTabs[idx] === 'aesthetic' && s.subTabTextActive]}>Aesthetic</Text>
                  </TouchableOpacity>
                </View>

                {activeSubTabs[idx] === 'functional' ? (
                  <View style={s.tabContent}>
                    <Text style={s.label}>Room Usage</Text>
                    <TextInput style={s.input} value={room.roomUsage} onChangeText={v => updateRoom(idx, 'roomUsage', v)} placeholder="e.g. Used for sleeping and WFH" />
                    
                    <Text style={s.label}>Furniture Requirements</Text>
                    <TextInput style={[s.input, { height: 60 }]} multiline value={room.furnitureRequirements} onChangeText={v => updateRoom(idx, 'furnitureRequirements', v)} placeholder="e.g. King bed with hydraulic storage, study desk" />
                    
                    <Text style={s.label}>Storage</Text>
                    <TextInput style={s.input} value={room.storage} onChangeText={v => updateRoom(idx, 'storage', v)} placeholder="e.g. Full height wardrobe, lofts" />
                    
                    <Text style={s.label}>Electrical & Lighting</Text>
                    <TextInput style={[s.input, { height: 60 }]} multiline value={room.electricalPoints} onChangeText={v => updateRoom(idx, 'electricalPoints', v)} placeholder="e.g. Reading lights, 2-way switches, profile LEDs" />
                  </View>
                ) : (
                  <View style={s.tabContent}>
                    <Text style={s.label}>Design Style / Theme</Text>
                    <TextInput style={s.input} value={room.designStyle} onChangeText={v => updateRoom(idx, 'designStyle', v)} placeholder="e.g. Minimalist, Japandi" />
                    
                    <Text style={s.label}>Color Palette</Text>
                    <TextInput style={s.input} value={room.colours} onChangeText={v => updateRoom(idx, 'colours', v)} placeholder="e.g. Warm neutrals, Sage green" />
                    
                    <Text style={s.label}>Materials & Finishes</Text>
                    <TextInput style={s.input} value={room.materials} onChangeText={v => updateRoom(idx, 'materials', v)} placeholder="e.g. Matte PU, Oak Veneer" />
                    
                    <Text style={s.label}>Ceiling & Flooring Preferences</Text>
                    <TextInput style={[s.input, { height: 60 }]} multiline value={room.ceiling} onChangeText={v => updateRoom(idx, 'ceiling', v)} placeholder="e.g. Simple cove ceiling, wooden laminate flooring" />
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
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  closeBtn: { padding: 4 },
  modalBody: { flex: 1 },
  overallBox: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 12 },
  roomCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 },
  roomTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  roomActions: { flexDirection: 'row', alignItems: 'center' },
  subTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  subTabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  subTabText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  subTabTextActive: { color: '#0F172A', fontFamily: 'Inter-Bold' },
  tabContent: { paddingTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#EEF2FF', borderRadius: 12, borderWidth: 1, borderColor: '#6366F1', borderStyle: 'dashed', gap: 8 },
  addBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#4F46E5' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#475569' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' }
});
