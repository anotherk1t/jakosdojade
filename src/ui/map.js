/**
 * Leaflet map initialization and management.
 */

const GDANSK_CENTER = [54.352, 18.647];
const DEFAULT_ZOOM = 13;

let map = null;
let originMarker = null;
let destMarker = null;
let routeLayerGroup = null;

/**
 * Initialize the Leaflet map.
 * @returns {L.Map}
 */
export function initMap() {
    map = L.map('map', {
        center: GDANSK_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: true,
    });

    // OSM tile layer — same source used by GraphHopper's web interface
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    // Zoom control - top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Route layer group
    routeLayerGroup = L.layerGroup().addTo(map);

    return map;
}

/**
 * Get the map instance.
 */
export function getMap() {
    return map;
}

/**
 * Set origin marker on the map.
 */
export function setOriginMarker(lat, lon) {
    if (originMarker) {
        originMarker.setLatLng([lat, lon]);
    } else {
        const icon = L.divIcon({
            className: 'leaflet-marker-icon origin-marker',
            html: '🅰',
            iconSize: [32, 32],
        });
        originMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
    }
}

/**
 * Set destination marker on the map.
 */
export function setDestMarker(lat, lon) {
    if (destMarker) {
        destMarker.setLatLng([lat, lon]);
    } else {
        const icon = L.divIcon({
            className: 'leaflet-marker-icon dest-marker',
            html: '🅱',
            iconSize: [32, 32],
        });
        destMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
    }
}

/**
 * Clear route lines from the map.
 */
export function clearRouteLines() {
    if (routeLayerGroup) routeLayerGroup.clearLayers();
}

/**
 * Draw a route on the map with color-coded segments.
 * @param {Array} legs - Route legs with mode and geometry/coordinates.
 */
export function drawRoute(legs) {
    clearRouteLines();

    const modeColors = {
        walk: '#60a5fa',
        transit: '#f97316',
        tram: '#a855f7',
        skm: '#ef4444',
        pkm: '#f59e0b',
        polregio: '#dc2626',
        bike: '#22c55e',
    };

    const allPoints = [];

    for (const leg of legs) {
        const color = modeColors[leg.mode] || '#888';
        const points = leg.geometry || (
            leg.from && leg.to
                ? [[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]]
                : []
        );

        if (points.length < 2) continue;
        allPoints.push(...points);

        const line = L.polyline(points, {
            color,
            weight: leg.mode === 'walk' ? 4 : 5,
            opacity: 0.85,
            dashArray: leg.mode === 'walk' ? '8, 8' : null,
            lineCap: 'round',
            lineJoin: 'round',
        });

        routeLayerGroup.addLayer(line);

        // Add stop markers for transit legs
        if (['transit','tram','skm','pkm','polregio'].includes(leg.mode)) {
            if (leg.from) {
                const circle = L.circleMarker([leg.from.lat, leg.from.lon], {
                    radius: 5,
                    color: '#fff',
                    fillColor: color,
                    fillOpacity: 1,
                    weight: 2,
                }).bindTooltip(leg.from.name || '', { direction: 'top', offset: [0, -8] });
                routeLayerGroup.addLayer(circle);
            }
            if (leg.to) {
                const circle = L.circleMarker([leg.to.lat, leg.to.lon], {
                    radius: 5,
                    color: '#fff',
                    fillColor: color,
                    fillOpacity: 1,
                    weight: 2,
                }).bindTooltip(leg.to.name || '', { direction: 'top', offset: [0, -8] });
                routeLayerGroup.addLayer(circle);
            }
        }
    }

    // Fit map to route bounds
    if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
}

/**
 * Register a click handler for map clicks.
 */
export function onMapClick(callback) {
    if (map) {
        map.on('click', (e) => callback(e.latlng.lat, e.latlng.lng));
    }
}
