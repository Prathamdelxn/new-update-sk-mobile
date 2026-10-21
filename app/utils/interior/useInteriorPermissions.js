// =============================================================================
// Interior — org-level permissions (the user's org role)
// Kept fresh by AuthContext (re-reads /auth/me on open, on foreground and every
// 15s), so grants / revokes apply without logging out. Same rules as the web
// usePermissions hook and the interior-os-backend (lib/rbac).
// =============================================================================

import { useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isInteriorOrgAdmin, permissionsAllow } from './permissionCatalog';
import { CRM_MODULES } from './crmStages';

export function useInteriorPermissions() {
  const { user } = useAuth();
  const isOrgAdmin = useMemo(() => isInteriorOrgAdmin(user), [user]);
  const perms = user?.role?.permissions || [];

  /** Allowed by the org role? Admins: always. Unknown role data: least access. */
  const hasPermission = useCallback(
    (module, action = 'read') => isOrgAdmin || permissionsAllow(perms, module, action),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOrgAdmin, user]
  );

  /** Sections the server says this user can open (GET /auth/me → navAccess). */
  const navAccess = useMemo(() => {
    if (isOrgAdmin) return { dashboard: true, crm: true, projects: true, vendors: true, usersRoles: true };
    const fromServer = user?.navAccess || {};
    return {
      dashboard: fromServer.dashboard ?? true,
      crm: fromServer.crm ?? CRM_MODULES.some((m) => permissionsAllow(perms, m, 'read')),
      projects: fromServer.projects ?? true,
      vendors: fromServer.vendors ?? permissionsAllow(perms, 'vendors', 'read'),
      usersRoles: fromServer.usersRoles ?? permissionsAllow(perms, 'roles', 'read'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrgAdmin, user]);

  return { user, isOrgAdmin, hasPermission, navAccess };
}
