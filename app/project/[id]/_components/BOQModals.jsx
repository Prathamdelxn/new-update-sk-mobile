import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
const AdaptiveGlass = ({ style, children }) => <View style={[{ backgroundColor: '#FFFFFF', overflow: 'hidden' }, style]}>{children}</View>;
import { formatCompact } from '../../../utils/format';
import { styles } from '../boqStyles';

export const ViewDetailsModal = ({
  visible,
  onClose,
  viewingHistory,
  selectedVersionIdx,
  setSelectedVersionIdx,
  isAdmin,
  user,
  isSubmitting,
  handleUpdateStatus,
  currency = '$'
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <AdaptiveGlass intensity={90} tint="light" style={styles.viewCard}>
          {/* Close button — top right corner always visible */}
          <TouchableOpacity onPress={onClose} style={styles.viewCloseBtn}>
            <Ionicons name="close" size={22} color="#0F172A" />
          </TouchableOpacity>

          {viewingHistory.length > 1 && (
            <View style={styles.versionTabRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {viewingHistory.map((v, i) => (
                  <TouchableOpacity
                    key={v._id}
                    style={[styles.versionTab, selectedVersionIdx === i && styles.activeTab]}
                    onPress={() => setSelectedVersionIdx(i)}
                  >
                    <Text style={[styles.versionTabText, selectedVersionIdx === i && styles.activeTabText]}>
                      v{v.version}
                      {i === 0 && ' (Latest)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.modalTitle}>Item Details</Text>
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {viewingHistory[selectedVersionIdx]?.itemNumber || 'BOQ Line Item'}
                {selectedVersionIdx !== 0 && ' [Archived Version]'}
              </Text>
            </View>
          </View>

          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.detailBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Group Name</Text>
                <Text style={styles.detailValue}>{viewingHistory[selectedVersionIdx]?.groupName}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailDesc}>{viewingHistory[selectedVersionIdx]?.itemDescription}</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Quantity</Text>
                  <Text style={styles.statValue}>{viewingHistory[selectedVersionIdx]?.quantity} {viewingHistory[selectedVersionIdx]?.unit}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Unit Cost</Text>
                  <Text style={styles.statValue}>{currency} {formatCompact(viewingHistory[selectedVersionIdx]?.unitCost)}</Text>
                </View>
              </View>

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>{currency} {formatCompact(viewingHistory[selectedVersionIdx]?.totalCost)}</Text>
              </View>

              {viewingHistory[selectedVersionIdx]?.remark ? (
                <View style={styles.remarkBox}>
                  <Text style={styles.detailLabel}>Remarks</Text>
                  <Text style={styles.remarkText}>{viewingHistory[selectedVersionIdx]?.remark}</Text>
                </View>
              ) : null}

              <View style={styles.auditBox}>
                <Text style={styles.auditLabel}>
                  {selectedVersionIdx === 0 ? 'Last modified by' : 'Created by'} {viewingHistory[selectedVersionIdx]?.createdByName || 'System'}
                </Text>
                <Text style={styles.auditDate}>
                  {viewingHistory[selectedVersionIdx]?.createdAt ? new Date(viewingHistory[selectedVersionIdx].createdAt).toLocaleString() : ''}
                </Text>
              </View>

              <View style={styles.viewStatusBox}>
                <Text style={styles.detailLabel}>Current Status</Text>
                <View style={[styles.viewStatusBadge, styles[`status${viewingHistory[selectedVersionIdx]?.status || 'Pending'}_solid`]]}>
                  <Ionicons
                    name={
                      viewingHistory[selectedVersionIdx]?.status === 'Approved' ? 'shield-checkmark' :
                        viewingHistory[selectedVersionIdx]?.status === 'Rejected' ? 'alert-circle' : 'hourglass'
                    }
                    size={16}
                    color="#FFF"
                  />
                  <Text style={styles.viewStatusText}>{viewingHistory[selectedVersionIdx]?.status || 'Pending'}</Text>
                </View>

                {viewingHistory[selectedVersionIdx]?.status !== 'Pending' && (
                  <View style={styles.decisionAudit}>
                    <Text style={styles.auditLabel}>
                      {viewingHistory[selectedVersionIdx]?.status} by {viewingHistory[selectedVersionIdx]?.approvedByName || 'Authorized User'}
                    </Text>
                    <Text style={styles.auditDate}>
                      {viewingHistory[selectedVersionIdx]?.approvedAt ? new Date(viewingHistory[selectedVersionIdx].approvedAt).toLocaleString() : ''}
                    </Text>
                  </View>
                )}
              </View>

              {viewingHistory[selectedVersionIdx]?.status === 'Rejected' && viewingHistory[selectedVersionIdx]?.rejectionReason && (
                <View style={[styles.remarkBox, { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444', borderLeftWidth: 3 }]}>
                  <Text style={[styles.detailLabel, { color: '#DC2626' }]}>Rejection Reason</Text>
                  <Text style={[styles.remarkText, { color: '#7F1D1D' }]}>{viewingHistory[selectedVersionIdx].rejectionReason}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.viewActions}>
            {selectedVersionIdx === 0 && (isAdmin || String(user?._id) === String(viewingHistory[0]?.requestedApprover) || String(user?.id) === String(viewingHistory[0]?.requestedApprover)) && viewingHistory[0]?.status === 'Pending' ? (
              <View style={styles.approvalWrapper}>
                <Text style={styles.approvalTitle}>Approval Required</Text>
                <View style={styles.approvalActions}>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.rejectBtnSolid]}
                    onPress={() => handleUpdateStatus(viewingHistory[0]._id, 'Rejected')}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.approvalBtnTextSolid}>Reject Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.approveBtnSolid]}
                    onPress={() => handleUpdateStatus(viewingHistory[0]._id, 'Approved')}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.approvalBtnTextSolid}>Approve Item</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.readOnlyNote}>
                <Ionicons name="information-circle-outline" size={16} color="#64748B" />
                <Text style={styles.readOnlyText}>
                  {viewingHistory[0]?.status === 'Pending' 
                    ? `Pending with ${viewingHistory[0]?.requestedApproverName || 'Authorized Approver'}` 
                    : (selectedVersionIdx === 0 ? 'Viewing current version.' : 'Viewing historical version.')}
                </Text>
              </View>
            )}
          </View>
        </AdaptiveGlass>
      </View>
    </Modal>
  );
};

export const ChoiceModal = ({
  visible,
  onClose,
  onOpenManual,
  handleExcelImport,
  isImporting
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <AdaptiveGlass intensity={60} tint="light" style={styles.choiceCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New BOQ Batch</Text>
          <Text style={styles.modalSubtitle}>Choose your entry method</Text>
        </View>

        <TouchableOpacity style={styles.choiceBtn} onPress={onOpenManual}>
          <View style={[styles.choiceIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="create" size={22} color="#3B82F6" />
          </View>
          <View style={styles.choiceTextCol}>
            <Text style={styles.choiceBtnTitle}>Manual Precision</Text>
            <Text style={styles.choiceBtnSub}>Add line items with full detail</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.choiceBtn} onPress={handleExcelImport} disabled={isImporting}>
          <View style={[styles.choiceIconBox, { backgroundColor: '#ECFDF5' }]}>
            {isImporting ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name="cloud-upload" size={22} color="#10B981" />}
          </View>
          <View style={styles.choiceTextCol}>
            <Text style={styles.choiceBtnTitle}>Excel Smart Sync</Text>
            <Text style={styles.choiceBtnSub}>Bulk import from spreadsheets</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={styles.cancelLinkText}>Close</Text>
        </TouchableOpacity>
      </AdaptiveGlass>
    </View>
  </Modal>
);

export const ExcelPreviewModal = ({
  visible,
  onClose,
  previewData,
  importFile,
  handleConfirmImport,
  isSubmitting,
  currency = '$'
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <AdaptiveGlass intensity={95} tint="light" style={styles.previewCard}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Import Preview</Text>
            <Text style={styles.modalSubtitle}>{previewData.length} items found in {importFile?.name}</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.previewList}>
          {previewData.map((item, idx) => (
            <View key={idx} style={styles.previewRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewGroupName}>{item.groupName}</Text>
                <Text style={styles.previewDesc}>{item.itemDescription}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.previewTotal}>{currency} {formatCompact(item.totalCost)}</Text>
                <Text style={styles.previewDetails}>{item.quantity} {item.unit} x {currency} {item.unitCost}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.formCancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleConfirmImport}
            disabled={isSubmitting}
          >
            <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.submitGradient}>
              {isSubmitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.submitText}>Confirm Import</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AdaptiveGlass>
    </View>
  </Modal>
);

export const ManualEntryModal = ({
  visible,
  onClose,
  editingItem,
  formData,
  setFormData,
  handleManualSubmit,
  isSubmitting,
  errors = {},
  existingGroups = []
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const filteredGroups = existingGroups.filter(g => g.toLowerCase().includes((formData.groupName || '').toLowerCase()) && g !== formData.groupName);

  return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <AdaptiveGlass intensity={90} tint="light" style={styles.formCard}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>
            {editingItem
              ? (editingItem.status === 'Draft' ? 'Edit Draft Item' : editingItem.status === 'Rejected' ? 'Edit Rejected Item' : 'Create New Version')
              : 'Manual BOQ Entry'}
          </Text>

          <View style={{ zIndex: 10 }}>
            <Text style={[styles.inputLabel, errors.groupName && { color: '#EF4444' }]}>
              Group Name {errors.groupName && `(${errors.groupName})`}
            </Text>
            <TextInput
              style={[styles.input, errors.groupName && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
              placeholder="e.g. Substructure"
              placeholderTextColor="#94A3B8"
              value={formData.groupName}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onChangeText={(v) => { setFormData({ ...formData, groupName: v }); setShowDropdown(true); }}
            />
            {showDropdown && filteredGroups.length > 0 && (
              <View style={styles.autocompleteDropdown}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                  {filteredGroups.map(g => (
                    <TouchableOpacity 
                      key={g} 
                      style={styles.autocompleteItem}
                      onPress={() => {
                        setFormData({ ...formData, groupName: g });
                        setShowDropdown(false);
                      }}
                    >
                      <Text style={styles.autocompleteItemText}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Item Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. EF4"
                placeholderTextColor="#94A3B8"
                value={formData.itemNumber}
                onChangeText={(v) => setFormData({ ...formData, itemNumber: v })}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.inputLabel, errors.unit && { color: '#EF4444' }]}>
                Unit {errors.unit && `(${errors.unit})`}
              </Text>
              <TextInput
                style={[styles.input, errors.unit && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                placeholder="e.g. m3"
                placeholderTextColor="#94A3B8"
                value={formData.unit}
                onChangeText={(v) => setFormData({ ...formData, unit: v })}
              />
            </View>
          </View>

          <Text style={[styles.inputLabel, errors.itemDescription && { color: '#EF4444' }]}>
            Item Description {errors.itemDescription && `(${errors.itemDescription})`}
          </Text>
          <TextInput
            style={[styles.input, errors.itemDescription && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
            placeholder="e.g. Earthwork Excavation"
            placeholderTextColor="#94A3B8"
            value={formData.itemDescription}
            onChangeText={(v) => setFormData({ ...formData, itemDescription: v })}
          />

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, errors.quantity && { color: '#EF4444' }]}>
                Quantity {errors.quantity && `(${errors.quantity})`}
              </Text>
              <TextInput
                style={[styles.input, errors.quantity && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={formData.quantity}
                onChangeText={(v) => {
                  const sanitized = v.replace(/[^0-9.]/g, '');
                  const parts = sanitized.split('.');
                  const final = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
                  setFormData({ ...formData, quantity: final });
                }}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.inputLabel, errors.unitCost && { color: '#EF4444' }]}>
                Unit Cost {errors.unitCost && `(${errors.unitCost})`}
              </Text>
              <TextInput
                style={[styles.input, errors.unitCost && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={formData.unitCost}
                onChangeText={(v) => {
                  const sanitized = v.replace(/[^0-9.]/g, '');
                  const parts = sanitized.split('.');
                  const final = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
                  setFormData({ ...formData, unitCost: final });
                }}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Remark (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Notes..."
            placeholderTextColor="#94A3B8"
            value={formData.remark}
            onChangeText={(v) => setFormData({ ...formData, remark: v })}
          />
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.formCancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit} disabled={isSubmitting}>
            <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.submitGradient}>
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.submitText}>
                  {editingItem
                    ? (editingItem.status === 'Draft' ? 'Save Changes' : editingItem.status === 'Rejected' ? 'Save & Re-draft' : 'Create Version')
                    : 'Save Item'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AdaptiveGlass>
    </View>
  </Modal>
  );
};

export const HistoryModal = ({
  visible,
  onClose,
  loadingHistory,
  historyItems,
  currency = '$'
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <AdaptiveGlass intensity={95} tint="light" style={styles.historyCard}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Price History</Text>
            <Text style={styles.modalSubtitle}>Timeline of changes for this item</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {loadingHistory ? (
          <ActivityIndicator style={{ marginVertical: 40 }} color="#3B82F6" />
        ) : (
          <ScrollView style={styles.historyList}>
            {historyItems.map((v, i) => (
              <View key={v._id} style={styles.historyItem}>
                <View style={styles.historyDotCol}>
                  <View style={[styles.historyDot, i === 0 && styles.latestDot]} />
                  {i !== historyItems.length - 1 && <View style={styles.historyLine} />}
                </View>
                <View style={styles.historyContent}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyVersion}>Version {v.version}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.historyUser}>{v.createdByName || 'System'}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(v.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyDataRow}>
                    <View>
                      <Text style={styles.historyLabel}>Rate</Text>
                      <Text style={styles.historyValue}>{currency} {formatCompact(v.unitCost)}</Text>
                    </View>
                    <View style={{ marginLeft: 24 }}>
                      <Text style={styles.historyLabel}>Quantity</Text>
                      <Text style={styles.historyValue}>{v.quantity} {v.unit}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.historyLabel}>Total</Text>
                      <Text style={styles.historyTotal}>{currency} {formatCompact(v.totalCost)}</Text>
                    </View>
                  </View>
                  {v.remark && <Text style={styles.historyRemark}>Note: {v.remark}</Text>}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.historyCloseBtn} onPress={onClose}>
          <Text style={styles.historyCloseText}>Close History</Text>
        </TouchableOpacity>
      </AdaptiveGlass>
    </View>
  </Modal>
);

export const ApproverModal = ({
  visible,
  onClose,
  loadingApprovers,
  approvers,
  selectedApproverId,
  setSelectedApproverId,
  confirmSendForApproval,
  isSubmitting
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <AdaptiveGlass intensity={90} tint="light" style={styles.approverCard}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Authorized Approvers</Text>
            <Text style={styles.modalSubtitle}>Users with permission to approve BOQ</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {loadingApprovers ? (
          <ActivityIndicator style={{ marginVertical: 40 }} color="#3B82F6" />
        ) : (
          <ScrollView style={styles.approverList} showsVerticalScrollIndicator={false}>
            {approvers.length > 0 ? (
              approvers.map((approver) => {
                const initials = approver.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const isSelected = selectedApproverId === approver._id;
                
                return (
                  <TouchableOpacity 
                    key={approver._id} 
                    style={[styles.approverItemModern, isSelected && styles.selectedApproverModern]}
                    onPress={() => setSelectedApproverId(approver._id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatarBox, isSelected && styles.avatarBoxActive]}>
                      <Text style={[styles.avatarText, isSelected && styles.avatarTextActive]}>{initials}</Text>
                    </View>
                    
                    <View style={styles.approverInfoModern}>
                      <View style={styles.nameRowModern}>
                        <Text style={styles.approverNameModern} numberOfLines={1}>{approver.name}</Text>
                        {approver.isProjectMember && (
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>Project Team</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.approverRoleModern} numberOfLines={1}>{approver.roleName}</Text>
                      <Text style={styles.approverEmailModern} numberOfLines={1}>{approver.email}</Text>
                    </View>

                    <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyApproverBox}>
                <Ionicons name="people-outline" size={32} color="#94A3B8" />
                <Text style={styles.emptyApproverText}>No authorized approvers found.</Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.formCancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={confirmSendForApproval} 
            disabled={isSubmitting || approvers.length === 0 || !selectedApproverId}
          >
            <LinearGradient colors={['#3B82F6', '#3B82F6']} style={[styles.submitGradient, !selectedApproverId && { opacity: 0.6 }]}>
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Send for Approval</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AdaptiveGlass>
    </View>
  </Modal>
);

export const BudgetImpactModal = ({
  visible,
  onClose,
  budgetImpactData,
  handleUpdateStatus,
  isSubmitting,
  currency = '$'
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <AdaptiveGlass intensity={95} tint="light" style={styles.impactCard}>
        <View style={styles.impactHeader}>
          <View style={styles.impactIconBox}>
            <Ionicons name="trending-up" size={24} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.impactTitle}>Budget Impact Analysis</Text>
            <Text style={styles.impactSubtitle}>Review changes before final approval</Text>
          </View>
        </View>

        <View style={styles.comparisonGrid}>
          <View style={styles.compareBox}>
            <Text style={styles.compareLabel}>Current Version</Text>
            <Text style={styles.compareAmount}>{currency} {formatCompact(budgetImpactData?.oldAmount)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#94A3B8" style={{ marginTop: 24 }} />
          <View style={styles.compareBox}>
            <Text style={styles.compareLabel}>New Version</Text>
            <Text style={[styles.compareAmount, { color: '#0F172A' }]}>{currency} {formatCompact(budgetImpactData?.newAmount)}</Text>
          </View>
        </View>

        <View style={[styles.diffBox, { backgroundColor: (budgetImpactData?.difference || 0) >= 0 ? '#F0FDF4' : '#FEF2F2' }]}>
          <Text style={[styles.diffLabel, { color: (budgetImpactData?.difference || 0) >= 0 ? '#16A34A' : '#EF4444' }]}>
            NET BUDGET CHANGE
          </Text>
          <Text style={[styles.diffValue, { color: (budgetImpactData?.difference || 0) >= 0 ? '#15803D' : '#DC2626' }]}>
            {(budgetImpactData?.difference || 0) >= 0 ? '+' : '-'}{currency} {formatCompact(Math.abs(budgetImpactData?.difference || 0))}
          </Text>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.formCancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={() => handleUpdateStatus(budgetImpactData.itemId, 'Approved', budgetImpactData)} 
            disabled={isSubmitting}
          >
            <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.submitGradient}>
              <Text style={styles.submitText}>Confirm & Apply</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AdaptiveGlass>
    </View>
  </Modal>
);

export const RejectionReasonModal = ({
  visible,
  onClose,
  onConfirm,
  isSubmitting
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setError('');
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <AdaptiveGlass intensity={90} tint="light" style={[styles.formCard, { maxHeight: 'auto' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Reject BOQ Item</Text>
                  <Text style={styles.modalSubtitle}>Please provide a reason for rejection</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <View style={[styles.remarkBox, { backgroundColor: '#FFF7ED', borderLeftColor: '#F59E0B', borderLeftWidth: 3, marginBottom: 16 }]}>
                <Ionicons name="warning-outline" size={16} color="#D97706" style={{ marginBottom: 4 }} />
                <Text style={[styles.remarkText, { color: '#92400E' }]}>
                  The item creator will be notified of this rejection along with your reason.
                </Text>
              </View>

              <Text style={[styles.inputLabel, error && { color: '#EF4444' }]}>
                Rejection Reason {error ? `(${error})` : '*'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { height: 100, textAlignVertical: 'top', paddingTop: 10 },
                  error && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }
                ]}
                placeholder="e.g. Quantities do not match site survey data..."
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={(v) => { setReason(v); if (error) setError(''); }}
                multiline
                numberOfLines={4}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.formCancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1 }]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.submitGradient}>
                    {isSubmitting
                      ? <ActivityIndicator color="#FFF" />
                      : <Text style={styles.submitText}>Confirm Rejection</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </AdaptiveGlass>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
