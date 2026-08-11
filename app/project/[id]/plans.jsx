import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Linking, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, FlatList } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
const AdaptiveGlass = ({ style, children }) => <View style={[{ backgroundColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden' }, style]}>{children}</View>;
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from '../../services/cloudinaryService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, hasAnyProjectPermissionPrefix, isProjectLocked } from '../../utils/permissions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ConfirmModal from '../../components/ConfirmModal';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const { width } = Dimensions.get('window');

const STATUS_COLORS = {
  Draft: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  Pending: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  Approved: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  Rejected: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

const FolderCard = memo(({ folder, onSelect }) => (
  <TouchableOpacity
    style={styles.folderCard}
    onPress={() => onSelect(folder._id)}
  >
    <AdaptiveGlass intensity={15} tint="light" style={styles.folderContent}>
      <View style={styles.folderIconBox}><Ionicons name="folder" size={32} color="#3B82F6" /></View>
      <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
      <Text style={styles.folderCount}>{folder.documents?.length || 0} Assets</Text>
    </AdaptiveGlass>
  </TouchableOpacity>
));

const PlanCard = memo(({ item, folderId, activeIsAdmin, canDeleteDocument, canAssignPlans, onDocDelete, onVersionDelete, onDocView, onSendApproval, onRevertDraft, onApprove, onReject, onUploadRevision, onShowHistory, isUpdating, uploadingRevisionId, canAnnotate, onAnnotate }) => {
  const versions = item.versions || [];
  const [viewIdx, setViewIdx] = useState(versions.length - 1);

  useEffect(() => {
    setViewIdx(versions.length - 1);
  }, [versions.length]);

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const displayedVersion = versions[viewIdx] || latestVersion;

  if (!displayedVersion) return null;

  const isViewingLatest = viewIdx === versions.length - 1;
  const versionCount = versions.length;

  const handleVersionToggle = () => {
    if (versionCount > 1) {
      setViewIdx(prev => (prev > 0 ? prev - 1 : versions.length - 1));
    }
  };

  const status = displayedVersion.approvalStatus || 'Draft';
  const sc = STATUS_COLORS[status] || STATUS_COLORS.Draft;
  const isImage = displayedVersion.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(displayedVersion.name || '');

  return (
    <View style={styles.docCardContainer}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => onDocView(displayedVersion.url, displayedVersion.name, item, folderId)} style={styles.docRow}>
        <View style={styles.docIconBox}>
          <Ionicons
            name={displayedVersion.name?.toLowerCase().endsWith('.pdf') ? "document-text" : displayedVersion.name?.toLowerCase().endsWith('.dwg') ? "layers" : isImage ? "pencil" : "image"}
            size={20}
            color={isViewingLatest ? "#3B82F6" : "#64748B"}
          />
        </View>

        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
          <View style={styles.docMetaRow}>
            <Text style={styles.docSize}>{displayedVersion.size ? (displayedVersion.size / 1024 / 1024).toFixed(2) + ' MB' : 'Link'}</Text>
            <Text style={styles.docDot}>•</Text>
            <Text style={styles.docDate}>{displayedVersion.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</Text>
            {versionCount > 1 && (
              <>
                <Text style={styles.docDot}>•</Text>
                <TouchableOpacity style={styles.historyBtnLine} onPress={() => onShowHistory(item)}>
                  <Ionicons name="time-outline" size={11} color="#64748B" />
                  <Text style={styles.historyTextLine}>{versionCount} versions</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          {activeIsAdmin && status === 'Rejected' && displayedVersion.approvalNote ? (
            <Text style={styles.docRejectNote} numberOfLines={1}>{displayedVersion.approvalNote}</Text>
          ) : null}
        </View>

        <View style={styles.docRightSide}>
          <View style={styles.cardHeaderCol}>
            <View style={[styles.docStatusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
              <Text style={[styles.docStatusText, { color: sc.text }]}>{status}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleVersionToggle}
              style={[styles.versionBadge, { backgroundColor: isViewingLatest ? '#3B82F6' : '#64748B', flexDirection: 'row', gap: 4 }]}
              disabled={versionCount <= 1}
            >
              <Text style={styles.versionBadgeText}>v{displayedVersion.versionNumber}</Text>
              {versionCount > 1 && <Ionicons name="repeat" size={10} color="#FFF" />}
            </TouchableOpacity>
          </View>

          {canDeleteDocument && (activeIsAdmin || status === 'Draft' || status === 'Pending') && (
            <TouchableOpacity
              style={styles.docActionBtn}
              onPress={() => onDocDelete(item)}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      {isUpdating ? (
        <View style={styles.docActionRow}><ActivityIndicator size="small" color="#8B5CF6" /></View>
      ) : (
        <View style={styles.approvalRow}>
          {!isViewingLatest ? (
            <TouchableOpacity
              style={[styles.miniBtn, { backgroundColor: '#F1F5F9' }]}
              onPress={() => setViewIdx(versions.length - 1)}
            >
              <Ionicons name="arrow-forward" size={13} color="#64748B" />
              <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' }}>Show Latest (v{latestVersion.versionNumber})</Text>
            </TouchableOpacity>
          ) : (
            <>
              {(activeIsAdmin || canAssignPlans) && status === 'Draft' && (
                <TouchableOpacity
                  style={[styles.miniBtn, { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                  activeOpacity={0.85}
                  onPress={() => onSendApproval(item, latestVersion)}
                >
                  <Ionicons name="send" size={12} color="#FFF" />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#FFF' }}>Send for Approval</Text>
                </TouchableOpacity>
              )}
              {activeIsAdmin && status === 'Pending' && (
                <View style={[styles.miniBtn, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#D97706' }}>Awaiting Approval</Text>
                </View>
              )}
              {activeIsAdmin && status === 'Rejected' && (
                <TouchableOpacity
                  style={[styles.miniBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => onRevertDraft(item, latestVersion)}
                >
                  <Ionicons name="refresh-outline" size={13} color="#64748B" />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' }}>Resubmit</Text>
                </TouchableOpacity>
              )}
              {activeIsAdmin && (status === 'Approved' || status === 'Rejected') && (
                <TouchableOpacity
                  style={[styles.miniBtn, { backgroundColor: '#EFF6FF', borderColor: '#3B82F640' }]}
                  onPress={() => onUploadRevision(item)}
                  disabled={isUpdating || !!uploadingRevisionId}
                >
                  {uploadingRevisionId === item._id ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={13} color="#3B82F6" />
                      <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#3B82F6' }}>Upload Revision</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {status === 'Pending' && item.isMyTurn && (
                <>
                  <TouchableOpacity
                    style={[styles.miniBtn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                    onPress={() => onApprove(item, latestVersion)}
                  >
                    <Ionicons name="checkmark" size={14} color="#16A34A" />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#16A34A' }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                    onPress={() => onReject(item, latestVersion)}
                  >
                    <Ionicons name="close" size={14} color="#DC2626" />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#DC2626' }}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
          {activeIsAdmin && (status === 'Draft' || status === 'Pending') && versionCount > 1 && (
            <TouchableOpacity
              style={[styles.miniBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
              onPress={() => onVersionDelete(item, displayedVersion)}
            >
              <Ionicons name="trash-outline" size={13} color="#DC2626" />
            </TouchableOpacity>
          )}

        </View>
      )}
    </View>
  );
});

export default function ProjectPlansTab({ projectId, project, isAdmin, currentUserId, insetsBottom = 0, canAnnotate = false }) {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const activeId = projectId || id;
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const { socket } = useSocket();
  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
  const activeIsAdmin = isAdmin !== undefined ? isAdmin : (roleName?.toLowerCase() === 'admin');
  const isLocked = isProjectLocked(project);
  const canDeleteDocument = !isLocked && (activeIsAdmin || hasProjectPermission(user, project, 'plans:delete'));
  const canCreatePlans = !isLocked && (activeIsAdmin || hasProjectPermission(user, project, 'plans:create'));
  const canEditPlans = !isLocked && (activeIsAdmin || hasProjectPermission(user, project, 'plans:update') || hasProjectPermission(user, project, 'plans:edit'));
  const canApprovePlans = !isLocked && (activeIsAdmin || hasProjectPermission(user, project, 'plans:approve'));
  const canAssignPlans = !isLocked && (activeIsAdmin || hasProjectPermission(user, project, 'plans:assign'));
  const canViewPlans = activeIsAdmin || hasAnyProjectPermissionPrefix(user, project, 'plans:');
  const activeCurrentUserId = currentUserId || user?.id;

  const [planFolders, setPlanFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadingRevisionId, setUploadingRevisionId] = useState(null); // Per-item loading for revisions
  const [showApproversModal, setShowApproversModal] = useState(false);
  const [approversList, setApproversList] = useState([]);
  const [isLoadingApprovers, setIsLoadingApprovers] = useState(false);
  const [selectedApproverIds, setSelectedApproverIds] = useState([]); // multi-select
  const [approvalDoc, setApprovalDoc] = useState(null);
  const [approvalFolderId, setApprovalFolderId] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPlan, setHistoryPlan] = useState(null);

  // Plan approval workflow state
  const [updatingDocId, setUpdatingDocId] = useState(null);
  const [planRejectModal, setPlanRejectModal] = useState({ visible: false, folderId: null, doc: null });
  const [planRejectReason, setPlanRejectReason] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  // Annotation state
  const [annotationModal, setAnnotationModal] = useState({ visible: false, item: null });
  const [annotations, setAnnotations] = useState([]);
  const [annotationText, setAnnotationText] = useState('');
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);

  const fetchAnnotations = useCallback(async (documentId) => {
    if (!activeId || !token || !documentId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${activeId}/annotations?document=${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAnnotations(await res.json());
    } catch (e) {}
  }, [activeId, token]);

  const openAnnotateModal = useCallback((item) => {
    setAnnotationModal({ visible: true, item });
    setAnnotationText('');
    fetchAnnotations(item._id);
  }, [fetchAnnotations]);

  const saveAnnotation = useCallback(async () => {
    if (!annotationText.trim() || !annotationModal.item) return;
    setIsSavingAnnotation(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${activeId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ document: annotationModal.item._id, documentName: annotationModal.item.name, text: annotationText.trim() }),
      });
      if (res.ok) {
        setAnnotationText('');
        fetchAnnotations(annotationModal.item._id);
        showToast('Annotation saved', 'success');
      } else {
        showToast('Failed to save annotation', 'error');
      }
    } catch (e) {
      showToast('Error saving annotation', 'error');
    } finally {
      setIsSavingAnnotation(false);
    }
  }, [annotationText, annotationModal, activeId, token, fetchAnnotations, showToast]);

  const deleteAnnotation = useCallback(async (annotationId) => {
    try {
      await fetch(`${API_BASE_URL}/projects/${activeId}/annotations/${annotationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnnotations(prev => prev.filter(a => a._id !== annotationId));
    } catch (e) {}
  }, [activeId, token]);

  const myApprovalEntry = (version) =>
    version?.approvals?.find(a =>
      a.user === activeCurrentUserId ||
      a.user?._id === activeCurrentUserId ||
      a.user?.toString() === activeCurrentUserId
    );

  const fetchPlanFolders = useCallback(async () => {
    if (!activeId || !token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${activeId}/folders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlanFolders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsInitialLoading(false);
    }
  }, [activeId, token]);

  useEffect(() => {
    fetchPlanFolders();
  }, [fetchPlanFolders]);

  useEffect(() => {
    if (!socket) return;
    socket.on('plans:updated', fetchPlanFolders);
    return () => socket.off('plans:updated', fetchPlanFolders);
  }, [socket, fetchPlanFolders]);

  const patchDoc = async (folderId, body) => {
    const res = await fetch(`${API_BASE_URL}/projects/${activeId}/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) return;
    try {
      const url = editingFolderId
        ? `${API_BASE_URL}/projects/${activeId}/folders/${editingFolderId}`
        : `${API_BASE_URL}/projects/${activeId}/folders`;
      const method = editingFolderId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: folderName })
      });
      if (response.ok) {
        showToast(`Folder "${folderName}" ${editingFolderId ? 'updated' : 'created'} successfully.`, 'success');
        fetchPlanFolders();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to save folder', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(t('networkError'), 'error');
    } finally {
      setShowFolderModal(false);
      setFolderName('');
      setEditingFolderId(null);
    }
  };

  const handleUploadDocument = async (arg = null) => {
    const existingPlanId = typeof arg === 'string' ? arg : null;
    if (!activeFolderId) return;

    let result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const file = result.assets[0];
      if (existingPlanId) setUploadingRevisionId(existingPlanId);
      else setIsUploadingDoc(true);

      try {
        const cloudinaryUrl = await cloudinaryService.uploadFile(
          file.uri,
          file.name,
          file.mimeType || 'application/octet-stream'
        );

        if (!token) {
          console.warn("[Upload] No token available in state. Request will likely fail with 401.");
        }

        const response = await fetch(`${API_BASE_URL}/projects/${activeId}/folders/${activeFolderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            url: cloudinaryUrl,
            name: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            size: file.size,
            documentId: existingPlanId
          })
        });

        if (response.ok) {
          showToast(existingPlanId ? 'New version (v' + (file.name ? 'v...' : '') + ') uploaded.' : 'Document uploaded to folder.', 'success');
          await fetchPlanFolders();
        } else {
          showToast('Could not upload document', 'error');
        }
      } catch (e) {
        console.error(e);
        showToast('Upload failed', 'error');
      } finally {
        setIsUploadingDoc(false);
        setUploadingRevisionId(null);
      }
    }
  };

  const fetchPlanApprovers = async () => {
    try {
      setIsLoadingApprovers(true);
      setSelectedApproverIds([]);
      const response = await fetch(`${API_BASE_URL}/projects/${activeId}/plan-approvers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApproversList(data);
      } else {
        showToast('Failed to fetch approvers', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(t('networkErrorFetchApprovers'), 'error');
    } finally {
      setIsLoadingApprovers(false);
    }
  };

  const handlePlanSendForApproval = (folderId, plan, version) => {
    setApprovalFolderId(folderId);
    setApprovalDoc({ ...plan, activeVersion: version });
    setSelectedApproverIds([]);
    fetchPlanApprovers();
    setShowApproversModal(true);
  };

  const toggleApprover = (approverId) => {
    setSelectedApproverIds(prev =>
      prev.includes(approverId) ? prev.filter(i => i !== approverId) : [...prev, approverId]
    );
  };

  const handleConfirmApproval = async () => {
    if (selectedApproverIds.length === 0) {
      showToast('Please select at least one approver.', 'error');
      return;
    }
    setShowApproversModal(false);
    try {
      setUpdatingDocId(approvalDoc._id);
      await patchDoc(approvalFolderId, {
        action: 'sendForApproval',
        docId: approvalDoc._id,
        versionId: approvalDoc.activeVersion._id,
        approverIds: selectedApproverIds
      });
      fetchPlanFolders();
    } catch (e) { showToast(e.message, 'error'); }
    finally {
      setUpdatingDocId(null);
      setApprovalDoc(null);
      setApprovalFolderId(null);
      setSelectedApproverIds([]);
    }
  };

  const handlePlanApprove = (folderId, plan, version) => {
    setConfirmModal({
      visible: true,
      title: 'Approve Drawing',
      message: `Approve "${plan.name}" (v${version.versionNumber})? This will notify the project team.`,
      confirmText: 'Approve',
      type: 'success',
      onConfirm: async () => {
        try {
          setUpdatingDocId(plan._id);
          await patchDoc(folderId, {
            action: 'respond',
            docId: plan._id,
            versionId: version._id,
            response: 'Approved'
          });
          fetchPlanFolders();
        } catch (e) { showToast(e.message, 'error'); }
        finally {
          setUpdatingDocId(null);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const openPlanRejectModal = (folderId, plan, version) => {
    setPlanRejectReason('');
    setPlanRejectModal({ visible: true, folderId, doc: { ...plan, activeVersion: version } });
  };

  const submitPlanRejection = async () => {
    if (!planRejectReason.trim()) { showToast('Please provide a reason.', 'error'); return; }
    const { folderId, doc } = planRejectModal;
    setPlanRejectModal({ visible: false, folderId: null, doc: null });
    try {
      setUpdatingDocId(doc._id);
      await patchDoc(folderId, {
        action: 'respond',
        docId: doc._id,
        versionId: doc.activeVersion._id,
        response: 'Rejected',
        note: planRejectReason.trim()
      });
      fetchPlanFolders();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setUpdatingDocId(null); }
  };

  const handleVersionDelete = useCallback((plan, version) => {
    if (plan.versions.length <= 1) {
      showToast('Cannot delete the only version. Delete the document instead.', 'error');
      return;
    }
    setConfirmModal({
      visible: true,
      title: 'Delete Version',
      message: `Delete v${version.versionNumber} of "${plan.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setUpdatingDocId(plan._id);
          await patchDoc(activeFolderId, {
            action: 'deleteVersion',
            docId: plan._id,
            versionId: version._id
          });
          fetchPlanFolders();
          if (historyPlan?._id === plan._id) {
            setHistoryPlan(prev => ({
              ...prev,
              versions: prev.versions.filter(v => v._id !== version._id)
            }));
          }
        } catch (e) { showToast(e.message, 'error'); }
        finally {
          setUpdatingDocId(null);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  }, [activeFolderId, historyPlan, fetchPlanFolders, showToast]);

  const handlePlanDeleteDoc = useCallback((item) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Document',
      message: `Delete "${item.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setUpdatingDocId(item._id);
          await patchDoc(activeFolderId, { action: 'deleteDocument', docId: item._id });
          fetchPlanFolders();
        } catch (e) { showToast(e.message, 'error'); }
        finally {
          setUpdatingDocId(null);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  }, [activeFolderId, activeId, token, fetchPlanFolders]);

  const handleFolderDelete = useCallback((folder) => {
    const fileCount = folder.documents?.length || 0;
    setConfirmModal({
      visible: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete "${folder.name}"? This folder contains ${fileCount} file${fileCount !== 1 ? 's' : ''}. This action cannot be undone.`,
      confirmText: 'Delete Folder',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setUpdatingDocId(folder._id);
          const response = await fetch(`${API_BASE_URL}/projects/${activeId}/folders/${folder._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            showToast(`Folder "${folder.name}" deleted successfully.`, 'success');
            fetchPlanFolders();
          } else {
            const data = await response.json();
            showToast(data.message || 'Failed to delete folder', 'error');
          }
        } catch (e) {
          showToast(t('networkError'), 'error');
        } finally {
          setUpdatingDocId(null);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  }, [activeId, token, fetchPlanFolders, showToast]);

  const handleRevertDraft = useCallback((plan, version) => {
    setConfirmModal({
      visible: true,
      title: 'Revert to Draft',
      message: `Reset "${plan.name}" (v${version.versionNumber}) and clear all approvals?`,
      confirmText: 'Revert',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setUpdatingDocId(plan._id);
          await patchDoc(activeFolderId, {
            action: 'revertToDraft',
            docId: plan._id,
            versionId: version._id
          });
          fetchPlanFolders();
        } catch (e) { showToast(e.message, 'error'); }
        finally {
          setUpdatingDocId(null);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  }, [activeFolderId, activeId, token, fetchPlanFolders]);

  const handleDocApprove = useCallback((item, version) => handlePlanApprove(activeFolderId, item, version), [activeFolderId, handlePlanApprove]);
  const handleDocReject = useCallback((item, version) => openPlanRejectModal(activeFolderId, item, version), [activeFolderId]);
  const handleDocSendApproval = useCallback((item, version) => handlePlanSendForApproval(activeFolderId, item, version), [activeFolderId]);

  const handleViewDocument = useCallback(async (url, name, plan, folderId) => {
    if (!url) {
      showToast('No source URL found for this document.', 'error');
      return;
    }
    const latestVersion = plan.versions?.[plan.versions.length - 1];
    const isImage = latestVersion?.mimeType?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');
    const isPdf = latestVersion?.mimeType === 'application/pdf' ||
      /\.pdf$/i.test(name || '') || /\.pdf($|\?)/i.test(url || '');
    if ((isImage || isPdf) && plan?._id && folderId) {
      router.push({
        pathname: '/annotate-plan',
        params: { url, name, documentId: plan._id, folderId, projectId: activeId, canAnnotate: canAnnotate ? '1' : '0', isPdf: isPdf ? '1' : '0' },
      });
    } else {
      router.push({ pathname: '/document-viewer', params: { url, name } });
    }
  }, [router, activeId, canAnnotate]);

  const activeFolder = useMemo(() => planFolders.find(f => f._id === activeFolderId), [planFolders, activeFolderId]);

  const getVisibleDocsForFolder = useCallback((folder) => {
    if (!folder?.documents) return [];
    return folder.documents.filter(doc => {
      const latest = doc.versions?.[doc.versions.length - 1];
      const isUploader = latest?.uploadedBy === activeCurrentUserId || latest?.uploadedBy?._id === activeCurrentUserId;
      return activeIsAdmin || isUploader || (latest && latest.approvalStatus !== 'Draft');
    }).map(doc => {
      const latest = doc.versions?.[doc.versions.length - 1];
      return {
        ...doc,
        isMyTurn: latest?.approvals?.some(a =>
          (a.user === activeCurrentUserId || a.user?._id === activeCurrentUserId || a.user?.toString() === activeCurrentUserId) &&
          a.status === 'Pending'
        )
      };
    });
  }, [activeIsAdmin, activeCurrentUserId]);

  const visibleDocs = useMemo(() => getVisibleDocsForFolder(activeFolder), [activeFolder, getVisibleDocsForFolder]);

  const filteredVisibleDocs = useMemo(() => {
    return visibleDocs.filter(doc => {
      const latestVersion = doc.versions?.[doc.versions.length - 1];
      const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const docStatus = latestVersion?.approvalStatus || 'Draft';
      const matchesStatus = statusFilter === 'All' || docStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visibleDocs, searchQuery, statusFilter]);

  const filteredFolders = useMemo(() => {
    return planFolders.filter(f => f.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [planFolders, searchQuery]);

  const renderFolder = useCallback(({ item }) => {
    const visibleCount = getVisibleDocsForFolder(item).length;
    return (
      <TouchableOpacity
        style={styles.docCardContainer}
        onPress={() => setActiveFolderId(item._id)}
      >
        <View style={styles.docRow}>
          <View style={[styles.docIconBox, { backgroundColor: '#F0F9FF' }]}>
            <Ionicons name="folder" size={20} color="#0EA5E9" />
          </View>
          <View style={styles.docInfo}>
            <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.docMetaRow}>
              <Text style={styles.docDate}>{visibleCount} Asset{visibleCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={styles.docRightSide}>
            {(canEditPlans || canDeleteDocument) && (
              <>
                {canEditPlans && (
                  <TouchableOpacity
                    style={[styles.docActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setEditingFolderId(item._id);
                      setFolderName(item.name);
                      setShowFolderModal(true);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={14} color="#3B82F6" />
                  </TouchableOpacity>
                )}
                {canDeleteDocument && (
                  <TouchableOpacity
                    style={[styles.docActionBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleFolderDelete(item);
                    }}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </>
            )}
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [getVisibleDocsForFolder, canDeleteDocument, handleFolderDelete]);

  const renderPlan = useCallback(({ item }) => (
    <PlanCard
      item={item}
      folderId={activeFolderId}
      activeIsAdmin={activeIsAdmin}
      canDeleteDocument={canDeleteDocument}
      canAssignPlans={canAssignPlans}
      onDocDelete={handlePlanDeleteDoc}
      onVersionDelete={handleVersionDelete}
      onDocView={handleViewDocument}
      onSendApproval={handleDocSendApproval}
      onRevertDraft={handleRevertDraft}
      onApprove={handleDocApprove}
      onReject={handleDocReject}
      onUploadRevision={(plan) => handleUploadDocument(plan._id)}
      onShowHistory={(plan) => { setHistoryPlan(plan); setShowHistoryModal(true); }}
      isUpdating={updatingDocId === item._id || uploadingRevisionId === item._id}
      uploadingRevisionId={uploadingRevisionId}
      canAnnotate={canAnnotate}
      onAnnotate={openAnnotateModal}
    />
  ), [activeFolderId, activeIsAdmin, canDeleteDocument, canAssignPlans, handlePlanDeleteDoc, handleVersionDelete, handleViewDocument, handleDocSendApproval, handleRevertDraft, handleDocApprove, handleDocReject, handleUploadDocument, updatingDocId, uploadingRevisionId, canAnnotate, openAnnotateModal]);

  if (!canViewPlans) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          You don't have permission to view the Drawing Management module.
        </Text>
      </View>
    );
  }

  if (isInitialLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading drawings...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={!activeFolder ? filteredFolders : filteredVisibleDocs}
        keyExtractor={item => item._id}
        renderItem={!activeFolder ? renderFolder : renderPlan}
        contentContainerStyle={{ paddingBottom: insetsBottom + 80 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={styles.plansHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bentoTitle}>
                  {activeFolder ? activeFolder.name : 'Technical Folders'}
                </Text>
                <Text style={styles.bentoSub} numberOfLines={1}>
                  {activeFolder ? 'Manage and approve folder assets' : 'Manage project drawings and diagrams'}
                </Text>
              </View>
              {activeFolder ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {canCreatePlans && (
                    <TouchableOpacity onPress={() => handleUploadDocument()} style={styles.uploadPill}>
                      {isUploadingDoc ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="cloud-upload" size={14} color="#FFF" />}
                      <Text style={styles.uploadPillText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { setActiveFolderId(null); setSearchQuery(''); setStatusFilter('All'); }} style={styles.backPill}>
                    <Ionicons name="arrow-back" size={14} color="#3B82F6" />
                    <Text style={styles.backPillText}>Back</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {canCreatePlans && (
                    <TouchableOpacity 
                      onPress={() => {
                        setEditingFolderId(null);
                        setFolderName('');
                        setShowFolderModal(true);
                      }} 
                      style={styles.uploadPill}
                    >
                      <Ionicons name="add" size={16} color="#FFF" />
                      <Text style={styles.uploadPillText}>Add Folder</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.filterSection}>
              <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={activeFolder ? "Search drawings..." : "Search folders..."}
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                {activeFolder && (
                  <TouchableOpacity 
                    style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} 
                    onPress={() => setShowFilters(!showFilters)}
                  >
                    <Ionicons name="options" size={20} color={showFilters ? '#FFF' : '#64748B'} />
                  </TouchableOpacity>
                )}
              </View>
              {activeFolder && showFilters && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                  {['All', 'Approved', 'Pending', 'Rejected', 'Draft'].map(status => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                      onPress={() => setStatusFilter(status)}
                    >
                      <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>{status}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: '#94A3B8', marginTop: 20, fontFamily: 'Inter-SemiBold', width: '100%' }}>
              {activeFolder
                ? (activeIsAdmin ? 'No documents in this folder yet.' : 'No drawings sent for approval yet.')
                : 'No folders found.'
              }
            </Text>
          </View>
        }
        key={!activeFolder ? 'folders' : 'docs'} // Force re-render when switching modes to avoid layout issues with numColumns
      />



      {/* CREATE/EDIT FOLDER MODAL */}
      <Modal visible={showFolderModal} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.smallModal}>
            <View style={styles.modalIconBox}><Ionicons name={editingFolderId ? "pencil" : "folder-open"} size={28} color="#3B82F6" /></View>
            <Text style={styles.modalTitle}>{editingFolderId ? 'Update Folder Name' : 'New Drawings Folder'}</Text>
            <Text style={styles.modalSub}>
              {editingFolderId ? 'Rename this folder to keep your documentation organized.' : 'Organize your technical drawings by category or phase.'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Folder Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Phase 1 - Structural"
                value={folderName}
                onChangeText={setFolderName}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowFolderModal(false);
                  setFolderName('');
                  setEditingFolderId(null);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleSaveFolder()}
              >
                <Text style={styles.confirmText}>{editingFolderId ? 'Update Folder' : 'Create Folder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PLAN REJECTION REASON MODAL */}
      <Modal visible={planRejectModal.visible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlayCenter}
        >
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Reject Drawing</Text>
            <Text style={styles.modalSub} numberOfLines={2}>{planRejectModal.doc?.name}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Rejection</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, paddingTop: 12, textAlignVertical: 'top' }]}
                placeholder="e.g. Dimensions don't match agreed layout"
                multiline
                value={planRejectReason}
                onChangeText={setPlanRejectReason}
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlanRejectModal({ visible: false, folderId: null, doc: null })}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#DC2626' }]} onPress={submitPlanRejection}>
                <Text style={styles.confirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SEND FOR APPROVAL MODAL */}
      <Modal visible={showApproversModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowApproversModal(false)} />
          <View style={[styles.modalContent, { minHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Send for Approval</Text>
                <Text style={[styles.bentoSub, { marginTop: 4 }]}>
                  {selectedApproverIds.length > 0
                    ? `${selectedApproverIds.length} selected • all must approve`
                    : 'Select one or more approvers'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowApproversModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {isLoadingApprovers ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={{ marginTop: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8' }}>Fetching approvers...</Text>
              </View>
            ) : approversList.length > 0 ? (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {approversList.map((approver) => {
                  const isSelected = selectedApproverIds.includes(approver._id);
                  const matchingMember = project?.members?.find(m => m._id === approver._id || (m.email && m.email === approver.email)) || 
                                         ((project?.createdBy?._id === approver._id || (project?.createdBy?.email && project?.createdBy?.email === approver.email)) ? project?.createdBy : null);
                  
                  let displayName = approver.name;
                  const isInvalidName = (name) => {
                    if (!name) return true;
                    if (name.includes(':')) return true;
                    if (/^[a-f0-9]{24}$/i.test(name)) return true;
                    return false;
                  };

                  if (matchingMember?.name && !isInvalidName(matchingMember.name)) {
                    displayName = matchingMember.name;
                  } else if (approver.name && !isInvalidName(approver.name)) {
                    displayName = approver.name;
                  } else if (matchingMember?.email) {
                    displayName = matchingMember.email.split('@')[0];
                  } else if (approver.email) {
                    displayName = approver.email.split('@')[0];
                  }

                  if (displayName && displayName.includes('.')) {
                      displayName = displayName.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                  }

                  return (
                    <TouchableOpacity
                      key={approver._id}
                      style={[styles.approverItem, isSelected && styles.approverItemSelected]}
                      activeOpacity={0.7}
                      onPress={() => toggleApprover(approver._id)}
                    >
                      {/* Checkbox */}
                      <View style={[styles.approverCheckbox, isSelected && styles.approverCheckboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={13} color="#FFF" />}
                      </View>
                      <View style={[styles.approverAvatar, isSelected && { backgroundColor: '#8B5CF6' }]}>
                        <Text style={[styles.approverAvatarText, isSelected && { color: '#FFF' }]}>
                          {displayName?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.approverInfo}>
                        <Text style={styles.approverName}>{displayName}</Text>
                        <Text style={styles.approverEmail}>{matchingMember?.email || approver.email}</Text>
                        {approver.roleName && (
                          <View style={styles.approverRolePill}>
                            <Text style={styles.approverRoleText}>{approver.roleName}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 }}>No Approvers Found</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                  No project members have the "Drawing Management → Approve" permission. Ask your admin to assign it.
                </Text>
              </View>
            )}

            {approversList.length > 0 && (
              <TouchableOpacity
                style={[styles.updateTrigger, { opacity: selectedApproverIds.length > 0 ? 1 : 0.5 }]}
                onPress={() => handleConfirmApproval()}
                disabled={selectedApproverIds.length === 0}
              >
                <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.updateGradient}>
                  <Ionicons name="send" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.updateBtnText}>
                    {selectedApproverIds.length > 0 ? `Send to ${selectedApproverIds.length} Approver${selectedApproverIds.length > 1 ? 's' : ''}` : 'Send for Approval'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
      {/* VERSION HISTORY MODAL */}
      <Modal visible={showHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowHistoryModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Version History</Text>
                <Text style={styles.bentoSub}>{historyPlan?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {historyPlan?.versions?.slice().reverse().map((ver, idx) => {
                const sc = STATUS_COLORS[ver.approvalStatus] || STATUS_COLORS.Draft;
                return (
                  <View key={ver._id} style={styles.historyItem}>
                    <View style={styles.historyMeta}>
                      <View style={[styles.versionBadge, { backgroundColor: '#F8FAFF', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                        <Text style={[styles.versionBadgeText, { color: '#3B82F6' }]}>v{ver.versionNumber}</Text>
                      </View>
                      <Text style={styles.historyDate}>
                        {new Date(ver.uploadedAt).toLocaleDateString()} at {new Date(ver.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <View style={styles.historyBody}>
                      <Text style={styles.historyName} numberOfLines={1}>{ver.name}</Text>
                      <View style={[styles.docStatusBadge, { backgroundColor: sc.bg, borderColor: sc.border, marginTop: 8 }]}>
                        <Text style={[styles.docStatusText, { color: sc.text }]}>{ver.approvalStatus}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.historyViewBtn}
                      onPress={() => handleViewDocument(ver.url, ver.name, historyPlan, activeFolderId)}
                    >
                      <Ionicons name="eye-outline" size={18} color="#3B82F6" />
                      <Text style={styles.historyViewText}>View</Text>
                    </TouchableOpacity>

                    {activeIsAdmin && (ver.approvalStatus === 'Draft' || ver.approvalStatus === 'Pending') && historyPlan?.versions?.length > 1 && (
                      <TouchableOpacity
                        style={[styles.historyViewBtn, { backgroundColor: '#FEF2F2', marginLeft: 8 }]}
                        onPress={() => handleVersionDelete(historyPlan, ver)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={!!updatingDocId}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />

      {/* Annotation Modal */}
      <Modal visible={annotationModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Annotations</Text>
                <TouchableOpacity onPress={() => setAnnotationModal({ visible: false, item: null })}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>
              {annotationModal.item && (
                <Text style={styles.modalSub} numberOfLines={1}>{annotationModal.item.name}</Text>
              )}

              <ScrollView style={{ maxHeight: 200, marginTop: 10 }} showsVerticalScrollIndicator={false}>
                {annotations.length === 0 ? (
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingVertical: 16 }}>No annotations yet</Text>
                ) : annotations.map(a => (
                  <View key={a._id} style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B' }}>{a.text}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' }}>{a.createdByName || 'You'} • {new Date(a.createdAt).toLocaleDateString()}</Text>
                      <TouchableOpacity onPress={() => deleteAnnotation(a._id)}>
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={{ marginTop: 12, gap: 10 }}>
                <TextInput
                  style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Add an annotation note..."
                  placeholderTextColor="#94A3B8"
                  value={annotationText}
                  onChangeText={setAnnotationText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.submitBtn, (!annotationText.trim() || isSavingAnnotation) && styles.submitBtnDisabled]}
                  disabled={!annotationText.trim() || isSavingAnnotation}
                  onPress={saveAnnotation}
                >
                  <LinearGradient colors={['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGradient}>
                    {isSavingAnnotation ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={14} color="#FFF" />
                        <Text style={styles.submitBtnText}>Save Note</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 12 },
  tabScrollContent: { gap: 24, paddingBottom: 80 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  plansGrid: { flexDirection: 'column', gap: 12 },
  docCardContainer: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, overflow: 'hidden', marginHorizontal: 20, marginBottom: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  docIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginBottom: 4 },
  docMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  docSize: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  docDot: { fontSize: 11, color: '#CBD5E1', marginHorizontal: 6 },
  docDate: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  docRightSide: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderCol: { alignItems: 'flex-end', gap: 4 },
  docActionBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  approvalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  miniBtn: { flex: 1, minWidth: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  historyBtnLine: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  historyTextLine: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  plansHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#3B82F620' },
  backPillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  uploadPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  uploadPillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center' },
  modalDismiss: { flex: 1 },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%', backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 24 },
  bentoTitle: { fontSize: 20, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  bentoSub: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 4 },
  updateTrigger: { marginTop: 24, borderRadius: 18, overflow: 'hidden' },
  updateGradient: { height: 56, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  updateBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter-Bold' },
  smallModal: { margin: 24, marginBottom: 100, borderRadius: 28, padding: 28, backgroundColor: '#FFF', gap: 20 },
  modalInput: { height: 56, backgroundColor: '#F8FAFF', borderRadius: 16, paddingHorizontal: 16, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  cancelText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  confirmBtn: { flex: 2, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6' },
  confirmText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFF' },
  fab: { position: 'absolute', right: 0, bottom: 20, width: 64, height: 64, borderRadius: 32, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  fabGradient: { width: '100%', height: '100%', borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  modalIconBox: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  approverItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: '#F8FAFF', marginBottom: 10, borderWidth: 1.5, borderColor: '#F1F5F9' },
  approverItemSelected: { borderColor: '#8B5CF6', backgroundColor: '#FAF5FF' },
  approverAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  approverAvatarText: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#64748B' },
  approverInfo: { flex: 1 },
  approverName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  approverEmail: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 2 },
  approverCheckbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#DDD6FE', justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  approverCheckboxSelected: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  approverRolePill: { marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  approverRoleText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 },
  planCardWrapper: { width: (width - 54) / 2 },
  docApprovalBtn: { borderRadius: 10, overflow: 'hidden', marginTop: 8 },
  docApprovalGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 34, gap: 6, borderRadius: 10 },
  docApprovalText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  docStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  docStatusText: { fontSize: 10, fontFamily: 'Inter-SemiBold' },
  docRejectNote: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#DC2626', marginBottom: 6, lineHeight: 15 },
  docActionRow: { flexDirection: 'column', gap: 6, marginTop: 8 },
  docActionHalf: { width: '100%', height: 34, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cardDeleteBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, width: 24, height: 24, borderRadius: 8, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  folderActionBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3B82F640' },
  folderActionContainer: { position: 'absolute', top: 12, right: 12, zIndex: 10, flexDirection: 'row', gap: 6 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginLeft: 4 },

  // Versioning Styles
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  versionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  versionBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#FFF' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  historyText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },

  // History Modal Styles
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFF', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  historyMeta: { flex: 1, gap: 4 },
  historyDate: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  historyBody: { flex: 2, justifyContent: 'center' },
  historyName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  historyViewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  historyViewText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  filterSection: { gap: 12, marginBottom: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 8 },
  filterToggleBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  filterToggleBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', height: '100%' },
  filterChips: { maxHeight: 32 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },
});
