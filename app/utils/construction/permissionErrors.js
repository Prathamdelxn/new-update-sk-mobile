// Turns generic error toasts into "no permission" messages when the request
// behind them was refused with 403 (mirrors web src/lib/permissionErrors.ts).
//
// Most screens show a hard-coded "Failed to load X" from a catch block that
// never looks at the response, so the global fetch wrapper (AuthContext)
// records when a 403 happens and the toast rewrites an error raised right after.

const FORBIDDEN_WINDOW_MS = 1500;
let lastForbiddenAt = 0;

export const markForbidden = () => {
  lastForbiddenAt = Date.now();
};

const wasRecentlyForbidden = () => Date.now() - lastForbiddenAt < FORBIDDEN_WINDOW_MS;

export const toPermissionMessage = (message) => {
  if (typeof message !== 'string' || !message) return message;

  // Backend 403 messages: "Forbidden: Insufficient permissions", "Forbidden: Only an Admin can ..."
  const forbidden = message.match(/^Forbidden:?\s*(.*)$/i);
  if (forbidden) {
    const detail = forbidden[1].trim();
    if (!detail || /^insufficient permissions?\.?$/i.test(detail)) {
      return "You don't have permission to do this.";
    }
    return detail.charAt(0).toUpperCase() + detail.slice(1);
  }

  if (!wasRecentlyForbidden()) return message;

  // "Failed to load plan folders" -> "You don't have permission to view plan folders"
  const failedLoad = message.match(/^Failed to (?:load|fetch)\s+(.*)$/i);
  if (failedLoad) return `You don't have permission to view ${failedLoad[1]}`;

  // "Failed to delete material" -> "You don't have permission to delete material"
  const failed = message.match(/^Failed to\s+(.*)$/i);
  if (failed) return `You don't have permission to ${failed[1]}`;

  return message;
};

export default { markForbidden, toPermissionMessage };
