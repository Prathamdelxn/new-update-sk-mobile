import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback, StatusBar, LayoutAnimation, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import ConfirmModal from '../../components/ConfirmModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { milestoneService, boqService } from '../../services/projectService';
import { useTranslation } from 'react-i18next';
import ProjectTimelineTab from './timeline';

export default function ProjectMilestonesTab({ project }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: projectId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [milestones, setMilestones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', description: '', tasks: [] });
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [boqItems, setBoqItems] = useState([]);
  const [isBoqLoading, setIsBoqLoading] = useState(true);
  const [activeView, setActiveView] = useState('milestones');

  const hasPermission = useCallback((moduleId, action) => {
    if (user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*')) return true;
    if (!project) return false;

    // Find myRole from project.members if not directly attached
    let myRole = project.myRole;
    if (!myRole && project.members) {
      const currentUserId = user?.id || user?._id;
      const member = project.members.find(m => m.user?._id === currentUserId || m.user === currentUserId);
      if (member && member.role) myRole = member.role;
    }

    if (!myRole) return false;
    if (myRole.name === 'Admin' || myRole.permissions?.includes('*')) return true;
    return myRole.permissions?.includes(`${moduleId}:${action}`);
  }, [project, user]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchMilestones = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      else setRefreshing(true);

      const data = await milestoneService.getProjectMilestones(projectId, token);
      setMilestones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
      showToast('Failed to load milestones', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [projectId, token]);

  const fetchBoqItems = useCallback(async () => {
    try {
      setIsBoqLoading(true);
      const data = await boqService.getBOQItems(projectId, token);
      setBoqItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching BOQ:', error);
    } finally {
      setIsBoqLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchMilestones();
    fetchBoqItems();
  }, [fetchMilestones, fetchBoqItems]);

  // Real-time: refresh when any team member changes milestones
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchMilestones(true);
    socket.on('milestone:created', refresh);
    socket.on('milestone:updated', refresh);
    socket.on('milestone:deleted', refresh);
    return () => {
      socket.off('milestone:created', refresh);
      socket.off('milestone:updated', refresh);
      socket.off('milestone:deleted', refresh);
    };
  }, [socket, fetchMilestones]);

  const onRefresh = useCallback(() => {
    fetchMilestones(true);
    fetchBoqItems();
  }, [fetchMilestones, fetchBoqItems]);

  const handleAddMilestone = async () => {
    if (!newMilestone.name.trim()) {
      showToast('Milestone name is required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingMilestoneId) {
        await milestoneService.updateMilestone(projectId, editingMilestoneId, token, newMilestone);
      } else {
        await milestoneService.createMilestone(projectId, token, newMilestone);
      }
      setIsModalVisible(false);
      setEditingMilestoneId(null);
      setNewMilestone({ name: '', description: '', tasks: [] });
      fetchMilestones();
    } catch (error) {
      console.error('Error saving milestone:', error);
      showToast(`Failed to ${editingMilestoneId ? 'update' : 'create'} milestone`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (milestone) => {
    setEditingMilestoneId(milestone._id);
    setNewMilestone({
      name: milestone.name,
      description: milestone.description,
      tasks: [...milestone.tasks]
    });
    setIsModalVisible(true);
  };

  const handleDeleteMilestone = (milestoneId) => {
    setMilestoneToDelete(milestoneId);
    setIsDeleteModalVisible(true);
  };

  const confirmDeleteMilestone = async () => {
    if (!milestoneToDelete) return;
    try {
      setIsDeleting(true);
      await milestoneService.deleteMilestone(projectId, milestoneToDelete, token);
      setIsDeleteModalVisible(false);
      setMilestoneToDelete(null);
      fetchMilestones();
    } catch (error) {
      showToast("Failed to delete milestone", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportXER = async () => {
    if (boqItems.length === 0) {
      showToast('Cannot import: BOQ is empty. Please add items to BOQ first.', 'error');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.xer')) {
        showToast('Please select a valid .XER file', 'error');
        return;
      }

      setIsImporting(true);
      const fileContent = await FileSystem.readAsStringAsync(file.uri);

      const response = await milestoneService.importXER(projectId, token, fileContent);

      if (response.milestones) {
        showToast(`Successfully imported ${response.milestones.length} milestones`, 'success');
        setIsModalVisible(false);
        fetchMilestones();
      } else {
        showToast(response.message || 'Failed to import XER', 'error');
      }
    } catch (error) {
      console.error('Error importing XER:', error);
      showToast('Error reading or uploading XER file', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading && milestones.length === 0) {
    return (
      <View style={[styles.tabScrollContent, { justifyContent: 'center', alignItems: 'center', height: 300 }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!hasPermission('tasks', 'view')) {
    return (
      <View style={[styles.tabScrollContent, { justifyContent: 'center', alignItems: 'center', height: 300 }]}>
        <Feather name="lock" size={48} color="#CBD5E1" />
        <Text style={{ marginTop: 16, fontSize: 16, fontFamily: 'Inter-Medium', color: '#64748B' }}>
          You don't have permission to view Milestones & Tasks.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginHorizontal: 20, flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: activeView === 'milestones' ? '#3B82F6' : 'transparent', borderRadius: 8, shadowColor: activeView === 'milestones' ? '#3B82F6' : 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: activeView === 'milestones' ? 4 : 0 }}
          onPress={() => setActiveView('milestones')}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: activeView === 'milestones' ? '#FFFFFF' : '#64748B' }}>Milestones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: activeView === 'timeline' ? '#3B82F6' : 'transparent', borderRadius: 8, shadowColor: activeView === 'timeline' ? '#3B82F6' : 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: activeView === 'timeline' ? 4 : 0 }}
          onPress={() => setActiveView('timeline')}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: activeView === 'timeline' ? '#FFFFFF' : '#64748B' }}>Timeline</Text>
        </TouchableOpacity>
      </View>

      {activeView === 'timeline' ? (
        <ProjectTimelineTab />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.tabScrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
        >
          <View style={styles.headerRow}>
            <Text style={styles.sectionLabel}>Task Milestones</Text>
            {hasPermission('tasks', 'create') && (
              <TouchableOpacity
                style={[styles.addBtn, boqItems.length === 0 && { backgroundColor: '#94A3B8' }]}
                onPress={() => {
                  if (boqItems.length === 0) {
                    showToast('Cannot create milestone: BOQ is empty. Please add items to BOQ first.', 'error');
                    return;
                  }
                  setIsModalVisible(true);
                }}
              >
                <Feather name="plus" size={16} color="#FFF" />
                <Text style={styles.addBtnText}>{t('newMilestone')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {milestones.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>{t('noMilestonesAddedYet')}</Text>
            </View>
          ) : (
            <View style={styles.verticalTimeline}>
              {milestones.map((m, i) => {
                const completedTasksCount = m.tasks?.filter(t => t.isCompleted).length || 0;
                const totalTasksCount = m.tasks?.length || 0;
                const progress = totalTasksCount > 0 ? completedTasksCount / totalTasksCount : 0;

                return (
                  <View key={m._id} style={styles.milestoneItem}>
                    <View style={styles.connectorContainer}>
                      <View style={[styles.marker, { backgroundColor: m.status === 'Completed' ? '#10B981' : m.status === 'In Progress' ? '#3B82F6' : '#CBD5E1' }]} />
                      {i !== milestones.length - 1 && <View style={styles.connector} />}
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={0.8}
                      onPress={() => router.push(`/project/${projectId}/milestone/${m._id}`)}
                    >
                      <View style={styles.mCard}>
                        <View style={styles.mCardTop}>
                          <Text style={styles.mTitle}>{m.name}</Text>
                          <View style={styles.mCardActions}>
                            {hasPermission('tasks', 'update') && (
                              <TouchableOpacity onPress={() => openEditModal(m)} style={styles.actionIcon}>
                                <Feather name="edit-3" size={14} color="#3B82F6" />
                              </TouchableOpacity>
                            )}
                            {hasPermission('tasks', 'delete') && (
                              <TouchableOpacity onPress={() => handleDeleteMilestone(m._id)} style={styles.actionIcon}>
                                <Feather name="trash-2" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        <View style={styles.mMetaRow}>
                          <View style={[styles.mStatusPill, { backgroundColor: m.status === 'Completed' ? '#D1FAE5' : m.status === 'In Progress' ? '#DBEAFE' : '#F1F5F9' }]}>
                            <Text style={[styles.mStatusText, { color: m.status === 'Completed' ? '#059669' : m.status === 'In Progress' ? '#2563EB' : '#64748B' }]}>{m.status}</Text>
                          </View>
                          {m.dueDate && <Text style={styles.mDate}>{new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>}
                        </View>
                        <Text style={styles.mDesc} numberOfLines={2}>{m.description}</Text>

                        <View style={styles.tasksSection}>
                          <View style={styles.tasksLabelRow}>
                            <Text style={styles.tasksLabel}>{t('progressCount')} ({completedTasksCount}/{totalTasksCount})</Text>
                            <View style={styles.viewTasksLink}>
                              <Text style={styles.viewTasksText}>{t('viewTasks')}</Text>
                              <Feather name="chevron-right" size={12} color="#3B82F6" />
                            </View>
                          </View>
                          <View style={styles.mProgressBg}>
                            <View style={[styles.mProgressFill, { width: `${progress * 100}%`, backgroundColor: m.status === 'Completed' ? '#10B981' : '#3B82F6' }]} />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          setKeyboardHeight(0);
          setEditingMilestoneId(null);
          setNewMilestone({ name: '', description: '', tasks: [] });
          setIsModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setEditingMilestoneId(null);
              setNewMilestone({ name: '', description: '', tasks: [] });
              setIsModalVisible(false);
            }}
          />
          <View style={[
            styles.modalContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : Math.max(insets.bottom, 24) }
          ]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMilestoneId ? t('editMilestone') : t('addNewMilestone')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => {
                Keyboard.dismiss();
                setEditingMilestoneId(null);
                setNewMilestone({ name: '', description: '', tasks: [] });
                setIsModalVisible(false);
              }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('milestoneName')}</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="flag-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder={t('egSiteMobilization')}
                    value={newMilestone.name}
                    onChangeText={(text) => setNewMilestone({ ...newMilestone, name: text })}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('description')}</Text>
                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <Ionicons name="document-text-outline" size={18} color="#94A3B8" style={styles.inputIconTop} />
                  <TextInput
                    style={[styles.inputFlex, styles.textArea]}
                    placeholder={t('enterMilestoneDesc')}
                    value={newMilestone.description}
                    onChangeText={(text) => setNewMilestone({ ...newMilestone, description: text })}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} activeOpacity={0.8} onPress={handleAddMilestone} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>{editingMilestoneId ? t('updateMilestone') : t('createMilestone')}</Text>
                    <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.importDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('orImportSchedule')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {!editingMilestoneId && hasPermission('tasks', 'create') && (
                <TouchableOpacity
                  style={styles.importXERBtn}
                  onPress={handleImportXER}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <ActivityIndicator color="#3B82F6" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="file-import-outline" size={20} color="#3B82F6" />
                      <Text style={styles.importXERText}>{t('importPrimaveraXER')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={isDeleteModalVisible}
        title={t('deleteMilestone')}
        message={t('deleteMilestoneMsg')}
        confirmText={t('delete')}
        onConfirm={confirmDeleteMilestone}
        onCancel={() => {
          setIsDeleteModalVisible(false);
          setMilestoneToDelete(null);
        }}
        type="destructive"
        isSubmitting={isDeleting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabScrollContent: { gap: 24, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionLabel: { fontSize: 22, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
  addBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  verticalTimeline: { paddingLeft: 10 },
  milestoneItem: { flexDirection: 'row', gap: 12 },
  connectorContainer: { width: 2, alignItems: 'center' },
  marker: { width: 16, height: 16, borderRadius: 8, zIndex: 1, borderWidth: 3, borderColor: '#F8FAFF', marginTop: 12 },
  connector: { flex: 1, width: 2, backgroundColor: '#E2E8F0', marginVertical: 4 },
  mCard: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  mCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  mTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1, paddingRight: 8 },
  mCardActions: { flexDirection: 'row', gap: 6 },
  actionIcon: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  mMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  mStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  mStatusText: { fontSize: 9, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  mDate: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  mDesc: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', lineHeight: 16, marginBottom: 8 },
  tasksSection: { marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 8 },
  tasksLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tasksLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569' },
  viewTasksLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewTasksText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  taskTitle: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155' },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#94A3B8' },
  mProgressBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  mProgressFill: { height: '100%' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#0F172A' },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, height: 52 },
  textAreaContainer: { height: 100, alignItems: 'flex-start', paddingTop: 16 },
  inputIcon: { marginRight: 12 },
  inputIconTop: { marginRight: 12, marginTop: 2 },
  inputFlex: { flex: 1, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', height: '100%' },
  textArea: { textAlignVertical: 'top' },
  newTaskItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 10, borderRadius: 12, marginTop: 8 },
  newTaskText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155', flex: 1 },
  submitBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 20, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  importDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  importXERBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 16, height: 56, gap: 10, marginBottom: 10 },
  importXERText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#3B82F6' }
});
