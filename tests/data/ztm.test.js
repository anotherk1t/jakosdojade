import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '../setup.js';
import { fetchStops, fetchRoutes, fetchTimetable } from '../../src/data/ztm.js';

const DATE = '2026-05-12';

describe('fetchStops', () => {
    it('filters out nonpassenger, depot, and missing-coord stops; remaps shape', async () => {
        mockFetch(jsonResponse({
            stops: [
                { stopId: 1, stopCode: 'A1', stopName: 'Hello', stopDesc: 'desc',
                  stopLat: 54.35, stopLon: 18.65, type: 'BUS', zoneName: 'Z1' },
                { stopId: 2, stopCode: '', stopName: 'Drop', stopLat: 0, stopLon: 0 }, // missing coords
                { stopId: 3, stopName: 'Depot', stopLat: 54.35, stopLon: 18.65, depot: true },
                { stopId: 4, stopName: 'Internal', stopLat: 54.35, stopLon: 18.65, nonpassenger: true },
            ],
        }));

        const stops = await fetchStops(DATE);
        expect(stops).toHaveLength(1);
        expect(stops[0]).toEqual({
            id: 1,
            code: 'A1',
            name: 'Hello A1',
            desc: 'desc',
            lat: 54.35,
            lon: 18.65,
            type: 'BUS',
            zone: 'Z1',
        });
    });

    it('uses raw stopName when stopCode is missing', async () => {
        mockFetch(jsonResponse({
            stops: [
                { stopId: 7, stopName: 'PlainName', stopLat: 54.35, stopLon: 18.65 },
            ],
        }));
        const stops = await fetchStops(DATE);
        expect(stops[0].name).toBe('PlainName');
        expect(stops[0].type).toBe('BUS'); // default when missing
    });

    it('caches stops so a second call does not refetch', async () => {
        const fetchMock = mockFetch(jsonResponse({
            stops: [{ stopId: 1, stopName: 'A', stopLat: 1, stopLon: 1 }],
        }));
        await fetchStops('cache-date-1');
        await fetchStops('cache-date-1');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws on HTTP error with status and URL', async () => {
        mockFetch(jsonResponse({}, { ok: false, status: 503 }));
        await expect(fetchStops('error-date')).rejects.toThrow(/503/);
    });
});

describe('fetchRoutes', () => {
    it('maps routes to {id, shortName, longName, type}', async () => {
        mockFetch(jsonResponse({
            routes: [
                { routeId: 1, routeShortName: '8', routeLongName: 'Stogi', routeType: 'TRAM' },
                { routeId: 2, routeShortName: 'N9', routeLongName: 'Night to Przegalina' },
            ],
        }));
        const routes = await fetchRoutes('routes-date');
        expect(routes).toEqual([
            { id: 1, shortName: '8', longName: 'Stogi', type: 'TRAM' },
            { id: 2, shortName: 'N9', longName: 'Night to Przegalina', type: 'BUS' },
        ]);
    });
});

