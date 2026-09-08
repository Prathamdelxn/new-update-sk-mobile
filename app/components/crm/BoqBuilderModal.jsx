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

export default function BoqBuilderModal({ 
  visible, 
  onClose, 
  customerId, 
  existingBoqs = [], 
  editingBoqIndex = null, 
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  const isEditing = editingBoqIndex !== null && editingBoqIndex >= 0 && existingBoqs[editingBoqIndex];

  useEffect(() => {
    if (visible) {
      if (isEditing) {
        const targetBoq = existingBoqs[editingBoqIndex];
        setItems(targetBoq.items?.length > 0 ? [...targetBoq.items] : [createEmptyItem(1)]);
        setNotes(targetBoq.notes || '');
      } else {
        setItems([createEmptyItem(1)]);
        setNotes('');
      }
    }
  }, [visible, editingBoqIndex, existingBoqs]);

  const createEmptyItem = (serialNumber) => ({
    serialNumber,
    category: 'Flooring',
    itemName: '',
    description: '',
    quantity: '1',
    unit: 'sqft',
    rate: '0',
    amount: 0
  });

  const updateItemField = (index, field, value) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index], [field]: value };
      
      // Recalculate amount if qty or rate changes
      if (field === 'quantity' || field === 'rate') {
        const q = parseFloat(item.quantity) || 0;
        const r = parseFloat(item.rate) || 0;
        item.amount = q * r;
      }
      
      newItems[index] = item;
      return newItems;
    });
  };

  const addItemRow = () => {
    setItems(prev => [
      ...prev, 
      {
        ...createEmptyItem(prev.length + 1),
        category: prev[prev.length - 1]?.category || 'Flooring',
        unit: prev[prev.length - 1]?.unit || 'sqft'
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index).map((it, idx) => ({ ...it, serialNumber: idx + 1 })));
  };

  const totalAmount = items.reduce((acc, item) => acc + (item.amount || 0), 0);

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one line item to the BOQ.');
      return;
    }
    if (items.some(i => !i.itemName || !i.itemName.trim())) {
      Alert.alert('Error', 'Please provide an item name for all items.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedBoqs = [...(existingBoqs || [])];
      
      const payloadItems = items.map(i => ({
        ...i,
        quantity: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0,
      }));

      if (isEditing) {
        const currentBoq = updatedBoqs[editingBoqIndex];
        updatedBoqs[editingBoqIndex] = {
          ...currentBoq,
          items: payloadItems,
          totalAmount,
          notes,
          updatedAt: new Date()
        };
      } else {
        const newVersion = (existingBoqs?.length || 0) + 1;
        updatedBoqs.push({
          version: newVersion, // Mongoose expects Number
          items: payloadItems,
          totalAmount: totalAmount * 1.18, // Added tax logic matching mobile ui
          notes,
          status: 'draft',
          createdAt: new Date()
        });
      }

      await interiorCrmService.updateCustomer(customerId, {
        boqs: updatedBoqs,
        status: 'Under BOQ Creation'
      });

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'System Update',
        status: 'Completed',
        remarks: isEditing 
          ? `BOQ Version ${existingBoqs[editingBoqIndex]?.version || (editingBoqIndex + 1)} details updated.`
          : `BOQ Version ${updatedBoqs.length} added.`,
        completedDate: new Date()
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving BOQ:', error);
      Alert.alert('Error', 'Failed to save BOQ. Please try again.');
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
            <Text style={s.modalTitle}>{isEditing ? 'Edit BOQ' : 'Create Estimate BOQ'}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 16 }}>
            {items.map((item, index) => (
              <View key={index} style={s.itemCard}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>Item {item.serialNumber}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItemRow(index)}>
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={s.label}>Category</Text>
                <TextInput
                  style={s.input}
                  value={item.category}
                  onChangeText={(val) => updateItemField(index, 'category', val)}
                  placeholder="e.g. Flooring, Woodwork"
                />

                <Text style={s.label}>Item Name</Text>
                <TextInput
                  style={s.input}
                  value={item.itemName}
                  onChangeText={(val) => updateItemField(index, 'itemName', val)}
                  placeholder="e.g. Marine Plywood 18mm"
                />

                <Text style={s.label}>Description (Optional)</Text>
                <TextInput
                  style={s.input}
                  value={item.description}
                  onChangeText={(val) => updateItemField(index, 'description', val)}
                  placeholder="Detailed specifications"
                  multiline
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Qty</Text>
                    <TextInput
                      style={s.input}
                      value={String(item.quantity)}
                      onChangeText={(val) => updateItemField(index, 'quantity', val)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Unit</Text>
                    <TextInput
                      style={s.input}
                      value={item.unit}
                      onChangeText={(val) => updateItemField(index, 'unit', val)}
                      placeholder="sqft"
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.label}>Rate (₹)</Text>
                    <TextInput
                      style={s.input}
                      value={String(item.rate)}
                      onChangeText={(val) => updateItemField(index, 'rate', val)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>

                <View style={s.itemTotalRow}>
                  <Text style={s.itemTotalLabel}>Line Total:</Text>
                  <Text style={s.itemTotalValue}>₹{(item.amount || 0).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={s.addBtn} onPress={addItemRow}>
              <Ionicons name="add-circle-outline" size={20} color="#059669" />
              <Text style={s.addBtnText}>Add Row</Text>
            </TouchableOpacity>

            <View style={s.grandTotalBox}>
              <Text style={s.grandTotalLabel}>Subtotal</Text>
              <Text style={s.grandTotalValue}>₹{totalAmount.toLocaleString('en-IN')}</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                +18% GST will be added automatically
              </Text>
            </View>

            <Text style={[s.label, { marginTop: 16 }]}>Notes / Terms (Optional)</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any specific terms for this BOQ"
              multiline
            />
            
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
                <Text style={s.saveBtnText}>Save BOQ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#334155',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  itemTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemTotalLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  itemTotalValue: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  addBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  grandTotalBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  grandTotalValue: {
    fontSize: 24,
    fontFamily: 'Inter-Black',
    color: '#059669',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#475569',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  }
});
