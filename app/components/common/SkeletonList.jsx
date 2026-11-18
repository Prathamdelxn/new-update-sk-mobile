// Loading placeholders: draws the shape of the content (grey pulsing blocks) while data loads,
// so a screen shows its structure immediately instead of a blank page with a spinner.
//
//   <SkeletonList />                  → 4 cards (title, sub line, 3 figures)
//   <SkeletonList variant="rows" />   → a card holding plain list rows
//   <SkeletonList variant="home" />   → project home (progress card, quick-access grid, list)
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

function usePulse() {
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

const Bar = ({ w = '100%', h = 12, r = 6, style }) => (
  <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#E8EDF3' }, style]} />
);

function CardSkeleton() {
  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <Bar w="58%" h={14} />
        <Bar w={64} h={20} r={10} />
      </View>
      <Bar w="40%" h={11} style={{ marginTop: 10 }} />
      <View style={s.figRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.figCol, i === 1 && { alignItems: 'center' }, i === 2 && { alignItems: 'flex-end' }]}>
            <Bar w={52} h={10} />
            <Bar w={68} h={13} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function RowsSkeleton({ count }) {
  return (
    <View style={[s.card, { paddingVertical: 4 }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.row, i === count - 1 && { borderBottomWidth: 0 }]}>
          <Bar w={34} h={34} r={10} />
          <View style={{ flex: 1, gap: 7 }}>
            <Bar w="62%" h={13} />
            <Bar w="38%" h={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

function HomeSkeleton() {
  return (
    <>
      <View style={s.card}>
        <View style={s.rowBetween}>
          <Bar w={110} h={12} />
          <Bar w={90} h={11} />
        </View>
        <Bar w={70} h={22} style={{ marginTop: 10 }} />
        <Bar h={6} r={3} style={{ marginTop: 10 }} />
        <View style={s.figRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.figCol}>
              <Bar w={60} h={13} />
              <Bar w={44} h={10} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>
      <Bar w={110} h={14} style={{ marginTop: 8 }} />
      <View style={[s.card, s.grid]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={s.gridCell}>
            <Bar w={44} h={44} r={12} />
            <Bar w={48} h={10} />
          </View>
        ))}
      </View>
      <Bar w={130} h={14} style={{ marginTop: 8 }} />
      <RowsSkeleton count={3} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Bar w={80} h={13} style={{ marginTop: 4 }} />
      <View style={s.statGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={s.statTile}>
            <Bar w={34} h={34} r={10} />
            <View style={{ flex: 1, gap: 7 }}>
              <Bar w="70%" h={10} />
              <Bar w="40%" h={16} />
            </View>
          </View>
        ))}
      </View>
      <Bar w={120} h={13} style={{ marginTop: 8 }} />
      <View style={s.card}>
        <Bar w="45%" h={12} />
        <Bar h={140} r={10} style={{ marginTop: 14 }} />
      </View>
      <Bar w={110} h={13} style={{ marginTop: 8 }} />
      <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 18 }]}>
        <Bar w={110} h={110} r={55} />
        <View style={{ flex: 1, gap: 10 }}>
          <Bar w="60%" h={12} />
          <Bar w="80%" h={10} />
          <Bar w="70%" h={10} />
        </View>
      </View>
    </>
  );
}

export default function SkeletonList({ variant = 'cards', count = 4, style }) {
  const opacity = usePulse();
  return (
    <Animated.View style={[s.wrap, { opacity }, style]} pointerEvents="none">
      {variant === 'dashboard' ? (
        <DashboardSkeleton />
      ) : variant === 'home' ? (
        <HomeSkeleton />
      ) : variant === 'rows' ? (
        <RowsSkeleton count={Math.max(count, 5)} />
      ) : (
        Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F6', padding: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  figRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  figCol: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0, paddingVertical: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F6', padding: 12 },
  gridCell: { width: '25%', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
