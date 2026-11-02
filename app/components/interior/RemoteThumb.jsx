// =============================================================================
// Thumbnail for remote images (drawings, site photos).
// Uses expo-image (decodes WebP/AVIF/HEIC/SVG and caches) instead of RN Image,
// cleans up the link (http -> https, unencoded spaces) and shows a visible
// "Preview unavailable" state instead of an empty box when a load fails.
// =============================================================================

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export function normalizeImageUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  let u = uri.trim();
  if (u.startsWith('data:') || u.startsWith('file:')) return u;
  // Android blocks plain-http images; Cloudinary and most CDNs serve https
  if (u.startsWith('http://')) u = `https://${u.slice(7)}`;
  // Unencoded spaces etc. make the request fail on device (browsers fix these silently)
  try {
    if (/\s/.test(u) || /[^\x21-\x7E]/.test(u)) u = encodeURI(decodeURI(u));
  } catch {
    u = encodeURI(u);
  }
  return u;
}

export default function RemoteThumb({ uri, height = 160, style, contentFit = 'cover', fallbackLabel = 'Preview unavailable' }) {
  const source = useMemo(() => normalizeImageUri(uri), [uri]);
  const [failed, setFailed] = useState(false);

  if (!source || failed) {
    return (
      <View style={[s.box, { height }, style, s.fallback]}>
        <Ionicons name="image-outline" size={28} color="#94A3B8" />
        <Text style={s.fallbackText}>{fallbackLabel}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: source }}
      style={[s.box, { height }, style]}
      contentFit={contentFit}
      transition={150}
      cachePolicy="memory-disk"
      recyclingKey={source}
      onError={() => setFailed(true)}
    />
  );
}

const s = StyleSheet.create({
  box: { width: '100%', backgroundColor: '#E2E8F0' },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  fallbackText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
});
