import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  Modal, TextInput, Image, Alert, ActivityIndicator, Dimensions,
  KeyboardAvoidingView, Platform, RefreshControl, LayoutAnimation
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { hasProjectPermissionWithMembers, isProjectLocked } from '../../utils/permissions';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { milestoneService, workProgressService } from '../../services/projectService';
import cloudinaryService from '../../services/cloudinaryService';
import { useSocket } from '../../context/SocketContext';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Colours ─────────────────────────────────────────────────────────────────
const C = {
  blue: '#3B82F6',
  blueDark: '#1D4ED8',
  bluePale: '#EFF6FF',
  blueBorder: '#BFDBFE',
  green: '#10B981',
  greenPale: '#ECFDF5',
  greenBorder: '#A7F3D0',
  amber: '#F59E0B',
  amberPale: '#FFFBEB',
  amberBorder: '#FDE68A',
  red: '#EF4444',
  redPale: '#FEF2F2',
  slate: '#64748B',
  bg: '#F8FAFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMid: '#475569',
  textSoft: '#94A3B8',
  white: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.7)',
};

// ─── Task completion derived progress ────────────────────────────────────────
function getMilestoneProgress(milestone) {
  const tasks = milestone.tasks || [];
  if (tasks.length === 0) return { completed: 0, total: 0, pct: 0 };
  const completed = tasks.filter((t) => t.isCompleted).length;
  return { completed, total: tasks.length, pct: Math.round((completed / tasks.length) * 100) };
}


// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }

