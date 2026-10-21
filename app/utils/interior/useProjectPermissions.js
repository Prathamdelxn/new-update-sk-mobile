// =============================================================================
// Interior — permissions inside one project
// The backend allows an action in a project when the user is an org admin, or a
// member whose org role + project role allow it. This mirrors that (via
// GET /projects/:id/members/me) so screens hide what the server would refuse.
// Reloads whenever AuthContext refreshes the user (~15s) and on foreground.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import interiorApiClient from '../../services/interiorApiClient';
import { permissionsAllow } from './permissionCatalog';
import { useInteriorPermissions } from './useInteriorPermissions';

const CACHE_MS = 10000;
const cache = new Map();
const inflight = new Map();

function loadProjectAccess(projectId, force = false) {
  const hit = cache.get(projectId);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  if (inflight.has(projectId)) return inflight.get(projectId);
  const p = interiorApiClient
    .get(`/projects/${projectId}/members/me`)
    .then((res) => {
      const d = res?.data ?? res ?? {};
      const data = {
        isMember: !!d.isMember,
        isAdmin: !!d.isAdmin,
        roleName: d.roleName,
        permissions: Array.isArray(d.permissions) ? d.permissions : [],
      };
      cache.set(projectId, { at: Date.now(), data });
      return data;
    })
    .catch(() => ({ isMember: false, isAdmin: false, permissions: [] }))
    .finally(() => inflight.delete(projectId));
  inflight.set(projectId, p);
  return p;
}

export function useProjectPermissions(projectId) {
  const { isOrgAdmin, user } = useInteriorPermissions();
  const [access, setAccess] = useState(() => (projectId ? cache.get(projectId)?.data ?? null : null));

  // `user` changes on every AuthContext refresh → reload project permissions too
  useEffect(() => {
    if (!projectId || isOrgAdmin) return undefined;
    let alive = true;
    const load = (force) =>
      loadProjectAccess(projectId, force).then((d) => {
        if (alive) setAccess(d);
      });
    load(true);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load(true);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [projectId, isOrgAdmin, user]);

  /** Allowed in this project? `false` while loading, so buttons don't flash. */
  const can = useCallback(
    (module, action = 'read') => {
      if (isOrgAdmin) return true;
      if (!access) return false;
      if (access.isAdmin) return true;
      return permissionsAllow(access.permissions, module, action);
    },
    [isOrgAdmin, access]
  );

  return {
    can,
    isAdmin: isOrgAdmin || !!access?.isAdmin,
    isMember: isOrgAdmin || !!access?.isMember,
    loading: !isOrgAdmin && !access,
  };
}

/** Clear cached project permissions (after a member's role changes). */
export function invalidateProjectPermissions(projectId) {
  if (projectId) cache.delete(projectId);
  else cache.clear();
}
