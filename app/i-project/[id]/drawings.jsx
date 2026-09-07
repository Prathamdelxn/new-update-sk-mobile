import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

// ---------------------------------------------------------------------------
// File Type Detection & Badging (Mirrors Web detectDrawingFileType & getFileTypeBadge)
// ---------------------------------------------------------------------------
export function detectDrawingFileType(fileName = '', url = '') {
  const getExt = (str) => {
    if (!str) return '';
    const clean = str.split('?')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  };
  const ext = getExt(url) || getExt(fileName);
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'hdr'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['dwg', 'skp', 'obj', 'fbx', '3ds', 'dae', 'blend', 'rvt', 'rfa', 'ifc', 'gltf', 'glb', 'max'].includes(ext)) return '3d-model';
  if (['dxf'].includes(ext)) return 'cad-2d';
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return 'archive';
  return 'other';
}

export function getFileTypeBadge(fileName = '', url = '', drawingType = '2D') {
  const getExt = (str) => {
    if (!str) return '';
    const clean = str.split('?')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : '';
  };
  const ext = getExt(url) || getExt(fileName);
  const type = detectDrawingFileType(fileName, url);

  if (ext === 'DWG') {
    return {
      label: drawingType === '3D' ? '3D DWG' : '2D DWG',
      color: drawingType === '3D' ? '#7C3AED' : '#2563EB',
      bg: drawingType === '3D' ? '#F5F3FF' : '#EFF6FF',
      icon: drawingType === '3D' ? 'cube-outline' : 'layers-outline',
    };
  }
  if (type === 'image') {
    return {
      label: ext || 'RENDER',
      color: '#059669',
      bg: '#ECFDF5',
      icon: 'image-outline',
    };
  }
  if (type === 'pdf') {
    return {
      label: 'PDF DOC',
      color: '#DC2626',
      bg: '#FEF2F2',
      icon: 'document-text-outline',
    };
  }
  if (type === '3d-model') {
    return {
      label: ext || '3D MODEL',
      color: '#7C3AED',
      bg: '#F5F3FF',
      icon: 'cube-outline',
    };
  }
  if (type === 'cad-2d') {
    return {
      label: ext || '2D CAD',
      color: '#2563EB',
      bg: '#EFF6FF',
      icon: 'layers-outline',
    };
  }
  if (type === 'archive') {
    return {
      label: ext || 'ARCHIVE',
      color: '#0891B2',
      bg: '#ECFEFF',
      icon: 'folder-outline',
    };
  }
  return {
    label: ext || (drawingType === '3D' ? '3D FILE' : '2D PLAN'),
    color: '#64748B',
    bg: '#F1F5F9',
    icon: 'document-outline',
  };
}

const DISCIPLINE_OPTIONS = [
  { value: 'Architectural', label: 'Architectural Plan' },
  { value: 'Electrical', label: 'Electrical & Lighting' },
  { value: 'Plumbing', label: 'Plumbing & Drainage' },
  { value: 'HVAC', label: 'HVAC / Ventilation' },
  { value: 'Carpentry', label: 'Carpentry & Millwork' },
  { value: 'Joinery', label: 'Joinery / Wardrobes' },
  { value: 'GFC', label: 'GFC (Issued for Construction)' },
  { value: 'Shop', label: 'Shop Drawing' },
  { value: 'Tender', label: 'Tender Drawing' },
  { value: '3D Visual', label: '3D Visual / Render' },
  { value: 'As-Built', label: 'As-Built Drawing' },
];

