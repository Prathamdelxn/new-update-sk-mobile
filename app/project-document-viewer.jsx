import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, Image, Alert, Linking, Platform, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToast } from './context/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { BlurView } from 'expo-blur';

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
      background: rgba(255, 255, 255, 0.85); padding: 12px 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      z-index: 100; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .toolbar-group { display: flex; align-items: center; gap: 12px; }
    #toolbar button {
      background: #F1F5F9; border: 1px solid rgba(0,0,0,0.05); border-radius: 10px;
      padding: 8px 16px; color: #0F172A; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    #toolbar button:active { background: #E2E8F0; transform: scale(0.96); }
    #zoom-level { font-size: 13px; color: #475569; min-width: 48px; text-align: center; font-weight: 500; }
    #page-info { font-size: 14px; color: #475569; min-width: 60px; text-align: center; font-weight: 500; }
    #viewer { margin-top: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100vh - 60px); padding: 16px 12px 100px; gap: 16px; }
    canvas { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: #fff; }
    #loading { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: #F8FAFF; z-index: 200; }
    #loading p { color: #3B82F6; font-family: -apple-system, sans-serif; font-size: 15px; margin-top: 16px; font-weight: 500; letter-spacing: 0.5px; }
    .spinner { width: 44px; height: 44px; border: 4px solid #EFF6FF; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; align-items: center; justify-content: center; flex-direction: column; background: #F8FAFF; }
    #error p { color: #64748B; font-family: -apple-system, sans-serif; font-size: 15px; margin-top: 12px; }
  </style>
</head>
<body>
  <div id="loading"><div><div class="spinner"></div><p>Rendering Document...</p></div></div>
  <div id="error"><p>⚠️</p><p>Failed to load document.</p></div>
  <div id="toolbar" style="display:none">
    <div class="toolbar-group">
      <button onclick="prevPage()">‹</button>
      <span id="page-info">1 / 1</span>
      <button onclick="nextPage()">›</button>
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
      document.getElementById('loading').style.display = 'flex'; 
      const page = await pdfDoc.getPage(num);
      const baseScale = window.devicePixelRatio > 1 ? 1.5 : 1.2;
      const viewport = page.getViewport({ scale: baseScale });
      
      const viewer = document.getElementById('viewer');
      viewer.innerHTML = ''; 
      
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

export default function ProjectDocumentViewerScreen() {
  const { url, name, mimeType } = useLocalSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  if (!url) {
    return (
      <View style={[styles.container, { backgroundColor: '#F8FAFF' }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.title}>Error</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontFamily: 'Inter-Bold', color: '#64748B' }}>No URL provided to view.</Text>
        </View>
      </View>
    );
  }

  const isPdf = mimeType === 'application/pdf' || name?.toLowerCase().endsWith('.pdf') || url?.toLowerCase().includes('.pdf');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = mimeType?.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name) || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(url) || name?.toLowerCase().startsWith('video/');
  const isDwg = mimeType === 'application/acad' || name?.toLowerCase().endsWith('.dwg') || url?.toLowerCase().includes('.dwg');


  const handleOpenExternal = async () => {
    try {
      setLoading(true);
      const fileName = name || (url.split('/').pop()) || 'drawing.dwg';
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      const download = await FileSystem.downloadAsync(url, fileUri);
      
      if (download.status !== 200) {
        throw new Error('Download failed');
      }

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(download.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, 
          type: 'application/acad',
        });
      } else {
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Glassmorphic Header */}
      <BlurView intensity={70} tint="light" style={[styles.headerBlur, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{name || 'Document Viewer'}</Text>
            <Text style={styles.subtitle}>{isPdf ? 'PDF Document' : isImage ? 'Image File' : isVideo ? 'Video File' : isDwg ? 'AutoCAD Drawing' : 'File'}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </BlurView>

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
                <Text style={styles.loadingText}>Loading Video...</Text>
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
                <Text style={styles.loadingText}>Loading Image...</Text>
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
            backgroundColor="#F8FAFF"
          />
        ) : isDwg ? (
          <View style={[styles.content, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
            <View style={styles.dwgIconBox}>
              <Ionicons name="layers" size={56} color="#3B82F6" />
            </View>
            <Text style={{ fontFamily: 'Inter-Black', color: '#0F172A', fontSize: 22, marginTop: 24, textAlign: 'center' }}>
              AutoCAD Drawing
            </Text>
            <Text style={{ fontFamily: 'Inter-Medium', color: '#64748B', fontSize: 15, marginTop: 12, textAlign: 'center', lineHeight: 24 }}>
              This is a .DWG file. These drawings are best viewed in specialized CAD applications.
            </Text>
            <TouchableOpacity style={styles.externalBtn} onPress={handleOpenExternal} activeOpacity={0.8}>
              <Ionicons name="open-outline" size={20} color="#FFF" />
              <Text style={styles.externalBtnText}>Open in External App</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
            <View style={[styles.dwgIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="document-outline" size={56} color="#94A3B8" />
            </View>
            <Text style={{ fontFamily: 'Inter-Bold', color: '#64748B', marginTop: 24, fontSize: 16 }}>
              Unsupported file type
            </Text>
          </View>
        )}
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  headerBlur: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: '#EFF6FF' },
  titleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  title: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 2 },
  subtitle: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  content: { flex: 1, backgroundColor: '#F8FAFF', zIndex: 1 },
  webview: { flex: 1, backgroundColor: '#F8FAFF' },
  imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFF' },
  imageViewer: { width: '100%', height: '100%' },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: '#F8FAFF' },
  loadingText: { color: '#3B82F6', fontFamily: 'Inter-Medium', marginTop: 12, fontSize: 14 },

  dwgIconBox: { width: 110, height: 110, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#3B82F6', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, marginTop: 40, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  externalBtnText: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 16 },
});