function fmtDate(ds) {
  if (!ds) return '';
  const d = new Date(ds + 'T00:00:00');
  if (isNaN(d.getTime())) return ds;
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDue(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_META = {
  'Completed':  { color: C.green,  bg: C.greenPale,  border: C.greenBorder,  icon: 'checkmark-circle' },
  'In Progress':{ color: C.blue,   bg: C.bluePale,   border: C.blueBorder,   icon: 'time' },
  'On Hold':    { color: C.amber,  bg: C.amberPale,  border: C.amberBorder,  icon: 'pause-circle' },
  'Pending':    { color: C.textSoft, bg: '#F1F5F9', border: C.border,        icon: 'ellipse-outline' },
};








// ─── Daily log form (notes + photos only, no manual %) ───────────────────────
function LogForm({ visible, milestones, preselectedMilestone, onClose, onSubmit, submitting }) {
  const { showToast } = useToast();
  const [milestoneId, setMilestoneId]     = useState('');
  const [milestoneName, setMilestoneName] = useState('');
  const [description, setDescription]     = useState('');
  const [localUris, setLocalUris]         = useState([]);
  const [photos, setPhotos]               = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPicker, setShowPicker]       = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setDescription('');
      setLocalUris([]);
      setPhotos([]);
      if (preselectedMilestone) {
        setMilestoneId(preselectedMilestone._id);
        setMilestoneName(preselectedMilestone.name);
      } else {
        setMilestoneId('');
        setMilestoneName('');
      }
    }
  }, [visible, preselectedMilestone?._id]);

  const handlePhotoResult = async (result) => {
    if (!result.canceled && result.assets?.length > 0) {
      const uris = result.assets.map((a) => a.uri);
      setLocalUris((prev) => [...prev, ...uris]);
      setUploadingPhoto(true);
      try {
        const uploaded = await Promise.all(
          uris.map((u) => cloudinaryService.uploadFile(u, `site_${Date.now()}.jpg`, 'image/jpeg'))
        );
        setPhotos((prev) => [...prev, ...uploaded]);
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showToast('Allow photo access in settings.', 'error'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 5 - localUris.length,
      });
      await handlePhotoResult(result);
    } catch { showToast('Could not pick photo', 'error'); }
  };

  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { showToast('Allow camera access in settings.', 'error'); return; }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      await handlePhotoResult(result);
    } catch { showToast('Could not capture photo', 'error'); }
  };

  const pickPhoto = () => {
    setShowPhotoOptions(true);
  };

  const removePhoto = (i) => {
    setLocalUris((prev) => prev.filter((_, idx) => idx !== i));
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    if (!description.trim()) { showToast('Add a description.', 'error'); return; }
    if (photos.length === 0) { showToast('Add at least one site photo.', 'error'); return; }
    onSubmit({ milestoneId, milestoneName: milestoneName || 'General', description, photos });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.formOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <AdaptiveGlass intensity={20} style={[styles.formSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Record Site Progress</Text>
              <TouchableOpacity style={styles.formCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={C.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Milestone picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Linked Milestone</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setShowPicker(!showPicker);
                  }}
                >
                  <Feather name="flag" size={16} color={milestoneId ? C.blue : C.textSoft} />
                  <Text style={[styles.pickerBtnText, milestoneId && { color: C.text }]}>
                    {milestoneName || 'General Update'}
                  </Text>
                  <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={14} color={C.textSoft} />
                </TouchableOpacity>

                {showPicker && (
                  <View style={styles.pickerDropdown}>
                    <TouchableOpacity
                      style={styles.pickerOption}
                      onPress={() => { setMilestoneId(''); setMilestoneName(''); setShowPicker(false); }}
                    >
                      <MaterialCommunityIcons name="layers-outline" size={16} color={C.textSoft} />
                      <Text style={styles.pickerOptionText}>General</Text>
                    </TouchableOpacity>
                    {milestones.map((m) => {
                      const { pct } = getMilestoneProgress(m);
                      const sm = STATUS_META[m.status] || STATUS_META['Pending'];
                      return (
                        <TouchableOpacity
                          key={m._id}
                          style={[styles.pickerOption, milestoneId === m._id && styles.pickerOptionActive]}
                          onPress={() => { setMilestoneId(m._id); setMilestoneName(m.name); setShowPicker(false); }}
                        >
                          <View style={[styles.pickerOptionDot, { backgroundColor: sm.color }]} />
                          <Text style={[styles.pickerOptionText, milestoneId === m._id && { color: C.blue }]} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text style={styles.pickerOptionPct}>{pct}%</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Site Activities / Notes</Text>
                <View style={styles.textAreaWrapper}>
                  <TextInput
                    style={styles.descInput}
                    multiline
                    numberOfLines={4}
                    placeholder="Describe today's activities, observations, or blockers..."
                    placeholderTextColor={C.textSoft}
                    value={description}
                    onChangeText={(t) => setDescription(t.slice(0, 300))}
                  />
                  <Text style={styles.charCount}>{description.length}/300</Text>
                </View>
              </View>

              {/* Photos */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Progress Evidence (Photos)</Text>
                <View style={styles.photoGrid}>
                  {localUris.map((uri, i) => (
                    <View key={i} style={styles.photoItem}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                        <Ionicons name="close-circle" size={20} color={C.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {localUris.length < 5 && (
                    <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto} disabled={uploadingPhoto}>
                      {uploadingPhoto ? (
                        <ActivityIndicator size="small" color={C.blue} />
                      ) : (
                        <View style={styles.photoAddInner}>
                          <Feather name="camera" size={24} color={C.blue} />
                          <Text style={styles.photoAddText}>Add Photo</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (submitting || uploadingPhoto) && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting || uploadingPhoto}
              >
                <LinearGradient
                  colors={[C.blue, C.blueDark]}
                  style={styles.submitBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {submitting ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Text style={styles.submitBtnText}>Submit Site Update</Text>
                      <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </AdaptiveGlass>
        </View>
        
        {/* Photo Options Modal/Sheet */}
        {showPhotoOptions && (
          <View style={styles.photoOptionsOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowPhotoOptions(false)} />
            <View style={styles.photoOptionsSheet}>
              <Text style={styles.photoOptionsTitle}>Add Photo</Text>
              <Text style={styles.photoOptionsSub}>Select a source for your evidence</Text>

              <View style={styles.photoOptionList}>
                <TouchableOpacity 
                  style={styles.photoOptionBtn} 
                  onPress={() => { setShowPhotoOptions(false); pickFromCamera(); }}
                >
                  <View style={[styles.photoOptionIcon, { backgroundColor: C.bluePale }]}>
                    <Feather name="camera" size={24} color={C.blue} />
                  </View>
                  <Text style={styles.photoOptionText}>Take Photo</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.border} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.photoOptionBtn} 
                  onPress={() => { setShowPhotoOptions(false); pickFromGallery(); }}
                >
                  <View style={[styles.photoOptionIcon, { backgroundColor: C.greenPale }]}>
                    <Feather name="image" size={24} color={C.green} />
                  </View>
                  <Text style={styles.photoOptionText}>Choose from Gallery</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.border} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.photoOptionCancel} onPress={() => setShowPhotoOptions(false)}>
                <Text style={styles.photoOptionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Log card (site diary entry) ─────────────────────────────────────────────
function LogCard({ log, canDelete, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <AdaptiveGlass intensity={15} tint="light" style={styles.logCard}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.85}>
        <View style={styles.logCardTop}>
          <View style={styles.logMsTag}>
            <Feather name="flag" size={10} color={C.blue} />
            <Text style={styles.logMsTagText} numberOfLines={1}>{log.milestoneName}</Text>
          </View>
          <Text style={styles.logTime}>{fmtTime(log.createdAt)}</Text>
          {canDelete && (
            <TouchableOpacity onPress={() => onDelete(log._id)} style={styles.logDeleteBtn}>
              <Feather name="trash-2" size={14} color={C.red} />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.logDesc} numberOfLines={expanded ? undefined : 3}>{log.description}</Text>
        
        {log.photos?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.logPhotoScroll}>
            {log.photos.map((uri, i) => (
              <View key={i} style={styles.logPhotoWrapper}>
                <Image source={{ uri }} style={styles.logPhoto} />
              </View>
            ))}
          </ScrollView>
        )}
        
        <View style={styles.logFooter}>
          <View style={styles.logAuthor}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorAvatarText}>{log.loggedByName?.charAt(0)}</Text>
            </View>
            <Text style={styles.logFooterText} numberOfLines={1}>{log.loggedByName}</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textSoft} />
        </View>
      </TouchableOpacity>
    </AdaptiveGlass>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
export default function ProjectProgressTab() {
  const insets = useSafeAreaInsets();
  const { id: projectId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [projectMembers, setProjectMembers] = useState([]);
  const [projectObj, setProjectObj] = useState(null);

  const isLocked = isProjectLocked(projectObj);
  const canView   = hasProjectPermissionWithMembers(user, projectMembers, 'workprogress:view');
  const canCreate = !isLocked && hasProjectPermissionWithMembers(user, projectMembers, 'workprogress:create');
  const canDelete = !isLocked && hasProjectPermissionWithMembers(user, projectMembers, 'workprogress:delete');

  const [subTab, setSubTab]         = useState('logs');
  const [milestones, setMilestones] = useState([]);
  const [logs, setLogs]             = useState([]);
  const [logPeriod, setLogPeriod]   = useState('week');
  const [isLoading, setIsLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [preselected, setPreselected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Milestone status filter
  const [msFilter, setMsFilter] = useState('all');

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const [ms, lg, projRes] = await Promise.all([
        milestoneService.getProjectMilestones(projectId, token),
        workProgressService.getLogs(projectId, token, logPeriod),
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json())
      ]);
      if (Array.isArray(ms)) setMilestones(ms);
      if (Array.isArray(lg)) setLogs(lg);
      if (projRes) {
        setProjectObj(projRes);
        if (projRes.members) setProjectMembers(projRes.members);
      }
    } catch { showToast('Failed to load data', 'error'); }
    finally { setIsLoading(false); setRefreshing(false); }
  }, [projectId, token, logPeriod]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time: re-fetch when any team member mutates data in this project
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchAll(true);
    socket.on('workprogress:created', refresh);
    socket.on('workprogress:deleted', refresh);
    socket.on('milestone:created',   refresh);
    socket.on('milestone:updated',   refresh);
    socket.on('milestone:deleted',   refresh);
    return () => {
      socket.off('workprogress:created', refresh);
      socket.off('workprogress:deleted', refresh);
      socket.off('milestone:created',   refresh);
      socket.off('milestone:updated',   refresh);
      socket.off('milestone:deleted',   refresh);
    };
  }, [socket, fetchAll]);

  // ── Submit log ───────────────────────────────────────────────────────────
  const handleSubmit = async (data) => {
    try {
      setSubmitting(true);
      const { ok, data: json } = await workProgressService.createLog(projectId, token, { ...data, date: todayStr() });
      if (!ok) { showToast(json.message || 'Failed', 'error'); return; }
      showToast('Site note saved!', 'success');
      setShowForm(false);
      setPreselected(null);
      fetchAll(true);
    } finally { setSubmitting(false); }
  };

  // ── Delete log ───────────────────────────────────────────────────────────
  const handleDelete = (logId) => {
    Alert.alert('Delete', 'Remove this site note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await workProgressService.deleteLog(projectId, logId, token);
          showToast('Deleted', 'success');
          fetchAll(true);
        },
      },
    ]);
  };

  // ── Open form with preselected milestone ─────────────────────────────────
  const openNoteFor = (milestone) => {
    setPreselected(milestone);
    setShowForm(true);
  };

  // ── Filtered milestones ──────────────────────────────────────────────────
  const filteredMs = useMemo(() => {
    if (msFilter === 'all') return milestones;
    return milestones.filter((m) => m.status === msFilter);
  }, [milestones, msFilter]);

  // ── Grouped logs by date ─────────────────────────────────────────────────
  const groupedLogs = useMemo(() => {
    const g = {};
    logs.forEach((l) => { if (!g[l.date]) g[l.date] = []; g[l.date].push(l); });
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  if (!canView) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Access Restricted</Text>
        <Text style={styles.emptySub}>You don't have permission to view work progress.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.blue} />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* ══ SITE DIARY ══ */}
      <>
          <View style={styles.logsHeader}>
            <View>
              <Text style={styles.bentoTitle}>Progress</Text>
              <Text style={styles.bentoSub}>Track daily site updates</Text>
            </View>
            {canCreate && (
              <TouchableOpacity style={styles.uploadPill} onPress={() => { setPreselected(null); setShowForm(true); }}>
                <Feather name="plus" size={14} color="#FFF" />
                <Text style={styles.uploadPillText}>Record</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Period filter */}
          <View style={styles.periodRow}>
            {[['today', 'Today'], ['week', 'This Week'], ['month', 'Month']].map(([k, lbl]) => (
              <TouchableOpacity
                key={k}
                style={[styles.periodChip, logPeriod === k && styles.periodChipActive]}
                onPress={() => setLogPeriod(k)}
              >
                <Text style={[styles.periodChipText, logPeriod === k && styles.periodChipTextActive]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {groupedLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No site notes</Text>
              <Text style={styles.emptySub}>Document daily activities with notes and photos</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(true); }} tintColor={C.blue} />}
              showsVerticalScrollIndicator={false}
            >
              {groupedLogs.map(([date, dateLogs]) => (
                <View key={date}>
                  <View style={styles.dateHeader}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateLabel}>{fmtDate(date)}</Text>
                    <View style={styles.dateLine} />
                  </View>
                  {dateLogs.map((log) => (
                    <LogCard key={log._id} log={log} canDelete={canDelete} onDelete={handleDelete} />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

        </>


      {/* Log form — only rendered for users with workprogress:create */}
      {canCreate && (
        <LogForm
          visible={showForm}
          milestones={milestones}
          preselectedMilestone={preselected}
          onClose={() => { setShowForm(false); setPreselected(null); }}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const PHOTO_SIZE = (SCREEN_W - 20 * 2 - 12 * 2) / 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textSoft, fontFamily: 'Inter-SemiBold' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, color: C.text, marginTop: 16 , fontFamily: 'Inter-Black' },
  emptySub: { fontSize: 14, color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Sub Tab Bar
  subTabBarWrapper: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  subTabBar: { 
    flexDirection: 'row', 
    backgroundColor: '#F8FAFF', 
    borderRadius: 20, 
    padding: 6,
    borderWidth: 1,
    borderColor: '#D1E9FF',
    overflow: 'hidden'
  },
  subTab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: 14,
    gap: 6,
    overflow: 'hidden'
  },
  subTabActive: { backgroundColor: '#3B82F6' },
  subTabTextActive: { color: '#FFF', fontSize: 12, fontFamily: 'Inter-Black' },

  // Filters
  filterScrollView: { flexGrow: 0, marginBottom: 4 },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 12 },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 12, 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterChipText: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  filterChipTextActive: { color: '#FFF', fontFamily: 'Inter-Bold' },

  // Header Section
  logsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 0, marginBottom: 16 },
  bentoTitle: { fontSize: 20, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  bentoSub: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 4 },
  uploadPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  uploadPillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  projectHeader: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },
  sectionLabel: { fontSize: 11, color: '#94A3B8', letterSpacing: 1, marginBottom: 12 , fontFamily: 'Inter-Black' },
  mainProgressCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 24, 
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden'
  },
  mainProgressLeft: { marginRight: 20 },
  mainProgressRight: { flex: 1 },
  mainProgressTitle: { fontSize: 17, color: '#0F172A', marginBottom: 4 , fontFamily: 'Inter-Black' },
  mainProgressSub: { fontSize: 13, color: '#64748B', marginBottom: 12 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { 
    flexGrow: 1, 
    minWidth: 90,
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 16, 
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    overflow: 'hidden'
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statVal: { fontSize: 16, color: '#0F172A' , fontFamily: 'Inter-Black' },
  statLabel: { fontSize: 10, color: '#64748B', textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },

  // Progress Components
  progressContainer: { backgroundColor: '#F1F5F9', borderRadius: 10, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 10 },
  ringInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontFamily: 'Inter-Black' },

  // Milestone Cards
  msCard: { 
    borderRadius: 24, 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    marginBottom: 16,
    overflow: 'hidden'
  },
  msCardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  msCardInfo: { flex: 1, gap: 6 },
  msCardName: { fontSize: 15, color: '#0F172A' , fontFamily: 'Inter-Black' },
  msCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, textTransform: 'uppercase' , fontFamily: 'Inter-Black' },
  duePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  duePillText: { fontSize: 11, color: '#94A3B8' , fontFamily: 'Inter-SemiBold' },
  msTaskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  msTaskCount: { fontSize: 12, color: '#475569' , fontFamily: 'Inter-Bold' },
  msPctText: { fontSize: 13, fontFamily: 'Inter-Black' },
  expandIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },

  // Expanded Tasks
  msExpanded: { paddingHorizontal: 16, paddingBottom: 16 },
  msExpandedDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 16 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  taskCheck: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  taskTitle: { flex: 1, fontSize: 14, color: '#334155' , fontFamily: 'Inter-Medium' },
  taskTitleDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  taskAssignee: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  taskAssigneeText: { fontSize: 10, color: '#64748B' , fontFamily: 'Inter-Black' },
  
  addNoteBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  addNoteBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  addNoteBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter-Bold' },

  // Site Diary Logs
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 16 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dateLabel: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 , fontFamily: 'Inter-Black' },
  
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  periodChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  periodChipText: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  periodChipTextActive: { color: '#FFF', fontFamily: 'Inter-Bold' },

  logCard: { 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    padding: 16, 
    marginBottom: 16,
    overflow: 'hidden'
  },
  logCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logMsTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#EFF6FF', flex: 1, marginRight: 10 },
  logMsTagText: { fontSize: 11, color: '#3B82F6', fontFamily: 'Inter-Bold' },
  logTime: { fontSize: 12, color: '#94A3B8', fontFamily: 'Inter-Medium' },
  logDeleteBtn: { width: 28, height: 28, backgroundColor: '#FEF2F2', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', marginLeft: 12 },
  
  logDesc: { fontSize: 14, color: '#334155', lineHeight: 22, marginBottom: 12, fontFamily: 'Inter-Regular' },
  logPhotoScroll: { marginBottom: 12 },
  logPhotoWrapper: { marginRight: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  logPhoto: { width: 100, height: 100 },
  
  logFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  logAuthor: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 10 },
  authorAvatar: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  authorAvatarText: { fontSize: 10, color: '#64748B', fontFamily: 'Inter-Black' },
  logFooterText: { fontSize: 12, color: '#475569', fontFamily: 'Inter-SemiBold' },

  // FAB
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, overflow: 'hidden', elevation: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  fabGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Form Modals
  formOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  formSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%', overflow: 'hidden' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  formTitle: { fontSize: 22, color: '#0F172A' , fontFamily: 'Inter-Black' },
  formCloseBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  
  inputGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: '#475569', marginBottom: 10 , fontFamily: 'Inter-Bold' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, gap: 12 },
  pickerBtnText: { flex: 1, fontSize: 15, color: '#94A3B8' , fontFamily: 'Inter-Medium' },
  pickerDropdown: { marginTop: 8, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', elevation: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  pickerOptionActive: { backgroundColor: '#F8FAFF' },
  pickerOptionDot: { width: 8, height: 8, borderRadius: 4 },
  pickerOptionText: { flex: 1, fontSize: 14, color: '#334155' , fontFamily: 'Inter-SemiBold' },
  pickerOptionPct: { fontSize: 12, color: '#94A3B8' , fontFamily: 'Inter-Black' },
  
  textAreaWrapper: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 12 },
  descInput: { height: 120, fontSize: 15, color: '#0F172A', textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 4 , fontFamily: 'Inter-SemiBold' },
  
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoItem: { width: PHOTO_SIZE, height: PHOTO_SIZE },
  photoThumb: { width: '100%', height: '100%', borderRadius: 16 },
  photoRemove: { position: 'absolute', top: -6, right: -6, zIndex: 1 },
  photoAdd: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#3B82F6', backgroundColor: '#EFF6FF', overflow: 'hidden' },
  photoAddInner: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  photoAddText: { fontSize: 11, color: '#3B82F6' , fontFamily: 'Inter-Bold' },
  
  submitBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  submitBtnGrad: { height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { fontSize: 16, color: '#FFF' , fontFamily: 'Inter-Black' },
  
  // Photo Options Modal
  photoOptionsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end', zIndex: 100 },
  photoOptionsSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  photoOptionsTitle: { fontSize: 20, color: '#0F172A', marginBottom: 4 , fontFamily: 'Inter-Black' },
  photoOptionsSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  photoOptionList: { backgroundColor: '#F8FAFF', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  photoOptionBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, gap: 16 },
  photoOptionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  photoOptionText: { flex: 1, fontSize: 16, color: '#0F172A' , fontFamily: 'Inter-SemiBold' },
  photoOptionCancel: { paddingVertical: 16, alignItems: 'center', borderRadius: 16, backgroundColor: '#FEF2F2' },
  photoOptionCancelText: { fontSize: 16, color: '#EF4444' , fontFamily: 'Inter-Bold' },
});