import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useTranslation } from 'react-i18next';

const FULL_TASKS = [
  
];

export default function ProjectTasksTab() {
  const { t } = useTranslation();
  const STATUS_KEYS = { 'Todo': 'todo', 'In Progress': 'inprogress', 'Done': 'done' };
  return (
    <View style={styles.tabScrollContent}>
      <Text style={styles.sectionLabel}>{t('projectTaskBoard')}</Text>
      <View style={styles.taskGroups}>
        {['Todo', 'In Progress', 'Done'].map(status => (
          <View key={status} style={styles.taskSec}>
            <Text style={styles.taskSecTitle}>{t(STATUS_KEYS[status], status)}</Text>
            {FULL_TASKS.filter(task => task.status === status).map(task => (
              <AdaptiveGlass key={task.id} intensity={10} tint="light" style={styles.taskCard}>
                <View style={styles.taskTop}>
                  <View style={[styles.pPill, { backgroundColor: task.priority === 'Urgent' ? '#EF4444' : '#64748B' }]}>
                    <Text style={styles.pText}>{task.priority}</Text>
                  </View>
                  <Text style={styles.tTeam}>{task.team}</Text>
                </View>
                <Text style={styles.taskTitle}>{task.title}</Text>
              </AdaptiveGlass>
            ))}
            {FULL_TASKS.filter(t => t.status === status).length === 0 && (
              <Text style={styles.emptyTaskText}>No tasks</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabScrollContent: { gap: 24, paddingBottom: 20 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  taskGroups: { gap: 24 },
  taskSec: { marginBottom: 8 },
  taskSecTitle: { fontSize: 14, fontFamily: 'Inter-Black', color: '#64748B', textTransform: 'uppercase', marginBottom: 12 },
  taskCard: { borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pText: { fontSize: 9, fontFamily: 'Inter-Black', color: '#FFF', textTransform: 'uppercase' },
  tTeam: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  taskTitle: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A' },
  emptyTaskText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#CBD5E1', fontStyle: 'italic', marginLeft: 4 }
});
