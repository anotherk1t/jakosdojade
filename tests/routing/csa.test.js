import { describe, expect, it } from 'vitest';
import { runCSA } from '../../src/routing/csa.js';

function conn({ from, to, dep, arr, route = 'R1', trip = 'T1', type = 'BUS' }) {
    return {
        routeId: route,
        routeName: route,
        routeType: type,
        tripId: trip,
        fromStopId: from,
        toStopId: to,
        departureTime: dep,
        arrivalTime: arr,
    };
}

const T = 8 * 3600; // 08:00 base

describe('runCSA', () => {
    it('finds a single-leg journey', () => {
        const connections = [
            conn({ from: 1, to: 2, dep: T + 60, arr: T + 600 }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([2]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result).toHaveLength(1);
        expect(result[0].legs).toHaveLength(1);
        expect(result[0].legs[0].mode).toBe('transit');
        expect(result[0].legs[0].fromStopId).toBe(1);
        expect(result[0].legs[0].toStopId).toBe(2);
        expect(result[0].arrivalTime).toBe(T + 600);
    });

    it('returns empty when destination is unreachable', () => {
        const connections = [
            conn({ from: 1, to: 2, dep: T + 60, arr: T + 600 }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([99]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result).toEqual([]);
    });

    it('prefers the earliest-arrival connection when multiple are available', () => {
        const connections = [
            conn({ from: 1, to: 2, dep: T + 60,  arr: T + 1200, trip: 'slow' }),
            conn({ from: 1, to: 2, dep: T + 120, arr: T + 600,  trip: 'fast' }),
        ].sort((a, b) => a.departureTime - b.departureTime);
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([2]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result).toHaveLength(1);
        expect(result[0].arrivalTime).toBe(T + 600);
        expect(result[0].legs[0].tripId).toBe('fast');
    });

    it('skips connections that depart before we can reach the boarding stop', () => {
        // Source isn't at stop 1 until T+700, so the T+60 connection is missed.
        const connections = [
            conn({ from: 1, to: 2, dep: T + 60,   arr: T + 600,  trip: 'missed' }),
            conn({ from: 1, to: 2, dep: T + 1000, arr: T + 1500, trip: 'caught' }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T + 700 }],
            targetStopIds: new Set([2]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result).toHaveLength(1);
        expect(result[0].legs[0].tripId).toBe('caught');
    });

    it('uses transfers from the source stop to a different boarding stop', () => {
        const transfers = new Map([
            [1, [{ toStopId: 10, walkTime: 120, distance: 150 }]],
        ]);
        const connections = [
            conn({ from: 10, to: 20, dep: T + 300, arr: T + 900 }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([20]),
            transfers,
            minDepartureTime: T,
        });
        expect(result).toHaveLength(1);
        const legs = result[0].legs;
        expect(legs[0].mode).toBe('walk');
        expect(legs[0].fromStopId).toBe(1);
        expect(legs[0].toStopId).toBe(10);
        expect(legs[1].mode).toBe('transit');
        expect(legs[1].fromStopId).toBe(10);
        expect(legs[1].toStopId).toBe(20);
    });

    it('does not consider connections outside the 6-hour scan window', () => {
        const connections = [
            conn({ from: 1, to: 2, dep: T + 7 * 3600, arr: T + 7 * 3600 + 600 }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([2]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result).toEqual([]);
    });

    it('merges consecutive segments on the same trip into one leg', () => {
        const connections = [
            conn({ from: 1, to: 2, dep: T + 60,  arr: T + 300, trip: 'T1' }),
            conn({ from: 2, to: 3, dep: T + 360, arr: T + 600, trip: 'T1' }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([3]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result).toHaveLength(1);
        expect(result[0].legs).toHaveLength(1);
        expect(result[0].legs[0].fromStopId).toBe(1);
        expect(result[0].legs[0].toStopId).toBe(3);
    });

    it('tags TRAM connections with mode "tram"', () => {
        const connections = [
            conn({ from: 1, to: 2, dep: T + 60, arr: T + 600, type: 'TRAM' }),
        ];
        const result = runCSA({
            connections,
            sources: [{ stopId: 1, arrivalTime: T }],
            targetStopIds: new Set([2]),
            transfers: new Map(),
            minDepartureTime: T,
        });
        expect(result[0].legs[0].mode).toBe('tram');
    });
});
