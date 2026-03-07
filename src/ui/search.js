/**
 * Search panel: geocoding, map-pick, and route search orchestration.
 */

let originCoords = null;
let destCoords = null;
let pickMode = null; // 'origin' | 'destination' | null
let geocodeTimeout = null;
let onSearchCallback = null;

/**
 * Initialize search panel event listeners.
 * @param {function} onSearch - Called with { origin, destination, departureTimeSec }
 * @param {function} onMapClick - Registers map click handler
 * @param {function} setOriginMarker
 * @param {function} setDestMarker
 */
export function initSearch({ onSearch, onMapClick, setOriginMarker, setDestMarker }) {
    onSearchCallback = onSearch;

    const originInput = document.getElementById('origin-input');
    const destInput = document.getElementById('dest-input');
    const originMapBtn = document.getElementById('origin-map-btn');
    const destMapBtn = document.getElementById('dest-map-btn');
    const swapBtn = document.getElementById('swap-btn');
    const searchBtn = document.getElementById('search-btn');
    const timeInput = document.getElementById('time-input');
    const timeNowBtn = document.getElementById('time-now-btn');

    // Set default time to now
    setTimeToNow(timeInput);
    timeNowBtn.addEventListener('click', () => setTimeToNow(timeInput));

    // Geocoding on input
    originInput.addEventListener('input', () => {
        clearTimeout(geocodeTimeout);
        geocodeTimeout = setTimeout(() => geocodeInput(originInput, 'origin-group', (lat, lon, name) => {
            originCoords = { lat, lon };
            originInput.value = name;
            setOriginMarker(lat, lon);
        }), 500);
    });

    destInput.addEventListener('input', () => {
        clearTimeout(geocodeTimeout);
        geocodeTimeout = setTimeout(() => geocodeInput(destInput, 'dest-group', (lat, lon, name) => {
            destCoords = { lat, lon };
            destInput.value = name;
            setDestMarker(lat, lon);
        }), 500);
    });

    // Map pick buttons
    originMapBtn.addEventListener('click', () => {
        pickMode = pickMode === 'origin' ? null : 'origin';
        originMapBtn.classList.toggle('active', pickMode === 'origin');
        destMapBtn.classList.remove('active');
        document.getElementById('map').style.cursor = pickMode ? 'crosshair' : '';
    });

    destMapBtn.addEventListener('click', () => {
        pickMode = pickMode === 'destination' ? null : 'destination';
        destMapBtn.classList.toggle('active', pickMode === 'destination');
        originMapBtn.classList.remove('active');
        document.getElementById('map').style.cursor = pickMode ? 'crosshair' : '';
    });

    // Map click handler
    onMapClick((lat, lon) => {
        if (pickMode === 'origin') {
            originCoords = { lat, lon };
            originInput.value = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            setOriginMarker(lat, lon);
            originMapBtn.classList.remove('active');

            // Reverse geocode
            reverseGeocode(lat, lon).then(name => {
                if (name) originInput.value = name;
            });

            pickMode = null;
            document.getElementById('map').style.cursor = '';
        } else if (pickMode === 'destination') {
            destCoords = { lat, lon };
            destInput.value = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            setDestMarker(lat, lon);
            destMapBtn.classList.remove('active');

            reverseGeocode(lat, lon).then(name => {
                if (name) destInput.value = name;
            });

            pickMode = null;
            document.getElementById('map').style.cursor = '';
        }
    });

    // Swap
    swapBtn.addEventListener('click', () => {
        const tempCoords = originCoords;
        originCoords = destCoords;
        destCoords = tempCoords;

        const tempVal = originInput.value;
        originInput.value = destInput.value;
        destInput.value = tempVal;

        if (originCoords) setOriginMarker(originCoords.lat, originCoords.lon);
        if (destCoords) setDestMarker(destCoords.lat, destCoords.lon);
    });

    // Search
    searchBtn.addEventListener('click', () => {
        if (!originCoords || !destCoords) {
            showError('Please set both origin and destination');
            return;
        }

        const timeParts = timeInput.value.split(':');
        const departureTimeSec = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60;

        onSearchCallback({
            origin: originCoords,
            destination: destCoords,
            departureTimeSec,
        });
    });
}

function setTimeToNow(input) {
    const now = new Date();
    input.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Geocode an input value using Nominatim.
 */
async function geocodeInput(input, groupId, onSelect) {
    const query = input.value.trim();
    if (query.length < 3) {
        removeSuggestions(groupId);
        return;
    }

    try {
        const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=18.4,54.45,18.85,54.28&bounded=1&limit=5`,
            { headers: { 'Accept-Language': 'pl,en' } }
        );
        const results = await resp.json();

        if (results.length === 0) {
            removeSuggestions(groupId);
            return;
        }

        showSuggestions(groupId, results, (result) => {
            onSelect(parseFloat(result.lat), parseFloat(result.lon), result.display_name.split(',')[0]);
            removeSuggestions(groupId);
        });
    } catch (e) {
        console.warn('[Geocode] Error:', e);
    }
}

/**
 * Reverse geocode coordinates to a place name.
 */
async function reverseGeocode(lat, lon) {
    try {
        const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'Accept-Language': 'pl,en' } }
        );
        const data = await resp.json();
        if (data.display_name) {
            const parts = data.display_name.split(',');
            return parts.slice(0, 2).join(',').trim();
        }
    } catch {
        // silent
    }
    return null;
}

function showSuggestions(groupId, results, onSelect) {
    removeSuggestions(groupId);
    const group = document.getElementById(groupId);
    const dropdown = document.createElement('div');
    dropdown.className = 'suggestions-dropdown';

    for (const result of results) {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = result.display_name;
        item.addEventListener('click', () => onSelect(result));
        dropdown.appendChild(item);
    }

    group.style.position = 'relative';
    group.appendChild(dropdown);

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!group.contains(e.target)) {
                removeSuggestions(groupId);
                document.removeEventListener('click', handler);
            }
        });
    }, 10);
}

function removeSuggestions(groupId) {
    const group = document.getElementById(groupId);
    const existing = group?.querySelector('.suggestions-dropdown');
    if (existing) existing.remove();
}

function showError(message) {
    // Remove existing
    const existing = document.querySelector('.error-msg');
    if (existing) existing.remove();

    const panel = document.getElementById('search-panel');
    const el = document.createElement('div');
    el.className = 'error-msg';
    el.textContent = message;
    panel.appendChild(el);

    setTimeout(() => el.remove(), 3000);
}

/**
 * Set search loading state.
 */
export function setSearchLoading(loading) {
    const btn = document.getElementById('search-btn');
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');

    btn.disabled = loading;
    text.hidden = loading;
    loader.hidden = !loading;
}
