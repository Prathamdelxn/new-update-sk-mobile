import { tr } from '../../utils/i18n/tr';
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
import SkeletonList from '../../components/common/SkeletonList';

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

const REV_STATUS = {
  approved: { label: 'Approved', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: 'Changes requested', color: '#B91C1C', bg: '#FEF2F2' },
  superseded: { label: 'Superseded', color: '#64748B', bg: '#F1F5F9' },
  submitted: { label: 'In review', color: '#1D4ED8', bg: '#EFF6FF' },
  under_review: { label: 'In review', color: '#1D4ED8', bg: '#EFF6FF' },
  draft: { label: 'Draft', color: '#475569', bg: '#F1F5F9' },
};

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
      showToast(tr("Failed to fetch Drawings register"), 'error');
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
    if (uploadFiles.length === 0) return showToast(tr("Please choose at least one drawing file or photo to upload."), 'error');
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
        done === 1 ? tr("{{createType}} drawing uploaded successfully as Draft!", { createType: createType }) : tr("{{done}} {{createType}} drawings uploaded successfully as Draft!", { done: done, createType: createType }),
        'success'
      );
      closeCreate();
    } catch (e) {
      // Keep the files that didn't make it so the user can retry them
      if (done > 0) setUploadFiles((prev) => prev.slice(done));
      showToast(e.message || tr("Failed to upload drawing"), 'error');
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
    showToast(tr("Drawing sent to {{reviewerName}} for approval!", { reviewerName: reviewerName }), 'success');
    fetchDrawings();
  };

  const handleDecision = async (action, reason) => {
    await interiorApiClient.put(`/projects/${projectId}/drawings`, {
      drawingId: decisionTarget._id,
      status: action === 'approve' ? 'approved' : 'rejected',
      ...(action === 'reject' ? { rejectionReason: reason } : {}),
    });
    showToast(
      action === 'approve' ? tr("Drawing \"{{title}}\" approved successfully!", { title: decisionTarget.title }) : tr("Drawing marked as rejected with change request notes."),
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
          <Text style={approvalStyles.summaryTitle} numberOfLines={2}>{tr(dwg.title)}</Text>
          <View style={approvalStyles.chipRow}>
            <Text style={[approvalStyles.chip, { color: badge.color, backgroundColor: badge.bg }]}>{tr(badge.label)}</Text>
            <Text style={approvalStyles.chip}>{tr("Version v")}{drawingVersion(dwg)}</Text>
            {!!dwg.drawingNumber && <Text style={approvalStyles.chip}>#{tr(dwg.drawingNumber)}</Text>}
            {extra === 'discipline' && !!dwg.discipline && <Text style={approvalStyles.chip}>{tr(dwg.discipline)}</Text>}
            {extra === 'reviewer' && !!dwg.assignedReviewerName && (
              <Text style={approvalStyles.reviewerChip}>{tr("Reviewer: ")}{tr(dwg.assignedReviewerName)}</Text>
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
    if (!revChanges.trim()) return showToast(tr("Please describe the revision changes"), 'error');
    if (!revFile) return showToast(tr("Please select a revision file to upload"), 'error');

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

      showToast(tr("New revision uploaded successfully!"), 'success');
      closeRev();
      fetchDrawings();
    } catch (e) {
      showToast(e.message || tr("Failed to upload revision"), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDrawing = (dwg) => {
    Alert.alert(
      tr("Delete Drawing"),
      tr("Are you sure you want to permanently delete \"{{title}}\"?", { title: dwg.title }),
      [
        { text: tr("Cancel"), style: 'cancel' },
        {
          text: tr("Delete"),
          style: 'destructive',
          onPress: async () => {
            try {
              await interiorApiClient.delete(`/projects/${projectId}/drawings?drawingId=${dwg._id}`);
              showToast(tr("Drawing deleted successfully"), 'success');
              fetchDrawings();
            } catch (e) {
              showToast(e.message || tr("Failed to delete drawing"), 'error');
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
            <Text style={s.headerTitle} numberOfLines={1}>{tr("Drawings & Blueprints")}</Text>
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
              {tr("2D Drawings")}
            </Text>
            <View style={[s.categoryTabCount, activeCategory === '2D' && s.categoryTabCountActive]}>
              <Text style={[s.categoryTabCountText, activeCategory === '2D' && s.categoryTabCountTextActive]}>
                {tr(count2D)}
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
              {tr("3D Renders")}
            </Text>
            <View style={[s.categoryTabCount, activeCategory === '3D' && s.categoryTabCountActive]}>
              <Text style={[s.categoryTabCountText, activeCategory === '3D' && s.categoryTabCountTextActive]}>
                {tr(count3D)}
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
              placeholder={tr("Search by drawing #, title, or changes...")}
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
                {tr(st.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* --- DRAWINGS LIST --- */}
        {loading ? (
          <SkeletonList />
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
                  {tr("No ")}{activeCategory === '3D' ? tr("3D Models & Renders") : tr("2D Working Drawings")}{tr(" Found")}
                </Text>
                <Text style={s.emptySub}>
                  {searchQuery ? tr("Try clearing your search query") : tr("Tap the + button below to upload blueprints")}
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

                const facts = [
                  dwg.drawingNumber,
                  dwg.discipline,
                  currentRev.revision || 'R0',
                  currentRev.createdAt ? new Date(currentRev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
                  isImage ? null : fileBadge.label,
                ].filter(Boolean).join('  ·  ');

                // Title + status first, one line of facts, then only the action this stage needs
                return (
                  <View key={dwg._id} style={s.dwgCard}>
                    {isImage && !!currentRev.url && (
                      <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenOrPreview(currentRev.url, dwg.title)}>
                        <RemoteThumb uri={currentRev.url} style={s.dwgThumb} height={150} />
                      </TouchableOpacity>
                    )}

                    <View style={s.dwgTopRow}>
                      <Text style={s.dwgTitle} numberOfLines={2}>{tr(dwg.title)}</Text>
                      <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[s.statusBadgeText, { color: meta.color }]}>{tr(meta.label)}</Text>
                      </View>
                    </View>
                    <Text style={s.dwgFacts} numberOfLines={2}>{tr(facts)}</Text>

                    {awaitingDecision && !!dwg.assignedReviewerName && (
                      <Text style={s.reviewerLine} numberOfLines={1}>{tr("Waiting for ")}{tr(dwg.assignedReviewerName)}</Text>
                    )}
                    {dwg.status === 'rejected' && !!dwg.rejectionReason && (
                      <View style={s.rejectionBox}>
                        <Text style={s.rejectionText} numberOfLines={3}>{tr("Changes: ")}{tr(dwg.rejectionReason)}</Text>
                      </View>
                    )}

                    {/* Version history (notes per revision live here) */}
                    {revisions.length > 1 && (
                      <TouchableOpacity style={s.historyToggleBtn} onPress={() => setExpandedDwgId(isExpanded ? null : dwg._id)}>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#2563EB" />
                        <Text style={s.historyToggleText}>{isExpanded ? tr("Hide") : tr("Show")} {revisions.length}{tr(" revisions")}</Text>
                      </TouchableOpacity>
                    )}
                    {isExpanded && (
                      <View style={s.historyContainer}>
                        {revisions.slice().reverse().map((rev, idx) => (
                          <View key={idx} style={s.historyRow}>
                            <View style={s.historyBullet} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                                  <Text style={s.historyRevName}>{rev.revision || `R${revisions.length - idx - 1}`}</Text>
                                  {(() => {
                                    // each revision's own outcome; older data: latest = drawing status, earlier = superseded
                                    const st = rev.status || (idx === 0 ? dwg.status : 'superseded');
                                    const meta = REV_STATUS[st] || REV_STATUS.submitted;
                                    return (
                                      <View style={[s.revPill, { backgroundColor: meta.bg }]}>
                                        <Text style={[s.revPillText, { color: meta.color }]}>{tr(meta.label)}</Text>
                                      </View>
                                    );
                                  })()}
                                </View>
                                {rev.createdAt && (
                                  <Text style={s.historyDate}>
                                    {new Date(rev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </Text>
                                )}
                              </View>
                              {!!rev.changes && <Text style={s.historyChanges}>{tr(rev.changes)}</Text>}
                              {rev.status === 'rejected' && !!rev.rejectionReason && (
                                <Text style={s.revReason}>{tr("Change requested:")} {rev.rejectionReason}</Text>
                              )}
                              {rev.url && (
                                <TouchableOpacity style={s.historyDownloadLink} onPress={() => handleOpenOrPreview(rev.url, dwg.title)}>
                                  <Ionicons name="open-outline" size={13} color="#2563EB" />
                                  <Text style={s.historyDownloadText}>{tr("Open File")}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={s.actionsRow}>
                      {canSend && (
                        <TouchableOpacity style={[s.primaryActionBtn, { backgroundColor: '#2563EB' }]} onPress={() => setSendTarget(dwg)}>
                          <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                          <Text style={s.primaryActionText} numberOfLines={1}>{tr("Send for approval")}</Text>
                        </TouchableOpacity>
                      )}
                      {awaitingDecision && canDo('drawings', 'approve') && (
                        <>
                          <TouchableOpacity style={[s.primaryActionBtn, s.approveBtn]} onPress={() => openDecision(dwg, 'approve')}>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                            <Text style={s.primaryActionText} numberOfLines={1}>{tr("Approve")}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.primaryActionBtn, s.rejectBtn]} onPress={() => openDecision(dwg, 'reject')}>
                            <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
                            <Text style={[s.primaryActionText, { color: '#B91C1C' }]} numberOfLines={1}>{tr("Reject")}</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {dwg.status === 'rejected' && canDo('drawings', 'update') && (
                        <TouchableOpacity style={[s.primaryActionBtn, { backgroundColor: '#0F172A' }]} onPress={() => openRevModal(dwg)}>
                          <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                          <Text style={s.primaryActionText} numberOfLines={1}>{tr("Upload revision")}</Text>
                        </TouchableOpacity>
                      )}
                      {!(canSend || (awaitingDecision && canDo('drawings', 'approve')) || (dwg.status === 'rejected' && canDo('drawings', 'update'))) && <View style={{ flex: 1 }} />}
                      <TouchableOpacity style={s.iconActionBtn} onPress={() => handleOpenOrPreview(currentRev.url, dwg.title)} accessibilityLabel={isImage ? tr("Preview") : tr("Open")}>
                        <Ionicons name={isImage ? 'eye-outline' : 'open-outline'} size={18} color="#2563EB" />
                      </TouchableOpacity>
                      {dwg.status !== 'rejected' && canDo('drawings', 'update') && (
                        <TouchableOpacity style={s.iconActionBtn} onPress={() => openRevModal(dwg)} accessibilityLabel={tr("Upload revision")}>
                          <Ionicons name="cloud-upload-outline" size={18} color="#475569" />
                        </TouchableOpacity>
                      )}
                      {canDo('drawings', 'delete') && (
                        <TouchableOpacity style={s.iconActionBtn} onPress={() => handleDeleteDrawing(dwg)} accessibilityLabel={tr("Delete")}>
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
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
                <Text style={s.modalTitle}>{tr("Upload Drawing")}</Text>
                <Text style={s.modalSubtitle}>{tr("Upload 2D architectural plans, working layouts, or 3D models.")}</Text>
              </View>
              <TouchableOpacity onPress={closeCreate} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category selector */}
              <Text style={s.label}>{tr("Drawing Category *")}</Text>
              <View style={s.createTypeSwitchRow}>
                <TouchableOpacity
                  style={[s.createTypeOption, s.createTypeCard, createType === '2D' && s.createTypeOptionActive]}
                  onPress={() => setCreateType('2D')}
                >
                  <Ionicons name="document-text-outline" size={16} color={createType === '2D' ? '#2563EB' : '#64748B'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.createTypeOptionText, createType === '2D' && s.createTypeOptionTextActive]}>{tr("2D Working Drawing")}</Text>
                    <Text style={s.createTypeHint}>{tr("Floor plans, RCP, Electrical, PDF, DXF")}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.createTypeOption, s.createTypeCard, createType === '3D' && s.createTypeOptionActive3D]}
                  onPress={() => setCreateType('3D')}
                >
                  <Ionicons name="cube-outline" size={16} color={createType === '3D' ? '#7C3AED' : '#64748B'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.createTypeOptionText, createType === '3D' && { color: '#7C3AED', fontFamily: 'Inter-Bold' }]}>{tr("3D Model / Render")}</Text>
                    <Text style={s.createTypeHint}>{tr("DWG, SketchUp (.skp), Renders")}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Title (3–50 chars, unique per category) */}
              <View style={s.labelRow}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>{tr("Drawing Title *")}</Text>
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
                placeholder={tr("e.g. Master Bedroom — False Ceiling (min 3 chars)")}
                placeholderTextColor="#94A3B8"
                editable={!submitting}
              />
              {titleTouched && !!getTitleError() && <Text style={s.fieldError}>{getTitleError()}</Text>}

              {/* Room / Area (optional) */}
              <View style={s.labelRow}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>
                  {tr("Room / Area ")}<Text style={s.optionalText}>{tr("(Optional)")}</Text>
                </Text>
                {roomTag === GENERAL_ROOM && <Text style={s.charCount}>{tr("Default: General")}</Text>}
              </View>
              <SelectField value={roomTag} onChange={setRoomTag} options={ROOM_OPTIONS} disabled={submitting} />
              {roomTag === CUSTOM_ROOM && (
                <TextInput
                  style={[s.input, { marginTop: 8 }]}
                  value={customRoom}
                  maxLength={40}
                  onChangeText={setCustomRoom}
                  placeholder={tr("Type custom room/area (e.g. Home Theater, Balcony Garden)")}
                  placeholderTextColor="#94A3B8"
                />
              )}

              {/* Files */}
              <View style={s.labelRow}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>{tr("File Attachment(s) *")}</Text>
                {uploadFiles.length > 0 && (
                  <Text style={s.fileCountBadge}>
                    {uploadFiles.length} {uploadFiles.length === 1 ? tr("file") : tr("files")}{tr(" selected")}
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
                          <Text style={s.uploadItemTitle} numberOfLines={1}>{tr(f.asset.name)}</Text>
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
                    <Text style={s.addMoreText}>{tr("Add More Files")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.uploadBox} onPress={handlePickCreateFiles} disabled={submitting}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#2563EB" />
                  <Text style={s.uploadBoxText} numberOfLines={1}>{tr("Tap to choose files/photos to upload")}</Text>
                  <Text style={s.uploadBoxSub}>{tr("Select one or multiple files (Photos, PDFs, 3D models)")}</Text>
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
                  <Text style={s.saveBtnText}>{tr("Uploading...")}</Text>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={s.saveBtnText}>
                      {uploadFiles.length > 1 ? tr("Upload {{uploadFilesCount}} Drawings", { uploadFilesCount: uploadFiles.length }) : tr("Upload Drawing")}
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
                <Text style={s.modalTitle}>{tr("Upload Revision: ")}{tr(revName)}</Text>
                <Text style={s.modalSubtitle} numberOfLines={1}>{tr(revTargetTitle)}</Text>
              </View>
              <TouchableOpacity onPress={closeRev} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Describe Revision Changes *")}</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder={tr("e.g. Adjusted cove lighting profile per client revision request")}
                placeholderTextColor="#94A3B8"
                value={revChanges}
                onChangeText={setRevChanges}
              />

              <Text style={s.label}>{tr("New Revision File *")}</Text>
              <TouchableOpacity style={s.uploadBox} onPress={handlePickRevFile}>
                <Ionicons name="cloud-upload-outline" size={26} color="#2563EB" />
                <Text style={s.uploadBoxText} numberOfLines={1}>
                  {revFile ? revFile.name : tr("Tap to select revised file")}
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
                  <Text style={s.saveBtnText}>{tr("Submit Revision")}</Text>
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
        title={tr("Send Drawing for Approval")}
        subtitle={tr("Assign a project lead or manager to review specifications & verify layout")}
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
        confirmText={decisionTarget ? tr("By approving this drawing version (v{{drawingVersion}}), you confirm that dimensions, structural allowances, and working specifications comply with project requirements and are authorized for site execution.", { drawingVersion: drawingVersion(decisionTarget) }) : ''}
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
              <Text style={s.lightboxTitle} numberOfLines={1}>{tr(lightboxFile?.title)}</Text>
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
                <Text style={s.lightboxOpenExternalText}>{tr("Open in Browser / Full Quality")}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  revPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  revPillText: { fontSize: 10, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  revReason: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#B91C1C', marginTop: 3 },
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
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

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
    fontSize: 13,
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
    fontSize: 12,
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
    fontSize: 13.5,
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
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },

  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  emptySub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 30 },

  dwgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  dwgTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dwgFacts: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  reviewerLine: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#B45309' },
  primaryActionBtn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, paddingHorizontal: 10, borderRadius: 10 },
  primaryActionText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  iconActionBtn: { flexShrink: 0, width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  dwgThumb: { width: '100%', height: 150, borderRadius: 10, backgroundColor: '#E2E8F0', marginBottom: 10 },
  approvalThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#E2E8F0', overflow: 'hidden' },


  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 12.5, fontFamily: 'Inter-Bold' },

  dwgTitle: { flex: 1, fontSize: 16, lineHeight: 21, fontFamily: 'Inter-Bold', color: '#0F172A' },

  rejectionBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  rejectionText: { fontSize: 12, fontFamily: 'Inter-Medium', fontStyle: 'italic', color: '#DC2626' },

  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  charCount: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  optionalText: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  fieldError: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#F43F5E', marginTop: 4 },
  fileCountBadge: {
    fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#2563EB', backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  createTypeCard: { justifyContent: 'flex-start', paddingHorizontal: 10, alignItems: 'flex-start' },
  createTypeHint: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  uploadItemThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  uploadItemTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  addMoreText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1D4ED8' },
  uploadItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  uploadItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  uploadItemName: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3 },



  historyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  historyToggleText: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#2563EB' },

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
  historyRevName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  historyDate: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  historyChanges: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  historyDownloadLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  historyDownloadText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    alignItems: 'center',
  },

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
  modalSubtitle: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
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
  createTypeOptionText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  createTypeOptionTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },


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
  uploadBoxText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#2563EB', maxWidth: '100%' },
  uploadBoxSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

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
  lightboxOpenExternalText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});
