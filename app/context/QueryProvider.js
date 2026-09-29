import { useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

// Same defaults as web's src/providers/QueryProvider.tsx — data loaded once
// stays on screen when a user leaves and comes back, instead of re-fetching
// on every visit. Mutations and pull-to-refresh still refetch explicitly.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes fresh data
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function QueryProvider({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Query keys shared across screens (mirrors web's keys where one exists).
export const queryKeys = {
  crmLeads: ['crm-leads-list'],
  crmLead: (id) => ['crm-lead', id],
  crmLeadActivities: (id) => ['crm-lead-activities', id],
  crmUsers: ['crm-users'],
  crmFollowUps: ['crm-follow-ups-all'],
  crmWonProjects: ['crm-won-projects'],
  interiorProjects: ['interior-projects-list'],
  interiorTemplates: ['interior-templates'],
  interiorProject: (id) => ['interior-project', id],
  interiorProjectMetrics: (id) => ['interior-project-metrics', id],
  interiorDashboard: ['interior-dashboard'],
};

// Marks all CRM data stale after a lead/activity mutation: a status change on
// one screen affects the list, pipeline, follow-ups and lead 360 views.
// Screens currently mounted refetch immediately; the rest refetch when opened.
export function invalidateCrmQueries(client = queryClient) {
  return client.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('crm-'),
  });
}

export function invalidateProjectQueries(client = queryClient) {
  return client.invalidateQueries({
    predicate: (q) =>
      typeof q.queryKey[0] === 'string' &&
      (q.queryKey[0].startsWith('interior-') || q.queryKey[0] === 'crm-won-projects'),
  });
}

// Tab screens stay mounted in expo-router, so remount-based refetching never
// fires for them. On re-focus, refetch only queries that went stale (older than
// staleTime, or invalidated by a mutation elsewhere) — fresh data is reused.
export function useRefreshOnFocus(queryKeyList) {
  const client = useQueryClient();
  const isFirstFocus = useRef(true);
  const keysRef = useRef(queryKeyList);
  keysRef.current = queryKeyList;

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      keysRef.current.forEach((queryKey) => {
        client.refetchQueries({ queryKey, stale: true, type: 'active' });
      });
    }, [client])
  );
}

// Lets screens keep their existing setX(prev => ...) optimistic updates while
// the data itself lives in the query cache.
export function useQuerySetter(queryKey) {
  const client = useQueryClient();
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;
  return useCallback(
    (updater) => {
      client.setQueryData(keyRef.current, (prev) =>
        typeof updater === 'function' ? updater(prev) : updater
      );
    },
    [client]
  );
}
