import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { interiorCrmService } from '../../services/interiorCrmService';
import cloudinaryService from '../../services/cloudinaryService';
import { parseMaxBudget, formatExactCurrency } from '../../utils/format';
import BoqDrawingViewerModal from './BoqDrawingViewerModal';

const STANDARD_UOMS = [
  { value: 'sqft', label: 'Sq Ft' },
  { value: 'SQ M', label: 'Sq M' },
  { value: 'rft', label: 'Rft' },
  { value: 'Rn M', label: 'Rn M' },
  { value: 'nos', label: 'Nos' },
  { value: 'lumpsum', label: 'LS' },
  { value: 'trip', label: 'Trip' },
  { value: 'cum', label: 'CUM' },
];

export default function BoqBuilderModal({
  visible,
  isOpen,
  onClose,
  customerId,
  customerName = 'Client',
  existingBoqs = [],
  drawings = [],
  editingBoqIndex = null,
  isReadOnly = false,
  budgetRange,
  onSuccess,
}) {
  const isModalOpen = Boolean(visible ?? isOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  // Drawing attachment picker & viewer
  const [activeDrawingPickerSecId, setActiveDrawingPickerSecId] = useState(null);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [uploadingDrawing, setUploadingDrawing] = useState(false);

  const isEditing = editingBoqIndex !== null && editingBoqIndex >= 0 && existingBoqs[editingBoqIndex];
  const targetBoq = isEditing ? existingBoqs[editingBoqIndex] : null;

  // Initialize data on open
  useEffect(() => {
    if (!isModalOpen) return;

    if (isEditing && targetBoq) {
      setNotes(targetBoq.notes || '');

      // Parse sections
      const rawSections =
        targetBoq.sections && Array.isArray(targetBoq.sections) && targetBoq.sections.length > 0
          ? targetBoq.sections.map((s, idx) => ({
              id: s.id || s.sectionId || `sec-${idx + 1}`,
              sectionNumber: String(s.sectionNumber || idx + 1),
              sectionTitle: s.sectionTitle || s.name || `Section ${idx + 1}`,
              scopeDescription: s.scopeDescription || s.description || '',
              attachments: s.attachments ? [...s.attachments] : [],
              isCollapsed: false,
            }))
          : [];

      // Parse items
      let rawItems = (targetBoq.items || []).map((it, idx) => ({
        id: it.id || it._id || `item-${Date.now()}-${idx}`,
        sectionId: it.sectionId || (rawSections[0]?.id || 'sec-1'),
        serialNumber: it.serialNumber || idx + 1,
        category: it.category || 'Interior Work',
        itemName: it.itemName || it.name || '',
        description: it.description || '',
        brand: it.brand || it.make || '',
        quantity: String(it.quantity ?? 1),
        unit: it.unit || 'sqft',
        rate: String(it.rate ?? 0),
        amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0),
        drawingAttachment: it.drawingAttachment || null,
      }));

      // If no sections existed, generate default sections by category or fallback to one
      if (rawSections.length === 0) {
        if (rawItems.length > 0) {
          const distinctCategories = Array.from(new Set(rawItems.map((i) => i.category || 'General Works')));
          const generatedSecs = distinctCategories.map((cat, idx) => ({
            id: `sec-${idx + 1}`,
            sectionNumber: String(idx + 1),
            sectionTitle: cat,
            scopeDescription: '',
            attachments: [],
            isCollapsed: false,
          }));

          rawItems = rawItems.map((it) => {
            const matchedSec = generatedSecs.find((s) => s.sectionTitle === (it.category || 'General Works'));
            return { ...it, sectionId: matchedSec ? matchedSec.id : generatedSecs[0].id };
          });

          setSections(generatedSecs);
        } else {
          setSections([
            {
              id: 'sec-1',
              sectionNumber: '1',
              sectionTitle: 'Main Scope',
              scopeDescription: '',
              attachments: [],
              isCollapsed: false,
            },
          ]);
        }
      } else {
        setSections(rawSections);
      }

      setItems(rawItems.length > 0 ? rawItems : [createEmptyItem(rawSections[0]?.id || 'sec-1', 1)]);
    } else {
      // New BOQ Version
      const initialSecId = 'sec-1';
      setSections([
        {
          id: initialSecId,
          sectionNumber: '1',
          sectionTitle: 'Living & Dining',
          scopeDescription: '',
          attachments: [],
          isCollapsed: false,
        },
      ]);
      setItems([createEmptyItem(initialSecId, 1)]);
      setNotes('');
    }
  }, [visible, editingBoqIndex, existingBoqs]);

  const createEmptyItem = (sectionId, serialNumber) => ({
    id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sectionId,
    serialNumber,
    category: 'Woodwork',
    itemName: '',
    description: '',
    brand: '',
    quantity: '1',
    unit: 'sqft',
    rate: '0',
    amount: 0,
    drawingAttachment: null,
  });

  // Section handlers
  const handleAddSection = () => {
    const nextIdx = sections.length + 1;
    const newSecId = `sec-${Date.now()}`;
    const newSec = {
      id: newSecId,
      sectionNumber: String(nextIdx),
      sectionTitle: `Section ${nextIdx}`,
      scopeDescription: '',
      attachments: [],
      isCollapsed: false,
    };
    setSections((prev) => [...prev, newSec]);
    setItems((prev) => [...prev, createEmptyItem(newSecId, 1)]);
  };

  const handleUpdateSection = (secId, field, value) => {
    setSections((prev) => prev.map((s) => (s.id === secId ? { ...s, [field]: value } : s)));
  };

  const handleToggleSectionCollapse = (secId) => {
    setSections((prev) => prev.map((s) => (s.id === secId ? { ...s, isCollapsed: !s.isCollapsed } : s)));
  };

  const handleRemoveSection = (secId) => {
    if (sections.length <= 1) {
      Alert.alert('Notice', 'A BOQ must have at least one section.');
      return;
    }
    Alert.alert('Remove Section', 'Are you sure you want to remove this section and all its line items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSections((prev) => prev.filter((s) => s.id !== secId));
          setItems((prev) => prev.filter((it) => it.sectionId !== secId));
        },
      },
    ]);
  };

  // Item handlers
  const handleAddItemToSection = (secId) => {
    const itemsInSec = items.filter((it) => it.sectionId === secId);
    setItems((prev) => [...prev, createEmptyItem(secId, itemsInSec.length + 1)]);
  };

  const handleUpdateItemField = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          const q = parseFloat(updated.quantity) || 0;
          const r = parseFloat(updated.rate) || 0;
          updated.amount = q * r;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (itemId) => {
    if (items.length <= 1) {
      Alert.alert('Notice', 'BOQ must contain at least one item.');
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Drawing attachment to section
  const handleAttachProjectDrawing = (secId, drawing) => {
    const newAtt = {
      id: drawing._id || drawing.id || `att-${Date.now()}`,
      name: drawing.title || drawing.name || 'Drawing',
      url: drawing.fileUrl || drawing.url,
      category: drawing.category || 'Architectural',
      drawingId: drawing._id || drawing.id,
    };
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, attachments: [...(s.attachments || []), newAtt] } : s))
    );
    setActiveDrawingPickerSecId(null);
  };

  const handleUploadNewDrawing = async (secId) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera roll access is required to upload blueprint images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadingDrawing(true);
        const file = result.assets[0];
        const uploadedUrl = await cloudinaryService.uploadFile(file.uri, `drawing_${Date.now()}.jpg`, 'image/jpeg');

        const newAtt = {
          id: `att-${Date.now()}`,
          name: file.fileName || `Drawing ${new Date().toLocaleDateString('en-IN')}`,
          url: uploadedUrl,
          category: 'Attached Spec',
        };

        setSections((prev) =>
          prev.map((s) => (s.id === secId ? { ...s, attachments: [...(s.attachments || []), newAtt] } : s))
        );
        setActiveDrawingPickerSecId(null);
      }
    } catch (err) {
      console.warn('Upload error:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload image.');
    } finally {
      setUploadingDrawing(false);
    }
  };

  const handleRemoveAttachment = (secId, attId) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, attachments: (s.attachments || []).filter((a) => a.id !== attId) } : s))
    );
  };

  // Calculations
  const totalAmount = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.amount || 0), 0);
  }, [items]);

  const maxBudget = parseMaxBudget(budgetRange);
  const isOverBudget = Boolean(maxBudget && maxBudget > 0 && totalAmount > maxBudget);
  const budgetExcess = isOverBudget ? totalAmount - (maxBudget || 0) : 0;
  const budgetExcessPct = isOverBudget && maxBudget ? ((totalAmount - maxBudget) / maxBudget) * 100 : 0;

  // Save BOQ
  const handleSubmit = async () => {
    if (isReadOnly) {
      Alert.alert('Locked', 'BOQ cannot be edited because quotation is already approved.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one line item.');
      return;
    }
    if (items.some((i) => !i.itemName || !i.itemName.trim())) {
      Alert.alert('Error', 'Please provide an item title for all line items.');
      return;
    }
    if (items.some((i) => !i.quantity || parseFloat(i.quantity) <= 0)) {
      Alert.alert('Error', 'Quantity must be greater than 0 for all items.');
      return;
    }
    if (items.some((i) => i.rate === undefined || i.rate === null || parseFloat(i.rate) <= 0)) {
      Alert.alert('Error', 'Unit rate must be greater than ₹0 for all items.');
      return;
    }
    if (totalAmount <= 0) {
      Alert.alert('Error', 'Total BOQ amount must be greater than ₹0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedBoqs = [...(existingBoqs || [])];

      // Format items with sectionTitle mapping for flat consumers
      const payloadItems = items.map((it, idx) => {
        const parentSec = sections.find((s) => s.id === it.sectionId);
        return {
          ...it,
          serialNumber: idx + 1,
          sectionTitle: parentSec?.sectionTitle || it.category || 'General Scope',
          category: parentSec?.sectionTitle || it.category || 'General Scope',
          quantity: parseFloat(it.quantity) || 0,
          rate: parseFloat(it.rate) || 0,
          amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0),
        };
      });

      const payloadSections = sections.map((s, idx) => ({
        id: s.id,
        sectionNumber: String(idx + 1),
        sectionTitle: s.sectionTitle.trim() || `Section ${idx + 1}`,
        scopeDescription: s.scopeDescription?.trim() || '',
        attachments: s.attachments || [],
      }));

      if (isEditing) {
        const currentBoq = updatedBoqs[editingBoqIndex];
        updatedBoqs[editingBoqIndex] = {
          ...currentBoq,
          sections: payloadSections,
          items: payloadItems,
          totalAmount,
          notes: notes.trim(),
          updatedAt: new Date(),
        };
      } else {
        const newVersion = (existingBoqs?.length || 0) + 1;
        updatedBoqs.push({
          version: newVersion,
          sections: payloadSections,
          items: payloadItems,
          totalAmount,
          notes: notes.trim(),
          status: 'draft',
          createdAt: new Date(),
        });
      }

      await interiorCrmService.updateCustomer(customerId, {
        boqs: updatedBoqs,
        status: 'Under BOQ Creation',
      });

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'System Update',
        status: 'Completed',
        remarks: isEditing
          ? `BOQ Version ${existingBoqs[editingBoqIndex]?.version || editingBoqIndex + 1} updated.`
          : `BOQ Version ${updatedBoqs.length} created with ${payloadSections.length} sections.`,
        completedDate: new Date(),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving BOQ:', error);
      Alert.alert('Error', error.message || 'Failed to save BOQ. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isModalOpen} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalContent}>
          {/* Header */}
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={s.modalTitle}>
                  {isReadOnly
                    ? `View BOQ (v${targetBoq?.version || editingBoqIndex + 1})`
                    : isEditing
                    ? `Edit BOQ (v${targetBoq?.version || editingBoqIndex + 1})`
                    : `New BOQ Version (v${existingBoqs.length + 1})`}
                </Text>
                {isReadOnly && (
                  <View style={s.lockedBadge}>
                    <Ionicons name="lock-closed" size={11} color="#059669" />
                    <Text style={s.lockedBadgeText}>Locked</Text>
                  </View>
                )}
              </View>
              <Text style={s.modalSub}>
                Hierarchical sections, technical specs, brand/makes & drawing links
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 14, gap: 14 }} showsVerticalScrollIndicator={false}>
            {/* Sections Accordion */}
            {sections.map((section, secIdx) => {
              const secItems = items.filter((it) => it.sectionId === section.id);
              const secTotal = secItems.reduce((acc, it) => acc + (it.amount || 0), 0);

              return (
                <View key={section.id} style={s.sectionCard}>
                  {/* Section Title & Collapse Header */}
                  <View style={s.sectionHeader}>
                    <TouchableOpacity
                      style={s.sectionHeaderTitleRow}
                      onPress={() => handleToggleSectionCollapse(section.id)}
                    >
                      <Ionicons
                        name={section.isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={18}
                        color="#2563EB"
                      />
                      <View style={{ flex: 1, marginRight: 8 }}>
                        {isReadOnly ? (
                          <Text style={s.sectionHeaderTitleText}>{section.sectionTitle || `Section ${secIdx + 1}`}</Text>
                        ) : (
                          <TextInput
                            style={s.sectionTitleInput}
                            value={section.sectionTitle}
                            onChangeText={(val) => handleUpdateSection(section.id, 'sectionTitle', val)}
                            placeholder={`Section ${secIdx + 1} Name (e.g. Living Room)`}
                            placeholderTextColor="#94A3B8"
                          />
                        )}
                        <Text style={s.sectionItemCountText}>
                          {secItems.length} items • Section Total: {formatExactCurrency(secTotal)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {!isReadOnly && sections.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemoveSection(section.id)} style={s.sectionDeleteBtn}>
                        <Ionicons name="trash-outline" size={17} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {!section.isCollapsed && (
                    <View style={s.sectionBody}>
                      {/* Section Scope Description */}
                      <TextInput
                        style={[s.scopeDescInput, isReadOnly && s.inputDisabled]}
                        value={section.scopeDescription}
                        onChangeText={(val) => handleUpdateSection(section.id, 'scopeDescription', val)}
                        placeholder="Scope description / technical specs for this zone (Optional)"
                        placeholderTextColor="#94A3B8"
                        multiline
                        editable={!isReadOnly}
                      />

                      {/* Section Drawing Attachments */}
                      <View style={s.attachmentsRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Ionicons name="document-attach" size={14} color="#2563EB" />
                          <Text style={s.attachmentsTitle}>Linked Drawings & Blueprints</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.attachmentsScroll}>
                          {(section.attachments || []).map((att) => (
                            <View key={att.id} style={s.attThumbCard}>
                              <TouchableOpacity
                                style={s.attThumbClick}
                                onPress={() =>
                                  setViewingAttachment({
                                    ...att,
                                    sectionTitle: section.sectionTitle,
                                    leadName: customerName,
                                  })
                                }
                              >
                                <Ionicons name="image" size={18} color="#2563EB" />
                                <Text style={s.attThumbName} numberOfLines={1}>
                                  {att.name}
                                </Text>
                              </TouchableOpacity>
                              {!isReadOnly && (
                                <TouchableOpacity
                                  style={s.attRemoveBtn}
                                  onPress={() => handleRemoveAttachment(section.id, att.id)}
                                >
                                  <Ionicons name="close-circle" size={14} color="#DC2626" />
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}

                          {!isReadOnly && (
                            <TouchableOpacity
                              style={s.addAttBtn}
                              onPress={() => setActiveDrawingPickerSecId(section.id)}
                            >
                              <Ionicons name="add" size={15} color="#2563EB" />
                              <Text style={s.addAttBtnText}>Attach Drawing</Text>
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      </View>

                      {/* Items in this Section */}
                      <View style={s.itemsContainer}>
                        {secItems.map((item, itemIdx) => (
                          <View key={item.id} style={s.itemCard}>
                            <View style={s.itemCardHeader}>
                              <Text style={s.itemCardNumber}>#{itemIdx + 1}</Text>
                              {!isReadOnly && secItems.length > 1 && (
                                <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Item Name */}
                            <Text style={s.fieldLabel}>Item Title *</Text>
                            <TextInput
                              style={[s.input, isReadOnly && s.inputDisabled]}
                              value={item.itemName}
                              onChangeText={(val) => handleUpdateItemField(item.id, 'itemName', val)}
                              placeholder="e.g. 18mm BWP Marine Plywood Wardrobe"
                              placeholderTextColor="#94A3B8"
                              editable={!isReadOnly}
                            />

                            {/* Brand / Make & Category Row */}
                            <View style={s.twoColRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.fieldLabel}>Brand / Make</Text>
                                <TextInput
                                  style={[s.input, isReadOnly && s.inputDisabled]}
                                  value={item.brand}
                                  onChangeText={(val) => handleUpdateItemField(item.id, 'brand', val)}
                                  placeholder="e.g. CenturyPly / Hafele"
                                  placeholderTextColor="#94A3B8"
                                  editable={!isReadOnly}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.fieldLabel}>Trade / Category</Text>
                                <TextInput
                                  style={[s.input, isReadOnly && s.inputDisabled]}
                                  value={item.category}
                                  onChangeText={(val) => handleUpdateItemField(item.id, 'category', val)}
                                  placeholder="e.g. Carpentry"
                                  placeholderTextColor="#94A3B8"
                                  editable={!isReadOnly}
                                />
                              </View>
                            </View>

                            {/* Detailed Description / Technical Specs */}
                            <Text style={s.fieldLabel}>Technical Specifications</Text>
                            <TextInput
                              style={[s.specInput, isReadOnly && s.inputDisabled]}
                              value={item.description}
                              onChangeText={(val) => handleUpdateItemField(item.id, 'description', val)}
                              placeholder="Finish specifications, laminate thickness, edge-banding, hardware make..."
                              placeholderTextColor="#94A3B8"
                              multiline
                              editable={!isReadOnly}
                            />

                            {/* Qty, Unit, Rate Row */}
                            <View style={s.qtyRateRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.fieldLabel}>Qty *</Text>
                                <TextInput
                                  style={[s.input, isReadOnly && s.inputDisabled]}
                                  value={String(item.quantity)}
                                  onChangeText={(val) => handleUpdateItemField(item.id, 'quantity', val)}
                                  keyboardType="numeric"
                                  placeholder="1"
                                  placeholderTextColor="#94A3B8"
                                  editable={!isReadOnly}
                                />
                              </View>

                              <View style={{ flex: 1.2 }}>
                                <Text style={s.fieldLabel}>Unit</Text>
                                <TextInput
                                  style={[s.input, isReadOnly && s.inputDisabled]}
                                  value={item.unit}
                                  onChangeText={(val) => handleUpdateItemField(item.id, 'unit', val)}
                                  placeholder="sqft"
                                  placeholderTextColor="#94A3B8"
                                  editable={!isReadOnly}
                                />
                              </View>

                              <View style={{ flex: 1.4 }}>
                                <Text style={s.fieldLabel}>Rate (₹) *</Text>
                                <TextInput
                                  style={[s.input, isReadOnly && s.inputDisabled]}
                                  value={String(item.rate)}
                                  onChangeText={(val) => handleUpdateItemField(item.id, 'rate', val)}
                                  keyboardType="numeric"
                                  placeholder="0"
                                  placeholderTextColor="#94A3B8"
                                  editable={!isReadOnly}
                                />
                              </View>
                            </View>

                            {/* Quick UOM Pills */}
                            {!isReadOnly && (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.uomPillsScroll}>
                                {STANDARD_UOMS.map((u) => (
                                  <TouchableOpacity
                                    key={u.value}
                                    style={[s.uomPill, item.unit?.toLowerCase() === u.value.toLowerCase() && s.uomPillActive]}
                                    onPress={() => handleUpdateItemField(item.id, 'unit', u.value)}
                                  >
                                    <Text style={[s.uomPillText, item.unit?.toLowerCase() === u.value.toLowerCase() && s.uomPillTextActive]}>
                                      {u.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            )}

                            {/* Line Total */}
                            <View style={s.lineTotalRow}>
                              <Text style={s.lineTotalLabel}>Subtotal:</Text>
                              <Text style={s.lineTotalValue}>{formatExactCurrency(item.amount || 0)}</Text>
                            </View>
                          </View>
                        ))}

                        {!isReadOnly && (
                          <TouchableOpacity
                            style={s.addItemBtn}
                            onPress={() => handleAddItemToSection(section.id)}
                          >
                            <Ionicons name="add-circle" size={18} color="#2563EB" />
                            <Text style={s.addItemBtnText}>Add Item to {section.sectionTitle || 'Section'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {!isReadOnly && (
              <TouchableOpacity style={s.addSectionBtn} onPress={handleAddSection}>
                <Ionicons name="duplicate-outline" size={18} color="#2563EB" />
                <Text style={s.addSectionBtnText}>+ Add New Section / Zone</Text>
              </TouchableOpacity>
            )}

            {/* Over-Budget Warning */}
            {isOverBudget && (
              <View style={s.overBudgetBox}>
                <Ionicons name="warning" size={18} color="#E11D48" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.overBudgetText}>
                    <Text style={{ fontFamily: 'Inter-Bold' }}>Target Budget Exceeded: </Text>
                    Est. budget ({budgetRange}) exceeded by{' '}
                    <Text style={{ fontFamily: 'Inter-ExtraBold', color: '#E11D48' }}>
                      {formatExactCurrency(budgetExcess)}
                    </Text>
                  </Text>
                </View>
                <View style={s.overBudgetPill}>
                  <Text style={s.overBudgetPillText}>+{budgetExcessPct.toFixed(1)}%</Text>
                </View>
              </View>
            )}

            {/* Grand Total Card */}
            <View style={s.grandTotalCard}>
              <View>
                <Text style={s.grandTotalLabel}>TOTAL ESTIMATED BOQ AMOUNT</Text>
                <Text style={s.grandTotalSub}>
                  {items.length} items across {sections.length} sections
                </Text>
              </View>
              <Text style={[s.grandTotalValue, isOverBudget && { color: '#E11D48' }]}>
                {formatExactCurrency(totalAmount)}
              </Text>
            </View>

            {/* Notes / Terms */}
            <View style={{ marginTop: 4 }}>
              <Text style={s.fieldLabel}>Notes & Scope Conditions (Optional)</Text>
              <TextInput
                style={[s.notesInput, isReadOnly && s.inputDisabled]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Exclusions, payment terms, or client stipulations for this BOQ..."
                placeholderTextColor="#94A3B8"
                multiline
                editable={!isReadOnly}
              />
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity style={isReadOnly ? s.saveBtn : s.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={isReadOnly ? s.saveBtnText : s.cancelBtnText}>{isReadOnly ? 'Close' : 'Cancel'}</Text>
            </TouchableOpacity>
            {!isReadOnly && (
              <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={s.saveBtnText}>{isEditing ? 'Update BOQ' : 'Save BOQ'}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL: Pick or Upload Drawing to attach */}
      <Modal
        visible={Boolean(activeDrawingPickerSecId)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDrawingPickerSecId(null)}
      >
        <View style={s.pickerOverlay}>
          <View style={s.pickerCard}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Attach Drawing / Blueprint</Text>
              <TouchableOpacity onPress={() => setActiveDrawingPickerSecId(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
              <Text style={s.pickerSectionLabel}>Project Approved / Uploaded Drawings</Text>
              {drawings.length === 0 ? (
                <Text style={s.pickerEmptyText}>No drawings uploaded in this lead yet.</Text>
              ) : (
                drawings.map((dw) => (
                  <TouchableOpacity
                    key={dw._id || dw.id}
                    style={s.drawingPickRow}
                    onPress={() => handleAttachProjectDrawing(activeDrawingPickerSecId, dw)}
                  >
                    <Ionicons name="document-attach" size={18} color="#2563EB" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.drawingPickTitle} numberOfLines={1}>
                        {dw.title || dw.name || 'Drawing'}
                      </Text>
                      <Text style={s.drawingPickSub}>
                        {dw.category || 'General'} • v{dw.version || 1}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[s.uploadPickBtn, uploadingDrawing && { opacity: 0.6 }]}
              onPress={() => handleUploadNewDrawing(activeDrawingPickerSecId)}
              disabled={uploadingDrawing}
            >
              {uploadingDrawing ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
                  <Text style={s.uploadPickBtnText}>Upload New Image / Blueprint</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lightbox Blueprint Viewer Modal */}
      <BoqDrawingViewerModal
        visible={Boolean(viewingAttachment)}
        onClose={() => setViewingAttachment(null)}
        attachment={viewingAttachment}
        title="BOQ Specification Drawing"
        leadName={customerName}
        sectionTitle={viewingAttachment?.sectionTitle}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '92%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },

  // Sections
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  sectionHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleInput: {
    fontSize: 13.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    padding: 0,
  },
  sectionHeaderTitleText: {
    fontSize: 13.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  sectionItemCountText: {
    fontSize: 10.5,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  sectionDeleteBtn: {
    padding: 6,
  },
  sectionBody: {
    padding: 12,
    gap: 10,
  },
  scopeDescInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    minHeight: 48,
    textAlignVertical: 'top',
  },

  // Attachments
  attachmentsRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  attachmentsTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
  },
  attachmentsScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  attThumbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  attThumbClick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  attThumbName: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },
  attRemoveBtn: {
    marginLeft: 2,
  },
  addAttBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addAttBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },

  // Items
  itemsContainer: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemCardNumber: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    marginBottom: 3,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },
  specInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    minHeight: 46,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  qtyRateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  uomPillsScroll: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  uomPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  uomPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  uomPillText: {
    fontSize: 9.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  uomPillTextActive: {
    color: '#FFFFFF',
  },
  lineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  lineTotalLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  lineTotalValue: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    marginTop: 4,
  },
  addItemBtnText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },

  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
  },
  addSectionBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },

  overBudgetBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 10,
    padding: 10,
  },
  overBudgetText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#BE123C',
    lineHeight: 15,
  },
  overBudgetPill: {
    backgroundColor: '#E11D48',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overBudgetPillText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },

  grandTotalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  grandTotalSub: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
  },
  grandTotalValue: {
    fontSize: 16,
    fontFamily: 'Inter-Black',
    color: '#10B981',
  },

  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    height: 60,
    textAlignVertical: 'top',
  },

  footer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },

  // Picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  pickerTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  pickerSectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pickerEmptyText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    paddingVertical: 10,
  },
  drawingPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  drawingPickTitle: {
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  drawingPickSub: {
    fontSize: 10.5,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 1,
  },
  uploadPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 8,
  },
  uploadPickBtnText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
});
