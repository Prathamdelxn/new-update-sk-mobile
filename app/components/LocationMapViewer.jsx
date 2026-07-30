import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Text, Keyboard } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

export default function LocationMapViewer({
  mode = 'admin', // 'admin' or 'worker'
  centerLat = 25.2048,
  centerLng = 55.2708,
  radius = 100,
  workerLat = null,
  workerLng = null,
  fullScreen = false,
  onLocationSelect = () => {}
}) {
  const mapRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const safeCenterLat = parseFloat(centerLat) || 0;
  const safeCenterLng = parseFloat(centerLng) || 0;
  const safeRadius = parseFloat(radius) || 100;
  
  // Default region centering
  const initialRegion = {
    latitude: safeCenterLat,
    longitude: safeCenterLng,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  useEffect(() => {
    if (mode === 'worker' && workerLat && workerLng && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: parseFloat(workerLat),
        longitude: parseFloat(workerLng),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  }, [workerLat, workerLng, mode]);

  const handleRegionChangeComplete = (region) => {
    if (mode === 'admin') {
      onLocationSelect(region.latitude, region.longitude);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
        if (mode === 'admin') {
          onLocationSelect(latitude, longitude);
        }
      } else {
        alert("Location not found. Please try a different search term.");
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={[styles.container, fullScreen && styles.fullScreenContainer]}>
      {mode === 'admin' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search address or city..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={mode === 'admin'}
        scrollEnabled={mode === 'admin'}
        zoomEnabled={mode === 'admin'}
      >
        <Circle
          center={{ latitude: safeCenterLat, longitude: safeCenterLng }}
          radius={safeRadius}
          fillColor="rgba(59, 130, 246, 0.3)" // Blue with opacity
          strokeColor="#2563EB"
          strokeWidth={2}
        />

        <Marker
          coordinate={{ latitude: safeCenterLat, longitude: safeCenterLng }}
          title="Project Site"
          pinColor="red"
        />

        {mode === 'worker' && workerLat && workerLng && (
          <Marker
            coordinate={{ latitude: parseFloat(workerLat), longitude: parseFloat(workerLng) }}
            title="Your Location"
          >
            <View style={styles.workerDotWrapper}>
              <View style={styles.workerDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Admin Crosshair Overlay */}
      {mode === 'admin' && (
        <View style={styles.crosshairContainer} pointerEvents="none">
          <Ionicons name="location" size={40} color="#DC2626" style={styles.crosshairIcon} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#F8FAFC',
    position: 'relative'
  },
  fullScreenContainer: {
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    zIndex: 10,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRightWidth: 0,
  },
  searchBtn: {
    backgroundColor: '#2563EB',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  crosshairContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairIcon: {
    marginTop: -20, // offset icon to point at exact center
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  workerDotWrapper: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerDot: {
    width: 12,
    height: 12,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  }
});