const STATUS_META = {
  approved: { label: 'Approved', color: '#16A34A', bg: '#F0FDF4' },
  under_review: { label: 'Under Review', color: '#2563EB', bg: '#EFF6FF' },
  submitted: { label: 'Submitted', color: '#2563EB', bg: '#EFF6FF' },
  draft: { label: 'Draft', color: '#D97706', bg: '#FFFBEB' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
};

async function pickFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'application/acad', 'image/vnd.dwg', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export default function InteriorDrawingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState('2D'); // '2D' | '3D'
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded revisions tracking
  const [expandedDwgId, setExpandedDwgId] = useState(null);

  // Lightbox
  const [lightboxFile, setLightboxFile] = useState(null);

  // Modal: Register Drawing
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createType, setCreateType] = useState('2D'); // '2D' | '3D'
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('Architectural');
  const [selectedFile, setSelectedFile] = useState(null);

  // Modal: Upload Revision
  const [revTarget, setRevTarget] = useState(null);
  const [revTargetTitle, setRevTargetTitle] = useState('');
  const [revName, setRevName] = useState('');
  const [revChanges, setRevChanges] = useState('');
  const [revFile, setRevFile] = useState(null);

  const fetchDrawings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/drawings`);
      setDrawings(res?.success && res?.data ? res.data : Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load drawings', e);
      showToast('Failed to fetch Drawings register', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useFocusEffect(useCallback(() => { fetchDrawings(); }, [fetchDrawings]));

  // Infer 2D vs 3D type
  const inferType = (d) => {
    if (d.drawingType === '2D' || d.drawingType === '3D') return d.drawingType;
    const disc = (d.discipline || '').toLowerCase();
    const titleLower = (d.title || '').toLowerCase();
    const dwgNum = (d.drawingNumber || '').toLowerCase();
    const latestUrl = d.revisions?.[d.revisions.length - 1]?.url || '';
    const fileType = detectDrawingFileType(titleLower, latestUrl);

    if (
      disc.includes('3d') ||
      disc.includes('render') ||
      disc.includes('model') ||
      titleLower.includes('3d') ||
      titleLower.includes('render') ||
      titleLower.includes('model') ||
      titleLower.includes('perspective') ||
      dwgNum.includes('3d') ||
      fileType === '3d-model'
    ) {
      return '3D';
    }
    return '2D';
  };

  // Stats Counters
  const count2D = useMemo(() => drawings.filter((d) => inferType(d) === '2D').length, [drawings]);
  const count3D = useMemo(() => drawings.filter((d) => inferType(d) === '3D').length, [drawings]);
  const approvedCount = useMemo(() => drawings.filter((d) => d.status === 'approved').length, [drawings]);
  const underReviewCount = useMemo(
    () => drawings.filter((d) => ['under_review', 'submitted', 'draft'].includes(d.status)).length,
    [drawings]
  );

  // Filtered List
  const filteredDrawings = useMemo(() => {
    return drawings.filter((d) => {
      const type = inferType(d);
      if (type !== activeCategory) return false;

      if (selectedStatus !== 'all' && d.status !== selectedStatus) return false;

      if (selectedDiscipline !== 'all') {
        const dDisc = (d.discipline || '').toLowerCase();
        if (dDisc !== selectedDiscipline.toLowerCase()) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = d.title?.toLowerCase().includes(q);
        const matchesNum = d.drawingNumber?.toLowerCase().includes(q);
        const matchesChanges = d.revisions?.some((r) => r.changes?.toLowerCase().includes(q));
        if (!matchesTitle && !matchesNum && !matchesChanges) return false;
      }

      return true;
    });
  }, [drawings, activeCategory, selectedStatus, selectedDiscipline, searchQuery]);

  // Actions
  const closeCreate = () => {
    setIsCreateOpen(false);
    setTitle('');
    setDiscipline('Architectural');
    setSelectedFile(null);
    setCreateType('2D');
  };

  const closeRev = () => {
    setRevTarget(null);
    setRevTargetTitle('');
    setRevChanges('');
    setRevFile(null);
  };

  const handlePickCreateFile = async () => {
    const asset = await pickFile();
    if (asset) setSelectedFile(asset);
  };

  const handlePickRevFile = async () => {
    const asset = await pickFile();
    if (asset) setRevFile(asset);
  };

  const handleSubmitDrawing = async () => {
    if (!title.trim()) return showToast('Please enter drawing title', 'error');
    if (!selectedFile) return showToast('Please select a drawing file to upload', 'error');

    setSubmitting(true);
    try {
      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/drawings/upload`, {
        file: { uri: selectedFile.uri, name: selectedFile.name, type: selectedFile.mimeType || 'application/octet-stream' },
      });
      if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error('Drawing upload failed');

      await interiorApiClient.post(`/projects/${projectId}/drawings`, {
        title: title.trim(),
        discipline,
        drawingType: createType,
        fileUrl: uploadRes.data.url,
      });

      showToast('Drawing registered successfully!', 'success');
      closeCreate();
      fetchDrawings();
    } catch (e) {
      showToast(e.message || 'Failed to register drawing', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openRevModal = (dwg) => {
    setRevTarget(dwg._id);
    setRevTargetTitle(dwg.title);
    setRevName(`Rev ${dwg.revisions?.length || 1}`);
    setRevChanges('');
    setRevFile(null);
  };

  const handleSubmitRevision = async () => {
    if (!revChanges.trim()) return showToast('Please describe the revision changes', 'error');
    if (!revFile) return showToast('Please select a revision file to upload', 'error');

    setSubmitting(true);
    try {
      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/drawings/upload`, {
        file: { uri: revFile.uri, name: revFile.name, type: revFile.mimeType || 'application/octet-stream' },
      });
      if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error('Revision upload failed');

      await interiorApiClient.put(`/projects/${projectId}/drawings`, {
        drawingId: revTarget,
        revisionName: revName,
        changes: revChanges.trim(),
        fileUrl: uploadRes.data.url,
      });

      showToast('New revision uploaded successfully!', 'success');
      closeRev();
      fetchDrawings();
    } catch (e) {
      showToast(e.message || 'Failed to upload revision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (dwg, status) => {
    try {
      await interiorApiClient.put(`/projects/${projectId}/drawings`, { drawingId: dwg._id, status });
      showToast(`Drawing status updated to: ${status.replace('_', ' ')}`, 'success');
      fetchDrawings();
    } catch (e) {
      showToast(e.message || 'Failed to update approval status', 'error');
    }
  };

  const handleDeleteDrawing = (dwg) => {
    Alert.alert(
      'Delete Drawing',
      `Are you sure you want to permanently delete "${dwg.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await interiorApiClient.delete(`/projects/${projectId}/drawings?drawingId=${dwg._id}`);
              showToast('Drawing deleted successfully', 'success');
              fetchDrawings();
            } catch (e) {
              showToast(e.message || 'Failed to delete drawing', 'error');
            }
          },
        },
      ]
    );
  };

  const handleOpenOrPreview = (fileUrl, titleStr) => {
    if (!fileUrl) return;
    const fileType = detectDrawingFileType(titleStr, fileUrl);
    if (fileType === 'image') {
      setLightboxFile({ url: fileUrl, title: titleStr });
    } else {
      Linking.openURL(fileUrl);
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* --- HEADER --- */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Drawings & Blueprints</Text>
            <Text style={s.headerSub}>Architectural 2D CAD layouts & 3D visual concepts</Text>
          </View>
        </View>

        {/* --- CATEGORY SEGMENTED TABS (2D vs 3D) --- */}
        <View style={s.categorySegmentRow}>
          <TouchableOpacity
            style={[s.categoryTab, activeCategory === '2D' && s.categoryTabActive]}
            onPress={() => setActiveCategory('2D')}
          >
            <Ionicons
              name="layers-outline"
              size={15}
              color={activeCategory === '2D' ? '#2563EB' : '#64748B'}
            />
            <Text style={[s.categoryTabText, activeCategory === '2D' && s.categoryTabTextActive]}>
              2D Working Drawings ({count2D})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.categoryTab, activeCategory === '3D' && s.categoryTabActive]}
            onPress={() => setActiveCategory('3D')}
          >
            <Ionicons
              name="cube-outline"
              size={15}
              color={activeCategory === '3D' ? '#7C3AED' : '#64748B'}
            />
            <Text style={[s.categoryTabText, activeCategory === '3D' && s.categoryTabTextActive]}>
              3D Concepts & Renders ({count3D})
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- KPI STATS BANNER --- */}
        <View style={s.statsBanner}>
          <View style={s.statItem}>
            <Text style={s.statNumber}>{drawings.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNumber, { color: '#2563EB' }]}>{count2D}</Text>
            <Text style={s.statLabel}>2D Plans</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNumber, { color: '#7C3AED' }]}>{count3D}</Text>
            <Text style={s.statLabel}>3D Renders</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNumber, { color: '#16A34A' }]}>{approvedCount}</Text>
            <Text style={s.statLabel}>Approved</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNumber, { color: '#D97706' }]}>{underReviewCount}</Text>
            <Text style={s.statLabel}>Review</Text>
          </View>
        </View>

        {/* --- SEARCH & STATUS FILTER ROW --- */}
        <View style={s.searchRow}>
          <View style={s.searchInputBox}>
            <Ionicons name="search-outline" size={15} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search by drawing #, title, or changes..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* --- STATUS FILTER CHIPS --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusChipsRow}>
          {[
            { id: 'all', label: 'All Status' },
            { id: 'approved', label: 'Approved ✓' },
            { id: 'under_review', label: 'Under Review' },
            { id: 'rejected', label: 'Rejected' },
          ].map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[s.filterChip, selectedStatus === st.id && s.filterChipActive]}
              onPress={() => setSelectedStatus(st.id)}
            >
              <Text style={[s.filterChipText, selectedStatus === st.id && s.filterChipTextActive]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* --- DRAWINGS LIST --- */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {filteredDrawings.length === 0 ? (
              <View style={s.empty}>
                <Ionicons
                  name={activeCategory === '3D' ? 'cube-outline' : 'layers-outline'}
                  size={44}
                  color="#CBD5E1"
                />
                <Text style={s.emptyTitle}>
                  No {activeCategory === '3D' ? '3D Models & Renders' : '2D Working Drawings'} Found
                </Text>
                <Text style={s.emptySub}>
                  {searchQuery ? 'Try clearing your search query' : 'Tap the + button below to upload blueprints'}
                </Text>
              </View>
            ) : (
              filteredDrawings.map((dwg) => {
                const revisions = dwg.revisions || [];
                const currentRev = revisions[revisions.length - 1] || {};
                const meta = STATUS_META[dwg.status] || STATUS_META.submitted;
                const fileBadge = getFileTypeBadge(dwg.title, currentRev.url, activeCategory);
                const isExpanded = expandedDwgId === dwg._id;
                const isImage = detectDrawingFileType(dwg.title, currentRev.url) === 'image';

                return (
                  <View key={dwg._id} style={s.dwgCard}>
                    {/* Top Row: DWG Number, File Type Badge, Status */}
                    <View style={s.dwgTopRow}>
                      <View style={s.dwgNumBadge}>
                        <Text style={s.dwgNumber}>{dwg.drawingNumber || 'DWG-XXXX'}</Text>
                      </View>

                      {/* File format badge */}
                      <View style={[s.fileTypeBadge, { backgroundColor: fileBadge.bg }]}>
                        <Ionicons name={fileBadge.icon} size={11} color={fileBadge.color} />
                        <Text style={[s.fileTypeBadgeText, { color: fileBadge.color }]}>{fileBadge.label}</Text>
                      </View>

                      {/* Discipline */}
                      <View style={s.disciplineTag}>
                        <Text style={s.disciplineTagText}>{dwg.discipline || 'General'}</Text>
                      </View>

                      {/* Status */}
                      <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[s.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>

                    {/* Title */}
                    <Text style={s.dwgTitle}>{dwg.title}</Text>

                    {/* Latest Revision Details */}
                    <View style={s.latestRevRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="git-branch-outline" size={13} color="#2563EB" />
                        <Text style={s.latestRevText}>
                          Current: <Text style={{ fontFamily: 'Inter-Bold' }}>{currentRev.revision || 'R0'}</Text>
                        </Text>
                      </View>
                      {currentRev.createdAt && (
                        <Text style={s.revDate}>
                          {new Date(currentRev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                    </View>

                    {!!currentRev.changes && (
                      <View style={s.changesBox}>
                        <Text style={s.changesLabel}>Notes:</Text>
                        <Text style={s.dwgChanges} numberOfLines={2}>{currentRev.changes}</Text>
                      </View>
                    )}

                    {/* Expandable Revisions Accordion */}
                    {revisions.length > 1 && (
                      <TouchableOpacity
                        style={s.historyToggleBtn}
                        onPress={() => setExpandedDwgId(isExpanded ? null : dwg._id)}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color="#2563EB"
                        />
                        <Text style={s.historyToggleText}>
                          {isExpanded ? 'Hide' : 'View'} Version History ({revisions.length} revisions)
                        </Text>
                      </TouchableOpacity>
                    )}

                    {isExpanded && (
                      <View style={s.historyContainer}>
                        {revisions.slice().reverse().map((rev, idx) => (
                          <View key={idx} style={s.historyRow}>
                            <View style={s.historyBullet} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={s.historyRevName}>{rev.revision || `R${revisions.length - idx - 1}`}</Text>
                                {rev.createdAt && (
                                  <Text style={s.historyDate}>
                                    {new Date(rev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </Text>
                                )}
                              </View>
                              {!!rev.changes && <Text style={s.historyChanges}>{rev.changes}</Text>}
                              {rev.url && (
                                <TouchableOpacity
                                  style={s.historyDownloadLink}
                                  onPress={() => handleOpenOrPreview(rev.url, dwg.title)}
                                >
                                  <Ionicons name="open-outline" size={11} color="#2563EB" />
                                  <Text style={s.historyDownloadText}>Open File</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Actions Row */}
                    <View style={s.actionsRow}>
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                        onPress={() => handleOpenOrPreview(currentRev.url, dwg.title)}
                      >
                        <Ionicons name={isImage ? 'eye-outline' : 'open-outline'} size={13} color="#2563EB" />
                        <Text style={[s.actionBtnText, { color: '#2563EB' }]}>{isImage ? 'Preview' : 'Open'}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.actionBtn}
                        onPress={() => openRevModal(dwg)}
                      >
                        <Ionicons name="cloud-upload-outline" size={13} color="#475569" />
                        <Text style={s.actionBtnText}>+ Revision</Text>
                      </TouchableOpacity>

                      {dwg.status !== 'approved' && (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}
                          onPress={() => updateStatus(dwg, 'approved')}
                        >
                          <Ionicons name="checkmark-circle-outline" size={13} color="#16A34A" />
                          <Text style={[s.actionBtnText, { color: '#16A34A' }]}>Approve</Text>
                        </TouchableOpacity>
                      )}

                      {dwg.status !== 'rejected' && (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                          onPress={() => updateStatus(dwg, 'rejected')}
                        >
                          <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                          <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Reject</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[s.actionBtn, { borderColor: '#F1F5F9', marginLeft: 'auto' }]}
                        onPress={() => handleDeleteDrawing(dwg)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* --- FLOATING REGISTER DRAWING BUTTON --- */}
        <TouchableOpacity
          style={[s.fab, activeCategory === '3D' && { backgroundColor: '#7C3AED', shadowColor: '#7C3AED' }]}
          onPress={() => {
            setCreateType(activeCategory);
            setDiscipline(activeCategory === '3D' ? '3D Visual' : 'Architectural');
            setIsCreateOpen(true);
          }}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Register Design Drawing */}
      {/* ========================================================================= */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={closeCreate}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Register Blueprint / Drawing</Text>
                <Text style={s.modalSubtitle}>Upload working CAD drawings, specifications or renders</Text>
              </View>
              <TouchableOpacity onPress={closeCreate} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category selector */}
              <Text style={s.label}>Drawing Classification *</Text>
              <View style={s.createTypeSwitchRow}>
                <TouchableOpacity
                  style={[s.createTypeOption, createType === '2D' && s.createTypeOptionActive]}
                  onPress={() => {
                    setCreateType('2D');
                    setDiscipline('Architectural');
                  }}
                >
                  <Ionicons name="layers-outline" size={15} color={createType === '2D' ? '#2563EB' : '#64748B'} />
                  <Text style={[s.createTypeOptionText, createType === '2D' && s.createTypeOptionTextActive]}>
                    2D Working Drawing
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.createTypeOption, createType === '3D' && s.createTypeOptionActive3D]}
                  onPress={() => {
                    setCreateType('3D');
                    setDiscipline('3D Visual');
                  }}
                >
                  <Ionicons name="cube-outline" size={15} color={createType === '3D' ? '#7C3AED' : '#64748B'} />
                  <Text style={[s.createTypeOptionText, createType === '3D' && { color: '#7C3AED' }]}>
                    3D Visual / Concept
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Drawing Title *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Master Bedroom False Ceiling & Lighting Grid"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={s.label}>Engineering Discipline</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {DISCIPLINE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.disciplineChip, discipline === opt.value && s.disciplineChipActive]}
                    onPress={() => setDiscipline(opt.value)}
                  >
                    <Text style={[s.disciplineChipText, discipline === opt.value && s.disciplineChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Drawing Document File (PDF, Image, CAD, SKP) *</Text>
              <TouchableOpacity style={s.uploadBox} onPress={handlePickCreateFile}>
                <Ionicons name="cloud-upload-outline" size={26} color="#2563EB" />
                <Text style={s.uploadBoxText} numberOfLines={1}>
                  {selectedFile ? selectedFile.name : 'Tap to select document from device'}
                </Text>
                <Text style={s.uploadBoxSub}>Supports PDF, DWG, SKP, PNG, JPG</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.saveBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitDrawing}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Register & Upload Blueprint</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Upload New Revision */}
      {/* ========================================================================= */}
      <Modal visible={!!revTarget} animationType="slide" transparent onRequestClose={closeRev}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Upload Revision: {revName}</Text>
                <Text style={s.modalSubtitle} numberOfLines={1}>{revTargetTitle}</Text>
              </View>
              <TouchableOpacity onPress={closeRev} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Describe Revision Changes *</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Adjusted cove lighting profile per client revision request"
                placeholderTextColor="#94A3B8"
                value={revChanges}
                onChangeText={setRevChanges}
              />

              <Text style={s.label}>New Revision File *</Text>
              <TouchableOpacity style={s.uploadBox} onPress={handlePickRevFile}>
                <Ionicons name="cloud-upload-outline" size={26} color="#2563EB" />
                <Text style={s.uploadBoxText} numberOfLines={1}>
                  {revFile ? revFile.name : 'Tap to select revised file'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.saveBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitRevision}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Submit Revision</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Full Screen Image Lightbox */}
      {/* ========================================================================= */}
      <Modal visible={!!lightboxFile} transparent animationType="fade" onRequestClose={() => setLightboxFile(null)}>
        <View style={s.lightboxOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.lightboxHeader}>
              <Text style={s.lightboxTitle} numberOfLines={1}>{lightboxFile?.title}</Text>
              <TouchableOpacity style={s.lightboxCloseBtn} onPress={() => setLightboxFile(null)}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={s.lightboxBody}>
              {lightboxFile?.url && (
                <Image
                  source={{ uri: lightboxFile.url }}
                  style={s.lightboxImage}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={s.lightboxFooter}>
              <TouchableOpacity
                style={s.lightboxOpenExternalBtn}
                onPress={() => {
                  if (lightboxFile?.url) Linking.openURL(lightboxFile.url);
                }}
              >
                <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                <Text style={s.lightboxOpenExternalText}>Open in Browser / Full Quality</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  categorySegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  categoryTabText: {
    fontSize: 11.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },

  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A' },
  statLabel: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: '#F1F5F9' },

  searchRow: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },

  statusChipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },

  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 30 },

  dwgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  dwgTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dwgNumBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dwgNumber: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#475569' },

  fileTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fileTypeBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },

  disciplineTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  disciplineTagText: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#475569' },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },

  dwgTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  latestRevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  latestRevText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#475569' },
  revDate: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  changesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#CBD5E1',
  },
  changesLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase' },
  dwgChanges: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#475569', marginTop: 2 },

  historyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  historyToggleText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#2563EB' },

  historyContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  historyBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginTop: 5,
  },
  historyRevName: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  historyDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  historyChanges: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  historyDownloadLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  historyDownloadText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 10,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#334155' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },

  createTypeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  createTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  createTypeOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  createTypeOptionActive3D: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  createTypeOptionText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  createTypeOptionTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  disciplineChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  disciplineChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  disciplineChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  disciplineChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  uploadBox: {
    height: 95,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  uploadBoxText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#2563EB', maxWidth: '100%' },
  uploadBoxSub: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  saveBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Lightbox
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lightboxTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  lightboxCloseBtn: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  lightboxBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxFooter: { padding: 16, alignItems: 'center' },
  lightboxOpenExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  lightboxOpenExternalText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});
