/**
 * Train station data provider.
 * Loads a static JSON snapshot of SKM and PolRegio stations in the Tricity area,
 * extracted from GTFS stops.txt feeds.
 */

let stations = null;

/**
 * Load train stations from the static JSON file.
 * @returns {Promise<Array<{ id: string, name: string, lat: number, lon: number, feed: string }>>}
 */
export async function loadTrainStations() {
    if (stations) return stations;

    const resp = await fetch('/train_stations.json');
    if (!resp.ok) throw new Error(`Failed to load train stations: ${resp.status}`);

    stations = await resp.json();
    console.log(`[Trains] Loaded ${stations.length} train stations`);
    return stations;
}

/**
 * Get all loaded train stations.
 */
export function getTrainStations() {
    return stations || [];
}
