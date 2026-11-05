import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import RemoteThumb from '../../components/interior/RemoteThumb';
import SelectField from '../../components/common/SelectField';
import SendForApprovalModal, { approvalStyles } from '../../components/interior/SendForApprovalModal';
import ApprovalDecisionModal from '../../components/interior/ApprovalDecisionModal';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import { fetchProjectReviewers } from '../../utils/interior/projectReviewers';

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
  // Embedded images and Cloudinary image links can have no file extension
  if (String(url).startsWith('data:image') || /\/image\/upload\//.test(String(url))) return 'image';
  const ext = getExt(url) || getExt(fileName);
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'hdr', 'heic'].includes(ext)) return 'image';
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

// Same rule as the web card: nothing is "in review" until a reviewer has been assigned
const getStatusMeta = (dwg) => {
  const s = dwg.status;
  if ((s === 'draft' || s === 'submitted' || !s) && !dwg.assignedReviewer) return STATUS_META.draft;
  return STATUS_META[s] || STATUS_META.submitted;
};

async function pickFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'application/acad', 'image/vnd.dwg', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

async function pickFiles() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'application/acad', 'image/vnd.dwg', '*/*'],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets;
}

const MODEL_3D_EXT = ['dwg', 'skp', 'obj', 'fbx', '3ds', 'dae', 'blend', 'rvt', 'rfa', 'ifc', 'gltf', 'glb', 'max'];

// "master_bedroom-ceiling.pdf" → "master bedroom ceiling" (web sanitizeTitle)
const titleFromFileName = (name = '') =>
  name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GENERAL_ROOM = 'General / Not Specified';
const CUSTOM_ROOM = 'Other / Custom Area';
// Same list as the web upload modal (STANDARD_ROOM_TAGS)
const ROOM_TAGS = [
  'Living Room', 'Master Bedroom', 'Kitchen', 'Dining Area', 'Kids Bedroom', 'Guest Bedroom',
  'Foyer / Entrance', 'Balcony / Terrace', 'Master Bathroom', 'Common Bathroom', 'Devotional Room',
  'Walk-in Wardrobe', 'Home Office / Study', 'Whole House / Entire Space',
];
const ROOM_OPTIONS = [
  { value: GENERAL_ROOM, label: '-- General / Not Specified --' },
  ...ROOM_TAGS.map((r) => ({ value: r, label: r })),
  { value: CUSTOM_ROOM, label: 'Other / Custom Area...' },
];

const fileSizeMb = (asset) => (asset?.size ? `${(asset.size / (1024 * 1024)).toFixed(2)} MB • ` : '');

