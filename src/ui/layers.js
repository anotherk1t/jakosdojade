/**
 * Map layer management for transit stops and MEVO stations.
 */

let stopLayerGroup = null;
let bikeLayerGroup = null;
let trainLayerGroup = null;
let vehicleLayerGroup = null;
let lastVehicleData = null;
let map = null;

/**
 * Initialize layers on the map.
 */
export function initLayers(leafletMap) {
    map = leafletMap;
    stopLayerGroup = L.layerGroup().addTo(map);
    bikeLayerGroup = L.layerGroup().addTo(map);
    trainLayerGroup = L.layerGroup().addTo(map);
    vehicleLayerGroup = L.layerGroup(); // not added to map by default (disabled)

    // Re-render vehicles on zoom/pan so marker size updates
    map.on('moveend', () => {
        if (lastVehicleData && map.hasLayer(vehicleLayerGroup)) {
            renderVehicleMarkers(lastVehicleData);
        }
    });
}

/**
 * Display transit stops on the map.
 * Uses clustering-like approach: only show markers at zoom >= 15 for performance.
 */
export function displayStops(stops) {
    const updateStops = () => {
        stopLayerGroup.clearLayers();
        const zoom = map.getZoom();
        if (zoom < 15) return; // Too many markers at low zoom

        const bounds = map.getBounds();
        const visibleStops = stops.filter(s =>
            bounds.contains([s.lat, s.lon])
        );

        // Limit displayed markers for performance
        const maxMarkers = 200;
        const toShow = visibleStops.slice(0, maxMarkers);

        for (const stop of toShow) {
            const isTram = stop.type === 'TRAM' || stop.type === 'BUS_TRAM';
            const icon = L.divIcon({
                className: `leaflet-marker-icon stop-marker${isTram ? ' tram' : ''}`,
                html: isTram ? '🚊' : '',
                iconSize: [20, 20],
            });

            const marker = L.marker([stop.lat, stop.lon], { icon })
                .bindTooltip(`${stop.name} (${stop.type})`, {
                    direction: 'top',
                    offset: [0, -12],
                });

            stopLayerGroup.addLayer(marker);
        }
    };

    map.on('moveend', updateStops);
    map.on('zoomend', updateStops);
    updateStops();
}

/**
 * Display MEVO bike stations on the map.
 * Similar zoom-based filtering.
 */
export function displayBikeStations(stations) {
    const updateStations = () => {
        bikeLayerGroup.clearLayers();
        const zoom = map.getZoom();
        if (zoom < 14) return;

        const bounds = map.getBounds();
        const visible = stations.filter(s =>
            bounds.contains([s.lat, s.lon])
        );

        const maxMarkers = 300;
        const toShow = visible.slice(0, maxMarkers);

        for (const station of toShow) {
            const icon = L.divIcon({
                className: 'leaflet-marker-icon bike-marker',
                html: '🚲',
                iconSize: [22, 22],
            });

            const marker = L.marker([station.lat, station.lon], { icon })
                .bindTooltip(`${station.name}<br>${station.address}<br>Capacity: ${station.capacity}`, {
                    direction: 'top',
                    offset: [0, -14],
                });

            bikeLayerGroup.addLayer(marker);
        }
    };

    map.on('moveend', updateStations);
    map.on('zoomend', updateStations);
    updateStations();
}

/**
 * Toggle stop layer visibility.
 */
export function toggleStops(visible) {
    if (visible) {
        if (!map.hasLayer(stopLayerGroup)) map.addLayer(stopLayerGroup);
    } else {
        map.removeLayer(stopLayerGroup);
    }
}

/**
 * Toggle bike station layer visibility.
 */
export function toggleBikeStations(visible) {
    if (visible) {
        if (!map.hasLayer(bikeLayerGroup)) map.addLayer(bikeLayerGroup);
    } else {
        map.removeLayer(bikeLayerGroup);
    }
}

/**
 * Display train stations on the map.
 * Shown at zoom >= 12 since train stations are sparser and more important.
 */
