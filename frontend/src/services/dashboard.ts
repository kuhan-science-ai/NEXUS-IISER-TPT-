export type DashboardWidgetId = 'events' | 'clubs' | 'question' | 'history' | 'continue' | 'timetable' | 'exams' | 'todo' | 'messages' | 'announcements' | 'uploads';

export interface DashboardPreferences {
  widgets: Record<DashboardWidgetId, boolean>;
  clubs: string[];
}

export interface DashboardHistoryEntry {
  id: string;
  title: string;
  path: string;
  kind: 'page' | 'upload';
  visitedAt: string;
  sessionId: string;
}

export interface PersonalTimetable {
  name: string;
  dataUrl: string;
  mimeType: string;
}

export type StickyNotePalette = 'match' | 'blue' | 'teal' | 'pink' | 'yellow';
export type StickyNoteAngle = 'straight' | 'tilt';
export interface StickyNotePreferences { palette: StickyNotePalette; angle: StickyNoteAngle; sway: boolean; }
const stickyNotePreferencesKey = (userId: string) => `nexus-dashboard-sticky-notes-v1-${userId}`;

export function readStickyNotePreferences(userId: string): StickyNotePreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(stickyNotePreferencesKey(userId)) || '{}') as Partial<StickyNotePreferences>;
    return {
      palette: ['match', 'blue', 'teal', 'pink', 'yellow'].includes(stored.palette || '') ? stored.palette as StickyNotePalette : 'match',
      angle: stored.angle === 'straight' ? 'straight' : 'tilt',
      sway: stored.sway !== false,
    };
  } catch { return { palette: 'match', angle: 'tilt', sway: true }; }
}

export function writeStickyNotePreferences(userId: string, preferences: StickyNotePreferences): void {
  try { localStorage.setItem(stickyNotePreferencesKey(userId), JSON.stringify(preferences)); } catch { /* browser storage may be disabled */ }
  window.dispatchEvent(new CustomEvent('nexus-dashboard-sticky-notes-updated'));
}

export const DASHBOARD_WIDGETS: Array<{ id: DashboardWidgetId; label: string; description: string; optional?: boolean }> = [
  { id: 'events', label: 'Institute events & calendar', description: 'Academic events from the campus feed and your calendar.' },
  { id: 'clubs', label: 'Club activities', description: 'Events matching the clubs you follow.' },
  { id: 'question', label: 'Question of the Day', description: 'A highlighted daily campus question.' },
  { id: 'history', label: 'Recently visited', description: 'Pages and uploads from this browser.' },
  { id: 'continue', label: 'Continue studying', description: 'Pick up from a recent study page.' },
  { id: 'timetable', label: 'My timetable', description: 'Your uploaded semester timetable.', optional: true },
  { id: 'exams', label: 'Exams & deadlines', description: 'Exam and deadline entries from your calendar.', optional: true },
  { id: 'todo', label: 'To-do list', description: 'Your NEXUS tasks.', optional: true },
  { id: 'messages', label: 'Unread messages', description: 'Quick link to your inbox.', optional: true },
  { id: 'announcements', label: 'Campus notices', description: 'Official and academic notices sent to your account.', optional: true },
  { id: 'uploads', label: 'Recent uploads', description: 'Resources recently added to the repository.', optional: true },
];

const defaultWidgets: DashboardPreferences['widgets'] = {
  events: true, clubs: true, question: true, history: true, continue: true,
  timetable: false, exams: false, todo: false, messages: false, announcements: false, uploads: false,
};

const preferencesKey = (userId: string) => `nexus-dashboard-preferences-v1-${userId}`;
const timetableKey = (userId: string) => `nexus-personal-timetable-v1-${userId}`;
const historyKey = (userId: string) => `nexus-dashboard-history-v1-${userId}`;
const sessionHistoryKey = (userId: string) => `nexus-dashboard-session-history-v1-${userId}`;
const sessionIdKey = 'nexus-dashboard-session-id-v1';
const historyEvent = 'nexus-dashboard-history-updated';
export const HISTORY_PAGE_SIZE = 15;
export const HISTORY_MAX_PAGES = 5;
const historyRetentionLimit = HISTORY_PAGE_SIZE * HISTORY_MAX_PAGES;

