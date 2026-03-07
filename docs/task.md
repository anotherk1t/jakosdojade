# Public Transit + City Bike Route Planner (Gdańsk)

## Phase 1: Project Setup & Data Layer
- [x] Research data sources (ZTM API, MEVO GBFS, Gdynia ZKM — no timetable API)
- [x] Snapshot MEVO station data (805 stations → `mevo_stations_snapshot.json`)
- [x] Set up Vite project structure + Docker
- [x] Implement ZTM data fetching + localStorage cache
- [x] Implement MEVO data provider (hardcoded snapshot, future-ready interface)

## Phase 2: Routing Engine
- [x] Geo utilities (haversine, findNearby, time estimates)
- [x] Build transit graph (spatial grid + transfer links)
- [x] CSA routing algorithm
- [x] OSRM client for walking/cycling geometries
- [x] Multimodal route generator (walk, bike, transit, hybrid)

## Phase 3: Map UI & Frontend
- [x] Leaflet map with CartoDB Dark Matter tiles
- [x] Stop/station map layers with zoom-based filtering
- [x] Search panel (Nominatim geocoding, map pick, time picker)
- [x] Route results panel with color-coded legs
- [x] Route polyline rendering on map

## Phase 4: Verification
- [x] Docker build and run
- [x] Browser-based visual verification
