/**
 * Transit graph builder.
 * Builds walking transfer links between nearby stops and
 * indexes stops/stations for quick spatial lookup.
 */

import { haversine, findNearby, estimateWalkTime } from './geo.js';

const MAX_TRANSFER_DISTANCE_M = 500; // Max walking distance for transfers
const MAX_WALK_TO_STOP_M = 1000;     // Max walking distance to first/last stop

/**
 * Build transfer links between nearby stops.
 * @param {Array} stops - Array of { id, lat, lon, ... }
 * @returns {Map<number, Array<{ toStopId: number, walkTime: number, distance: number }>>}
 */
export function buildTransferLinks(stops) {
    const transfers = new Map();

    // Use a simple spatial grid for efficiency
    const grid = new Map();
    const cellSize = 0.005; // ~500m in lat degrees

    for (const stop of stops) {
        const cellKey = `${Math.floor(stop.lat / cellSize)},${Math.floor(stop.lon / cellSize)}`;
        if (!grid.has(cellKey)) grid.set(cellKey, []);
        grid.get(cellKey).push(stop);
    }

    for (const stop of stops) {
        const nearby = [];
        const cellLat = Math.floor(stop.lat / cellSize);
        const cellLon = Math.floor(stop.lon / cellSize);

        // Check neighboring cells
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                const key = `${cellLat + di},${cellLon + dj}`;
                const cell = grid.get(key);
                if (!cell) continue;

                for (const other of cell) {
                    if (other.id === stop.id) continue;
                    const d = haversine(stop.lat, stop.lon, other.lat, other.lon);
                    if (d <= MAX_TRANSFER_DISTANCE_M) {
                        nearby.push({
                            toStopId: other.id,
                            walkTime: estimateWalkTime(d),
                            distance: d,
                        });
                    }
                }
            }
        }

        if (nearby.length > 0) {
            transfers.set(stop.id, nearby);
        }
    }

    console.log(`[Graph] Built transfer links for ${transfers.size} stops`);
    return transfers;
}

/**
 * Find transit stops near a point.
 * @returns {Array<{ stop, distance, walkTime }>}
 */
export function findNearbyStops(lat, lon, stops, maxDistance = MAX_WALK_TO_STOP_M) {
    return findNearby({ lat, lon }, stops, maxDistance).map(({ item, distance }) => ({
        stop: item,
        distance,
        walkTime: estimateWalkTime(distance),
    }));
}
