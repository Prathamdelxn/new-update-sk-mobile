import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import cloudinaryService from '../../services/cloudinaryService';
import CategoryNav from './_components/CategoryNav';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';

// Mirrors sky-lite-web InteriorHandoverView: the checklist is worked out from live project
// data (WBS, tasks, drawings, snags, close-out documents) and isn't editable.

const RING_SIZE = 132;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function HandoverReadyRing({ percentage = 0 }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke="#EEF2F6" strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={clamped === 100 ? '#10B981' : '#2563EB'}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          rotation="-90"
          originX={RING_SIZE / 2}
          originY={RING_SIZE / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontFamily: 'Inter-Black', color: '#0F172A' }}>{clamped}%</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.5, marginTop: 2 }}>HANDOVER READY</Text>
      </View>
    </View>
  );
}

const DOC_TYPES = [
  { value: 'warranty', label: 'Warranty Card / Contract' },
  { value: 'manual', label: 'Interior Care & Appliance Manual' },
  { value: 'certificate', label: 'Handover / NOC Certificate' },
];

const DOC_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'warranty', label: 'Warranties' },
  { value: 'manual', label: 'Care & Appliance Manuals' },
  { value: 'certificate', label: 'Certificates' },
];

// Checklist row → project section it opens (and the permission behind it)
const SECTION_ACCESS = { wbs: 'wbs', tasks: 'tasks', drawings: 'drawings', snags: 'snags' };

const isTaskDone = (t) => t.status === 'completed' || (t.progress || 0) >= 100;

