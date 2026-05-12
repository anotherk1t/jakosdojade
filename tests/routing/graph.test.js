import { describe, expect, it } from 'vitest';
import { buildTransferLinks, findNearbyStops } from '../../src/routing/graph.js';

const BASE = { lat: 54.350, lon: 18.650 };

function stop(id, dLat, dLon) {
    return { id, lat: BASE.lat + dLat, lon: BASE.lon + dLon };
}

describe('buildTransferLinks', () => {
    it('links two stops within 500m', () => {
        // 0.002° lat ≈ 222m
        const stops = [stop(1, 0, 0), stop(2, 0.002, 0)];
        const t = buildTransferLinks(stops);
        expect(t.has(1)).toBe(true);
        expect(t.has(2)).toBe(true);
        const fwd = t.get(1);
        expect(fwd).toHaveLength(1);
        expect(fwd[0].toStopId).toBe(2);
        expect(fwd[0].distance).toBeGreaterThan(200);
        expect(fwd[0].distance).toBeLessThan(250);
        expect(fwd[0].walkTime).toBeGreaterThan(0);
    });

    it('does not create self-loops', () => {
        const stops = [stop(1, 0, 0), stop(2, 0.002, 0)];
        const t = buildTransferLinks(stops);
        for (const links of t.values()) {
            for (const link of links) {
                expect(link.toStopId).not.toBe(undefined);
            }
        }
        // stop 1 should not be in its own list
        const fwd = t.get(1);
        expect(fwd.map(l => l.toStopId)).not.toContain(1);
    });

    it('does not link stops beyond 500m', () => {
        // 0.01° lat ≈ 1110m
        const stops = [stop(1, 0, 0), stop(2, 0.01, 0)];
        const t = buildTransferLinks(stops);
        expect(t.has(1)).toBe(false);
        expect(t.has(2)).toBe(false);
    });

    it('links span neighbouring grid cells', () => {
        // Choose two stops that straddle the 0.005° cell boundary at 54.350
        // so the implementation has to check neighbouring grid cells.
        const stops = [
            { id: 1, lat: 54.3499, lon: 18.6500 },
            { id: 2, lat: 54.3510, lon: 18.6500 },
        ];
        const t = buildTransferLinks(stops);
        // ~122m apart, well within 500m
        expect(t.has(1)).toBe(true);
        expect(t.get(1)[0].toStopId).toBe(2);
    });
});

describe('findNearbyStops', () => {
    const stops = [
        stop(10, 0, 0),
        stop(11, 0.001, 0),    // ~111m
        stop(12, 0.005, 0),    // ~556m
        stop(13, 0.02, 0),     // ~2.2km, outside default 1000m
    ];

    it('returns stops within the default 1000m radius, sorted', () => {
        const result = findNearbyStops(BASE.lat, BASE.lon, stops);
        const ids = result.map(r => r.stop.id);
        expect(ids).toEqual([10, 11, 12]);
    });

    it('honors custom maxDistance', () => {
        const result = findNearbyStops(BASE.lat, BASE.lon, stops, 200);
        const ids = result.map(r => r.stop.id);
        expect(ids).toEqual([10, 11]);
    });

    it('attaches walkTime and distance to each result', () => {
        const result = findNearbyStops(BASE.lat, BASE.lon, stops);
        for (const r of result) {
            expect(typeof r.distance).toBe('number');
            expect(typeof r.walkTime).toBe('number');
            expect(r.walkTime).toBeGreaterThanOrEqual(0);
        }
    });
});
