// People who can be picked as an approver for a project drawing / BOQ.
// Same rule as the web: project members first, org users when the project has none.
import interiorApiClient from '../../services/interiorApiClient';

const fullName = (u) =>
  (u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : '') || u?.fullName || u?.name || u?.email || 'Team Member';

export async function fetchProjectReviewers(projectId) {
  const [membersRes, orgUsersRes] = await Promise.allSettled([
    interiorApiClient.get(`/projects/${projectId}/members`),
    interiorApiClient.get('/users'),
  ]);

  let list = [];
  if (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value?.data)) {
    list = membersRes.value.data.map((m) => {
      const u = m.userId && typeof m.userId === 'object' ? m.userId : null;
      const id = String(u?._id || u?.id || m.userId || m._id || '');
      return {
        id,
        name: u ? fullName(u) : m.name || m.email || 'Team Member',
        email: u?.email || m.email || '',
        role: m.roleId?.name || m.role?.name || m.projectRole || (typeof m.role === 'string' ? m.role : '') || 'Member',
      };
    });
  }
  if (list.length === 0 && orgUsersRes.status === 'fulfilled') {
    const raw = orgUsersRes.value?.data || (Array.isArray(orgUsersRes.value) ? orgUsersRes.value : []);
    list = (Array.isArray(raw) ? raw : []).map((u) => ({
      id: String(u._id || u.id || ''),
      name: fullName(u),
      email: u.email || '',
      role: u.role?.name || (typeof u.role === 'string' ? u.role : '') || 'Reviewer',
    }));
  }
  // The backend stores the reviewer as a user id, so drop anything that isn't one
  const seen = new Set();
  return list.filter((u) => /^[a-f0-9]{24}$/i.test(u.id) && !seen.has(u.id) && seen.add(u.id));
}

export const reviewerOptions = (users) =>
  users.map((u) => ({ value: u.id, label: `${u.name} (${u.role || 'Reviewer'})` }));
