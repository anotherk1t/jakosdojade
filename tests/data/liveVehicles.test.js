import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '../setup.js';
import {
    fetchVehiclePositions,
    startPolling,
    stopPolling,
    isPolling,
} from '../../src/data/liveVehicles.js';

afterEach(() => {
    stopPolling();
    vi.useRealTimers();
});

describe('fetchVehiclePositions', () => {
    it('normalizes the raw GPS payload', async () => {
        mockFetch(jsonResponse({
            lastUpdate: '2026-05-12T08:00:00Z',
            vehicles: [
                { lat: 54.35, lon: 18.65, routeShortName: '6', headsign: 'Brzeźno',
                  delay: -30, speed: 25, vehicleCode: 'V1', direction: 90,
                  generated: '2026-05-12T07:59:45Z' },
                { lat: 54.40, lon: 18.60, routeShortName: '199', headsign: 'Sopot',
                  delay: 120, speed: 0, vehicleCode: 'V2' },
            ],
        }));

        const result = await fetchVehiclePositions();
        expect(result.lastUpdate).toBe('2026-05-12T08:00:00Z');
        expect(result.vehicles).toHaveLength(2);
        expect(result.vehicles[0]).toMatchObject({
            line: '6',
            headsign: 'Brzeźno',
            delay: -30,
            speed: 25,
            vehicleCode: 'V1',
            direction: 90,
            isTram: true,
        });
        // bus, not tram
        expect(result.vehicles[1].isTram).toBe(false);
    });

    it('uses null for missing delay and zero for missing speed', async () => {
        mockFetch(jsonResponse({
            lastUpdate: 'x',
            vehicles: [
                { lat: 0, lon: 0, routeShortName: '100' },
            ],
        }));
        const r = await fetchVehiclePositions();
        expect(r.vehicles[0].delay).toBeNull();
        expect(r.vehicles[0].speed).toBe(0);
        expect(r.vehicles[0].isTram).toBe(false);
    });

    it('throws on non-OK HTTP response', async () => {
        mockFetch(jsonResponse({}, { ok: false, status: 500 }));
        await expect(fetchVehiclePositions()).rejects.toThrow(/500/);
    });
});

describe('startPolling / stopPolling', () => {
    it('invokes the callback immediately and then every 15 seconds', async () => {
        vi.useFakeTimers();
        let i = 0;
        const fetchMock = vi.fn(async () => jsonResponse({ lastUpdate: `t${i++}`, vehicles: [] }));
        vi.stubGlobal('fetch', fetchMock);

        const cb = vi.fn();
        startPolling(cb);
        expect(isPolling()).toBe(true);

        // Flush the immediate fetch's microtask queue (fetch → .json() → onUpdate)
        await vi.advanceTimersByTimeAsync(0);
        expect(cb).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(15_000);
        expect(cb).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(15_000);
        expect(cb).toHaveBeenCalledTimes(3);

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(cb.mock.calls[0][0].lastUpdate).toBe('t0');
        expect(cb.mock.calls[1][0].lastUpdate).toBe('t1');
        expect(cb.mock.calls[2][0].lastUpdate).toBe('t2');
    });

    it('stopPolling halts further callbacks', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn(async () => jsonResponse({ lastUpdate: 'x', vehicles: [] }));
        vi.stubGlobal('fetch', fetchMock);

        const cb = vi.fn();
        startPolling(cb);
        await vi.advanceTimersByTimeAsync(0);
        const callsBefore = cb.mock.calls.length;

        stopPolling();
        expect(isPolling()).toBe(false);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(cb.mock.calls.length).toBe(callsBefore);
    });

    it('keeps polling after a fetch failure (logs a warning, no crash)', async () => {
        vi.useFakeTimers();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let call = 0;
        const fetchMock = vi.fn(async () => {
            call++;
            if (call === 1) throw new Error('boom');
            return jsonResponse({ lastUpdate: 'ok', vehicles: [] });
        });
        vi.stubGlobal('fetch', fetchMock);

        const cb = vi.fn();
        startPolling(cb);
        await vi.advanceTimersByTimeAsync(0);
        // Tick once more so the second fetch fires
        await vi.advanceTimersByTimeAsync(15_000);

        expect(warn).toHaveBeenCalled();
        // Callback should only fire for the successful second call
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0].lastUpdate).toBe('ok');
    });
});
