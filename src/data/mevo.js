/**
 * MEVO bike station data provider.
 * 
 * Currently loads a hardcoded JSON snapshot. Designed with a provider
 * interface so we can swap in real-time GBFS fetching later.
 * 
 * Future interface:
 *   - getStations() → Promise<Station[]>
 *   - getStationAvailability(stationId) → Promise<Availability>
 */

import { findNearby } from '../routing/geo.js';

let stations = null;

/**
 * Load the hardcoded MEVO station snapshot.
 * @returns {Promise<Array>} Array of { id, name, address, lat, lon, capacity }
 */
export async function loadStations() {
    if (stations) return stations;

    try {
        const { default: data } = await import('./mevo_stations_snapshot.json');

        stations = data.stations.map(s => ({
            id: s.id,
            name: s.name,
            address: s.address || '',
            lat: s.lat,
            lon: s.lon,
            capacity: s.capacity || 0,
            type: 'mevo',
        }));

        console.log(`[MEVO] Loaded ${stations.length} stations`);
        return stations;
    } catch (err) {
        console.error('Failed to load MEVO stations from snapshot', err);
        throw err;
    }
}

/**
 * Get all loaded stations.
 */
export function getStations() {
    return stations || [];
}

/**
 * Get stations within a radius of a point.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusM - Radius in meters (default 800).
 * @returns {Array<{ item: Station, distance: number }>}
 */
export function getStationsNear(lat, lon, radiusM = 800) {
    if (!stations) return [];
    return findNearby({ lat, lon }, stations, radiusM);
}

/**
 * FUTURE: Real-time availability check.
 * For now returns null (unavailable).
 */
export async function getStationAvailability(stationId) {
    // TODO: Implement GBFS station_status.json fetching
    // const resp = await fetch(GBFS_STATUS_URL, { headers: { 'Client-Identifier': '...' } });
    return null;
}
