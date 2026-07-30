import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform, TextInput, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';
import * as DocumentPicker from 'expo-document-picker';
const AdaptiveGlass = ({ style, children }) => <View style={[{ backgroundColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden' }, style]}>{children}</View>;
import { useAuth } from '../../context/AuthContext';

import { ActivityIndicator } from 'react-native';
import cloudinaryService from '../../services/cloudinaryService';

import { useRouter } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import { formatCompact, formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, hasAnyProjectPermissionPrefix, isProjectLocked } from '../../utils/permissions';
import { useSocket } from '../../context/SocketContext';

export default function ProjectDocumentsTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const { token, user } = useAuth();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !fetchProjectData) return;
    socket.on('documents:updated', fetchProjectData);
    return () => socket.off('documents:updated', fetchProjectData);
  }, [socket, fetchProjectData]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [virtualFolders, setVirtualFolders] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  useEffect(() => {
    const fetchModuleDocuments = async () => {
      if (!project || !project._id) return;
      setIsLoadingFolders(true);
      try {
        const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
        
        const [txRes, matRes, snagRes, mileRes, progRes, survRes] = await Promise.all([
          fetch(`${API_BASE_URL}/projects/${project._id}/transactions`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_BASE_URL}/projects/${project._id}/material-purchase`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_BASE_URL}/projects/${project._id}/snags`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_BASE_URL}/projects/${project._id}/milestones`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_BASE_URL}/projects/${project._id}/progress`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_BASE_URL}/projects/${project._id}/survey`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
        ]);

        let txDocs = [];
        if (txRes && txRes.ok) {
          const txs = await txRes.json();
          if(Array.isArray(txs)) txs.forEach(t => {
            if (t.invoiceUrl) txDocs.push({ _id: t._id, name: `Invoice ${t.type || 'Tx'}`, url: t.invoiceUrl, uploadedAt: t.createdAt, size: 0, mimeType: 'application/pdf', status: 'Approved', uploadedBy: { name: 'System' } });
          });
        }
        if (matRes && matRes.ok) {
          const matTxs = await matRes.json();
          if(Array.isArray(matTxs)) matTxs.forEach(t => {
            if (t.invoiceUrl) txDocs.push({ _id: t._id, name: `Material Invoice`, url: t.invoiceUrl, uploadedAt: t.createdAt, size: 0, mimeType: 'application/pdf', status: 'Approved', uploadedBy: { name: 'System' } });
          });
        }

        let snagDocs = [];
        if (snagRes && snagRes.ok) {
          const snags = await snagRes.json();
          if(Array.isArray(snags)) snags.forEach(s => {
            if (s.images && s.images.length > 0) {
              s.images.forEach((img, idx) => snagDocs.push({ _id: `${s._id}_${idx}`, name: `${s.title} Photo ${idx+1}`, url: img, uploadedAt: s.createdAt, size: 0, mimeType: 'image/jpeg', status: 'Approved', uploadedBy: { name: 'System' } }));
            }
            if (s.resolutionImage) {
              snagDocs.push({ _id: `${s._id}_res`, name: `${s.title} Resolution`, url: s.resolutionImage, uploadedAt: s.updatedAt || s.createdAt, size: 0, mimeType: 'image/jpeg', status: 'Approved', uploadedBy: { name: 'System' } });
            }
          });
        }

        let mileDocs = [];
        if (mileRes && mileRes.ok) {
          const milestones = await mileRes.json();
          if(Array.isArray(milestones)) milestones.forEach(m => {
            if (m.tasks) {
              m.tasks.forEach(t => {
                if (t.proofImage && t.proofImage.url) {
                  mileDocs.push({ _id: t._id, name: `${t.title} Proof`, url: t.proofImage.url, uploadedAt: t.proofImage.uploadedAt || m.createdAt, size: 0, mimeType: 'image/jpeg', status: 'Approved', uploadedBy: { name: 'System' } });
                }
              });
            }
          });
        }

        let progDocs = [];
        if (progRes && progRes.ok) {
          const progresses = await progRes.json();
          if(Array.isArray(progresses)) progresses.forEach(p => {
            if (p.photos && p.photos.length > 0) {
              p.photos.forEach((img, idx) => progDocs.push({ _id: `${p._id}_${idx}`, name: `Progress Photo ${idx+1}`, url: img, uploadedAt: p.createdAt, size: 0, mimeType: 'image/jpeg', status: 'Approved', uploadedBy: { name: 'System' } }));
            }
          });
        }

        let survDocs = [];
        if (survRes && survRes.ok) {
          const survey = await survRes.json();
          if (survey) {
            if (survey.attachments) survey.attachments.forEach((a, idx) => survDocs.push({ _id: `${survey._id}_a${idx}`, name: a.name || 'Survey Attachment', url: a.url, uploadedAt: survey.createdAt, size: 0, mimeType: 'application/octet-stream', status: 'Approved', uploadedBy: { name: 'System' } }));
            if (survey.observationImage && survey.observationImage.url) survDocs.push({ _id: `${survey._id}_obs`, name: 'Observation Image', url: survey.observationImage.url, uploadedAt: survey.createdAt, size: 0, mimeType: 'image/jpeg', status: 'Approved', uploadedBy: { name: 'System' } });
            if (survey.additionalPhotos) survey.additionalPhotos.forEach((img, idx) => survDocs.push({ _id: `${survey._id}_p${idx}`, name: `Additional Photo ${idx+1}`, url: img, uploadedAt: survey.createdAt, size: 0, mimeType: 'image/jpeg', status: 'Approved', uploadedBy: { name: 'System' } }));
          }
        }

        const folders = [];
        if (txDocs.length > 0) folders.push({ id: 'transactions', name: 'Transactions', icon: 'receipt-outline', color: '#10B981', documents: txDocs });
        if (snagDocs.length > 0) folders.push({ id: 'snagging', name: 'Snagging', icon: 'warning-outline', color: '#F59E0B', documents: snagDocs });
        if (mileDocs.length > 0) folders.push({ id: 'milestones', name: 'Milestones', icon: 'flag-outline', color: '#8B5CF6', documents: mileDocs });
        if (progDocs.length > 0) folders.push({ id: 'progress', name: 'Work Progress', icon: 'analytics-outline', color: '#0EA5E9', documents: progDocs });
        if (survDocs.length > 0) folders.push({ id: 'survey', name: 'Site Survey', icon: 'map-outline', color: '#6366F1', documents: survDocs });

        setVirtualFolders(folders);
      } catch (err) {
        console.error('Error fetching module docs:', err);
      } finally {
        setIsLoadingFolders(false);
      }
    };

    fetchModuleDocuments();
  }, [project?._id, token]);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  const isAdmin = user?.role?.name === 'Admin';
  const canView = isAdmin || hasAnyProjectPermissionPrefix(user, project, 'land:');
  const isLocked = isProjectLocked(project);
  const canUpload = !isLocked && (isAdmin || hasProjectPermission(user, project, 'land:create'));
  const canApprove = !isLocked && (isAdmin || hasProjectPermission(user, project, 'land:approve'));
  const canDelete = !isLocked && (isAdmin || hasProjectPermission(user, project, 'land:delete'));

  const handleDocumentAction = (docId, action) => {
    setConfirmModal({
      visible: true,
      title: `${action} Document`,
      message: `Are you sure you want to ${action.toLowerCase()} this compliance document?`,
      confirmText: action,
      type: action === 'Approved' ? 'success' : 'destructive',
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
          const res = await fetch(`${API_BASE_URL}/projects/${project._id}/documents/${docId}/action`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action })
          });

          if (res.ok) {
            showToast(`Document ${action.toLowerCase()} successfully`, 'success');
            if (fetchProjectData) fetchProjectData();
          } else {
            const err = await res.json();
            showToast(err.message || `Failed to ${action.toLowerCase()} document`, 'error');
          }
        } catch (error) {
          console.error('Action error:', error);
          showToast(t('errorPerformingAction'), 'error');
        } finally {
          setIsProcessing(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleDeleteDocument = (docId, name) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Document',
      message: `Are you sure you want to permanently delete "${name}"?`,
      confirmText: 'Delete',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
          const res = await fetch(`${API_BASE_URL}/projects/${project._id}/documents/${docId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (res.ok) {
            showToast('Document deleted successfully', 'success');
            if (fetchProjectData) await fetchProjectData();
          } else {
            const err = await res.json();
            showToast(err.message || 'Failed to delete document', 'error');
          }
        } catch (error) {
          showToast(t('errorDeletingDocument'), 'error');
        } finally {
          setIsProcessing(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      setIsUploading(true);
      const file = result.assets[0];

      // 1. Upload to Cloudinary using existing service
      const secureUrl = await cloudinaryService.uploadFile(
        file.uri,
        file.name,
        file.mimeType || 'application/octet-stream'
      );

      // 2. Save to Backend
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: secureUrl,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size
        })
      });

      if (res.ok) {
        showToast('Document uploaded successfully', 'success');
        if (fetchProjectData) fetchProjectData();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to save document', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast(t('errorUploadingDocument'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDocument = async (url, name, mimeType) => {
    if (!url) {
      showToast('No source URL found for this document.', 'error');
      return;
    }
    router.push({ pathname: '/project-document-viewer', params: { url, name, mimeType } });
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 }}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 }}>{t('accessRestricted')}</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          {t('noPermissionDocs')}
        </Text>
      </View>
    );
  }

  let baseDocuments = [];
  const isVirtualFolder = activeFolderId && activeFolderId !== 'project_docs';
  
  if (isVirtualFolder) {
    const vFolder = virtualFolders.find(f => f.id === activeFolderId);
    if (vFolder) baseDocuments = vFolder.documents;
  } else {
    baseDocuments = project?.documents || [];
  }

  const filteredDocuments = baseDocuments.filter(doc => {
    const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const docStatus = doc.status || 'Pending';
    const matchesStatus = statusFilter === 'All' || docStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={styles.tabScrollContent}>
      <View style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{t('Documents')}</Text>
          {canUpload && !isVirtualFolder && (
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => handleUploadDocument()}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={16} color="#3B82F6" />
                  <Text style={styles.uploadBtnText}>{t('upload')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchDocuments')}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity 
              style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} 
              onPress={() => setShowFilters(!showFilters)}
            >
              <Ionicons name="options" size={20} color={showFilters ? '#FFF' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {showFilters && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              {['All', 'Approved', 'Pending', 'Rejected'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                  onPress={() => {
                    setStatusFilter(status);
                    setShowFilters(false);
                  }}
                >
                  <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>{t(status.toLowerCase(), status)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={styles.plansGrid}>
        {!activeFolderId ? (
          <>
            <TouchableOpacity
              style={styles.docCardContainer}
              onPress={() => setActiveFolderId('project_docs')}
            >
              <View style={styles.docRow}>
                <View style={[styles.docIconBox, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="folder" size={20} color="#0EA5E9" />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>Project Documents</Text>
                  <View style={styles.docMetaRow}>
                    <Text style={styles.docDate}>{filteredDocuments.length} Asset{filteredDocuments.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={styles.docRightSide}>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 4 }} />
                </View>
              </View>
            </TouchableOpacity>
          
          {isLoadingFolders ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 20 }} />
          ) : (
            virtualFolders.map(folder => (
              <TouchableOpacity
                key={folder.id}
                style={styles.docCardContainer}
                onPress={() => setActiveFolderId(folder.id)}
              >
                <View style={styles.docRow}>
                  <View style={[styles.docIconBox, { backgroundColor: '#F8FAFF' }]}>
                    <Ionicons name={folder.icon} size={20} color={folder.color} />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>{folder.name}</Text>
                    <View style={styles.docMetaRow}>
                      <Text style={styles.docDate}>{folder.documents.length} Asset{folder.documents.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.docRightSide}>
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 4 }} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }} 
              onPress={() => setActiveFolderId(null)}
            >
              <Ionicons name="arrow-back" size={20} color="#64748B" />
              <Text style={{ fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' }}>Back to Folders</Text>
            </TouchableOpacity>

            {filteredDocuments.length > 0 ? (
          filteredDocuments.map((doc, i) => (
            <View key={i} style={styles.docCardContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleViewDocument(doc.url, doc.name, doc.mimeType)}
                style={styles.docRow}
              >
                <View style={styles.docIconBox}>
                  <Ionicons name={doc.name?.toLowerCase().endsWith('.pdf') ? "document-text" : "image"} size={20} color="#3B82F6" />
                </View>
                
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1} ellipsizeMode="tail">{doc.name}</Text>
                  <View style={styles.docMetaRow}>
                    <Text style={styles.docSize}>{(doc.size / 1024).toFixed(1)} KB</Text>
                    <Text style={styles.docDot}>•</Text>
                    <Text style={styles.docDate}>{new Date(doc.uploadedAt).toLocaleDateString()}</Text>
                    <Text style={styles.docDot}>•</Text>
                    <Text style={styles.docDate} numberOfLines={1}>{doc.uploadedBy?.name || 'System'}</Text>
                  </View>
                </View>

                <View style={styles.docRightSide}>
                  <View style={[styles.statusBadge, { backgroundColor: doc.status === 'Approved' ? '#DEF7EC' : doc.status === 'Rejected' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: doc.status === 'Approved' ? '#059669' : doc.status === 'Rejected' ? '#DC2626' : '#D97706' }]}>{doc.status || 'Pending'}</Text>
                  </View>

                  {canDelete && !isVirtualFolder && doc.status !== 'Approved' && (
                    <TouchableOpacity 
                      style={styles.docActionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc._id, doc.name);
                      }}
                    >
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>

              {/* Action Buttons for Approvers */}
              {!isVirtualFolder && doc.status === 'Pending' && canApprove && (isAdmin || String(doc.uploadedBy?.user || doc.uploadedBy) !== String(user?.id)) && (
                <View style={styles.approvalRow}>
                  <TouchableOpacity
                    style={[styles.miniBtn, styles.rejectBtn]}
                    onPress={() => handleDocumentAction(doc._id, 'Rejected')}
                  >
                    <Ionicons name="close" size={14} color="#EF4444" />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniBtn, styles.approveBtn]}
                    onPress={() => handleDocumentAction(doc._id, 'Approved')}
                  >
                    <Ionicons name="checkmark" size={14} color="#059669" />
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <AdaptiveGlass intensity={10} tint="light" style={[styles.bentoCard, styles.bentoWide, { alignItems: 'center', paddingVertical: 40 }]}>
            <Ionicons name="document-lock-outline" size={48} color="#CBD5E1" />
            <Text style={[styles.bentoTitle, { fontSize: 18, marginTop: 16, marginBottom: 4 }]}>{t('noComplianceData')}</Text>
            <Text style={styles.bentoSub}>{t('uploadLandRecords')}</Text>
          </AdaptiveGlass>
        )}
          </>
        )}
      </View>
      <ConfirmModal 
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={isProcessing}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabScrollContent: { gap: 18, paddingBottom: 20 },
  sectionLabel: { fontSize: 22, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginBottom: 4 },
  plansGrid: { flexDirection: 'column', gap: 12 },
  docCardContainer: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, overflow: 'hidden' },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  docIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginBottom: 4 },
  docMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  docSize: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  docDot: { fontSize: 11, color: '#CBD5E1', marginHorizontal: 6 },
  docDate: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  docRightSide: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docActionBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  approvalRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  bentoCard: { flex: 1, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  bentoWide: { minWidth: '100%', marginTop: 10 },
  bentoTitle: { fontSize: 20, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  bentoSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  uploadBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 12 },
  lockTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 },
  lockSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },

  miniBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  rejectBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  approveBtn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  rejectText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#EF4444' },
  approveText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#059669' },

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
