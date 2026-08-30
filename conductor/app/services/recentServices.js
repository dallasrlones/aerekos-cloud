/**
 * recentServices — tracks the services a user has most recently opened so the
 * Console Home can show an AWS-style "Recently visited" shortcut row.
 *
 * Persisted in localStorage on web; falls back to an in-memory list on native
 * (or anywhere localStorage is unavailable) so the rest of the UI keeps working.
 */

const STORAGE_KEY = 'aerekos.recentServices';
const MAX_RECENT = 6;

let memoryStore = [];

const hasLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (_e) {
    return false;
  }
};

/** Returns the recent services, most-recently-visited first. */
export const getRecentServices = () => {
  if (!hasLocalStorage()) return memoryStore;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
};

/**
 * Records a visit to a catalog service. `meta` is a serviceCatalog entry; we
 * persist only the fields the row needs to render and re-navigate.
 */
export const recordServiceVisit = (meta) => {
  if (!meta || !meta.name) return getRecentServices();
  const entry = {
    name: meta.name,
    label: meta.label,
    icon: meta.icon,
    route: meta.route || null,
  };
  const next = [entry, ...getRecentServices().filter((s) => s.name !== meta.name)].slice(0, MAX_RECENT);

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_e) {
      // Quota / privacy mode — fall back to memory so the row still updates.
      memoryStore = next;
    }
  } else {
    memoryStore = next;
  }
  return next;
};
