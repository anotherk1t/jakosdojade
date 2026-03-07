/**
 * Connection Scan Algorithm (CSA) for transit routing.
 * Finds earliest-arrival journeys through the timetable.
 *
 * Reference: https://i11www.iti.kit.edu/extra/publications/dpsw-isftr-13.pdf
 */

/**
 * Run CSA from multiple source stops to multiple target stops.
 *
 * @param {Object} params
 * @param {Array} params.connections - Sorted by departure time.
 * @param {Array<{ stopId: number, arrivalTime: number }>} params.sources
 * @param {Set<number>} params.targetStopIds
 * @param {Map<number, Array>} params.transfers - Walking transfer links.
 * @param {number} params.minDepartureTime - Don't consider connections before this.
 * @param {number} params.maxJourneys - Max journeys to find (default 3).
 * @returns {Array<Journey>}
 */
export function runCSA({ connections, sources, targetStopIds, transfers, minDepartureTime, maxJourneys = 3 }) {
    // S[stopId] = earliest known arrival time at stop
    const S = new Map();
    // tripReached[tripKey] = earliest time we can board this trip
    const tripReached = new Map();
    // Previous pointer for journey reconstruction
    // J[stopId] = { type, connection?, fromStopId?, walkTime?, arrivalTime }
    const J = new Map();
    // Track visited stop→trip combinations to prevent cycles
    const visited = new Set();

    // Initialize source stops
    for (const { stopId, arrivalTime } of sources) {
        if (!S.has(stopId) || arrivalTime < S.get(stopId)) {
            S.set(stopId, arrivalTime);
            J.set(stopId, { type: 'origin', arrivalTime });
        }
    }

    // Apply initial transfers from source stops
    for (const { stopId, arrivalTime } of sources) {
        const transferList = transfers.get(stopId);
        if (!transferList) continue;
        for (const tr of transferList) {
            const newArrival = arrivalTime + tr.walkTime;
            if (!S.has(tr.toStopId) || newArrival < S.get(tr.toStopId)) {
                S.set(tr.toStopId, newArrival);
                J.set(tr.toStopId, {
                    type: 'transfer',
                    fromStopId: stopId,
                    walkTime: tr.walkTime,
                    arrivalTime: newArrival,
                });
            }
        }
    }

    // Find start index in connections array (binary search)
    let startIdx = 0;
    {
        let lo = 0, hi = connections.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (connections[mid].departureTime < minDepartureTime) {
                lo = mid + 1;
            } else {
                startIdx = mid;
                hi = mid - 1;
            }
        }
    }

    // Only scan connections that depart within a reasonable window (6 hours)
    const maxDepartureTime = minDepartureTime + 6 * 3600;

    // Scan connections
    for (let i = startIdx; i < connections.length; i++) {
        const c = connections[i];

        // Stop scanning if we're past the time window
        if (c.departureTime > maxDepartureTime) break;

        // Skip if arrival is before departure (data error)
        if (c.arrivalTime < c.departureTime) continue;

        // Can we reach the departure stop in time?
        const arrivalAtFrom = S.get(c.fromStopId);
        if (arrivalAtFrom === undefined || arrivalAtFrom > c.departureTime) continue;

        // Can we improve arrival at the destination stop?
        const currentBest = S.get(c.toStopId);
        if (currentBest !== undefined && currentBest <= c.arrivalTime) continue;

        // Prevent cycles: don't visit the same stop via the same route direction
        const cycleKey = `${c.toStopId}_${c.routeId}_${c.tripId}`;
        if (visited.has(cycleKey)) continue;
        visited.add(cycleKey);

        // Update arrival
        S.set(c.toStopId, c.arrivalTime);
        J.set(c.toStopId, {
            type: 'transit',
            connection: c,
            arrivalTime: c.arrivalTime,
        });

        // Apply transfers from this newly reached stop
        const transferList = transfers.get(c.toStopId);
        if (transferList) {
            for (const tr of transferList) {
                const newArrival = c.arrivalTime + tr.walkTime;
                const currentBestTransfer = S.get(tr.toStopId);
                if (currentBestTransfer === undefined || newArrival < currentBestTransfer) {
                    S.set(tr.toStopId, newArrival);
                    J.set(tr.toStopId, {
                        type: 'transfer',
                        fromStopId: c.toStopId,
                        walkTime: tr.walkTime,
                        arrivalTime: newArrival,
                    });
                }
            }
        }
    }

    // Find best target stops
    const targetArrivals = [];
    for (const targetId of targetStopIds) {
        const arr = S.get(targetId);
        if (arr !== undefined) {
            targetArrivals.push({ stopId: targetId, arrivalTime: arr });
        }
    }

    targetArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

    // Reconstruct journeys for best targets
    const journeys = [];
    const sourceStopIds = new Set(sources.map(s => s.stopId));

    for (const target of targetArrivals.slice(0, maxJourneys * 2)) {
        const journey = reconstructJourney(J, target.stopId, sourceStopIds);
        if (journey && journey.legs.length > 0) {
            // Filter out duplicate journeys with same legs
            const isDup = journeys.some(j =>
                j.legs.length === journey.legs.length &&
                Math.abs(j.arrivalTime - journey.arrivalTime) < 60
            );
            if (!isDup) {
                journeys.push(journey);
                if (journeys.length >= maxJourneys) break;
            }
        }
    }

    return journeys;
}

