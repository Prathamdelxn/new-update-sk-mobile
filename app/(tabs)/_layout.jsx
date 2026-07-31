import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const isInterior = user?.organization?.industryType === 'interior';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
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
          href: isInterior ? undefined : null,
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
          href: isInterior ? undefined : null,
          title: 'Project',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="template/index"
        options={{
          href: isInterior ? null : undefined,
          title: 'Template',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'layers' : 'layers-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="i-template/index"
        options={{
          href: isInterior ? undefined : null,
          title: 'Template',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'layers' : 'layers-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payment/index"
        options={{ href: null }}
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
