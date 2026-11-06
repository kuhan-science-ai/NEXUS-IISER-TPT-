/** Browser-local preferences are isolated by NEXUS account, even on shared devices. */
export function userPreferenceStorageKey(name: string, userId: string): string {
  return `${name}:user:${encodeURIComponent(userId)}`;
}

export function readUserPreference<T>(name: string, userId: string, fallback: T): T {
  try {
    const scopedKey = userPreferenceStorageKey(name, userId);
    let value = localStorage.getItem(scopedKey);
    const legacyValue = localStorage.getItem(name);
    if (legacyValue !== null) {
      if (value === null) {
        value = legacyValue;
        localStorage.setItem(scopedKey, legacyValue);
      }
      localStorage.removeItem(name);
    }
    if (value === null) return fallback;
    try { return JSON.parse(value) as T; } catch {
      if (value === 'true') return true as T;
      if (value === 'false') return false as T;
      return value as T;
    }
  } catch {
    return fallback;
  }
}

export function writeUserPreference<T>(name: string, userId: string, value: T): void {
  try {
    localStorage.setItem(userPreferenceStorageKey(name, userId), JSON.stringify(value));
    localStorage.removeItem(name);
  } catch { /* Keep the preference active for this session if browser storage is unavailable. */ }
}
