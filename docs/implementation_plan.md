# Multimodal Transit + City Bike Route Planner (Gdańsk)

A web app for the **Gdańsk area** that plans multimodal routes combining **walking**, **public transit (ZTM buses/trams)**, and **city bikes (MEVO)**.

## Data Sources

| Source | Format | Data | Scale |
|--------|--------|------|-------|
| **ZTM Gdańsk** | REST API (`ckan2.multimediagdansk.pl`) | Stops, routes, trips, stopTimes | ~2,500 stops, 140 routes (BUS+TRAM) |
| **MEVO Bikes** | Static JSON snapshot (hardcoded) | Station locations, capacity | 805 stations (422 in Gdańsk area) |
| **OSM** | Leaflet tiles + OSRM demo API | Walking/cycling route geometries | On-demand |

> [!IMPORTANT]
> **Gdynia ZKM**: No timetable API available in their open data portal. ZTM Gdańsk API already includes ~28 Gdynia cross-border stops, so those routes will still work. ZKM can be added in a future version if they publish an API.

> [!IMPORTANT]
> **MEVO approach**: Station data is fetched once and saved as `mevo_stations_snapshot.json` (108KB, without polygon geometries). The code is designed with a `MevoDataProvider` interface so we can swap in real-time GBFS fetching later.

## Proposed Changes

### Project Setup

#### [NEW] [package.json](file:///home/yan/Documents/bikerouter/package.json)
Vite project with vanilla JS. Dependency: `leaflet`.

#### [NEW] [vite.config.js](file:///home/yan/Documents/bikerouter/vite.config.js)
Vite config with dev server proxy for ZTM API (CORS).

---

### Data Layer (`src/data/`)

#### [NEW] [ztm.js](file:///home/yan/Documents/bikerouter/src/data/ztm.js)
Fetches ZTM stops, routes, trips, and stopTimes from `ckan2.multimediagdansk.pl`. Orchestrates parallel fetching of all routes' timetables.

#### [NEW] [mevo.js](file:///home/yan/Documents/bikerouter/src/data/mevo.js)
`MevoDataProvider` that loads hardcoded station snapshot. Interface designed for future swap to real-time GBFS fetching. Exports `getStations()`, `getStationsNear(lat, lon, radiusM)`.

#### [NEW] [cache.js](file:///home/yan/Documents/bikerouter/src/data/cache.js)
localStorage cache for ZTM timetable data (keyed by date).

---

### Routing Engine (`src/routing/`)

#### [NEW] [graph.js](file:///home/yan/Documents/bikerouter/src/routing/graph.js)
Builds sorted connections list from timetable data + walking transfer links between nearby stops.

#### [NEW] [csa.js](file:///home/yan/Documents/bikerouter/src/routing/csa.js)
Connection Scan Algorithm: finds earliest-arrival transit journeys with transfers.

#### [NEW] [multimodal.js](file:///home/yan/Documents/bikerouter/src/routing/multimodal.js)
Generates route alternatives: pure transit, pure bike, transit+bike hybrids. Ranks by total time, returns top 3.

#### [NEW] [osrm.js](file:///home/yan/Documents/bikerouter/src/routing/osrm.js)
OSRM API client for walking/cycling route geometries and durations.

#### [NEW] [geo.js](file:///home/yan/Documents/bikerouter/src/routing/geo.js)
Haversine distance, `findNearby()`, walk/bike time estimates.

---

### UI (`src/ui/`)

#### [NEW] [map.js](file:///home/yan/Documents/bikerouter/src/ui/map.js)
Leaflet map centered on Gdańsk, OSM tiles, layer groups, click-to-set origin/destination.

#### [NEW] [search.js](file:///home/yan/Documents/bikerouter/src/ui/search.js)
Search panel: origin/dest inputs with Nominatim geocoding, time picker, search button.

#### [NEW] [results.js](file:///home/yan/Documents/bikerouter/src/ui/results.js)
Route result cards with color-coded legs (walk/transit/bike), click to highlight on map.

#### [NEW] [layers.js](file:///home/yan/Documents/bikerouter/src/ui/layers.js)
Map layer toggles for stops/stations, custom markers, route polyline rendering.

---

### Entry Points

#### [NEW] [index.html](file:///home/yan/Documents/bikerouter/index.html)
Map + floating sidebar layout.

#### [NEW] [src/main.js](file:///home/yan/Documents/bikerouter/src/main.js)
App initialization: map, data loading, search→routing→results wiring.

#### [NEW] [src/style.css](file:///home/yan/Documents/bikerouter/src/style.css)
Dark glassmorphism theme, responsive sidebar, color-coded route legs.

## Verification Plan

1. Verify map loads with OSM tiles centered on Gdańsk
2. Verify ZTM stops and MEVO stations display on map
3. Click origin/destination, search routes, verify results panel shows alternatives
4. Verify route polylines render with correct color coding
5. Compare a real journey (e.g. Gdańsk Główny → Oliwa) against Jakdojade for sanity
