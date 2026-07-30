import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, Image, Alert, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToast } from './context/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

function buildPdfViewerHtml(pdfUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #F8FAFF; }
    #toolbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: #fff; padding: 8px 12px;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08); z-index: 100;
      font-family: sans-serif;
    }
    .toolbar-group { display: flex; align-items: center; gap: 8px; }
    #toolbar button {
      background: #EFF6FF; border: none; border-radius: 8px;
      padding: 6px 14px; color: #3B82F6; font-size: 14px; cursor: pointer;
    }
    #zoom-level { font-size: 12px; color: #64748B; min-width: 40px; text-align: center; }
    #page-info { font-size: 13px; color: #64748B; min-width: 60px; text-align: center; }
    #viewer { margin-top: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100vh - 48px); padding: 12px 8px 80px; gap: 12px; }
    canvas { max-width: 100%; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.10); background: #fff; }
    #loading { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: #F8FAFF; z-index: 200; }
    #loading p { color: #3B82F6; font-family: sans-serif; font-size: 15px; margin-top: 12px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #EFF6FF; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; align-items: center; justify-content: center; flex-direction: column; background: #F8FAFF; }
    #error p { color: #64748B; font-family: sans-serif; font-size: 14px; margin-top: 8px; }
  </style>
</head>
<body>
  <div id="loading"><div><div class="spinner"></div><p>Showing plan…</p></div></div>
  <div id="error"><p>⚠️</p><p>Failed to load document.</p></div>
  <div id="toolbar" style="display:none">
    <div class="toolbar-group">
      <button onclick="prevPage()">‹ Prev</button>
      <span id="page-info">1 / 1</span>
      <button onclick="nextPage()">Next ›</button>
    </div>
    <div class="toolbar-group">
      <button onclick="window.zoomOut()">−</button>
      <span id="zoom-level">100%</span>
      <button onclick="window.zoomIn()">+</button>
    </div>
  </div>
  <div id="viewer"></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const url = '${pdfUrl.replace(/'/g, "\\'")}';
    let pdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;
    let scale = 1.0;
    const SCALE_STEP = 0.25;
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 3.0;

    function updatePageInfo() {
      document.getElementById('page-info').textContent = currentPage + ' / ' + totalPages;
    }

    function updateZoomLabel() {
      document.getElementById('zoom-level').textContent = Math.round(scale * 100) + '%';
    }

    function applyZoom() {
      const viewer = document.getElementById('viewer');
      viewer.style.transformOrigin = 'top center';
      viewer.style.transform = 'scale(' + scale + ')';
    }

    async function renderPage(num) {
      document.getElementById('loading').style.display = 'flex'; // show loader during render
      const page = await pdfDoc.getPage(num);
      const baseScale = window.devicePixelRatio > 1 ? 1.5 : 1.2;
      const viewport = page.getViewport({ scale: baseScale });
      
      const viewer = document.getElementById('viewer');
      viewer.innerHTML = ''; // Clear previous canvas to free memory
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = Math.min(viewport.width, window.innerWidth - 16) + 'px';
      canvas.style.height = 'auto';
      viewer.appendChild(canvas);
      
      await page.render({ canvasContext: ctx, viewport }).promise;
      document.getElementById('loading').style.display = 'none';
    }

    window.zoomIn = function() {
      if (scale >= MAX_SCALE) return;
      scale = Math.min(scale + SCALE_STEP, MAX_SCALE);
      updateZoomLabel();
      applyZoom();
    }

    window.zoomOut = function() {
      if (scale <= MIN_SCALE) return;
      scale = Math.max(scale - SCALE_STEP, MIN_SCALE);
      updateZoomLabel();
      applyZoom();
    }

    function prevPage() {
      if (currentPage <= 1) return;
      currentPage--;
      updatePageInfo();
      renderPage(currentPage);
    }

    function nextPage() {
      if (currentPage >= totalPages) return;
      currentPage++;
      updatePageInfo();
      renderPage(currentPage);
    }

    pdfjsLib.getDocument(url).promise.then(async (pdf) => {
      pdfDoc = pdf;
      totalPages = pdf.numPages;
      updatePageInfo();
      await renderPage(currentPage);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('toolbar').style.display = 'flex';
    }).catch((err) => {
      console.error(err);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'flex';
    });
  </script>
