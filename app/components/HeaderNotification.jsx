import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSocket } from '../context/SocketContext';
import * as SecureStore from 'expo-secure-store';

export default function HeaderNotification() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket, connected } = useSocket();
  const router = useRouter();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        const unread = data.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Fetch unread count error:', error);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    if (socket && connected) {
      socket.on('notification:new', () => {
        fetchUnreadCount();
      });
      return () => socket.off('notification:new');
    }
  }, [socket, connected, fetchUnreadCount]);

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => router.push('/notifications')}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={24} color="#0F172A" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    textAlign: 'center'
  }
});
