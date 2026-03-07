/**
 * Simple cache using localStorage for ZTM timetable data.
 * Keyed by date string (YYYY-MM-DD).
 */

const CACHE_PREFIX = 'bikerouter_ztm_';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Get cached data for a given key (date + type).
 * Returns null if not found or expired.
 */
export function getCached(key) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;

        const entry = JSON.parse(raw);
        if (Date.now() - entry.timestamp > MAX_AGE_MS) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

/**
 * Store data in cache.
 */
export function setCache(key, data) {
    try {
        const entry = { data, timestamp: Date.now() };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
        // localStorage might be full — clear old entries and retry
        clearOldEntries();
        try {
            const entry = { data, timestamp: Date.now() };
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch {
            console.warn('[Cache] Failed to store data, localStorage may be full');
        }
    }
}

/**
 * Clear cache entries older than MAX_AGE_MS.
 */
function clearOldEntries() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keys.push(key);
        }
    }
    for (const key of keys) {
        try {
            const entry = JSON.parse(localStorage.getItem(key));
            if (Date.now() - entry.timestamp > MAX_AGE_MS) {
                localStorage.removeItem(key);
            }
        } catch {
            localStorage.removeItem(key);
        }
    }
}

/**
 * Clear all cache.
 */
export function clearCache() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keys.push(key);
        }
    }
    keys.forEach(k => localStorage.removeItem(k));
}
