// Templates already loaded by the Templates list, so the template view can show one
// immediately instead of depending only on the by-id request.

const cache = new Map();

export const rememberTemplate = (template) => {
  const id = template?._id || template?.id;
  if (id) cache.set(String(id), template);
};

export const getCachedTemplate = (id) => (id ? cache.get(String(id)) || null : null);
