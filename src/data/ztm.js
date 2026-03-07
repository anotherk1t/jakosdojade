/**
 * ZTM Gdańsk open data API client.
 * Fetches stops, routes, trips, and stopTimes.
 * Uses Vite dev proxy at /api/ztm to avoid CORS.
 */

import { getCached, setCache } from './cache.js';
import { parseZtmTime } from '../routing/geo.js';

const API_BASE = 'https://ckan2.multimediagdansk.pl';

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`ZTM API error: ${resp.status} ${url}`);
    return resp.json();
}

/**
 * Fetch all stops for a given date.
 */
export async function fetchStops(date = todayStr()) {
    const cacheKey = `stops_${date}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await fetchJSON(`${API_BASE}/stops?date=${date}`);
    const stops = data.stops
        .filter(s => s.stopLat && s.stopLon && !s.nonpassenger && !s.depot)
        .map(s => ({
            id: s.stopId,
            code: s.stopCode,
            name: s.stopCode ? `${s.stopName} ${s.stopCode}` : s.stopName,
            desc: s.stopDesc,
            lat: s.stopLat,
            lon: s.stopLon,
            type: s.type || 'BUS',
            zone: s.zoneName || '',
        }));

    setCache(cacheKey, stops);
    console.log(`[ZTM] Loaded ${stops.length} stops`);
    return stops;
}

/**
 * Fetch all routes for a given date.
 */
export async function fetchRoutes(date = todayStr()) {
    const cacheKey = `routes_${date}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await fetchJSON(`${API_BASE}/routes?date=${date}`);
    const routes = data.routes.map(r => ({
        id: r.routeId,
        shortName: r.routeShortName,
        longName: r.routeLongName,
        type: r.routeType || 'BUS',
    }));

    setCache(cacheKey, routes);
    console.log(`[ZTM] Loaded ${routes.length} routes`);
    return routes;
}

/**
 * Fetch stop times for a route on a given date.
 */
export async function fetchStopTimes(routeId, date = todayStr()) {
    const data = await fetchJSON(`${API_BASE}/stopTimes?date=${date}&routeId=${routeId}`);
    return data.stopTimes || [];
}

/**
 * Fetch trips for a route on a given date.
 */
export async function fetchTrips(routeId, date = todayStr()) {
    const data = await fetchJSON(`${API_BASE}/trips?date=${date}&routeId=${routeId}`);
    return data.trips || [];
}

/**
 * Fetch complete timetable data: stops, routes, and all stop times.
 * Groups stopTimes by tripId and builds connections.
 * 
 * @param {function} onProgress - callback(message) for progress updates
 * @returns {{ stops, routes, connections, stopMap, routeMap }}
 */
export async function fetchTimetable(date = todayStr(), onProgress = () => { }) {
    const fullCacheKey = `timetable_${date}`;
    const cached = getCached(fullCacheKey);
    if (cached) {
        console.log('[ZTM] Using cached timetable');
        return cached;
    }

    onProgress('Loading stops and routes...');
    const [stops, routes] = await Promise.all([
        fetchStops(date),
        fetchRoutes(date),
    ]);

    // Build lookup maps
    const stopMap = new Map(stops.map(s => [s.id, s]));
    const routeMap = new Map(routes.map(r => [r.id, r]));

    // Fetch stopTimes for all routes (in batches to avoid overwhelming the API)
    onProgress('Loading timetables...');
    const connections = [];
    const batchSize = 10;

    for (let i = 0; i < routes.length; i += batchSize) {
        const batch = routes.slice(i, i + batchSize);
        onProgress(`Loading timetables... (${Math.min(i + batchSize, routes.length)}/${routes.length})`);

        const batchResults = await Promise.all(
            batch.map(r => fetchStopTimes(r.id, date).catch(() => []))
        );

        for (let j = 0; j < batch.length; j++) {
            const route = batch[j];
            const stopTimes = batchResults[j];

            // Group by tripId + order + busServiceName (uniquely identifies a single service run)
            const trips = new Map();
            for (const st of stopTimes) {
                if (!st.passenger && st.nonpassenger) continue; // Skip non-passenger stops
                if (st.virtual) continue; // Skip virtual stops
                const key = `${st.tripId}_${st.order}_${st.busServiceName}`;
                if (!trips.has(key)) trips.set(key, []);
                trips.get(key).push(st);
            }

            // For each trip run, sort by stopSequence and create connections
            for (const [tripKey, tripStops] of trips) {
                tripStops.sort((a, b) => a.stopSequence - b.stopSequence);

                for (let k = 0; k < tripStops.length - 1; k++) {
                    const from = tripStops[k];
                    const to = tripStops[k + 1];
                    const fromStop = stopMap.get(from.stopId);
                    const toStop = stopMap.get(to.stopId);

                    if (!fromStop || !toStop) continue;

                    const depTime = parseZtmTime(from.departureTime);
                    const arrTime = parseZtmTime(to.arrivalTime);

                    // Skip invalid connections (arrival before departure)
                    if (arrTime < depTime) continue;
                    // Skip zero-duration connections
                    if (arrTime === depTime && from.stopId === to.stopId) continue;

                    connections.push({
                        routeId: route.id,
                        routeName: route.shortName,
                        routeType: route.type,
                        tripId: tripKey, // Unique per run: "tripId_order"
                        fromStopId: from.stopId,
                        toStopId: to.stopId,
                        departureTime: depTime,
                        arrivalTime: arrTime,
                    });
                }
            }
        }
    }

    // Sort connections by departure time (required for CSA)
    connections.sort((a, b) => a.departureTime - b.departureTime);

    const timetable = { stops, routes, connections, stopMap, routeMap };

    // Try to cache (may fail if data is too large for localStorage)
    try {
        setCache(fullCacheKey, timetable);
    } catch {
        console.warn('[ZTM] Timetable too large for localStorage cache');
    }

    console.log(`[ZTM] Built ${connections.length} connections from ${routes.length} routes`);
    return timetable;
}