export function displayTrainStations(stations) {
    const updateStations = () => {
        trainLayerGroup.clearLayers();
        const zoom = map.getZoom();
        if (zoom < 12) return;

        const bounds = map.getBounds();
        const visible = stations.filter(s =>
            bounds.contains([s.lat, s.lon])
        );

        for (const station of visible) {
            const operators = station.operators || [];
            const markerClass = operators.length > 1 ? 'shared'
                : operators[0] === 'PKM' ? 'pkm'
                : operators[0] === 'PolRegio' ? 'polregio'
                : 'skm';

            const icon = L.divIcon({
                className: `leaflet-marker-icon train-marker train-${markerClass}`,
                html: '🚆',
                iconSize: [26, 26],
            });

            const operatorLabel = operators.join(' / ');
            const colorMap = { SKM: '#ef4444', PKM: '#f59e0b', PolRegio: '#dc2626' };
            const badges = operators.map(op =>
                `<span style="color:${colorMap[op] || '#94a3b8'};font-weight:600">${op}</span>`
            ).join(' · ');

            const marker = L.marker([station.lat, station.lon], { icon })
                .bindTooltip(`${station.name}<br>${badges}`, {
                    direction: 'top',
                    offset: [0, -14],
                });

            trainLayerGroup.addLayer(marker);
        }
    };

    map.on('moveend', updateStations);
    map.on('zoomend', updateStations);
    updateStations();
}

/**
 * Toggle train station layer visibility.
 */
export function toggleTrainStations(visible) {
    if (visible) {
        if (!map.hasLayer(trainLayerGroup)) map.addLayer(trainLayerGroup);
    } else {
        map.removeLayer(trainLayerGroup);
    }
}

/**
 * Update live vehicle markers on the map.
 * @param {Array} vehicles – array of { lat, lon, line, headsign, delay, speed, isTram, direction }
 */
export function updateVehicles(vehicles) {
    lastVehicleData = vehicles;
    renderVehicleMarkers(vehicles);
}

function renderVehicleMarkers(vehicles) {
    vehicleLayerGroup.clearLayers();

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < 12) return; // too many at low zoom

    for (const v of vehicles) {
        if (!bounds.contains([v.lat, v.lon])) continue;

        const color = v.isTram ? '#a855f7' : '#f97316';
        const emoji = v.isTram ? '🚊' : '🚌';

        // Delay badge text
        let delayText = '';
        if (v.delay !== null) {
            const mins = Math.round(v.delay / 60);
            if (mins > 0) delayText = `+${mins} min late`;
            else if (mins < 0) delayText = `${mins} min early`;
            else delayText = 'on time';
        }

        const icon = L.divIcon({
            className: 'leaflet-marker-icon vehicle-marker' + (v.isTram ? ' vehicle-tram' : ' vehicle-bus'),
            html: `<span class="vehicle-dot" style="background:${color}">${zoom >= 14 ? v.line : ''}</span>`,
            iconSize: zoom >= 14 ? [28, 28] : [14, 14],
            iconAnchor: zoom >= 14 ? [14, 14] : [7, 7],
        });

        const tip = [
            `${emoji} <b>${v.line}</b> → ${v.headsign}`,
            delayText ? `Delay: ${delayText}` : '',
            `Speed: ${v.speed} km/h`,
            `Vehicle: ${v.vehicleCode}`,
        ].filter(Boolean).join('<br>');

        const marker = L.marker([v.lat, v.lon], { icon, zIndexOffset: -100 })
            .bindTooltip(tip, { direction: 'top', offset: [0, -10] });

        vehicleLayerGroup.addLayer(marker);
    }
}

/**
 * Toggle live vehicle layer visibility.
 */
export function toggleVehicles(visible) {
    if (visible) {
        if (!map.hasLayer(vehicleLayerGroup)) map.addLayer(vehicleLayerGroup);
    } else {
        map.removeLayer(vehicleLayerGroup);
        vehicleLayerGroup.clearLayers();
        lastVehicleData = null;
    }
}
