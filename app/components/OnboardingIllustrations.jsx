import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Slide 1: Project Management Scene ───
export const ProjectScene = () => (
  <View style={s.sceneWrap}>
    {/* Sky gradient */}
    <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={s.skyBg} />
    
    {/* Sun */}
    <View style={s.sun}>
      <LinearGradient colors={['#FCD34D', '#F59E0B']} style={s.sunInner} />
    </View>
    
    {/* Cloud 1 */}
    <View style={[s.cloud, { top: 28, left: 20 }]}>
      <View style={[s.cloudPart, { width: 40, height: 20 }]} />
      <View style={[s.cloudPart, { width: 28, height: 16, top: -8, left: 8 }]} />
    </View>
    
    {/* Cloud 2 */}
    <View style={[s.cloud, { top: 50, right: 30 }]}>
      <View style={[s.cloudPart, { width: 34, height: 16 }]} />
      <View style={[s.cloudPart, { width: 22, height: 12, top: -6, left: 6 }]} />
    </View>

    {/* Crane */}
    <View style={s.crane}>
      <View style={s.craneVertical} />
      <View style={s.craneHorizontal} />
      <View style={s.craneHook} />
      <View style={s.craneCable} />
    </View>

    {/* Building 1 - Tall */}
    <View style={[s.building, { left: 20, width: 55, height: 130, bottom: 0 }]}>
      <LinearGradient colors={['#3B82F6', '#2563EB']} style={s.buildFill}>
        {[0,1,2,3,4].map(r => (
          <View key={r} style={s.windowRow}>
            {[0,1,2].map(c => (
              <View key={c} style={[s.window, r < 3 && { backgroundColor: '#FDE68A' }]} />
            ))}
          </View>
        ))}
      </LinearGradient>
    </View>

    {/* Building 2 - Medium */}
    <View style={[s.building, { left: 82, width: 50, height: 100, bottom: 0 }]}>
      <LinearGradient colors={['#60A5FA', '#3B82F6']} style={s.buildFill}>
        {[0,1,2,3].map(r => (
          <View key={r} style={s.windowRow}>
            {[0,1].map(c => (
              <View key={c} style={[s.window, { width: 12, height: 10 }, r < 2 && { backgroundColor: '#FDE68A' }]} />
            ))}
          </View>
        ))}
      </LinearGradient>
    </View>

    {/* Building 3 - Short wide */}
    <View style={[s.building, { right: 30, width: 65, height: 85, bottom: 0 }]}>
      <LinearGradient colors={['#1D4ED8', '#1E40AF']} style={s.buildFill}>
        {[0,1,2].map(r => (
          <View key={r} style={s.windowRow}>
            {[0,1,2,3].map(c => (
              <View key={c} style={[s.window, { width: 8, height: 8 }, r === 0 && { backgroundColor: '#FDE68A' }]} />
            ))}
          </View>
        ))}
      </LinearGradient>
    </View>

    {/* Progress overlay card */}
    <View style={s.miniCard}>
      <View style={s.miniCardHeader}>
        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
        <Text style={s.miniCardTitle}>75% Complete</Text>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: '75%' }]} />
      </View>
    </View>

    {/* Ground */}
    <View style={s.ground} />
  </View>
);

// ─── Slide 2: Blueprint & Planning Scene ───
export const BlueprintScene = () => (
  <View style={s.sceneWrap}>
    <LinearGradient colors={['#F0F9FF', '#E0F2FE']} style={s.skyBg} />
    
    {/* Blueprint grid background */}
    <View style={s.blueprintGrid}>
      {[...Array(6)].map((_, i) => (
        <View key={`h${i}`} style={[s.gridLineH, { top: i * 30 + 15 }]} />
      ))}
      {[...Array(8)].map((_, i) => (
        <View key={`v${i}`} style={[s.gridLineV, { left: i * 28 + 10 }]} />
      ))}
    </View>

    {/* Floor plan shape */}
    <View style={s.floorPlan}>
      <View style={s.fpMain} />
      <View style={s.fpWing} />
      <View style={s.fpRoom1} />
      <View style={s.fpRoom2} />
      <View style={s.fpDoor} />
    </View>

    {/* Measurement line */}
    <View style={s.measureLine}>
      <View style={s.measureEnd} />
      <View style={s.measureBar} />
      <View style={s.measureEnd} />
      <Text style={s.measureText}>12.5m</Text>
    </View>

    {/* Checklist overlay */}
    <View style={s.checklistCard}>
      <Text style={s.checklistTitle}>Tasks</Text>
      {['Foundation', 'Framing', 'Electrical'].map((t, i) => (
        <View key={i} style={s.checkItem}>
          <Ionicons 
            name={i < 2 ? "checkmark-circle" : "ellipse-outline"} 
            size={13} 
            color={i < 2 ? "#10B981" : "#94A3B8"} 
          />
          <Text style={[s.checkText, i < 2 && s.checkDone]}>{t}</Text>
        </View>
      ))}
    </View>

    {/* Compass icon */}
    <View style={s.compass}>
      <Ionicons name="compass-outline" size={28} color="#3B82F6" />
    </View>

    {/* Ruler */}
    <View style={s.ruler}>
      {[...Array(8)].map((_, i) => (
        <View key={i} style={[s.rulerTick, i % 2 === 0 && { height: 10 }]} />
      ))}
    </View>
  </View>
);