/**
 * Reconstruct a journey by following the predecessor chain.
 */
function reconstructJourney(J, targetStopId, sourceStopIds) {
    const rawLegs = [];
    let currentStopId = targetStopId;
    let maxIter = 50; // Safety limit

    while (maxIter-- > 0) {
        const entry = J.get(currentStopId);
        if (!entry) break;
        if (entry.type === 'origin') break;

        if (entry.type === 'transit') {
            rawLegs.unshift({
                mode: entry.connection.routeType === 'TRAM' ? 'tram' : 'transit',
                routeName: entry.connection.routeName,
                routeType: entry.connection.routeType,
                feedId: 'gtfs_0',  // CSA uses ZTM timetable only
                routeId: entry.connection.routeId,
                tripId: entry.connection.tripId,
                fromStopId: entry.connection.fromStopId,
                toStopId: entry.connection.toStopId,
                departureTime: entry.connection.departureTime,
                arrivalTime: entry.connection.arrivalTime,
            });
            currentStopId = entry.connection.fromStopId;
        } else if (entry.type === 'transfer') {
            rawLegs.unshift({
                mode: 'walk',
                fromStopId: entry.fromStopId,
                toStopId: currentStopId,
                walkTime: entry.walkTime,
                arrivalTime: entry.arrivalTime,
                departureTime: entry.arrivalTime - entry.walkTime,
            });
            currentStopId = entry.fromStopId;
        } else {
            break;
        }
    }

    if (rawLegs.length === 0) return null;

    // Merge consecutive transit legs on the same trip (stay on the vehicle)
    const merged = [];
    for (const leg of rawLegs) {
        const prev = merged[merged.length - 1];
        if (
            prev &&
            prev.mode !== 'walk' && leg.mode !== 'walk' &&
            prev.routeId === leg.routeId &&
            prev.tripId === leg.tripId &&
            prev.toStopId === leg.fromStopId
        ) {
            // Same trip — extend the previous leg
            prev.toStopId = leg.toStopId;
            prev.arrivalTime = leg.arrivalTime;
        } else {
            merged.push({ ...leg });
        }
    }

    // Remove very short walk legs (< 30 seconds, likely noise)
    const cleaned = merged.filter(leg =>
        leg.mode !== 'walk' || leg.walkTime > 30
    );

    if (cleaned.length === 0) return null;

    return {
        legs: cleaned,
        departureTime: cleaned[0].departureTime,
        arrivalTime: cleaned[cleaned.length - 1].arrivalTime,
        totalTime: cleaned[cleaned.length - 1].arrivalTime - cleaned[0].departureTime,
    };
}
