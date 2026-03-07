/**
 * OSRM API client for walking and cycling route geometries.
 * Uses the public OSRM demo server — suitable for development.
 */

const OSRM_BASE = 'https://router.project-osrm.org';

/**
 * Get a route between two points.
 * @param {{ lat, lon }} from
 * @param {{ lat, lon }} to
 * @param {'foot'|'bike'} profile
 * @returns {{ duration: number, distance: number, geometry: Array<[number, number]> }|null}
 */
async function getRoute(from, to, profile) {
    const profileMap = { foot: 'foot', bike: 'bike' };
    const osrmProfile = profileMap[profile] || 'foot';

    try {
        const url = `${OSRM_BASE}/route/v1/${osrmProfile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;

        const route = data.routes[0];
        return {
            duration: route.duration,  // seconds
            distance: route.distance,  // meters
            geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]), // Leaflet format [lat, lon]
        };
    } catch (e) {
        console.warn(`[OSRM] Failed to get ${profile} route:`, e.message);
        return null;
    }
}

/**
 * Get walking route.
 */
export async function getWalkingRoute(from, to) {
    return getRoute(from, to, 'foot');
}

/**
 * Get cycling route.
 */
export async function getCyclingRoute(from, to) {
    return getRoute(from, to, 'bike');
}
