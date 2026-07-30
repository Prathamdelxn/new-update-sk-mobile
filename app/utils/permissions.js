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
  if (globalPerms.includes(permission)) {
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
      if (myMember.role.permissions.includes('*') || myMember.role.permissions.includes(permission)) {
        return true;
      }
    }
  }

  return false;
};

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
  if (globalPerms.includes(permission)) {
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
      if (myMember.role.permissions.includes('*') || myMember.role.permissions.includes(permission)) {
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
