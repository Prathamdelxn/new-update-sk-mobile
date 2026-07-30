import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (id = null) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/notifications`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      
      if (id) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleNotificationPress = (item) => {
    markAsRead(item._id);
    if (item.project) {
      router.push(`/project/${item.project._id}`);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'Risk': return { name: 'alert-triangle', color: '#EF4444', bg: '#FEE2E2' };
      case 'Issue': return { name: 'info', color: '#F59E0B', bg: '#FEF3C7' };
      case 'Material': return { name: 'package', color: '#3B82F6', bg: '#DBEAFE' };
      default: return { name: 'bell', color: '#64748B', bg: '#F1F5F9' };
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications')}</Text>
        <TouchableOpacity onPress={() => markAsRead()} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>{t('markAllAsRead')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const icon = getIcon(item.type);
          return (
            <TouchableOpacity 
              style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
              onPress={() => handleNotificationPress(item)}
            >
              <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
                <Feather name={icon.name} size={20} color={icon.color} />
              </View>
              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                {item.project && (
                  <Text style={styles.projectTag}>Project: {item.project.name}</Text>
                )}
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="bell-off" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{t('noNotificationsYet')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: 'Inter-Bold', color: '#1E293B', marginLeft: 16 },
  markAllBtn: { paddingVertical: 4 },
  markAllText: { fontSize: 12, color: '#3B82F6', fontFamily: 'Inter-Medium' },
  notificationCard: { 
    flexDirection: 'row', 
    padding: 16, 
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center'
  },
  unreadCard: { backgroundColor: '#F0F7FF' },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, marginLeft: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  time: { fontSize: 11, color: '#94A3B8' },
  message: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  projectTag: { fontSize: 11, color: '#3B82F6', marginTop: 4, fontFamily: 'Inter-Medium' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginLeft: 8 },
  emptyBox: { padding: 50, alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16, color: '#94A3B8', fontFamily: 'Inter-Medium' }
});
