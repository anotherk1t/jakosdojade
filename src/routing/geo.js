/**
 * Geo utility functions for distance calculations and nearest-point lookups.
 */

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Haversine distance between two lat/lon points.
 * @returns {number} Distance in meters.
 */
export function haversine(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * DEG_TO_RAD;
    const dLon = (lon2 - lon1) * DEG_TO_RAD;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
        Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find items within a given radius of a point.
 * @param {{ lat: number, lon: number }} point
 * @param {Array<{ lat: number, lon: number }>} items
 * @param {number} maxDistanceM - Maximum distance in meters.
 * @returns {Array<{ item: any, distance: number }>} Sorted by distance.
 */
export function findNearby(point, items, maxDistanceM) {
    const results = [];
    for (const item of items) {
        const d = haversine(point.lat, point.lon, item.lat, item.lon);
        if (d <= maxDistanceM) {
            results.push({ item, distance: d });
        }
    }
    results.sort((a, b) => a.distance - b.distance);
    return results;
}

/** Estimate walking time in seconds (avg 5 km/h = 1.39 m/s). */
export function estimateWalkTime(distanceM) {
    return distanceM / 1.39;
}

/** Estimate biking time in seconds (avg 15 km/h = 4.17 m/s). */
export function estimateBikeTime(distanceM) {
    return distanceM / 4.17;
}

/** Format seconds to "X mins" or "Xh Ym" string. */
export function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m} mins` : `${h}h`;
}

/** Format seconds since midnight to "HH:MM" (wraps past 24h). */
export function formatTime(secondsSinceMidnight) {
    const h = Math.floor(secondsSinceMidnight / 3600) % 24;
    const m = Math.floor((secondsSinceMidnight % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Parse "HH:MM" string to seconds since midnight. */
export function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
}

/** Parse ZTM time format "1899-12-30T07:15:00" to seconds since midnight. */
export function parseZtmTime(ztmTimeStr) {
    const timePart = ztmTimeStr.split('T')[1];
    if (!timePart) return 0;
    const [h, m, s] = timePart.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
}
