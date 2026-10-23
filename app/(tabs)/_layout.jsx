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
        tabBarStyle: {
          position: 'absolute',
          bottom: Math.max(insets.bottom + 8, 20),
          marginHorizontal: 18,
          left: 0,
          right: 0,
          height: 66,
          backgroundColor: '#EFF6FF',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#DBEAFE',
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter-SemiBold',
        },
      }}>
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="crm/index"
        options={{
          href: isInterior && navAccess.crm ? undefined : null,
          title: 'CRM',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="project/index"
        options={{
          href: isInterior ? null : undefined,
          title: 'Project',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="i-project/index"
        options={{
          href: isInterior && navAccess.projects ? undefined : null,
          title: 'Project',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="template/index"
        options={{
          href: isInterior || !canSeeTemplates ? null : undefined,
          title: 'Template',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'layers' : 'layers-outline'} size={22} color={color} />
          ),
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
          href: isInterior ? undefined : null,
          title: 'Audit',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="setting/index"
        options={{
          href: isInterior ? null : undefined,
          title: 'Setting',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'options' : 'options-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="i-setting/index"
        options={{
          href: isInterior ? undefined : null,
          title: 'Setting',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'options' : 'options-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