// ─── Slide 3: Finance & Tracking Scene ───
export const FinanceScene = () => (
  <View style={s.sceneWrap}>
    <LinearGradient colors={['#F0FDF4', '#ECFDF5']} style={s.skyBg} />

    {/* Chart bars */}
    <View style={s.chartArea}>
      {[45, 70, 55, 85, 60, 75, 90].map((h, i) => (
        <View key={i} style={s.barWrap}>
          <LinearGradient
            colors={i === 6 ? ['#10B981', '#059669'] : ['#3B82F6', '#2563EB']}
            style={[s.bar, { height: h }]}
          />
        </View>
      ))}
    </View>

    {/* Trend line dots */}
    <View style={s.trendLine}>
      {[38, 28, 32, 18, 30, 22, 12].map((top, i) => (
        <View key={i} style={[s.trendDot, { top, left: i * 27 + 8 }]} />
      ))}
    </View>

    {/* Amount card */}
    <View style={s.amountCard}>
      <Text style={s.amountLabel}>Total Budget</Text>
      <Text style={s.amountValue}>₹24,50,000</Text>
      <View style={s.amountRow}>
        <Ionicons name="trending-up" size={12} color="#10B981" />
        <Text style={s.amountChange}>+12.5%</Text>
      </View>
    </View>

    {/* Transaction mini cards */}
    <View style={s.txnCard}>
      <View style={s.txnRow}>
        <View style={[s.txnIcon, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="cube-outline" size={12} color="#2563EB" />
        </View>
        <View>
          <Text style={s.txnName}>Materials</Text>
          <Text style={s.txnAmt}>₹3,20,000</Text>
        </View>
      </View>
      <View style={s.txnDivider} />
      <View style={s.txnRow}>
        <View style={[s.txnIcon, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="people-outline" size={12} color="#D97706" />
        </View>
        <View>
          <Text style={s.txnName}>Labour</Text>
          <Text style={s.txnAmt}>₹1,85,000</Text>
        </View>
      </View>
    </View>

    {/* Wallet icon */}
    <View style={s.walletBadge}>
      <LinearGradient colors={['#10B981', '#059669']} style={s.walletInner}>
        <Ionicons name="wallet" size={18} color="#fff" />
      </LinearGradient>
    </View>
  </View>
);

const s = StyleSheet.create({
  sceneWrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  skyBg: { ...StyleSheet.absoluteFillObject },

  // Sun
  sun: { position: 'absolute', top: 18, right: 25 },
  sunInner: { width: 30, height: 30, borderRadius: 15 },

  // Clouds
  cloud: { position: 'absolute' },
  cloudPart: {
    backgroundColor: '#fff',
    borderRadius: 20,
    position: 'absolute',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },

  // Crane
  crane: { position: 'absolute', top: 20, right: 65 },
  craneVertical: { width: 4, height: 120, backgroundColor: '#F59E0B', position: 'absolute', top: 15 },
  craneHorizontal: { width: 80, height: 4, backgroundColor: '#F59E0B', position: 'absolute', top: 15, left: -40 },
  craneHook: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#D97706', position: 'absolute', top: 42, left: -38 },
  craneCable: { width: 2, height: 24, backgroundColor: '#D97706', position: 'absolute', top: 19, left: -35 },

  // Buildings
  building: { position: 'absolute', borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden' },
  buildFill: { flex: 1, padding: 6, justifyContent: 'flex-end' },
  windowRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 6 },
  window: { width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, backgroundColor: '#CBD5E1' },

  // Mini progress card
  miniCard: {
    position: 'absolute', top: 60, right: 15,
    backgroundColor: '#fff', borderRadius: 10, padding: 10, width: 110,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  miniCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  miniCardTitle: { fontSize: 10, color: '#0F172A', marginLeft: 4 , fontFamily: 'Inter-Black' },
  progressTrack: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#10B981', borderRadius: 2 },

  // Blueprint
  blueprintGrid: { ...StyleSheet.absoluteFillObject },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(59,130,246,0.08)' },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(59,130,246,0.08)' },
  floorPlan: { position: 'absolute', top: 40, left: 30 },
  fpMain: { width: 130, height: 90, borderWidth: 2.5, borderColor: '#3B82F6', borderRadius: 3, backgroundColor: 'rgba(59,130,246,0.05)' },
  fpWing: { position: 'absolute', right: -35, top: 20, width: 35, height: 50, borderWidth: 2, borderColor: '#60A5FA', borderLeftWidth: 0, borderRadius: 3, backgroundColor: 'rgba(96,165,250,0.05)' },
  fpRoom1: { position: 'absolute', left: 8, top: 8, width: 50, height: 35, borderWidth: 1.5, borderColor: '#93C5FD', borderRadius: 2, borderStyle: 'dashed' },
  fpRoom2: { position: 'absolute', right: 8, top: 8, width: 55, height: 35, borderWidth: 1.5, borderColor: '#93C5FD', borderRadius: 2, borderStyle: 'dashed' },
  fpDoor: { position: 'absolute', bottom: -1, left: 55, width: 18, height: 3, backgroundColor: '#F59E0B' },

  measureLine: { position: 'absolute', top: 145, left: 30, flexDirection: 'row', alignItems: 'center' },
  measureEnd: { width: 2, height: 10, backgroundColor: '#EF4444' },
  measureBar: { width: 126, height: 1.5, backgroundColor: '#EF4444' },
  measureText: { fontSize: 9, color: '#EF4444', marginLeft: 6 , fontFamily: 'Inter-Black' },

  checklistCard: {
    position: 'absolute', bottom: 20, right: 12,
    backgroundColor: '#fff', borderRadius: 10, padding: 10, width: 105,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  checklistTitle: { fontSize: 10, color: '#0F172A', marginBottom: 6 , fontFamily: 'Inter-Black' },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkText: { fontSize: 9, color: '#475569', marginLeft: 4 , fontFamily: 'Inter-SemiBold' },
  checkDone: { textDecorationLine: 'line-through', color: '#94A3B8' },

  compass: { position: 'absolute', bottom: 25, left: 20 },
  ruler: {
    position: 'absolute', bottom: 8, left: 60, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#FEF3C7', height: 16, paddingHorizontal: 4, borderRadius: 3, gap: 6,
  },
  rulerTick: { width: 1.5, height: 7, backgroundColor: '#D97706' },

  // Finance
  chartArea: {
    position: 'absolute', bottom: 55, left: 15, right: 15,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', height: 100,
  },
  barWrap: { alignItems: 'center' },
  bar: { width: 18, borderRadius: 4 },
  trendLine: { position: 'absolute', top: 55, left: 22, width: 200, height: 60 },
  trendDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },

  amountCard: {
    position: 'absolute', top: 15, left: 15,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  amountLabel: { fontSize: 9, color: '#94A3B8', marginBottom: 2 , fontFamily: 'Inter-Bold' },
  amountValue: { fontSize: 16, color: '#0F172A', letterSpacing: -0.5 , fontFamily: 'Inter-Black' },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  amountChange: { fontSize: 10, color: '#10B981', marginLeft: 3 , fontFamily: 'Inter-Black' },

  txnCard: {
    position: 'absolute', top: 18, right: 12,
    backgroundColor: '#fff', borderRadius: 10, padding: 10, width: 115,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  txnName: { fontSize: 9, color: '#64748B' , fontFamily: 'Inter-Bold' },
  txnAmt: { fontSize: 10, color: '#0F172A' , fontFamily: 'Inter-Black' },
  txnDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 6 },

  walletBadge: { position: 'absolute', bottom: 15, right: 20 },
  walletInner: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