export default function InteriorDrawingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
const { can: canDo } = useProjectPermissions(projectId);

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
  const [uploadFiles, setUploadFiles] = useState([]); // [{ key, asset }]
  const [uploadTitle, setUploadTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [roomTag, setRoomTag] = useState(GENERAL_ROOM);
  const [customRoom, setCustomRoom] = useState('');

  // Approval flow
  const [reviewers, setReviewers] = useState([]);
  const [sendTarget, setSendTarget] = useState(null);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decisionAction, setDecisionAction] = useState(null);

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

  useEffect(() => {
    if (!projectId) return;
    fetchProjectReviewers(projectId)
      .then(setReviewers)
      .catch((e) => console.warn('Failed to load project members for approval', e));
  }, [projectId]);

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

  // Filtered List
  const filteredDrawings = useMemo(() => {
    return drawings.filter((d) => {
      const type = inferType(d);
      if (type !== activeCategory) return false;

      if (selectedStatus !== 'all') {
        const isDraft = getStatusMeta(d) === STATUS_META.draft;
        if (selectedStatus === 'draft' ? !isDraft : isDraft || d.status !== selectedStatus) return false;
      }

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
    setUploadFiles([]);
    setUploadTitle('');
    setTitleTouched(false);
    setRoomTag(GENERAL_ROOM);
    setCustomRoom('');
    setCreateType('2D');
  };

  // Same validation as the web: 3–50 characters, unique within the category
  const getTitleError = (val = uploadTitle) => {
    const t = val.trim();
    if (!t) return 'Drawing title is required';
    if (t.length < 3) return 'Drawing title must be at least 3 characters';
    if (t.length > 50) return 'Drawing title cannot exceed 50 characters';
    const clash = drawings.some((d) => {
      const cat = String(d.drawingType || d.category || '2D').toUpperCase() === '3D' ? '3D' : '2D';
      return cat === createType && String(d.title || d.name || '').trim().toLowerCase() === t.toLowerCase();
    });
    if (clash) return `A ${createType} drawing with title "${t}" already exists. Please enter a unique title.`;
    return null;
  };
  const effectiveRoom = () => (roomTag === CUSTOM_ROOM ? customRoom.trim() || GENERAL_ROOM : roomTag || GENERAL_ROOM);

  const closeRev = () => {
    setRevTarget(null);
    setRevTargetTitle('');
    setRevChanges('');
    setRevFile(null);
  };

  const handlePickCreateFiles = async () => {
    const assets = await pickFiles();
    if (!assets.length) return;
    // A 3D model file switches the upload to the 3D category (same as the web)
    const has3D = assets.some((a) => MODEL_3D_EXT.includes((a.name || '').split('.').pop().toLowerCase()));
    if (has3D) setCreateType('3D');
    // First file names the drawing if no title was typed yet
    if (!uploadTitle.trim() && assets[0]) setUploadTitle(titleFromFileName(assets[0].name).slice(0, 50));
    setUploadFiles((prev) => [
      ...prev,
      ...assets.map((a, i) => ({ key: `${Date.now()}-${i}-${a.name}`, asset: a })),
    ]);
  };

  const removeUploadFile = (key) => setUploadFiles((prev) => prev.filter((f) => f.key !== key));

  const handlePickRevFile = async () => {
    const asset = await pickFile();
    if (asset) setRevFile(asset);
  };

  const handleSubmitDrawing = async () => {
    if (uploadFiles.length === 0) return showToast('Please choose at least one drawing file or photo to upload.', 'error');
    const titleErr = getTitleError();
    if (titleErr) {
      setTitleTouched(true);
      return showToast(titleErr, 'error');
    }

    const room = effectiveRoom();
    const total = uploadFiles.length;
    setSubmitting(true);
    let done = 0;
    try {
      for (let index = 0; index < total; index++) {
        const f = uploadFiles[index];
        const base = uploadTitle.trim() || titleFromFileName(f.asset.name);
        const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/drawings/upload`, {
          file: { uri: f.asset.uri, name: f.asset.name, type: f.asset.mimeType || 'application/octet-stream' },
        });
        if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error(`Upload failed for ${f.asset.name}`);

        await interiorApiClient.post(`/projects/${projectId}/drawings`, {
          // Several files share the title with a running number, like the web
          title: total === 1 ? base : `${base} (${index + 1})`,
          discipline: room !== GENERAL_ROOM ? room : createType === '3D' ? '3D Model' : '2D Drawing',
          roomTag: room,
          drawingType: createType,
          fileType: detectDrawingFileType(f.asset.name, uploadRes.data.url),
          fileUrl: uploadRes.data.url,
          status: 'draft',
        });
        done += 1;
      }

      showToast(
        done === 1 ? `${createType} drawing uploaded successfully as Draft!` : `${done} ${createType} drawings uploaded successfully as Draft!`,
        'success'
      );
      closeCreate();
    } catch (e) {
      // Keep the files that didn't make it so the user can retry them
      if (done > 0) setUploadFiles((prev) => prev.slice(done));
      showToast(e.message || 'Failed to upload drawing', 'error');
    } finally {
      setSubmitting(false);
      if (done > 0) fetchDrawings();
    }
  };

  const handleSendForApproval = async ({ reviewerId, reviewerName, notes }) => {
    await interiorApiClient.put(`/projects/${projectId}/drawings`, {
      drawingId: sendTarget._id,
      status: 'under_review',
      assignedReviewer: reviewerId,
      assignedReviewerName: reviewerName,
      submissionNotes: notes || undefined,
    });
    showToast(`Drawing sent to ${reviewerName} for approval!`, 'success');
    fetchDrawings();
  };

  const handleDecision = async (action, reason) => {
    await interiorApiClient.put(`/projects/${projectId}/drawings`, {
      drawingId: decisionTarget._id,
      status: action === 'approve' ? 'approved' : 'rejected',
      ...(action === 'reject' ? { rejectionReason: reason } : {}),
    });
    showToast(
      action === 'approve' ? `Drawing "${decisionTarget.title}" approved successfully!` : 'Drawing marked as rejected with change request notes.',
      action === 'approve' ? 'success' : 'info'
    );
    fetchDrawings();
  };

  // Version number the web modals show (v1, v2, …): one per uploaded revision
  const drawingVersion = (dwg) => dwg.revisions?.length || dwg.currentVersion || 1;

  // Drawing preview card at the top of both approval sheets (web "Drawing Preview Card")
  const renderApprovalCard = (dwg, extra) => {
    const rev = dwg.revisions?.[dwg.revisions.length - 1] || {};
    const badge = getFileTypeBadge(dwg.title, rev.url, dwg.drawingType || '2D');
    const isImg = detectDrawingFileType(dwg.title, rev.url) === 'image';
    return (
      <View style={[approvalStyles.summaryBox, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        {isImg && rev.url ? (
          <RemoteThumb uri={rev.url} style={s.approvalThumb} height={52} />
        ) : (
          <View style={[s.approvalThumb, { backgroundColor: badge.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name={badge.icon} size={22} color={badge.color} />
          </View>
        )}
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={approvalStyles.summaryTitle} numberOfLines={2}>{dwg.title}</Text>
          <View style={approvalStyles.chipRow}>
            <Text style={[approvalStyles.chip, { color: badge.color, backgroundColor: badge.bg }]}>{badge.label}</Text>
            <Text style={approvalStyles.chip}>Version v{drawingVersion(dwg)}</Text>
            {!!dwg.drawingNumber && <Text style={approvalStyles.chip}>#{dwg.drawingNumber}</Text>}
            {extra === 'discipline' && !!dwg.discipline && <Text style={approvalStyles.chip}>{dwg.discipline}</Text>}
            {extra === 'reviewer' && !!dwg.assignedReviewerName && (
              <Text style={approvalStyles.reviewerChip}>Reviewer: {dwg.assignedReviewerName}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const openDecision = (dwg, action) => {
    setDecisionAction(action);
    setDecisionTarget(dwg);
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
            <Text style={s.headerTitle} numberOfLines={1}>Drawings & Blueprints</Text>
            <Text style={s.headerSub}>Manage 2D Working Plans and 3D Models.</Text>
          </View>
        </View>

        {/* --- CATEGORY SEGMENTED TABS (2D vs 3D) --- */}
        <View style={s.categorySegmentRow}>
          <TouchableOpacity
            style={[s.categoryTab, activeCategory === '2D' && s.categoryTabActive]}
            onPress={() => setActiveCategory('2D')}
          >
            <Text
              style={[s.categoryTabText, activeCategory === '2D' && s.categoryTabTextActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              2D Drawings
            </Text>
            <View style={[s.categoryTabCount, activeCategory === '2D' && s.categoryTabCountActive]}>
              <Text style={[s.categoryTabCountText, activeCategory === '2D' && s.categoryTabCountTextActive]}>
                {count2D}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.categoryTab, activeCategory === '3D' && s.categoryTabActive]}
            onPress={() => setActiveCategory('3D')}
          >
            <Text
              style={[s.categoryTabText, activeCategory === '3D' && s.categoryTabTextActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              3D Renders
            </Text>
            <View style={[s.categoryTabCount, activeCategory === '3D' && s.categoryTabCountActive]}>
              <Text style={[s.categoryTabCountText, activeCategory === '3D' && s.categoryTabCountTextActive]}>
                {count3D}
              </Text>
            </View>
          </TouchableOpacity>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={s.statusChipsRow}
        >
          {[
            { id: 'all', label: 'All Status' },
            { id: 'draft', label: 'Draft' },
            { id: 'approved', label: 'Approved ✓' },
            { id: 'under_review', label: 'Under Review' },
            { id: 'rejected', label: 'Rejected' },
          ].map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[s.filterChip, selectedStatus === st.id && s.filterChipActive]}
              onPress={() => setSelectedStatus(st.id)}
            >
              <Text
                style={[s.filterChipText, selectedStatus === st.id && s.filterChipTextActive]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
          >
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
                const meta = getStatusMeta(dwg);
                const hasReviewer = Boolean(dwg.assignedReviewer);
                const canSend = !hasReviewer && dwg.status !== 'approved' && dwg.status !== 'rejected' && canDo('drawings', 'update');
                const awaitingDecision = hasReviewer && (dwg.status === 'under_review' || dwg.status === 'submitted');
                const fileBadge = getFileTypeBadge(dwg.title, currentRev.url, activeCategory);
                const isExpanded = expandedDwgId === dwg._id;
                const isImage = detectDrawingFileType(dwg.title, currentRev.url) === 'image';

                return (
                  <View key={dwg._id} style={s.dwgCard}>
                    {/* Image thumbnail (same as the web card) */}
                    {isImage && !!currentRev.url && (
                      <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenOrPreview(currentRev.url, dwg.title)}>
                        <RemoteThumb uri={currentRev.url} style={s.dwgThumb} height={150} />
                      </TouchableOpacity>
                    )}
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

                    {!!dwg.assignedReviewerName && (
                      <View style={s.reviewerChip}>
                        <Ionicons name="person-circle-outline" size={12} color="#B45309" />
                        <Text style={s.reviewerChipText} numberOfLines={1}>Reviewer: {dwg.assignedReviewerName}</Text>
                      </View>
                    )}
                    {dwg.status === 'rejected' && !!dwg.rejectionReason && (
                      <View style={s.rejectionBox}>
                        <Text style={s.rejectionText} numberOfLines={2}>Changes: {dwg.rejectionReason}</Text>
                      </View>
                    )}

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

                    {/* Approval flow */}
                    {canSend && (
                      <TouchableOpacity style={s.sendApprovalBtn} onPress={() => setSendTarget(dwg)}>
                        <Ionicons name="paper-plane-outline" size={13} color="#FFFFFF" />
                        <Text style={s.sendApprovalText}>Send for Approval</Text>
                      </TouchableOpacity>
                    )}
                    {awaitingDecision && canDo('drawings', 'approve') && (
                      <View style={s.decisionRow}>
                        <TouchableOpacity style={[s.decisionBtn, s.approveBtn]} onPress={() => openDecision(dwg, 'approve')}>
                          <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
                          <Text style={[s.decisionText, { color: '#FFFFFF' }]}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.decisionBtn, s.rejectBtn]} onPress={() => openDecision(dwg, 'reject')}>
                          <Ionicons name="close-circle-outline" size={14} color="#B91C1C" />
                          <Text style={[s.decisionText, { color: '#B91C1C' }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {dwg.status === 'rejected' && canDo('drawings', 'update') && (
                      <TouchableOpacity style={[s.sendApprovalBtn, { backgroundColor: '#0F172A' }]} onPress={() => openRevModal(dwg)}>
                        <Ionicons name="cloud-upload-outline" size={13} color="#FFFFFF" />
                        <Text style={s.sendApprovalText}>Upload Revision</Text>
                      </TouchableOpacity>
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

                      {dwg.status !== 'rejected' && canDo('drawings', 'update') && (
                        <TouchableOpacity
                          style={s.actionBtn}
                          onPress={() => openRevModal(dwg)}
                        >
                          <Ionicons name="cloud-upload-outline" size={13} color="#475569" />
                          <Text style={s.actionBtnText}>+ Revision</Text>
                        </TouchableOpacity>
                      )}

                      {canDo('drawings', 'delete') && (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: '#F1F5F9' }]}
                          onPress={() => handleDeleteDrawing(dwg)}
                        >
                          <Ionicons name="trash-outline" size={14} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* --- FLOATING REGISTER DRAWING BUTTON --- */}
        {canDo('drawings', 'create') && (
          <TouchableOpacity
            style={[s.fab, activeCategory === '3D' && { backgroundColor: '#7C3AED', shadowColor: '#7C3AED' }]}
            onPress={() => {
              setCreateType(activeCategory);
              setIsCreateOpen(true);
            }}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Register Design Drawing */}
      {/* ========================================================================= */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={closeCreate}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={s.modalTitle}>Upload Drawing</Text>
                <Text style={s.modalSubtitle}>Upload 2D architectural plans, working layouts, or 3D models.</Text>
              </View>
              <TouchableOpacity onPress={closeCreate} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category selector */}
              <Text style={s.label}>Drawing Category *</Text>
              <View style={s.createTypeSwitchRow}>
                <TouchableOpacity
                  style={[s.createTypeOption, s.createTypeCard, createType === '2D' && s.createTypeOptionActive]}
                  onPress={() => setCreateType('2D')}
                >
                  <Ionicons name="document-text-outline" size={16} color={createType === '2D' ? '#2563EB' : '#64748B'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.createTypeOptionText, createType === '2D' && s.createTypeOptionTextActive]}>2D Working Drawing</Text>
                    <Text style={s.createTypeHint}>Floor plans, RCP, Electrical, PDF, DXF</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.createTypeOption, s.createTypeCard, createType === '3D' && s.createTypeOptionActive3D]}
                  onPress={() => setCreateType('3D')}
                >
                  <Ionicons name="cube-outline" size={16} color={createType === '3D' ? '#7C3AED' : '#64748B'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.createTypeOptionText, createType === '3D' && { color: '#7C3AED', fontFamily: 'Inter-Bold' }]}>3D Model / Render</Text>
                    <Text style={s.createTypeHint}>DWG, SketchUp (.skp), Renders</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Title (3–50 chars, unique per category) */}
              <View style={s.labelRow}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>Drawing Title *</Text>
                <Text
                  style={[
                    s.charCount,
                    uploadTitle.length > 45 && { color: '#D97706' },
                    uploadTitle.length > 0 && uploadTitle.trim().length < 3 && { color: '#F43F5E' },
                  ]}
                >
                  {uploadTitle.length}/50
                </Text>
              </View>
              <TextInput
                style={[s.input, titleTouched && !!getTitleError() && { borderColor: '#FDA4AF' }]}
                value={uploadTitle}
                maxLength={50}
                onBlur={() => setTitleTouched(true)}
                onChangeText={(v) => { setUploadTitle(v); if (!titleTouched) setTitleTouched(true); }}
                placeholder="e.g. Master Bedroom — False Ceiling (min 3 chars)"
                placeholderTextColor="#94A3B8"
                editable={!submitting}
              />
              {titleTouched && !!getTitleError() && <Text style={s.fieldError}>{getTitleError()}</Text>}

              {/* Room / Area (optional) */}
              <View style={s.labelRow}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>
                  Room / Area <Text style={s.optionalText}>(Optional)</Text>
                </Text>
                {roomTag === GENERAL_ROOM && <Text style={s.charCount}>Default: General</Text>}
              </View>
              <SelectField value={roomTag} onChange={setRoomTag} options={ROOM_OPTIONS} disabled={submitting} />
              {roomTag === CUSTOM_ROOM && (
                <TextInput
                  style={[s.input, { marginTop: 8 }]}
                  value={customRoom}
                  maxLength={40}
                  onChangeText={setCustomRoom}
                  placeholder="Type custom room/area (e.g. Home Theater, Balcony Garden)"
                  placeholderTextColor="#94A3B8"
                />
              )}

              {/* Files */}
              <View style={s.labelRow}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>File Attachment(s) *</Text>
                {uploadFiles.length > 0 && (
                  <Text style={s.fileCountBadge}>
                    {uploadFiles.length} {uploadFiles.length === 1 ? 'file' : 'files'} selected
                  </Text>
                )}
              </View>
              {uploadFiles.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {uploadFiles.map((f) => {
                    const kind = detectDrawingFileType(f.asset.name, f.asset.uri);
                    return (
                      <View key={f.key} style={s.uploadItem}>
                        {kind === 'image' ? (
                          <Image source={{ uri: f.asset.uri }} style={s.uploadItemThumb} />
                        ) : (
                          <View style={[s.uploadItemIcon, { backgroundColor: createType === '3D' ? '#7C3AED' : '#2563EB' }]}>
                            <Ionicons name={createType === '3D' ? 'cube-outline' : 'document-text-outline'} size={18} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.uploadItemTitle} numberOfLines={1}>{f.asset.name}</Text>
                          <Text style={s.uploadItemName} numberOfLines={1}>
                            {fileSizeMb(f.asset)}{(kind === 'other' ? 'document' : kind).toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => removeUploadFile(f.key)} disabled={submitting} style={{ padding: 4 }}>
                          <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity style={s.addMoreBtn} onPress={handlePickCreateFiles} disabled={submitting}>
                    <Ionicons name="add" size={14} color="#1D4ED8" />
                    <Text style={s.addMoreText}>Add More Files</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.uploadBox} onPress={handlePickCreateFiles} disabled={submitting}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#2563EB" />
                  <Text style={s.uploadBoxText} numberOfLines={1}>Tap to choose files/photos to upload</Text>
                  <Text style={s.uploadBoxSub}>Select one or multiple files (Photos, PDFs, 3D models)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  s.saveBtn,
                  (submitting || uploadFiles.length === 0) && { opacity: 0.6 },
                ]}
                onPress={handleSubmitDrawing}
                disabled={submitting || uploadFiles.length === 0}
              >
                {submitting ? (
                  <Text style={s.saveBtnText}>Uploading...</Text>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={s.saveBtnText}>
                      {uploadFiles.length > 1 ? `Upload ${uploadFiles.length} Drawings` : 'Upload Drawing'}
                    </Text>
                  </>
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
      {/* MODALS: Send for Approval & Approve / Reject */}
      {/* ========================================================================= */}
      <SendForApprovalModal
        visible={!!sendTarget}
        onClose={() => setSendTarget(null)}
        title="Send Drawing for Approval"
        subtitle="Assign a project lead or manager to review specifications & verify layout"
        users={reviewers}
        initialReviewer={sendTarget?.assignedReviewer}
        reviewerLabel="Select Approver / Reviewer"
        reviewerHint="The reviewer will be notified to review the blueprint, place inspection pins, and approve or request changes."
        notesLabel="Submission Notes / Scope Covered (Optional)"
        notesPlaceholder="E.g., Updated electrical conduit layout per client discussion, revised structural beam cutouts..."
        submitLabel="Send for Approval"
        submittingLabel="Sending..."
        summary={sendTarget && renderApprovalCard(sendTarget, 'discipline')}
        onSubmit={handleSendForApproval}
      />

      <ApprovalDecisionModal
        visible={!!decisionTarget}
        onClose={() => { setDecisionTarget(null); setDecisionAction(null); }}
        approveTitle="Verify & Approve Drawing"
        approveSubtitle="Formal sign-off to authorize blueprint for site execution"
        rejectTitle="Request Changes / Reject Drawing"
        rejectSubtitle="Document specific revision requests for the design team"
        summary={decisionTarget && renderApprovalCard(decisionTarget, 'reviewer')}
        submissionNotes={decisionTarget?.submissionNotes}
        submissionNotesLabel="Submission Notes:"
        pastRejection={decisionTarget?.status === 'rejected' ? decisionTarget?.rejectionReason || decisionTarget?.submissionNotes : ''}
        pastRejectionLabel="Previous Rejection Reason:"
        initialAction={decisionAction}
        rejectPlaceholder="Specify what needs correction (e.g., HVAC duct clash on grid B-4, missing elevation heights, inaccurate wall thickness)..."
        rejectHint="This note will be saved in the drawing audit history and shown to the designer to guide version revision."
        rejectMissingMessage="Please provide a rejection reason explaining the required changes for the designer."
        confirmTitle="Confirm Architectural Approval"
        confirmText={decisionTarget ? `By approving this drawing version (v${drawingVersion(decisionTarget)}), you confirm that dimensions, structural allowances, and working specifications comply with project requirements and are authorized for site execution.` : ''}
        approveLabel={decisionTarget ? `Approve Drawing (v${drawingVersion(decisionTarget)})` : 'Approve Drawing'}
        backLabel="← Back to Approve Options"
        onDecision={handleDecision}
      />

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
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  categorySegmentRow: {
    flexShrink: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
    zIndex: 9,
  },
  categoryTab: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 10,
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
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    flexShrink: 1,
  },
  categoryTabTextActive: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
  categoryTabCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryTabCountActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryTabCountText: {
    fontSize: 10.5,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
  },
  categoryTabCountTextActive: {
    color: '#FFFFFF',
  },

  searchRow: {
    flexShrink: 0,
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
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },

  statusChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  filterChip: {
    flexShrink: 0,
    flexGrow: 0,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
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
  dwgThumb: { width: '100%', height: 150, borderRadius: 10, backgroundColor: '#E2E8F0', marginBottom: 10 },
  approvalThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#E2E8F0', overflow: 'hidden' },

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

  reviewerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%',
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  reviewerChipText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#B45309', flexShrink: 1 },
  rejectionBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  rejectionText: { fontSize: 10.5, fontFamily: 'Inter-Medium', fontStyle: 'italic', color: '#DC2626' },

  sendApprovalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 36, borderRadius: 10, backgroundColor: '#2563EB', marginTop: 2,
  },
  sendApprovalText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  decisionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  decisionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: 10 },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  decisionText: { fontSize: 12, fontFamily: 'Inter-Bold' },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  charCount: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  optionalText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  fieldError: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#F43F5E', marginTop: 4 },
  fileCountBadge: {
    fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#2563EB', backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  createTypeCard: { justifyContent: 'flex-start', paddingHorizontal: 10, alignItems: 'flex-start' },
  createTypeHint: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  uploadItemThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  uploadItemTitle: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  addMoreText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8' },
  uploadItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  uploadItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  uploadItemInput: {
    fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  uploadItemName: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3 },
  uploadItemError: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#DC2626', marginTop: 3 },

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