describe('fetchTimetable', () => {
    function setupResponses() {
        const stops = [
            { stopId: 1, stopName: 'A', stopLat: 54.350, stopLon: 18.650 },
            { stopId: 2, stopName: 'B', stopLat: 54.355, stopLon: 18.655 },
            { stopId: 3, stopName: 'C', stopLat: 54.360, stopLon: 18.660 },
        ];
        const routes = [
            { routeId: 100, routeShortName: '8', routeLongName: 'Line 8', routeType: 'TRAM' },
        ];
        // Two passenger stops + a virtual one + a zero-duration self-loop the cleaner should drop.
        const stopTimes = [
            { tripId: 'T1', order: 0, busServiceName: 'svc1', stopId: 1, stopSequence: 1,
              departureTime: '1899-12-30T08:00:00', arrivalTime: '1899-12-30T08:00:00',
              passenger: true },
            { tripId: 'T1', order: 0, busServiceName: 'svc1', stopId: 2, stopSequence: 2,
              departureTime: '1899-12-30T08:05:00', arrivalTime: '1899-12-30T08:05:00',
              passenger: true },
            { tripId: 'T1', order: 0, busServiceName: 'svc1', stopId: 3, stopSequence: 3,
              departureTime: '1899-12-30T08:10:00', arrivalTime: '1899-12-30T08:10:00',
              passenger: true },
            // virtual stop — should be skipped
            { tripId: 'T1', order: 0, busServiceName: 'svc1', stopId: 99, stopSequence: 4,
              departureTime: '1899-12-30T08:11:00', arrivalTime: '1899-12-30T08:11:00',
              passenger: true, virtual: true },
            // non-passenger and missing passenger flag — should be skipped
            { tripId: 'T1', order: 0, busServiceName: 'svc1', stopId: 4, stopSequence: 5,
              departureTime: '1899-12-30T08:12:00', arrivalTime: '1899-12-30T08:12:00',
              nonpassenger: true },
        ];
        return { stops, routes, stopTimes };
    }

    it('builds connections sorted by departureTime and skips non-passenger/virtual rows', async () => {
        const { stops, routes, stopTimes } = setupResponses();
        const fetchMock = vi.fn(async (url) => {
            if (url.includes('/stops')) return jsonResponse({ stops });
            if (url.includes('/routes')) return jsonResponse({ routes });
            if (url.includes('/stopTimes')) return jsonResponse({ stopTimes });
            throw new Error(`unexpected url ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const tt = await fetchTimetable('tt-date-1');

        expect(tt.stops).toHaveLength(3);
        expect(tt.routes).toHaveLength(1);
        // 3 passenger stops in sequence → 2 connections (1→2, 2→3), virtual/nonpassenger ignored
        expect(tt.connections).toHaveLength(2);

        // Sorted by departureTime
        const deps = tt.connections.map(c => c.departureTime);
        expect(deps).toEqual([...deps].sort((a, b) => a - b));

        // Each connection wears the route metadata and a tripKey of "tripId_order_busServiceName"
        expect(tt.connections[0]).toMatchObject({
            routeId: 100,
            routeName: '8',
            routeType: 'TRAM',
            tripId: 'T1_0_svc1',
            fromStopId: 1,
            toStopId: 2,
        });

        // stopMap/routeMap are wired
        expect(tt.stopMap.get(1).name).toBe('A');
        expect(tt.routeMap.get(100).shortName).toBe('8');
    });

    it('drops zero-duration same-stop connections', async () => {
        const { stops, routes } = setupResponses();
        // Two consecutive entries with same stopId and identical time → should be filtered
        const stopTimes = [
            { tripId: 'T2', order: 0, busServiceName: 'svc1', stopId: 1, stopSequence: 1,
              departureTime: '1899-12-30T08:00:00', arrivalTime: '1899-12-30T08:00:00',
              passenger: true },
            { tripId: 'T2', order: 0, busServiceName: 'svc1', stopId: 1, stopSequence: 2,
              departureTime: '1899-12-30T08:00:00', arrivalTime: '1899-12-30T08:00:00',
              passenger: true },
            { tripId: 'T2', order: 0, busServiceName: 'svc1', stopId: 2, stopSequence: 3,
              departureTime: '1899-12-30T08:05:00', arrivalTime: '1899-12-30T08:05:00',
              passenger: true },
        ];
        const fetchMock = vi.fn(async (url) => {
            if (url.includes('/stops')) return jsonResponse({ stops });
            if (url.includes('/routes')) return jsonResponse({ routes });
            if (url.includes('/stopTimes')) return jsonResponse({ stopTimes });
            throw new Error(`unexpected url ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const tt = await fetchTimetable('tt-date-2');
        // 1→1 self-loop is dropped; 1→2 (the second one) survives
        expect(tt.connections).toHaveLength(1);
        expect(tt.connections[0].fromStopId).toBe(1);
        expect(tt.connections[0].toStopId).toBe(2);
    });

    it('drops connections where arrival is before departure', async () => {
        const { stops, routes } = setupResponses();
        const stopTimes = [
            { tripId: 'T3', order: 0, busServiceName: 'svc1', stopId: 1, stopSequence: 1,
              departureTime: '1899-12-30T08:10:00', arrivalTime: '1899-12-30T08:10:00',
              passenger: true },
            { tripId: 'T3', order: 0, busServiceName: 'svc1', stopId: 2, stopSequence: 2,
              departureTime: '1899-12-30T08:00:00', arrivalTime: '1899-12-30T08:00:00',
              passenger: true },
        ];
        const fetchMock = vi.fn(async (url) => {
            if (url.includes('/stops')) return jsonResponse({ stops });
            if (url.includes('/routes')) return jsonResponse({ routes });
            if (url.includes('/stopTimes')) return jsonResponse({ stopTimes });
            throw new Error(`unexpected url ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const tt = await fetchTimetable('tt-date-3');
        expect(tt.connections).toHaveLength(0);
    });
});
