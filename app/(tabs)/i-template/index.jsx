import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import HeaderNotification from '../../components/HeaderNotification';
import ConfirmModal from '../../components/ConfirmModal';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function InteriorTemplatesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [area, setArea] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [catName, setCatName] = useState('');
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);
    try {
      const [catRes, tplRes] = await Promise.all([
        fetch(`${API_BASE_URL}/template-categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/templates`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const catData = await catRes.json();
      const tplData = await tplRes.json();
      if (catRes.ok) setCategories(catData);
      if (tplRes.ok) setTemplates(tplData);
    } catch (e) {
      console.error('Fetch interior templates error', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filteredTemplates = templates.filter((t) =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCategories = categories.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const templateCountFor = (categoryId) =>
    templates.filter((t) => (t.category?._id || t.category) === categoryId).length;

  const openCreateTemplate = () => {
    setTitle('');
    setDescription('');
    setMinBudget('');
    setMaxBudget('');
    setArea('');
    setEstimatedDays('');
    setCategory(categories[0]?._id || null);
    setIsTemplateModalVisible(true);
  };

  const handleCreateTemplate = async () => {
    if (!title.trim() || !category) return showToast('Please enter a title and select a category.', 'error');
    setIsSubmittingTemplate(true);
    try {
      const res = await fetch(`${API_BASE_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: title.trim(),
          category,
          description: description.trim(),
          minBudget: Number(minBudget) || 0,
          maxBudget: Number(maxBudget) || 0,
          area: Number(area) || 0,
          estimatedDays: Number(estimatedDays) || 0,
          images: [],
          files: [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => [data, ...prev]);
        setIsTemplateModalVisible(false);
        showToast('Template created successfully!', 'success');
      } else {
        showToast(data.message || 'Failed to create template.', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) return showToast('Please enter a category name.', 'error');
    setIsSubmittingCategory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/template-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => [...prev, data]);
        setIsCategoryModalVisible(false);
        setCatName('');
        showToast('Category created!', 'success');
      } else {
        showToast(data.message || 'Failed to create category.', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/templates/${deletingTemplate._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t._id !== deletingTemplate._id));
        showToast('Template deleted.', 'success');
      } else {
        showToast('Failed to delete template.', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsDeleting(false);
      setDeletingTemplate(null);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/template-categories/${deletingCategory._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c._id !== deletingCategory._id));
        setTemplates((prev) => prev.filter((t) => (t.category?._id || t.category) !== deletingCategory._id));
        showToast('Category deleted.', 'success');
      } else {
        showToast('Failed to delete category.', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsDeleting(false);
      setDeletingCategory(null);
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.headerGreeting}>Workspace</Text>
            <Text style={s.pageTitle}>Templates</Text>
          </View>
          <HeaderNotification />
        </View>

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchData(true)} tintColor="#2563EB" colors={['#2563EB']} />}
          >
            {/* Stats */}
            <View style={s.statsGrid}>
              <StatCard icon="layers-outline" iconBg="#F0F9FF" iconColor="#0284C7" label="Total Templates" value={`${templates.length}`} sub="blueprints" />
              <StatCard icon="folder-open-outline" iconBg="#EEF2FF" iconColor="#4F46E5" label="Categories" value={`${categories.length}`} />
            </View>

            {/* Tab switcher */}
            <View style={s.tabSwitcher}>
              <TouchableOpacity style={[s.tabBtn, activeTab === 'templates' && s.tabBtnActive]} onPress={() => setActiveTab('templates')}>
                <Text style={[s.tabBtnText, activeTab === 'templates' && s.tabBtnTextActive]}>Templates ({templates.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tabBtn, activeTab === 'categories' && s.tabBtnActive]} onPress={() => setActiveTab('categories')}>
                <Text style={[s.tabBtnText, activeTab === 'categories' && s.tabBtnTextActive]}>Categories ({categories.length})</Text>
              </TouchableOpacity>
            </View>

            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder={activeTab === 'templates' ? 'Search templates...' : 'Search categories...'}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {activeTab === 'templates' ? (
              <View style={{ marginTop: 14, gap: 12 }}>
                {filteredTemplates.length === 0 ? (
                  <View style={s.empty}>
                    <Ionicons name="layers-outline" size={44} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No templates found</Text>
                    <TouchableOpacity style={s.emptyBtn} onPress={openCreateTemplate}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={s.emptyBtnText}>Create Template</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredTemplates.map((t) => (
                    <TouchableOpacity
                      key={t._id}
                      style={s.templateCard}
                      onPress={() => router.push({
                        pathname: '/view-template',
                        params: {
                          id: t._id,
                          title: t.name,
                          category: t.category?.name,
                          description: t.description,
                          minBudget: t.minBudget,
                          maxBudget: t.maxBudget,
                          area: t.area,
                          estimatedDays: t.estimatedDays,
                        },
                      })}
                    >
                      <View style={s.templateTopRow}>
                        <View style={s.categoryBadge}>
                          <Text style={s.categoryBadgeText}>{t.category?.name || 'Uncategorized'}</Text>
                        </View>
                        {!!t.updatedAt && (
                          <Text style={s.updatedText}>
                            Updated {new Date(t.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        )}
                      </View>
                      <Text style={s.templateTitle}>{t.name}</Text>
                      {!!t.description && <Text style={s.templateDesc} numberOfLines={2}>{t.description}</Text>}
                      <View style={s.templateStatsRow}>
                        {(t.minBudget > 0 || t.maxBudget > 0) && (
                          <View style={s.templateStat}>
                            <Ionicons name="wallet-outline" size={13} color="#2563EB" />
                            <Text style={s.templateStatText}>${t.minBudget || 0} - ${t.maxBudget || 0}</Text>
                          </View>
                        )}
                        {t.area > 0 && (
                          <View style={s.templateStat}>
                            <Ionicons name="map-outline" size={13} color="#4F46E5" />
                            <Text style={s.templateStatText}>{t.area} sqft</Text>
                          </View>
                        )}
                        {t.estimatedDays > 0 && (
                          <View style={s.templateStat}>
                            <Ionicons name="time-outline" size={13} color="#16A34A" />
                            <Text style={s.templateStatText}>{t.estimatedDays} days</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.templateBottomRow}>
                        <View style={s.applyBtn}>
                          <Text style={s.applyBtnText}>View Template</Text>
                          <Ionicons name="arrow-forward" size={13} color="#2563EB" />
                        </View>
                        <TouchableOpacity onPress={() => setDeletingTemplate(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : (
              <View style={{ marginTop: 14, gap: 12 }}>
                {filteredCategories.length === 0 ? (
                  <View style={s.empty}>
                    <Ionicons name="folder-open-outline" size={44} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No categories found</Text>
                  </View>
                ) : (
                  filteredCategories.map((c) => (
                    <View key={c._id} style={s.categoryCard}>
                      <View style={s.categoryTopRow}>
                        <View style={s.categoryIconBox}>
                          <Ionicons name="folder-open-outline" size={18} color="#4F46E5" />
                        </View>
                        <TouchableOpacity onPress={() => setDeletingCategory(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      <Text style={s.categoryName}>{c.name}</Text>
                      <View style={s.categoryBottomRow}>
                        <Text style={s.categoryCount}>{templateCountFor(c._id)} Templates</Text>
                        <Text style={s.categoryActive}>Active</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity
          style={s.fab}
          onPress={() => (activeTab === 'templates' ? openCreateTemplate() : setIsCategoryModalVisible(true))}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Create Template Modal */}
      <Modal visible={isTemplateModalVisible} animationType="slide" transparent onRequestClose={() => setIsTemplateModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Workflow Template</Text>
              <TouchableOpacity onPress={() => setIsTemplateModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Template Title</Text>
              <TextInput style={s.input} placeholder="e.g. Luxury Apartment 3BHK Blueprint" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

              <Text style={s.label}>Category</Text>
              {categories.length === 0 ? (
                <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' }}>Create a category first.</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map((c) => (
                    <TouchableOpacity key={c._id} style={[s.optionChip, category === c._id && s.optionChipActive]} onPress={() => setCategory(c._id)}>
                      <Text style={[s.optionChipText, category === c._id && s.optionChipTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Describe included rooms, veneers, and BOQ items..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Min Budget</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor="#94A3B8" value={minBudget} onChangeText={setMinBudget} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Max Budget</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor="#94A3B8" value={maxBudget} onChangeText={setMaxBudget} keyboardType="numeric" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Area (sqft)</Text>
                  <TextInput style={s.input} placeholder="e.g. 1200" placeholderTextColor="#94A3B8" value={area} onChangeText={setArea} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Estimated Days</Text>
                  <TextInput style={s.input} placeholder="e.g. 45" placeholderTextColor="#94A3B8" value={estimatedDays} onChangeText={setEstimatedDays} keyboardType="numeric" />
                </View>
              </View>

              <TouchableOpacity style={s.saveBtn} onPress={handleCreateTemplate} disabled={isSubmittingTemplate}>
                {isSubmittingTemplate ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="send" size={15} color="#FFFFFF" />
                    <Text style={s.saveBtnText}>Save Template</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Category Modal */}
      <Modal visible={isCategoryModalVisible} animationType="slide" transparent onRequestClose={() => setIsCategoryModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Template Category</Text>
              <TouchableOpacity onPress={() => setIsCategoryModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Category Name</Text>
              <TextInput style={s.input} placeholder="e.g. Hospitality & Retail" placeholderTextColor="#94A3B8" value={catName} onChangeText={setCatName} />

              <TouchableOpacity style={s.saveBtn} onPress={handleCreateCategory} disabled={isSubmittingCategory}>
                {isSubmittingCategory ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="send" size={15} color="#FFFFFF" />
                    <Text style={s.saveBtnText}>Save Category</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmModal
        visible={!!deletingTemplate}
        title="Delete Template"
        message={`Are you sure you want to delete "${deletingTemplate?.name}"?`}
        confirmText="Delete"
        type="destructive"
        isSubmitting={isDeleting}
        onConfirm={handleConfirmDeleteTemplate}
        onCancel={() => setDeletingTemplate(null)}
      />

      <ConfirmModal
        visible={!!deletingCategory}
        title="Delete Category"
        message={`Are you sure you want to delete "${deletingCategory?.name}"? Templates in this category will also be removed.`}
        confirmText="Delete"
        type="destructive"
        isSubmitting={isDeleting}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setDeletingCategory(null)}
      />
    </View>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, sub }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>
        {value} {!!sub && <Text style={s.statValueSub}>{sub}</Text>}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  header: {
    backgroundColor: '#DBEAFE', paddingHorizontal: 24, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  headerGreeting: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  statIconBox: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  statValue: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 2 },
  statValueSub: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  tabSwitcher: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginTop: 16, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabBtnTextActive: { color: '#2563EB' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE',
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  templateCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#DBEAFE', gap: 8 },
  templateTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#4F46E5' },
  updatedText: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  templateTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  templateDesc: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 17 },
  templateStatsRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  templateStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  templateStatText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569' },
  templateBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10, marginTop: 2,
  },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  applyBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  categoryCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#DBEAFE', gap: 6 },
  categoryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryIconBox: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  categoryName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  categoryBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10, marginTop: 8,
  },
  categoryCount: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  categoryActive: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#4F46E5' },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  fab: {
    position: 'absolute', right: 20, bottom: 100,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },
  optionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  optionChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  optionChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  optionChipTextActive: { color: '#2563EB' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, marginTop: 20, marginBottom: 10 },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});