export function readDashboardPreferences(userId: string): DashboardPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(preferencesKey(userId)) || '{}') as Partial<DashboardPreferences>;
    return { widgets: { ...defaultWidgets, ...(stored.widgets || {}) }, clubs: Array.isArray(stored.clubs) ? stored.clubs.filter((club): club is string => typeof club === 'string').slice(0, 30) : [] };
  } catch { return { widgets: { ...defaultWidgets }, clubs: [] }; }
}

export function writeDashboardPreferences(userId: string, preferences: DashboardPreferences): void {
  try { localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences)); } catch { /* browser storage may be disabled */ }
  window.dispatchEvent(new CustomEvent('nexus-dashboard-preferences-updated'));
}

export function readPersonalTimetable(userId: string): PersonalTimetable | null {
  try {
    const value = JSON.parse(localStorage.getItem(timetableKey(userId)) || 'null') as PersonalTimetable | null;
    return value && typeof value.name === 'string' && typeof value.dataUrl === 'string' && typeof value.mimeType === 'string' ? value : null;
  } catch { return null; }
}

export function savePersonalTimetable(userId: string, timetable: PersonalTimetable | null): boolean {
  try {
    if (timetable) localStorage.setItem(timetableKey(userId), JSON.stringify(timetable));
    else localStorage.removeItem(timetableKey(userId));
    return true;
  } catch { return false; }
}

function getSessionId(): string {
  let id = sessionStorage.getItem(sessionIdKey);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(sessionIdKey, id);
  }
  return id;
}

function readEntries(storage: Storage, key: string): DashboardHistoryEntry[] {
  try {
    const entries = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(entries) ? entries.filter(entry => entry && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.path === 'string' && typeof entry.visitedAt === 'string') : [];
  } catch { return []; }
}

export function readDashboardHistory(userId: string): DashboardHistoryEntry[] {
  return readRetainedEntries(localStorage, historyKey(userId));
}

export function readDashboardSessionHistory(userId: string): DashboardHistoryEntry[] {
  return readRetainedEntries(sessionStorage, sessionHistoryKey(userId));
}

function readRetainedEntries(storage: Storage, key: string): DashboardHistoryEntry[] {
  const entries = readEntries(storage, key);
  const retained = entries.slice(0, historyRetentionLimit);
  if (retained.length !== entries.length) {
    try { storage.setItem(key, JSON.stringify(retained)); } catch { /* keep history readable if storage is unavailable */ }
  }
  return retained;
}

export function recordDashboardHistory(userId: string, entry: Omit<DashboardHistoryEntry, 'id' | 'visitedAt' | 'sessionId'>): void {
  if (!userId) return;
  const historyEntry: DashboardHistoryEntry = {
    ...entry,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    visitedAt: new Date().toISOString(),
    sessionId: getSessionId(),
  };
  const add = (storage: Storage, key: string, limit: number) => {
    try {
      const entries = readEntries(storage, key);
      storage.setItem(key, JSON.stringify([historyEntry, ...entries].slice(0, limit)));
    } catch { /* keep navigation working if storage is unavailable */ }
  };
  add(localStorage, historyKey(userId), historyRetentionLimit);
  add(sessionStorage, sessionHistoryKey(userId), historyRetentionLimit);
  window.dispatchEvent(new Event(historyEvent));
}

export function notifyDashboardHistoryChanged(): void { window.dispatchEvent(new Event(historyEvent)); }
export const DASHBOARD_HISTORY_EVENT = historyEvent;

export function clearDashboardHistory(userId: string): void {
  try { localStorage.removeItem(historyKey(userId)); sessionStorage.removeItem(sessionHistoryKey(userId)); } catch { /* browser storage may be disabled */ }
  window.dispatchEvent(new Event(historyEvent));
}
