// The Role editor saves `<module>:<action>` keys, but default roles seeded at
// registration and older code use other names for some of them. Treat them as
// equal (mirrors web src/lib/permissions.ts and the backend).
const PERMISSION_ALIASES = {
  'projects:view': ['project:view'],
  'projects:create': ['project:create'],
  'projects:update': ['project:update'],
  'projects:delete': ['project:delete'],
  'projects:approve': ['project:approve'],
  'projects:complete': ['project:complete'],
  'projects:assign': ['project:assign', 'team:assign'],
  'sitesurvey:create': ['sitesurvey:submit'],
  'sitesurvey:approve': ['sitesurvey:manage'],
  'sitesurvey:assign': ['sitesurvey:manage'],
  'snags:assign': ['snag:assign'],
  'snags:complete': ['snag:complete', 'snags:resolve', 'snags:close'],
};

export const permissionListIncludes = (perms, permission) => {
  if (!Array.isArray(perms)) return false;
  if (perms.includes('*') || perms.includes(permission)) return true;
  return (PERMISSION_ALIASES[permission] || []).some((alias) => perms.includes(alias));
};

/**
 * Check if the user is a global admin or has the specific global permission.
 * If not, check if they are part of the project and have the permission in their project-specific role.
 */
export const hasProjectPermission = (user, project, permission) => {
  if (!user) return false;

  // 1. Check Global Admin or wildcard
  const globalPerms = user?.role?.permissions || [];
  if (user?.role?.name === 'Admin' || globalPerms.includes('*')) {
    return true;
  }

  // 2. Check Global Permission (if assigned globally)
  if (permissionListIncludes(globalPerms, permission)) {
    return true;
  }

  // 3. Check Project-specific Permission
  if (project && Array.isArray(project.members)) {
    const currentUserId = user?._id || user?.id;
    const myMember = project.members.find(m => {
      const mUserId = m.user?._id || m.user;
      return mUserId === currentUserId;
    });

    if (myMember?.role?.permissions) {
      if (permissionListIncludes(myMember.role.permissions, permission)) {
        return true;
      }
    }
  }

  return false;
};

// Whether any of the user's roles (global or per-project) lets them see projects.
// Without it the project list is empty and every project-scoped permission
// (site survey, BOQ, ...) is unreachable. Mirrors web canViewAnyProject.
export const canViewAnyProject = (user) => hasAnyRolePermission(user, 'projects:view');

// True if the permission is on the user's global role OR on any of their
// project roles. For org-wide modules (Templates, Categories, creating
// projects) that aren't tied to one project. Mirrors web/backend.
export function hasAnyRolePermission(user, permission) {
  if (hasProjectPermission(user, null, permission)) return true;
  return (user?.projects || []).some((p) => {
    const role = p?.role;
    if (!role || typeof role !== 'object') return false;
    return role.name === 'Admin' || role.isSystemRole || permissionListIncludes(role.permissions, permission);
  });
}

export const canCreateProjects = (user) => hasAnyRolePermission(user, 'projects:create');

/**
 * Check if the user has ANY permission that starts with a specific prefix
 * (e.g., 'escalation:') either globally or in the project.
 */
export const hasAnyProjectPermissionPrefix = (user, project, prefix) => {
  if (!user) return false;

  // 1. Check Global Admin or wildcard
  const globalPerms = user?.role?.permissions || [];
  if (user?.role?.name === 'Admin' || globalPerms.includes('*')) {
    return true;
  }

  // 2. Check Global Permission with prefix
  if (globalPerms.some(p => p.startsWith(prefix))) {
    return true;
  }

  // 3. Check Project-specific Permission with prefix
  if (project && Array.isArray(project.members)) {
    const currentUserId = user?._id || user?.id;
    const myMember = project.members.find(m => {
      const mUserId = m.user?._id || m.user;
      return mUserId === currentUserId;
    });

    if (myMember?.role?.permissions) {
      if (myMember.role.permissions.some(p => p.startsWith(prefix))) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Same as hasProjectPermission, but takes a pre-filtered array of members 
 * (useful when project object isn't fully populated but we have members)
 */
export const hasProjectPermissionWithMembers = (user, projectMembers, permission) => {
  if (!user) return false;

  // 1. Check Global Admin or wildcard
  const globalPerms = user?.role?.permissions || [];
  if (user?.role?.name === 'Admin' || globalPerms.includes('*')) {
    return true;
  }

  // 2. Check Global Permission
  if (permissionListIncludes(globalPerms, permission)) {
    return true;
  }

  // 3. Check Project-specific Permission
  if (Array.isArray(projectMembers)) {
    const currentUserId = user?._id || user?.id;
    const myMember = projectMembers.find(m => {
      const mUserId = m.user?._id || m.user;
      return mUserId === currentUserId;
    });

    if (myMember?.role?.permissions) {
      if (permissionListIncludes(myMember.role.permissions, permission)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if the project is in a locked status, which should prevent any modifying actions.
 */
export const isProjectLocked = (project) => {
  if (!project || !project.status) return false;
  return ['Completed', 'Handover Completed', 'Cancelled'].includes(project.status);
};
