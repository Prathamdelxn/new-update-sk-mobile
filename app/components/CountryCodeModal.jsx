import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllCountries } from '../services/countryService';

export default function CountryCodeModal({
  visible,
  onClose,
  selectedCode,
  onSelectCountry,
}) {
  const [search, setSearch] = useState('');
  const countries = useMemo(() => getAllCountries(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return countries;
    const q = search.trim().toLowerCase().replace(/^\+/, '');
    return countries.filter((c) => {
      const cleanPhone = c.phoneCode.replace(/^\+/, '');
      return (
        c.name.toLowerCase().includes(q) ||
        c.cca2.toLowerCase().includes(q) ||
        cleanPhone.includes(q) ||
        c.currencyCode.toLowerCase().includes(q)
      );
    });
  }, [countries, search]);

  const handleSelect = (country) => {
    onSelectCountry(country);
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Country</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country name, dial code, or currency..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && Platform.OS !== 'ios' ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Country List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.cca2}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = item.cca2 === selectedCode;
            return (
              <TouchableOpacity
                style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.nameContainer}>
                  <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.dialCode}>{item.phoneCode}</Text>
                </View>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyText}>
                    {item.currencySymbol} {item.currencyCode}
                  </Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={20} color="#2563EB" style={styles.checkIcon} />
                ) : null}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No countries match &quot;{search}&quot;</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    height: '100%',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  itemRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  nameSelected: {
    color: '#2563EB',
  },
  dialCode: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
  },
  currencyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  currencyText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#475569',
  },
  checkIcon: {
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#F8FAFC',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
});