// All node ids under a WBS root (floors / zones / areas / packages / children)
function getAllDescendantIds(node) {
  const ids = [];
  const collect = (curr) => {
    if (!curr) return;
    const currId = String(curr.id || curr._id || '');
    if (currId) ids.push(currId);
    ['floors', 'zones', 'areas', 'packages', 'children'].forEach((k) => {
      if (Array.isArray(curr[k])) curr[k].forEach(collect);
    });
  };
  collect(node);
  return ids;
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildCertificateHtml({ project, readinessPercentage, checklistItems }) {
  const rows = checklistItems.map((c) => `
    <tr>
      <td><span class="${c.passed ? 'ok' : 'no'}">${c.passed ? '&#10004;' : '&#10006;'}</span> ${esc(c.title)}</td>
      <td class="right">${esc(c.subtitle)}</td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0f172a; padding: 32px; }
    h1 { text-align: center; font-size: 18px; font-weight: 900; margin: 0; }
    .sub { text-align: center; font-size: 12px; color: #64748b; margin: 6px 0 16px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; }
    .meta span.k { color: #94a3b8; } .meta b.g { color: #059669; }
    h3 { font-size: 12px; margin: 18px 0 6px; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } td.right { text-align: right; font-weight: 600; color: #475569; }
    .ok { color: #059669; } .no { color: #94a3b8; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; font-weight: 600; }
    .line { height: 32px; border-bottom: 1px dashed #94a3b8; margin-bottom: 8px; }
  </style></head><body>
    <h1>HANDOVER &amp; PRACTICAL COMPLETION CERTIFICATE</h1>
    <div class="sub">Project: <b>${esc(project?.name || 'Project')}</b> (${esc(project?.code || project?.projectNumber || 'PRJ')})</div>
    <div class="meta">
      <div><span class="k">Client:</span> <b>${esc(project?.client || project?.clientName || 'Client')}</b></div>
      <div><span class="k">Date:</span> <b>${new Date().toLocaleDateString('en-IN')}</b></div>
      <div><span class="k">Readiness:</span> <b class="g">${readinessPercentage}% Complete</b></div>
      <div><span class="k">Status:</span> <b>${readinessPercentage === 100 ? 'Ready' : 'In Progress'}</b></div>
    </div>
    <h3>Project Audit Checklist</h3>
    <table>${rows}</table>
    <div class="sign">
      <div><div class="line"></div>Project Manager</div>
      <div><div class="line"></div>Client Representative</div>
    </div>
  </body></html>`;
}

export default function InteriorHandoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { can: canDo, loading: permsLoading } = useProjectPermissions(projectId);

  // Project datasets
  const [project, setProject] = useState(null);
  const [wbsData, setWbsData] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [snags, setSnags] = useState([]);
  const [handover, setHandover] = useState(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const loadedOnce = useRef(false);

  // Upload modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('warranty');
  const [selectedFile, setSelectedFile] = useState(null);

  // Document filters & certificate
  const [docSearch, setDocSearch] = useState('');
  const [docFilterType, setDocFilterType] = useState('all');
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  const scrollRef = useRef(null);
  const docsY = useRef(null);

  const fetchAllData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const base = `/projects/${projectId}`;
      const [projRes, wbsRes, tasksRes, drawingsRes, snagsRes, handoverRes] = await Promise.allSettled([
        interiorApiClient.get(base),
        interiorApiClient.get(`${base}/wbs`),
        interiorApiClient.get(`${base}/tasks`),
        interiorApiClient.get(`${base}/drawings`),
        interiorApiClient.get(`${base}/snags`),
        interiorApiClient.get(`${base}/handover`),
      ]);
      const ok = (r) => (r.status === 'fulfilled' && r.value?.success && r.value.data ? r.value.data : null);
      const list = (r) => (Array.isArray(ok(r)) ? ok(r) : null);
      if (ok(projRes)) setProject(ok(projRes));
      if (list(wbsRes)) setWbsData(list(wbsRes));
      if (list(tasksRes)) setTasks(list(tasksRes));
      if (list(drawingsRes)) setDrawings(list(drawingsRes));
      if (list(snagsRes)) setSnags(list(snagsRes));
      if (ok(handoverRes)) setHandover(ok(handoverRes));
    } catch (err) {
      console.error('Failed to load handover data', err);
      if (showLoading) showToast('Failed to load handover details', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [projectId]);

  // First visit shows the loader; coming back from a section refreshes quietly
  useFocusEffect(useCallback(() => {
    fetchAllData(!loadedOnce.current);
    loadedOnce.current = true;
  }, [fetchAllData]));

  // WBS root elements (matches the WBS view 1-to-1)
  const actualWbsNodes = useMemo(() => (wbsData || []).map((node) => ({
    id: String(node.id || node._id || ''),
    name: node.name || 'WBS Element',
    childIds: getAllDescendantIds(node),
    rawProgress: node.progress || 0,
  })), [wbsData]);

  const checklistItems = useMemo(() => {
    // 1. Tasks / activities
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(isTaskDone).length;
    const isTasksDone = totalTasks > 0 && completedTasks === totalTasks;

    // 2. WBS
    const totalWbs = actualWbsNodes.length;
    const wbsNodesWithProgress = actualWbsNodes.map((wbsNode) => {
      const nodeTasks = tasks.filter((t) => {
        const rawPkgId = String(t.packageId?._id || t.packageId?.id || t.packageId || '');
        return rawPkgId === wbsNode.id || wbsNode.childIds.includes(rawPkgId);
      });
      if (nodeTasks.length > 0) {
        const completedInNode = nodeTasks.filter(isTaskDone).length;
        return { ...wbsNode, progress: Math.round((completedInNode / nodeTasks.length) * 100), isCompleted: completedInNode === nodeTasks.length };
      }
      if (isTasksDone) return { ...wbsNode, progress: 100, isCompleted: true };
      const progress = wbsNode.rawProgress || 0;
      return { ...wbsNode, progress, isCompleted: progress >= 100 };
    });
    const completedWbsCount = wbsNodesWithProgress.filter((w) => w.isCompleted).length;
    const avgWbsProgress = isTasksDone
      ? 100
      : totalWbs > 0
        ? Math.round(wbsNodesWithProgress.reduce((acc, w) => acc + w.progress, 0) / totalWbs)
        : totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : project?.progress || 0;
    const isWbsDone = avgWbsProgress >= 100 || (totalWbs > 0 && completedWbsCount === totalWbs) || isTasksDone;

    // 3. Drawings
    const totalDrawings = drawings.length;
    const approvedDrawings = drawings.filter((d) => d.status === 'approved').length;
    const isDrawingsDone = totalDrawings > 0 && approvedDrawings === totalDrawings;

    // 4. Snags
    const openSnags = snags.filter((sn) => sn.status !== 'resolved' && sn.status !== 'closed' && sn.status !== 'verified').length;

    // 5. Documents
    const docs = handover?.documents || [];

    return [
      {
        id: 'wbs',
        title: 'WBS progress 100%',
        subtitle: totalWbs > 0
          ? `${completedWbsCount} of ${totalWbs} WBS completed (${avgWbsProgress}%)`
          : totalTasks > 0
            ? `${completedTasks} of ${totalTasks} activities completed (${avgWbsProgress}%)`
            : `${avgWbsProgress}% overall progress`,
        passed: isWbsDone,
        tag: `${avgWbsProgress}%`,
        section: 'wbs',
      },
      {
        id: 'tasks',
        title: 'All activities & tasks completed',
        subtitle: totalTasks > 0 ? `${completedTasks} of ${totalTasks} completed` : 'No tasks scheduled',
        passed: isTasksDone,
        tag: totalTasks > 0 ? `${completedTasks}/${totalTasks}` : '0/0',
        section: 'tasks',
      },
      {
        id: 'drawings',
        title: 'All drawings approved',
        subtitle: totalDrawings > 0 ? `${approvedDrawings} of ${totalDrawings} approved` : 'No drawings uploaded',
        passed: isDrawingsDone,
        tag: totalDrawings > 0 ? `${approvedDrawings}/${totalDrawings}` : '0/0',
        section: 'drawings',
      },
      {
        id: 'snags',
        title: 'Snag list rectification verify',
        subtitle: openSnags === 0 ? 'Zero open snags on site' : `${openSnags} open snag${openSnags > 1 ? 's' : ''} remaining`,
        passed: openSnags === 0,
        tag: openSnags === 0 ? 'Verified' : `${openSnags} Open`,
        section: 'snags',
      },
      {
        id: 'documents',
        title: 'Interior Care & Appliance Manuals',
        subtitle: docs.length === 0 ? 'No manuals or warranties uploaded yet' : `${docs.length} document${docs.length > 1 ? 's' : ''} registered`,
        passed: docs.length > 0,
        tag: docs.length === 0 ? 'Pending' : `${docs.length} Uploaded`,
        section: '#closeout-docs',
      },
    ];
  }, [actualWbsNodes, project, tasks, drawings, snags, handover]);

  const completedCount = checklistItems.filter((i) => i.passed).length;
  const totalCount = checklistItems.length;
  const readinessPercentage = Math.round((completedCount / totalCount) * 100);

  // Keep the stored handover record in step with the live checklist
  useEffect(() => {
    if (handover && handover.completionPercentage !== readinessPercentage) {
      interiorApiClient
        .post(`/projects/${projectId}/handover`, {
          checklist: checklistItems.map((item) => ({ task: item.title, status: item.passed ? 'completed' : 'pending' })),
        })
        .catch(() => {});
    }
  }, [readinessPercentage, projectId, checklistItems, handover]);

  const filteredDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return (handover?.documents || []).filter((doc) => {
      const matchSearch = !q || doc.name?.toLowerCase().includes(q) || doc.type?.toLowerCase().includes(q);
      const matchType = docFilterType === 'all' || doc.type === docFilterType;
      return matchSearch && matchType;
    });
  }, [handover?.documents, docSearch, docFilterType]);

  // Checklist rows open other sections — only those the user can view
  const canOpenSection = (section) => section.startsWith('#') || permsLoading || canDo(SECTION_ACCESS[section], 'read') !== false;

  const handleItemPress = (section) => {
    if (!canOpenSection(section)) {
      showToast("You don't have permission to open this section", 'error');
      return;
    }
    if (section === '#closeout-docs') {
      if (docsY.current != null) scrollRef.current?.scrollTo({ y: docsY.current, animated: true });
      else setIsModalOpen(true);
      return;
    }
    router.push(`/i-project/${projectId}/${section}`);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDocName('');
    setDocType('warranty');
    setSelectedFile(null);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length) setSelectedFile(result.assets[0]);
  };

  const handleUploadDocument = async () => {
    if (!docName.trim()) return showToast('Please enter document title', 'error');
    if (!selectedFile) return showToast('Please select a file', 'error');
    setUpdating(true);
    try {
      const mimeType = selectedFile.mimeType || 'application/octet-stream';
      let uploadedUrl = '';
      try {
        uploadedUrl = await cloudinaryService.uploadFile(selectedFile.uri, selectedFile.name, mimeType);
      } catch {
        const res = await interiorApiClient.postForm(`/projects/${projectId}/handover/upload`, {
          file: { uri: selectedFile.uri, name: selectedFile.name, type: mimeType },
        });
        if (res?.success && res?.data?.url) uploadedUrl = res.data.url;
        else throw new Error('Upload failed');
      }
      if (!uploadedUrl) throw new Error('Upload failed');

      const res = await interiorApiClient.post(`/projects/${projectId}/handover`, {
        documentName: docName.trim(),
        documentUrl: uploadedUrl,
        documentType: docType,
      });
      if (res?.success) {
        showToast('Document uploaded!', 'success');
        closeModal();
        fetchAllData(false);
      }
    } catch (e) {
      showToast(e.message || 'Failed to upload document', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteDocument = (doc) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this closeout document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await interiorApiClient.post(`/projects/${projectId}/handover`, { deleteDocumentId: doc._id });
            if (res?.success) {
              showToast('Document deleted', 'success');
              fetchAllData(false);
            }
          } catch {
            showToast('Failed to delete document', 'error');
          }
        },
      },
    ]);
  };

  const printCertificate = async () => {
    try {
      await Print.printAsync({ html: buildCertificateHtml({ project, readinessPercentage, checklistItems }) });
    } catch (e) {
      if (!String(e?.message || '').toLowerCase().includes('cancel')) showToast('Failed to print certificate', 'error');
    }
  };

  if (loading) {
    return (
      <View style={s.outerContainer}>
        <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#2563EB" /></SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Handover & Closeout Management</Text>
            <Text style={s.headerSub}>Track warranties, operation manuals, project completion checklist, and client signoffs.</Text>
          </View>
        </View>

        <CategoryNav projectId={projectId} activeItem="Project Handover" comingSoon={(label) => showToast(`${label} — coming soon.`, 'success')} />

        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.outlineBtn} onPress={() => setIsCertModalOpen(true)}>
              <Ionicons name="ribbon-outline" size={15} color="#D97706" />
              <Text style={s.outlineBtnText}>Certificate</Text>
            </TouchableOpacity>
            {canDo('handover', 'create') && (
              <TouchableOpacity style={s.primaryBtn} onPress={() => setIsModalOpen(true)}>
                <Ionicons name="add" size={15} color="#FFFFFF" />
                <Text style={s.primaryBtnText}>Add Document</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Readiness ring */}
          <View style={s.readyCard}>
            <HandoverReadyRing percentage={readinessPercentage} />
            <Text style={s.readyMet}>{completedCount} of {totalCount} Requirements Met</Text>
          </View>

          {/* Auto-calculated checklist */}
          <View style={[s.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={s.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ionicons name="cube-outline" size={15} color="#2563EB" />
                <Text style={s.cardTitle}>Project Handover Checklist</Text>
              </View>
              <Text style={s.cardHeaderMeta}>{completedCount}/{totalCount} Completed</Text>
            </View>
            <View style={{ padding: 12, gap: 8 }}>
              {checklistItems.map((item) => {
                const allowed = canOpenSection(item.section);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.75}
                    onPress={() => handleItemPress(item.section)}
                    style={[s.checkRow, item.passed && s.checkRowPassed, !allowed && { opacity: 0.7 }]}
                  >
                    <View style={[s.checkBox, item.passed && s.checkBoxPassed]}>
                      {item.passed && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.checkTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.checkSub}>{item.subtitle}</Text>
                    </View>
                    <View style={[s.tag, item.passed && s.tagPassed]}>
                      <Text style={[s.tagText, item.passed && s.tagTextPassed]}>{item.tag}</Text>
                    </View>
                    <Ionicons name="arrow-up-outline" size={13} color="#94A3B8" style={{ transform: [{ rotate: '45deg' }] }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Close-out document register */}
          <View style={[s.card, { marginTop: 16, padding: 0, overflow: 'hidden' }]} onLayout={(e) => { docsY.current = e.nativeEvent.layout.y; }}>
            <View style={[s.cardHeader, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <Text style={s.cardTitle}>Closeout Document Register (Warranties, Care & Appliance Manuals)</Text>
              <View style={s.searchBox}>
                <Ionicons name="search" size={14} color="#94A3B8" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search..."
                  placeholderTextColor="#94A3B8"
                  value={docSearch}
                  onChangeText={setDocSearch}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {DOC_FILTERS.map((f) => (
                  <TouchableOpacity key={f.value} style={[s.filterChip, docFilterType === f.value && s.filterChipActive]} onPress={() => setDocFilterType(f.value)}>
                    <Text style={[s.filterChipText, docFilterType === f.value && s.filterChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ padding: 12, gap: 8 }}>
              {filteredDocuments.length === 0 ? (
                <Text style={s.emptyLine}>No closeout manuals or certificates uploaded yet. Tap "Add Document" above to add one.</Text>
              ) : (
                filteredDocuments.map((doc, i) => (
                  <View key={doc._id || i} style={s.docRow}>
                    <View style={s.docIconBox}>
                      <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
                      <Text style={s.docType}>{doc.type}</Text>
                    </View>
                    <TouchableOpacity style={s.docBtn} onPress={() => doc.url && Linking.openURL(doc.url)}>
                      <Ionicons name="download-outline" size={15} color="#334155" />
                    </TouchableOpacity>
                    {canDo('handover', 'delete') && (
                      <TouchableOpacity style={[s.docBtn, { borderColor: '#FFE4E6' }]} onPress={() => handleDeleteDocument(doc)}>
                        <Ionicons name="trash-outline" size={15} color="#F43F5E" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Upload document */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                <Text style={s.modalTitle}>Log Closeout Document</Text>
              </View>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Document Title</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Modular Kitchen Care Guide or Chimney Warranty"
                placeholderTextColor="#94A3B8"
                value={docName}
                onChangeText={setDocName}
              />

              <Text style={s.label}>Category</Text>
              <View style={{ gap: 6, marginBottom: 8 }}>
                {DOC_TYPES.map((opt) => (
                  <TouchableOpacity key={opt.value} style={[s.catOption, docType === opt.value && s.catOptionActive]} onPress={() => setDocType(opt.value)}>
                    <Text style={[s.catOptionText, docType === opt.value && s.catOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Select File</Text>
              <TouchableOpacity style={s.uploadBox} onPress={pickFile}>
                <Ionicons name="download-outline" size={24} color="#94A3B8" />
                <Text style={s.uploadBoxText} numberOfLines={1}>{selectedFile ? selectedFile.name : 'Tap to select file'}</Text>
              </TouchableOpacity>

              <View style={s.modalFooter}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeModal}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, updating && { opacity: 0.7 }]} onPress={handleUploadDocument} disabled={updating}>
                  {updating && <ActivityIndicator size="small" color="#FFFFFF" />}
                  <Text style={s.saveBtnText}>Save Document</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Handover certificate */}
      <Modal visible={isCertModalOpen} animationType="fade" transparent onRequestClose={() => setIsCertModalOpen(false)}>
        <View style={s.certOverlay}>
          <View style={s.certCard}>
            <View style={s.certHeader}>
              <Text style={s.certHeaderTitle}>Certificate of Practical Completion</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity style={s.outlineBtnSm} onPress={printCertificate}>
                  <Ionicons name="print-outline" size={13} color="#334155" />
                  <Text style={s.outlineBtnSmText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsCertModalOpen(false)}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} showsVerticalScrollIndicator={false}>
              <View style={s.certTitleBlock}>
                <Text style={s.certTitle}>HANDOVER & PRACTICAL COMPLETION CERTIFICATE</Text>
                <Text style={s.certSub}>
                  Project: <Text style={{ fontFamily: 'Inter-Bold', color: '#1E293B' }}>{project?.name || 'Project'}</Text> ({project?.code || project?.projectNumber || 'PRJ'})
                </Text>
              </View>

              <View style={s.certMeta}>
                {[
                  ['Client:', project?.client || project?.clientName || 'Client'],
                  ['Date:', new Date().toLocaleDateString('en-IN')],
                  ['Readiness:', `${readinessPercentage}% Complete`, '#059669'],
                  ['Status:', readinessPercentage === 100 ? 'Ready' : 'In Progress'],
                ].map(([k, v, color]) => (
                  <Text key={k} style={s.certMetaItem}>
                    <Text style={{ color: '#94A3B8' }}>{k} </Text>
                    <Text style={{ fontFamily: 'Inter-Bold', color: color || '#0F172A' }}>{v}</Text>
                  </Text>
                ))}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={s.certSection}>Project Audit Checklist</Text>
                <View style={s.certTable}>
                  {checklistItems.map((c, i) => (
                    <View key={c.id} style={[s.certRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name={c.passed ? 'checkmark-circle-outline' : 'close-circle-outline'} size={14} color={c.passed ? '#059669' : '#94A3B8'} />
                        <Text style={s.certRowText}>{c.title}</Text>
                      </View>
                      <Text style={s.certRowSub}>{c.subtitle}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={s.certSign}>
                {['Project Manager', 'Client Representative'].map((role) => (
                  <View key={role} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                    <View style={s.certSignLine} />
                    <Text style={s.certSignText}>{role}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 14 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  outlineBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#2563EB' },
  primaryBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  readyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 22, alignItems: 'center', marginBottom: 16 },
  readyMet: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 12 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cardTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  cardHeaderMeta: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptyLine: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingVertical: 22, paddingHorizontal: 8 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  checkRowPassed: { borderColor: '#A7F3D0', backgroundColor: '#F7FDFA' },
  checkBox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  checkBoxPassed: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkTitle: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  checkSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  tagPassed: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  tagText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#475569' },
  tagTextPassed: { color: '#047857' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#0F172A', paddingVertical: 0 },
  filterChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  filterChipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#2563EB' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  docIconBox: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  docName: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  docType: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  docBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 6 },
  modalTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18, marginBottom: 8 },

  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  catOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  catOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  catOptionText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  catOptionTextActive: { color: '#2563EB' },
  uploadBox: { height: 90, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  uploadBoxText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155', maxWidth: '100%' },
  cancelBtn: { height: 38, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  cancelBtnText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#334155' },
  saveBtn: { height: 38, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtnText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  certOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 16 },
  certCard: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', maxHeight: '90%' },
  certHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  certHeaderTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1, marginRight: 8 },
  outlineBtnSm: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  outlineBtnSmText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#334155' },
  certTitleBlock: { alignItems: 'center', gap: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  certTitle: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A', textAlign: 'center' },
  certSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center' },
  certMeta: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, padding: 12, borderRadius: 8, backgroundColor: '#F8FAFC' },
  certMetaItem: { width: '50%', fontSize: 11.5, fontFamily: 'Inter-Regular' },
  certSection: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155' },
  certTable: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 },
  certRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10 },
  certRowText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#0F172A', flexShrink: 1 },
  certRowSub: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569', textAlign: 'right', maxWidth: '45%' },
  certSign: { flexDirection: 'row', gap: 24, paddingTop: 22, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  certSignLine: { alignSelf: 'stretch', height: 32, borderBottomWidth: 1, borderBottomColor: '#94A3B8', borderStyle: 'dashed' },
  certSignText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
});
