import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const NODE_META = {
  building: { icon: 'business-outline', childType: 'floor', childrenField: 'floors' },
  floor: { icon: 'layers-outline', childType: 'zone', childrenField: 'zones' },
  zone: { icon: 'location-outline', childType: 'area', childrenField: 'areas' },
  area: { icon: 'resize-outline', childType: 'package', childrenField: 'packages' },
  package: { icon: 'hammer-outline', childType: null, childrenField: null },
};

const TRADES = [
  { value: 'civil', label: 'Civil & Structural' },
  { value: 'interior', label: 'Interior Finishing' },
  { value: 'mep', label: 'MEP Services' },
  { value: 'electrical', label: 'Electrical Works' },
  { value: 'hvac', label: 'HVAC Install' },
  { value: 'phe', label: 'PHE Services' },
  { value: 'fire_fighting', label: 'Fire Fighting' },
  { value: 'elv', label: 'ELV Systems' },
  { value: 'other', label: 'Other Trades' },
];

export default function InteriorWbsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [wbsData, setWbsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [currentNodeType, setCurrentNodeType] = useState('building');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [packageTrade, setPackageTrade] = useState('interior');
  const [submitting, setSubmitting] = useState(false);

  const fetchWbs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/wbs`);
      setWbsData(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.warn('Failed to load WBS', e);
      setWbsData([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchWbs(); }, [fetchWbs]));

  const toggleNode = (id) => {
    setExpandedNodes((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  };

  const openCreate = (type, parentId) => {
    setModalType('create');
    setCurrentNodeType(type);
    setSelectedParentId(parentId);
    setNodeName('');
    setPackageTrade('interior');
    setIsModalOpen(true);
  };

  const openEdit = (node) => {
    setModalType('edit');
    setCurrentNodeType(node.type);
    setCurrentNodeId(node.id);
    setNodeName(node.name);
    if (node.trade) setPackageTrade(node.trade);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!nodeName.trim()) {
      showToast('Node name is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (modalType === 'create') {
        await interiorApiClient.post(`/projects/${projectId}/wbs`, {
          type: currentNodeType,
          name: nodeName,
          parentId: selectedParentId || undefined,
          trade: currentNodeType === 'package' ? packageTrade : undefined,
        });
      } else {
        await interiorApiClient.put(`/projects/${projectId}/wbs`, {
          type: currentNodeType,
          id: currentNodeId,
          name: nodeName,
          trade: currentNodeType === 'package' ? packageTrade : undefined,
        });
      }
      setIsModalOpen(false);
      fetchWbs();
    } catch (e) {
      showToast(e.message || 'Failed to save node', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (node) => {
    Alert.alert(
      `Delete ${node.type}?`,
      'This will remove it and any associated associations.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(node) },
      ]
    );
  };

  const handleDelete = async (node) => {
    try {
      await interiorApiClient.delete(`/projects/${projectId}/wbs?type=${node.type}&id=${node.id}`);
      showToast(`${node.type.toUpperCase()} deleted successfully`, 'delete');
      fetchWbs();
    } catch (e) {
      showToast(e.message || 'Failed to delete node. Check if it contains children.', 'error');
    }
  };

  const renderTree = (nodes, depth = 0) => (
    <View style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {nodes.map((node) => {
        const meta = NODE_META[node.type] || NODE_META.package;
        const children = meta.childrenField ? node[meta.childrenField] || [] : [];
        const hasChildren = children.length > 0;
        const isExpanded = expandedNodes.includes(node.id);

        return (
          <View key={node.id} style={{ marginBottom: 8 }}>
            <View style={s.nodeRow}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}
                onPress={() => meta.childType && toggleNode(node.id)}
                activeOpacity={meta.childType ? 0.6 : 1}
              >
                {meta.childType ? (
                  <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={14} color="#94A3B8" />
                ) : (
                  <View style={{ width: 14 }} />
                )}
                <Ionicons name={meta.icon} size={16} color="#2563EB" />
                <Text style={s.nodeName} numberOfLines={1}>{node.name}</Text>
                {!!node.trade && (
                  <View style={s.tradeTag}>
                    <Text style={s.tradeTagText}>{node.trade}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {meta.childType && (
                  <TouchableOpacity onPress={() => openCreate(meta.childType, node.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="add-circle-outline" size={17} color="#2563EB" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openEdit(node)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="pencil-outline" size={15} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(node)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            {isExpanded && hasChildren && (
              <View style={s.childrenWrap}>
                {renderTree(children, depth + 1)}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Work Breakdown Structure</Text>
            <Text style={s.headerSub}>Define physical areas and assign trade packages.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {wbsData.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="business-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No buildings defined yet</Text>
                <Text style={s.emptySub}>Tap "Add Building" to initialize project scope.</Text>
              </View>
            ) : (
              renderTree(wbsData)
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={() => openCreate('building', '')}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{modalType === 'create' ? `Add New ${currentNodeType}` : `Edit ${currentNodeType}`}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Node Name *</Text>
              <TextInput
                style={s.input}
                placeholder={`e.g. ${currentNodeType === 'building' ? 'Tower A' : currentNodeType === 'floor' ? '12th Floor' : 'Name'}`}
                placeholderTextColor="#94A3B8"
                value={nodeName}
                onChangeText={setNodeName}
              />

              {currentNodeType === 'package' && (
                <>
                  <Text style={s.label}>Trade / Discipline</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {TRADES.map((t) => (
                      <TouchableOpacity key={t.value} style={[s.chip, packageTrade === t.value && s.chipActive]} onPress={() => setPackageTrade(t.value)}>
                        <Text style={[s.chipText, packageTrade === t.value && s.chipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSave} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save Node</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  nodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 10, gap: 10,
  },
  nodeName: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', flexShrink: 1 },
  tradeTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tradeTagText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase' },
  childrenWrap: { borderLeftWidth: 1, borderLeftColor: '#F1F5F9', marginTop: 8, paddingLeft: 4 },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', textTransform: 'capitalize' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});
