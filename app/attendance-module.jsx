import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import cloudinaryService from './services/cloudinaryService';
import LocationMapViewer from './components/LocationMapViewer';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Haversine on client to show real-time distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function AttendanceModule() {
  const router = useRouter();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [withinRadius, setWithinRadius] = useState(false);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [resAtt, resProj] = await Promise.all([
        fetch(`${API_BASE_URL}/attendance/today`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (resAtt.ok) {
        const attData = await resAtt.json();
        setActiveRecord(attData.active ? attData.record : null);
        if (attData.active && attData.record.project) {
          setSelectedProject(attData.record.project); // pre-select if checking out
        }
      }
      if (resProj.ok) {
        const projData = await resProj.json();
        setProjects(projData);
      }
    } catch (e) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = (proj) => {
    if (activeRecord) return; // Cant change project if checking out
    setSelectedProject(proj);
    setDistance(null);
    setWithinRadius(false);
  };

  const verifyLocation = async () => {
    if (!selectedProject || !selectedProject.siteLocation) {
      Alert.alert('Error', 'Selected project does not have a valid site location setup.');
      return;
    }
    
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance.');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);

      const dist = calculateDistance(
        loc.coords.latitude, loc.coords.longitude,
        selectedProject.siteLocation.latitude, selectedProject.siteLocation.longitude
      );
      
      setDistance(dist);
      const radius = selectedProject.attendanceRadius || 100;
      setWithinRadius(dist <= radius);
      
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  // Dummy upload since we don't have the cloudinary logic perfectly mapped out here
  const uploadPhoto = async (uri) => {
    try {
      const secureUrl = await cloudinaryService.uploadFile(uri, `checkin_${Date.now()}`);
      return secureUrl;
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      showToast('error', 'Failed to upload photo');
      return null;
    }
  };

  const submitCheckIn = async () => {
    if (!location || !photo || !withinRadius) return;
    setSubmitting(true);
    try {
      const photoUrl = await uploadPhoto(photo);
      if (!photoUrl) {
        setSubmitting(false);
        return;
      }

      const payload = {
        projectId: selectedProject._id,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        },
        checkInPhoto: photoUrl,
        deviceInfo: { platform: 'React Native', appVersion: '1.0' }
      };

      const res = await fetch(`${API_BASE_URL}/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showToast('success', 'Checked In Successfully!');
        router.replace('/(tabs)/dashboard');
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Check In Failed');
      }
    } catch (e) {
      showToast('error', 'Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCheckOut = async () => {
    if (!location) return; // location must be verified first
    setSubmitting(true);
    try {
      const payload = {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        }
      };

      const res = await fetch(`${API_BASE_URL}/attendance/check-out`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        showToast('success', `Checked out! Total hours: ${data.attendance.totalWorkHours}`);
        router.replace('/(tabs)/dashboard');
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Check Out Failed');
      }
    } catch (e) {
      showToast('error', 'Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !projects.length) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  const isCheckingOut = !!activeRecord;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isCheckingOut ? 'Check Out' : 'Check In'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.stepBox}>
          <Text style={s.label}>1. Select Project Site</Text>
          <View style={s.projectList}>
            {projects.map(p => {
              const isSelected = selectedProject?._id === (p._id || p.id);
              return (
                <TouchableOpacity
                  key={p._id || p.id}
                  style={[s.projectCard, isSelected && s.projectCardSelected]}
                  onPress={() => handleSelectProject(p)}
                  disabled={isCheckingOut}
                >
                  <Text style={[s.projectName, isSelected && s.projectNameSelected]}>{p.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {selectedProject && (
          <View style={s.stepBox}>
            <Text style={s.label}>2. Verify GPS Location</Text>
            
            <View style={{ marginBottom: 16 }}>
              <LocationMapViewer 
                mode="worker"
                centerLat={selectedProject.siteLocation?.latitude || 0}
                centerLng={selectedProject.siteLocation?.longitude || 0}
                radius={selectedProject.attendanceRadius || 100}
                workerLat={location?.latitude || null}
                workerLng={location?.longitude || null}
              />
            </View>

            <TouchableOpacity style={s.verifyBtn} onPress={verifyLocation}>
              <Ionicons name="location-outline" size={20} color="#fff" />
              <Text style={s.verifyBtnText}>Get Current Location</Text>
            </TouchableOpacity>
            
            {distance !== null && (
              <View style={[s.statusBox, withinRadius ? s.statusSuccess : s.statusError]}>
                <Ionicons name={withinRadius ? "checkmark-circle" : "warning"} size={20} color={withinRadius ? "#16A34A" : "#DC2626"} />
                <Text style={s.statusText}>
                  You are {distance}m away. {withinRadius ? '(Valid)' : `(Max allowed: ${selectedProject.attendanceRadius || 100}m)`}
                </Text>
              </View>
            )}
          </View>
        )}

        {selectedProject && distance !== null && (
          <View style={s.stepBox}>
            {isCheckingOut ? (
              <>
                <Text style={s.label}>3. Complete Check Out</Text>
                <TouchableOpacity 
                  style={[s.submitBtn, (!withinRadius || submitting) && s.btnDisabled]} 
                  onPress={submitCheckOut}
                  disabled={!withinRadius || submitting}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Confirm Check Out</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.label}>3. Take Selfie & Check In</Text>
                {photo ? (
                  <View style={s.photoPreviewContainer}>
                    <Image source={{ uri: photo }} style={s.photoPreview} />
                    <TouchableOpacity style={s.retakeBtn} onPress={takeSelfie}>
                      <Text style={s.retakeText}>Retake Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[s.cameraBtn, !withinRadius && s.btnDisabled]} 
                    onPress={takeSelfie}
                    disabled={!withinRadius}
                  >
                    <Ionicons name="camera" size={24} color={withinRadius ? "#2563EB" : "#94A3B8"} />
                    <Text style={[s.cameraBtnText, !withinRadius && {color: "#94A3B8"}]}>Open Camera</Text>
                  </TouchableOpacity>
                )}

                {photo && withinRadius && (
                  <TouchableOpacity style={s.submitBtn} onPress={submitCheckIn} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Confirm Check In</Text>}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  content: { padding: 20 },
  label: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 10 },
  projectList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  projectCard: { padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E0F2FE' },
  projectCardSelected: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  projectName: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },
  projectNameSelected: { color: '#1D4ED8', fontFamily: 'Inter-Bold' },
  stepBox: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 24 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0F172A', padding: 14, borderRadius: 12 },
  verifyBtnText: { color: '#fff', fontFamily: 'Inter-SemiBold', fontSize: 15 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, marginTop: 12 },
  statusSuccess: { backgroundColor: '#F0FDF4' },
  statusError: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155' },
  cameraBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderWidth: 2, borderColor: '#DBEAFE', borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#fff' },
  cameraBtnText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  btnDisabled: { opacity: 0.5 },
  photoPreviewContainer: { alignItems: 'center', marginBottom: 16 },
  photoPreview: { width: 150, height: 200, borderRadius: 12, marginBottom: 10 },
  retakeText: { color: '#2563EB', fontFamily: 'Inter-Medium' },
  submitBtn: { backgroundColor: '#16A34A', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 16 },
});