</body>
</html>
`;
}

export default function DocumentViewerScreen() {
  const { url, name, mimeType } = useLocalSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  if (!url) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.title}>Error</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontFamily: 'Inter-Bold', color: '#64748B' }}>No URL provided to view.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPdf = mimeType === 'application/pdf' || name?.toLowerCase().endsWith('.pdf') || url?.toLowerCase().includes('.pdf');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = mimeType?.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name) || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(url) || name?.toLowerCase().startsWith('video/');
  const isDwg = mimeType === 'application/acad' || name?.toLowerCase().endsWith('.dwg') || url?.toLowerCase().includes('.dwg');

  const handleMark = () => {
    showToast('Markup tools will be available in the next update.', 'success');
  };

  const handleOpenExternal = async () => {
    try {
      setLoading(true);
      // Download to cache first to avoid the browser-fallback/download behavior
      const fileName = name || (url.split('/').pop()) || 'drawing.dwg';
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      const download = await FileSystem.downloadAsync(url, fileUri);
      
      if (download.status !== 200) {
        throw new Error('Download failed');
      }

      if (Platform.OS === 'android') {
        // Direct open via Intent on Android
        const contentUri = await FileSystem.getContentUriAsync(download.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/acad',
        });
      } else {
        // Use Share sheet on iOS (standard way)
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(download.uri, {
            mimeType: 'application/acad',
            dialogTitle: `Open ${fileName}`,
            UTI: 'com.autodesk.dwg'
          });
        } else {
          throw new Error('Sharing not available');
        }
      }
    } catch (error) {
      console.error("[DWG Open Error]", error);
      Alert.alert(
        'No Viewer Found',
        'We could not find an app to open this DWG file. Please install a CAD viewer like DWG FastView.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Get DWG FastView', 
            onPress: () => {
              const storeUrl = Platform.OS === 'ios' 
                ? 'https://apps.apple.com/app/dwg-fastview-cad-viewer-editor/id456933557' 
                : 'https://play.google.com/store/apps/details?id=com.gstarmc.android';
              Linking.openURL(storeUrl);
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name || 'Document Viewer'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {isVideo ? (
          <View style={styles.imageWrapper}>
            <Video
              source={{ uri: url }}
              style={styles.imageViewer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              onLoadStart={() => setLoading(true)}
              onReadyForDisplay={() => setLoading(false)}
            />
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            )}
          </View>
        ) : isImage ? (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: url }}
              style={styles.imageViewer}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            )}
          </View>
        ) : isPdf ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: buildPdfViewerHtml(url) }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            mixedContentMode="always"
          />
        ) : isDwg ? (
          <View style={[styles.content, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
            <View style={styles.dwgIconBox}>
              <Ionicons name="layers" size={64} color="#3B82F6" />
            </View>
            <Text style={{ fontFamily: 'Inter-Black', color: '#0F172A', fontSize: 20, marginTop: 24, textAlign: 'center' }}>
              AutoCAD Drawing
            </Text>
            <Text style={{ fontFamily: 'Inter-Medium', color: '#64748B', fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
              This is a .DWG file. These drawings are best viewed in specialized apps like DWG FastView.
            </Text>
            <TouchableOpacity style={styles.externalBtn} onPress={handleOpenExternal} activeOpacity={0.8}>
              <Ionicons name="open-outline" size={20} color="#FFF" />
              <Text style={styles.externalBtnText}>Open in External App</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="document-outline" size={48} color="#CBD5E1" />
            <Text style={{ fontFamily: 'Inter-Bold', color: '#64748B', marginTop: 12 }}>
              Unsupported file type
            </Text>
          </View>
        )}
      </View>

      <View style={styles.toolbarContainer}>
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => webViewRef.current?.injectJavaScript('zoomOut(); true;')} activeOpacity={0.7}>
            <View style={styles.iconCircle}>
              <Ionicons name="remove" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.toolText}>Zoom Out</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.toolBtn} onPress={() => webViewRef.current?.injectJavaScript('zoomIn(); true;')} activeOpacity={0.7}>
            <View style={styles.iconCircle}>
              <Ionicons name="add" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.toolText}>Zoom In</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.toolBtn} onPress={handleMark} activeOpacity={0.7}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="pencil" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.toolText}>Mark</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 2 },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: '#F8FAFF' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter-Black', color: '#0F172A', paddingHorizontal: 12 },
  content: { flex: 1, backgroundColor: '#F8FAFF', overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#F8FAFF' },
  imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageViewer: { width: '100%', height: '100%' },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'transparent' },
  toolbarContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  toolbar: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, alignItems: 'center', gap: 16 },
  divider: { width: 1, height: 24, backgroundColor: '#F1F5F9' },
  toolBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center' },
  toolText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },
  dwgIconBox: { width: 100, height: 100, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 32, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  externalBtnText: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 15 },
});
