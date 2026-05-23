import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../setup.js';

const SHAPES = {
    shape_A: [
        [54.350, 18.650],
        [54.351, 18.651],
        [54.352, 18.652],
        [54.353, 18.653],
        [54.354, 18.654],
    ],
};
const ROUTE_SHAPES = {
    gtfs_0: {
        R1: ['shape_A'],
    },
};

let shapes;

beforeEach(async () => {
    vi.resetModules();
    shapes = await import('../../src/data/shapes.js');
});

describe('shapes', () => {
    it('loadShapes lazy-loads on first call; second call reuses the same promise', async () => {
        const fetchMock = vi.fn(async (url) => {
            if (url.includes('shapes.json') && !url.includes('route_shapes')) {
                return jsonResponse(SHAPES);
            }
            if (url.includes('route_shapes.json')) {
                return jsonResponse(ROUTE_SHAPES);
            }
            throw new Error('unexpected url ' + url);
        });
        vi.stubGlobal('fetch', fetchMock);

        expect(shapes.shapesLoaded()).toBe(false);
        const p1 = shapes.loadShapes();
        const p2 = shapes.loadShapes();
        expect(p1).toBe(p2);
        await p1;
        expect(shapes.shapesLoaded()).toBe(true);
        // Two fetches total — one for each JSON file — not four
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('getShapeForLeg returns null before shapes are loaded', () => {
        const result = shapes.getShapeForLeg('gtfs_0', 'R1',
            { lat: 54.350, lon: 18.650 }, { lat: 54.354, lon: 18.654 });
        expect(result).toBeNull();
    });

    it('getShapeForLeg clips the shape between boarding and alighting stops', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) =>
            url.includes('route_shapes.json') ? jsonResponse(ROUTE_SHAPES) : jsonResponse(SHAPES)));
        await shapes.loadShapes();

        const clipped = shapes.getShapeForLeg('gtfs_0', 'R1',
            { lat: 54.351, lon: 18.651 },     // matches index 1
            { lat: 54.353, lon: 18.653 });    // matches index 3

        expect(clipped).not.toBeNull();
        expect(clipped.length).toBe(3); // indices 1..3
        // First and last points are replaced with the exact stop coords
        expect(clipped[0]).toEqual([54.351, 18.651]);
        expect(clipped[clipped.length - 1]).toEqual([54.353, 18.653]);
    });

    it('getShapeForLeg returns null when route has no shapes', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) =>
            url.includes('route_shapes.json') ? jsonResponse(ROUTE_SHAPES) : jsonResponse(SHAPES)));
        await shapes.loadShapes();

        const result = shapes.getShapeForLeg('gtfs_0', 'UNKNOWN_ROUTE',
            { lat: 54.351, lon: 18.651 }, { lat: 54.353, lon: 18.653 });
        expect(result).toBeNull();
    });

    it('getShapeForLeg returns null when feedId is unknown', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) =>
            url.includes('route_shapes.json') ? jsonResponse(ROUTE_SHAPES) : jsonResponse(SHAPES)));
        await shapes.loadShapes();

        const result = shapes.getShapeForLeg('gtfs_99', 'R1',
            { lat: 54.351, lon: 18.651 }, { lat: 54.353, lon: 18.653 });
        expect(result).toBeNull();
    });
});
