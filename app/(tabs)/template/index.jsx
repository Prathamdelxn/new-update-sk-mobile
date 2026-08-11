import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, ScrollView, StatusBar, TextInput, Modal, DeviceEventEmitter, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import HeaderNotification from '../../components/HeaderNotification';
import ConfirmModal from '../../components/ConfirmModal';
import { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const formatCompact = (num) => {
  if (num == null || isNaN(num)) return '0';
  return Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
};

const INITIAL_TEMPLATES = [];

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function TemplateScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState([{ _id: 'All', name: 'All' }]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [templatesList, setTemplatesList] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [showFilters, setShowFilters] = useState(false);
  const [isCategoryActionSheetVisible, setIsCategoryActionSheetVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isEditCategoryModalVisible, setIsEditCategoryModalVisible] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [isDeleteCategoryModalVisible, setIsDeleteCategoryModalVisible] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);


  useEffect(() => {
    fetchInitialData();
    const sub = DeviceEventEmitter.addListener('new_template', (newTpl) => {
      setTemplatesList(prev => {
        const id = newTpl._id || newTpl.id;
        const exists = prev.some(t => (t._id || t.id) === id);
        if (exists) {
          // Replace existing template
          return prev.map(t => (t._id || t.id) === id ? newTpl : t);
        }
        // Prepend new template
        return [newTpl, ...prev];
      });
    });
    return () => sub.remove();
  }, []);

  const fetchInitialData = async () => {
    await Promise.all([fetchCategories(), fetchTemplates()]);
  };

  const fetchCategories = async () => {
    try {
      setIsCategoriesLoading(true);
      const response = await fetch(`${API_BASE_URL}/template-categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCategories([{ _id: 'All', name: 'All' }, ...data]);
      }
    } catch (e) {
      console.error('Fetch categories error', e);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setIsTemplatesLoading(true);
      const response = await fetch(`${API_BASE_URL}/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTemplatesList(data);
      }
    } catch (e) {
      console.error('Fetch templates error', e);
    } finally {
      setIsTemplatesLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      setIsAddingCategory(true);
      const response = await fetch(`${API_BASE_URL}/template-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCategoryName }),
      });

      const data = await response.json();

      if (response.ok) {
        setCategories(prev => [...prev, data]);
        setIsCategorySheetVisible(false);
        setNewCategoryName('');
        DeviceEventEmitter.emit('categories_updated');
      } else {
        showToast(data.message || 'Failed to add category', 'error');
      }
    } catch (e) {
      showToast(t('networkError'), 'error');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const openCategoryActions = (cat) => {
    setSelectedCategory(cat);
    setIsCategoryActionSheetVisible(true);
  };

  const handleEditCategory = () => {
    setEditingCategoryName(selectedCategory.name);
    setIsCategoryActionSheetVisible(false);
    setTimeout(() => setIsEditCategoryModalVisible(true), 100);
  };

  const updateCategory = async () => {
    if (!editingCategoryName.trim() || !selectedCategory) return;
    try {
      setIsUpdatingCategory(true);
      const response = await fetch(`${API_BASE_URL}/template-categories/${selectedCategory._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingCategoryName }),
      });

      const data = await response.json();
      if (response.ok) {
        setCategories(prev => prev.map(c => c._id === selectedCategory._id ? data : c));
        setIsEditCategoryModalVisible(false);
        setSelectedCategory(null);
        showToast('Category updated successfully', 'success');
        DeviceEventEmitter.emit('categories_updated');
      } else {
        showToast(data.message || 'Failed to update category', 'error');
      }
    } catch (e) {
      showToast(t('networkError'), 'error');
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const deleteCategory = async () => {
    if (!selectedCategory) return;
    setIsDeleteCategoryModalVisible(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!selectedCategory) return;

    try {
      setIsDeletingCategory(true);
      const response = await fetch(`${API_BASE_URL}/template-categories/${selectedCategory._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setCategories(prev => prev.filter(c => c._id !== selectedCategory._id));
        setTemplatesList(prev => prev.filter(t => {
          const tCatId = typeof t.category === 'object' ? t.category?._id : t.category;
          return tCatId !== selectedCategory._id;
        }));
        if (activeCategory === selectedCategory._id) {
          setActiveCategory('All');
        }
        setIsCategoryActionSheetVisible(false);
        setSelectedCategory(null);
        showToast('Category and associated templates removed.', 'delete');
        setIsDeleteCategoryModalVisible(false);
        DeviceEventEmitter.emit('categories_updated');
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to delete category', 'error');
        setIsDeleteCategoryModalVisible(false);
      }
    } catch (error) {
      console.error('Delete category error:', error);
      showToast(t('networkErrorDeleteCategory'), 'error');
      setIsDeleteCategoryModalVisible(false);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCategorySheetVisible, setIsCategorySheetVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isDeleteTemplateModalVisible, setIsDeleteTemplateModalVisible] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);

  const openTemplateActions = (item) => {
    setSelectedTemplate(item);
    setIsActionSheetVisible(true);
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    setIsDeleteTemplateModalVisible(true);
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    const templateId = selectedTemplate._id || selectedTemplate.id;

    try {
      setIsDeletingTemplate(true);
      const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setTemplatesList(prev => prev.filter(t => (t._id || t.id) !== templateId));
        setIsActionSheetVisible(false);
        setSelectedTemplate(null);
        showToast('Project template has been removed.', 'delete');
        setIsDeleteTemplateModalVisible(false);
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to delete template', 'error');
        setIsDeleteTemplateModalVisible(false);
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast(t('networkErrorDeleteTemplate'), 'error');
      setIsDeleteTemplateModalVisible(false);
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const filteredTemplates = templatesList.filter(t => {
    const matchesCategory = activeCategory === 'All' ||
      (t.category?._id === activeCategory) ||
      (t.category === activeCategory);
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderTemplateCard = ({ item }) => (
    <TouchableOpacity
      style={styles.templateCardWrapper}
      activeOpacity={0.8}
      onPress={() => openTemplateActions(item)}
    >
      <AdaptiveGlass intensity={15} tint="light" style={styles.glassCard}>
        {/* Left: Media & Area Section */}
        <View style={styles.mediaColumn}>
          <View style={styles.thumbnailContainer}>
            {item.images && item.images.length > 0 ? (
              <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="home-outline" size={32} color="#3B82F6" />
              </View>
            )}
            <View style={styles.itemCountBadge}>
              <Ionicons name="images-outline" size={10} color="#FFFFFF" />
              <Text style={styles.itemCountText}>{item.images?.length || 0}</Text>
            </View>
          </View>

          <View style={styles.areaUnderImage}>
            <Ionicons name="map-outline" size={12} color="#3B82F6" />
            <Text style={styles.areaTextUnder}>{item.area?.toLocaleString('en-US')} sqft</Text>
          </View>
        </View>

        {/* Right: Info Section */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {item.category?.name || 'Uncategorized'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openTemplateActions(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.templateTitle} numberOfLines={1}>{item.name}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="wallet-outline" size={14} color="#64748B" />
              <Text style={styles.detailText}>
                ${formatCompact(item.minBudget)} - ${formatCompact(item.maxBudget)}
              </Text>
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.assetCount}>
              <Ionicons name="document-attach-outline" size={12} color="#94A3B8" />
              <Text style={styles.assetCountText}>{item.files?.length || 0} Files Attached</Text>
            </View>
          </View>
        </View>
      </AdaptiveGlass>
    </TouchableOpacity>
  );

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <SimpleBackground />
      <SafeAreaView style={styles.container} edges={['bottom']}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }}>

            <Text style={styles.title}>{t('my')}<Text style={styles.titleHighlight}> {t('templatesTitle')}</Text></Text>
          </View>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => setIsAddModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.bellScale}>
              <HeaderNotification />
            </View>
          </View>
        </View>

        <View style={styles.searchParent}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AdaptiveGlass intensity={10} tint="light" style={[styles.searchContainer, { flex: 1, marginBottom: 0 }]}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchTemplates')}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </AdaptiveGlass>
            <TouchableOpacity
              style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
              onPress={() => setShowFilters(!showFilters)}
              activeOpacity={0.8}
            >
              <Ionicons name="options" size={20} color={showFilters ? '#FFF' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {showFilters && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat._id}
                  style={[styles.filterChip, activeCategory === cat._id && styles.filterChipActive]}
                  onPress={() => setActiveCategory(cat._id)}
                  onLongPress={() => { if (cat._id !== 'All') openCategoryActions(cat); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, activeCategory === cat._id && styles.filterChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Add Item Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isAddModalVisible}
          onRequestClose={() => setIsAddModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setIsAddModalVisible(false)}
            />

            <AdaptiveGlass intensity={60} tint="light" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('addNewItem')}</Text>
                <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalOptions}>
                <TouchableOpacity
                  style={styles.optionCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    const hasCreateCategoryPermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('category:create');
                    if (!hasCreateCategoryPermission) {
                      showToast('You do not have permission to create categories.', 'error');
                      return;
                    }
                    setIsAddModalVisible(false);
                    // Short timeout to ensure previous modal finishes closing on some platforms
                    setTimeout(() => setIsCategorySheetVisible(true), 100);
                  }}
                >
                  <View style={[styles.optionIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="folder-open" size={24} color="#2563EB" />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{t('createCategory')}</Text>
                    <Text style={styles.optionSubtitle}>{t('createYourProjectCategories')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    const hasCreateTemplatePermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('template:create');
                    if (!hasCreateTemplatePermission) {
                      showToast('You do not have permission to create templates.', 'error');
                      return;
                    }
                    setIsAddModalVisible(false);
                    router.push('/create-template');
                  }}
                >
                  <View style={[styles.optionIcon, { backgroundColor: '#F8FAFF' }]}>
                    <Ionicons name="document-text" size={24} color="#0F172A" />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{t('createProjectTemplate')}</Text>
                    <Text style={styles.optionSubtitle}>{t('buildReusableProjectKits')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
            </AdaptiveGlass>
          </View>
        </Modal>

        {/* Create Category Bottom Sheet */}
        {/* Create Category Bottom Sheet */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isCategorySheetVisible}
          statusBarTranslucent={true}
          onRequestClose={() => setIsCategorySheetVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setIsCategorySheetVisible(false)}
            />

            <AdaptiveGlass intensity={90} tint="light" style={[styles.sheetContent, { paddingBottom: insets.bottom + 24 + keyboardHeight }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>{t('createCategory')}</Text>
                  <TouchableOpacity onPress={() => setIsCategorySheetVisible(false)}>
                    <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetLabel}>{t('existingCategoriesLongPress')}</Text>
                <View style={styles.categoryBadgeGroup}>
                  {isCategoriesLoading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    categories.filter(c => c._id !== 'All').map(cat => (
                      <TouchableOpacity
                        key={cat._id}
                        style={styles.categoryBadge}
                        activeOpacity={0.7}
                        onLongPress={() => {
                          setIsCategorySheetVisible(false);
                          setTimeout(() => openCategoryActions(cat), 300);
                        }}
                      >
                        <Text style={styles.categoryBadgeText}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                <Text style={[styles.sheetLabel, { marginTop: 24 }]}>{t('categoryNameLabel')}</Text>
                <AdaptiveGlass intensity={10} tint="light" style={styles.inputContainer}>
                  <Ionicons name="folder-outline" size={20} color="#3B82F6" style={{ marginRight: 12 }} />
                  <TextInput
                    style={styles.sheetInput}
                    placeholder={t('egResidentialCommercial')}
                    placeholderTextColor="#94A3B8"
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                  />
                </AdaptiveGlass>

                <TouchableOpacity
                  style={styles.addCategoryBtn}
                  activeOpacity={0.8}
                  onPress={handleAddCategory}
                  disabled={isAddingCategory}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.addCategoryGradient}
                  >
                    {isAddingCategory ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.addCategoryText}>{t('addCategory')}</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </AdaptiveGlass>
          </View>
        </Modal>

        {/* Template Actions Sheet */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isActionSheetVisible}
          statusBarTranslucent={true}
          onRequestClose={() => setIsActionSheetVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setIsActionSheetVisible(false)}
            />

            <AdaptiveGlass intensity={90} tint="light" style={[styles.sheetContent, { paddingBottom: insets.bottom + 24, height: 'auto' }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>{t('options')}</Text>
                  <TouchableOpacity onPress={() => setIsActionSheetVisible(false)}>
                    <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.actionSheetOptions}>
                <TouchableOpacity
                  style={styles.actionSheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsActionSheetVisible(false);
                    if (selectedTemplate) {
                      router.push({
                        pathname: '/view-template',
                        params: {
                          id: selectedTemplate._id,
                          title: selectedTemplate.name,
                          category: selectedTemplate.category?.name,
                          description: selectedTemplate.description,
                          minBudget: selectedTemplate.minBudget,
                          maxBudget: selectedTemplate.maxBudget,
                          area: selectedTemplate.area
                        }
                      });
                    }
                  }}
                >
                  <View style={[styles.actionSheetIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="eye-outline" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.actionSheetText}>{t('viewTemplate')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionSheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    const hasEditTemplatePermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('template:update') || user?.role?.permissions?.includes('template:edit');
                    if (!hasEditTemplatePermission) {
                      showToast('You do not have permission to edit templates.', 'error');
                      return;
                    }
                    setIsActionSheetVisible(false);
                    if (selectedTemplate) {
                      router.push({
                        pathname: '/create-template',
                        params: {
                          isEditing: 'true',
                          id: selectedTemplate._id,
                          name: selectedTemplate.name,
                          description: selectedTemplate.description || '',
                          minBudget: selectedTemplate.minBudget || '',
                          maxBudget: selectedTemplate.maxBudget || '',
                          area: selectedTemplate.area || ''
                        }
                      });
                    }
                  }}
                >
                  <View style={[styles.actionSheetIcon, { backgroundColor: '#F8FAFF' }]}>
                    <Ionicons name="pencil-outline" size={20} color="#0F172A" />
                  </View>
                  <Text style={styles.actionSheetText}>{t('editDetails')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionSheetRow, styles.deleteRow]} activeOpacity={0.7} onPress={() => {
                  const hasDeleteTemplatePermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('template:delete');
                  if (!hasDeleteTemplatePermission) {
                    showToast('You do not have permission to delete templates.', 'error');
                    return;
                  }
                  deleteTemplate();
                }}>
                  <View style={[styles.actionSheetIcon, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.actionSheetText, { color: '#EF4444' }]}>{t('deleteTemplate')}</Text>
                </TouchableOpacity>
              </View>
            </AdaptiveGlass>
          </View>
        </Modal>

        {/* Category Actions Sheet */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isCategoryActionSheetVisible}
          statusBarTranslucent={true}
          onRequestClose={() => setIsCategoryActionSheetVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setIsCategoryActionSheetVisible(false)}
            />

            <AdaptiveGlass intensity={90} tint="light" style={[styles.sheetContent, { paddingBottom: insets.bottom + 24, height: 'auto' }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>{t('categoryOptions')}</Text>
                  <TouchableOpacity onPress={() => setIsCategoryActionSheetVisible(false)}>
                    <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.actionSheetOptions}>
                <TouchableOpacity
                  style={styles.actionSheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    const hasEditCategoryPermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('category:update') || user?.role?.permissions?.includes('category:edit');
                    if (!hasEditCategoryPermission) {
                      showToast('You do not have permission to edit categories.', 'error');
                      return;
                    }
                    handleEditCategory();
                  }}
                >
                  <View style={[styles.actionSheetIcon, { backgroundColor: '#F8FAFF' }]}>
                    <Ionicons name="pencil-outline" size={20} color="#0F172A" />
                  </View>
                  <Text style={styles.actionSheetText}>{t('editCategory')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionSheetRow, styles.deleteRow]} activeOpacity={0.7} onPress={() => {
                  const hasDeleteCategoryPermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('category:delete');
                  if (!hasDeleteCategoryPermission) {
                    showToast('You do not have permission to delete categories.', 'error');
                    return;
                  }
                  deleteCategory();
                }}>
                  <View style={[styles.actionSheetIcon, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.actionSheetText, { color: '#EF4444' }]}>{t('deleteCategory')}</Text>
                </TouchableOpacity>
              </View>
            </AdaptiveGlass>
          </View>
        </Modal>

        {/* Edit Category Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isEditCategoryModalVisible}
          onRequestClose={() => setIsEditCategoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setIsEditCategoryModalVisible(false)}
            />

            <AdaptiveGlass intensity={60} tint="light" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('editCategory')}</Text>
                <TouchableOpacity onPress={() => setIsEditCategoryModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sheetLabel, { marginTop: 8 }]}>{t('categoryNameLabel')}</Text>
              <AdaptiveGlass intensity={10} tint="light" style={styles.inputContainer}>
                <Ionicons name="folder-outline" size={20} color="#3B82F6" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.sheetInput}
                  placeholder="e.g. Residential, Commercial..."
                  placeholderTextColor="#94A3B8"
                  value={editingCategoryName}
                  onChangeText={setEditingCategoryName}
                />
              </AdaptiveGlass>

              <TouchableOpacity
                style={styles.addCategoryBtn}
                activeOpacity={0.8}
                onPress={updateCategory}
                disabled={isUpdatingCategory}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addCategoryGradient}
                >
                  {isUpdatingCategory ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.addCategoryText}>{t('saveChanges')}</Text>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </AdaptiveGlass>
          </View>
        </Modal>


        {isTemplatesLoading && templatesList.length === 0 ? (
          <View style={styles.centralLoader}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loaderText}>{t('synchronizingTemplates')}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTemplates}
            renderItem={renderTemplateCard}
            keyExtractor={item => item._id || item.id}
            numColumns={1}
            contentContainerStyle={styles.templateGrid}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>{t('noTemplatesFound')}</Text>
                <Text style={styles.emptySub}>{t('createFirstProjectKit')}</Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 120 }} />}
            refreshing={isTemplatesLoading}
            onRefresh={fetchTemplates}
          />
        )}

        <ConfirmModal
          visible={isDeleteTemplateModalVisible}
          title={t('deleteTemplate')}
          message={t('deleteItemMsg', { name: selectedTemplate?.name })}
          confirmText={t('delete')}
          onConfirm={handleConfirmDeleteTemplate}
          onCancel={() => setIsDeleteTemplateModalVisible(false)}
          type="destructive"
          isSubmitting={isDeletingTemplate}
        />

        <ConfirmModal
          visible={isDeleteCategoryModalVisible}
          title={t('deleteCategory')}
          message={t('deleteItemMsg', { name: selectedCategory?.name })}
          confirmText={t('delete')}
          onConfirm={handleConfirmDeleteCategory}
          onCancel={() => setIsDeleteCategoryModalVisible(false)}
          type="destructive"
          isSubmitting={isDeletingCategory}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFF',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 200,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#DBEAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  greetingText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  waveEmoji: { fontSize: 12 },
  preTitle: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  titleHighlight: { color: '#0F172A' },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellScale: {
    transform: [{ scale: 0.78 }],
  },
  searchParent: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    height: '100%',
  },
  filterToggleBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  filterToggleBtnActive: {
    backgroundColor: '#3B82F6', borderColor: '#3B82F6',
  },
  filterChips: { maxHeight: 32, marginTop: 12 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },
  categoryScroller: {
    marginBottom: 32,
  },
  categoryContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryPill: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  activePill: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  templateGrid: {
    paddingHorizontal: 24,
    gap: 16,
  },
  templateCardWrapper: {
    width: '100%',
    height: 140,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modalContent: {
    width: '100%',
    borderRadius: 32,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
  modalOptions: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  optionText: {
    flex: 1,
    paddingHorizontal: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContent: {
    width: '100%',
    maxHeight: height * 0.85,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  categoryBadgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  categoryBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
  },
  sheetInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  addCategoryBtn: {
    marginTop: 32,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  addCategoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 8,
  },
  addCategoryText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  glassCard: {
    flex: 1,
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(224, 242, 254, 0.8)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  mediaColumn: {
    alignItems: 'center',
    width: 90,
  },
  thumbnailContainer: {
    width: 90,
    height: 90,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  areaUnderImage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  areaTextUnder: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  itemCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  templateTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assetCountText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Inter-Regular',
  },
  actionSheetOptions: {
    gap: 8,
    marginTop: 8,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  actionSheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionSheetText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  deleteRow: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    marginTop: 8,
  },
  centralLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#334155',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    textAlign: 'center',
  },
});
