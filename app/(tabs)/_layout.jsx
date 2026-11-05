import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { hasAnyRolePermission } from '../utils/permissions';
import { useInteriorPermissions } from '../utils/interior/useInteriorPermissions';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isInterior = user?.organization?.industryType === 'interior';
  // Interior: CRM / Projects tabs only for users who can open them (same as the web sidebar)
  const { navAccess } = useInteriorPermissions();
  // Templates tab needs Template or Category Management > View (any role)
  const canSeeTemplates = hasAnyRolePermission(user, 'template:view') || hasAnyRolePermission(user, 'category:view');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        // Docked bar: solid white, sits above the home indicator; screens end above it
        // (the old floating translucent bar let list cards show through and cut labels off)
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: 'Inter-SemiBold',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="home" inactive="home-outline" />,
        }}
      />
      <Tabs.Screen
        name="crm/index"
        options={{
          href: isInterior && navAccess.crm ? undefined : null,
          title: 'CRM',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="people" inactive="people-outline" />,
        }}
      />
      <Tabs.Screen
        name="project/index"
        options={{
          href: isInterior ? null : undefined,
          title: 'Project',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="grid" inactive="grid-outline" />,
        }}
      />
      <Tabs.Screen
        name="i-project/index"
        options={{
          href: isInterior && navAccess.projects ? undefined : null,
          title: 'Project',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="grid" inactive="grid-outline" />,
        }}
      />
      <Tabs.Screen
        name="template/index"
        options={{
          href: isInterior || !canSeeTemplates ? null : undefined,
          title: 'Template',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="layers" inactive="layers-outline" />,
        }}
      />
      <Tabs.Screen
        name="i-template/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payment/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="i-audit/index"
        options={{
          href: isInterior && navAccess.audit ? undefined : null,
          title: 'Audit',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="shield-checkmark" inactive="shield-checkmark-outline" />,
        }}
      />
      <Tabs.Screen
        name="setting/index"
        options={{
          href: isInterior ? null : undefined,
          title: 'Setting',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="options" inactive="options-outline" />,
        }}
      />
      <Tabs.Screen
        name="i-setting/index"
        options={{
          href: isInterior ? undefined : null,
          title: 'Setting',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} active="options" inactive="options-outline" />,
        }}
      />
    </Tabs>
  );
}

// Icon with a soft pill behind it on the selected tab
function TabIcon({ focused, color, active, inactive }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Ionicons name={focused ? active : inactive} size={21} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconPill: { width: 46, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: '#DBEAFE' },
});
