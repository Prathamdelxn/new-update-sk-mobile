import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function BoqDrawingViewerModal({
  visible,
  isOpen,
  onClose,
  attachment,
  drawing,
  title = 'Architectural Drawing Viewer',
  leadName,
  sectionTitle,
}) {
  const isVisible = Boolean(visible ?? isOpen);
  const targetDrawing = attachment || drawing;

  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [downloading, setDownloading] = useState(false);

  if (!targetDrawing || !isVisible) return null;

  const url = targetDrawing.url || targetDrawing.uri || '';
  const fileName = targetDrawing.title || targetDrawing.name || 'Drawing';
  const isImage = /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(url) || (!/\.pdf($|\?)/i.test(url) && (targetDrawing.fileType === 'image' || !targetDrawing.fileType));

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.3, 0.6));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleOpenExternal = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open URL on this device.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to open link.');
    }
  };

  const handleShareOrDownload = async () => {
    if (!url) return;
    setDownloading(true);
    try {
      const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
      const localUri = `${FileSystem.cacheDirectory}drawing_${Date.now()}.${ext}`;
      const res = await FileSystem.downloadAsync(url, localUri);
      if (res.status === 200 && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(localUri, { dialogTitle: fileName });
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn('Share error:', err);
      // Fallback
      Linking.openURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={s.headerBadgeRow}>
                <Ionicons name="document-attach" size={13} color="#60A5FA" />
                <Text style={s.headerBadgeText}>{title}</Text>
                {targetDrawing?.category && (
                  <View style={s.catBadge}>
                    <Text style={s.catBadgeText}>{targetDrawing.category}</Text>
                  </View>
                )}
              </View>
              <Text style={s.fileNameText} numberOfLines={1}>
                {fileName}
              </Text>
              {(leadName || sectionTitle) && (
                <Text style={s.metaSubtitle} numberOfLines={1}>
                  {sectionTitle ? `Section: ${sectionTitle}  ` : ''}
                  {leadName ? `• Client: ${leadName}` : ''}
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Canvas */}
          <View style={s.canvas}>
            {loading && (
              <View style={s.loaderWrap}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={s.loaderText}>Loading drawing...</Text>
              </View>
            )}

            {isImage ? (
              <View
                style={[
                  s.imageWrapper,
                  {
                    transform: [{ scale }, { rotate: `${rotation}deg` }],
                  },
                ]}
              >
                <Image
                  source={{ uri: url }}
                  style={s.image}
                  resizeMode="contain"
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                />
              </View>
            ) : (
              <View style={s.pdfNoticeWrap}>
                <Ionicons name="document-text-outline" size={54} color="#60A5FA" />
                <Text style={s.pdfNoticeTitle}>PDF Architectural Drawing</Text>
                <Text style={s.pdfNoticeSub}>{fileName}</Text>
                <TouchableOpacity style={s.pdfOpenBtn} onPress={handleOpenExternal}>
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                  <Text style={s.pdfOpenBtnText}>Open Document in Viewer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Float Controls Toolbar */}
            {isImage && (
              <View style={s.toolbar}>
                <TouchableOpacity onPress={handleZoomOut} style={s.toolBtn}>
                  <Ionicons name="remove" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={s.zoomLevelText}>{Math.round(scale * 100)}%</Text>
                <TouchableOpacity onPress={handleZoomIn} style={s.toolBtn}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={s.toolDivider} />
                <TouchableOpacity onPress={handleRotate} style={s.toolBtn}>
                  <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleReset} style={s.toolBtn}>
                  <Ionicons name="scan-outline" size={17} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Footer Bar */}
          <View style={s.footer}>
            <TouchableOpacity style={s.footerActionBtn} onPress={handleOpenExternal}>
              <Ionicons name="open-outline" size={16} color="#94A3B8" />
              <Text style={s.footerActionText}>Browser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.footerPrimaryBtn, downloading && { opacity: 0.6 }]}
              onPress={handleShareOrDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                  <Text style={s.footerPrimaryText}>Share / Save Drawing</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 12, 22, 0.96)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  headerBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#60A5FA',
    textTransform: 'uppercase',
  },
  catBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 9.5,
    fontFamily: 'Inter-Bold',
    color: '#93C5FD',
  },
  fileNameText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  metaSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loaderWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '94%',
    height: '94%',
  },
  pdfNoticeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  pdfNoticeTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginTop: 6,
  },
  pdfNoticeSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    textAlign: 'center',
  },
  pdfOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  pdfOpenBtnText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  toolbar: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  toolBtn: {
    padding: 6,
    borderRadius: 6,
  },
  zoomLevelText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#E2E8F0',
    minWidth: 38,
    textAlign: 'center',
  },
  toolDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(10, 15, 29, 0.95)',
    gap: 12,
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerActionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#E2E8F0',
  },
  footerPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
  },
  footerPrimaryText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});
