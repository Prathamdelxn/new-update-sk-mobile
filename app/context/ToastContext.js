import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedToast from '../components/AnimatedToast';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toastConfig, setToastConfig] = useState({
    visible: false,
    message: '',
    type: 'success', // 'success', 'delete'
  });

  const [errorConfig, setErrorConfig] = useState({
    visible: false,
    message: ''
  });

  const showToast = useCallback((message, type = 'success') => {
    if (type === 'error') {
      setErrorConfig({ visible: true, message });
    } else {
      setToastConfig({ visible: true, message, type });
    }
  }, []);

  const hideToast = useCallback(() => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const hideError = useCallback(() => {
    setErrorConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const contextValue = useMemo(() => ({
    showToast,
    hideToast,
  }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <AnimatedToast
        visible={toastConfig.visible}
        message={toastConfig.message}
        type={toastConfig.type}
        onHide={hideToast}
      />

      <Modal visible={errorConfig.visible} transparent animationType="fade" onRequestClose={hideError}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="close-circle" size={48} color="#EF4444" />
            </View>
            <Text style={styles.errorTitle}>Action Failed</Text>
            <Text style={styles.errorMessage}>{errorConfig.message}</Text>
            <TouchableOpacity style={styles.okButton} activeOpacity={0.8} onPress={hideError}>
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 40,
    padding: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  okButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  okButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
