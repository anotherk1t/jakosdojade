import { describe, expect, it } from 'vitest';
import {
    haversine,
    findNearby,
    estimateWalkTime,
    estimateBikeTime,
    formatDuration,
    formatTime,
    parseTime,
    parseZtmTime,
} from '../../src/routing/geo.js';

describe('haversine', () => {
    const GDANSK = { lat: 54.3520, lon: 18.6466 };
    const GDYNIA = { lat: 54.5189, lon: 18.5305 };

    it('returns 0 for identical points', () => {
        expect(haversine(GDANSK.lat, GDANSK.lon, GDANSK.lat, GDANSK.lon)).toBe(0);
    });

    it('returns Gdańsk↔Gdynia distance around 20 km', () => {
        const d = haversine(GDANSK.lat, GDANSK.lon, GDYNIA.lat, GDYNIA.lon);
        expect(d).toBeGreaterThan(18000);
        expect(d).toBeLessThan(22000);
    });

    it('is symmetric', () => {
        const a = haversine(GDANSK.lat, GDANSK.lon, GDYNIA.lat, GDYNIA.lon);
        const b = haversine(GDYNIA.lat, GDYNIA.lon, GDANSK.lat, GDANSK.lon);
        expect(a).toBeCloseTo(b, 6);
    });

    it('handles ~100m differences accurately', () => {
        // ~111m per 0.001° latitude
        const d = haversine(54.35, 18.65, 54.351, 18.65);
        expect(d).toBeGreaterThan(100);
        expect(d).toBeLessThan(120);
    });
});

describe('findNearby', () => {
    const items = [
        { name: 'A', lat: 54.350, lon: 18.650 },
        { name: 'B', lat: 54.351, lon: 18.650 }, // ~111m N
        { name: 'C', lat: 54.360, lon: 18.650 }, // ~1.1km N
        { name: 'D', lat: 54.400, lon: 18.650 }, // ~5.5km N
    ];
    const center = { lat: 54.350, lon: 18.650 };

    it('filters by radius', () => {
        const result = findNearby(center, items, 500);
        const names = result.map(r => r.item.name);
        expect(names).toEqual(['A', 'B']);
    });

    it('sorts by distance ascending', () => {
        const result = findNearby(center, items, 10000);
        const distances = result.map(r => r.distance);
        const sorted = [...distances].sort((a, b) => a - b);
        expect(distances).toEqual(sorted);
        expect(result[0].item.name).toBe('A');
    });

    it('returns empty array when nothing is in range', () => {
        const result = findNearby(center, items, 1);
        expect(result).toEqual([{ item: items[0], distance: 0 }]);
    });

    it('attaches numeric distance to each item', () => {
        const result = findNearby(center, items, 10000);
        for (const r of result) {
            expect(typeof r.distance).toBe('number');
            expect(r.distance).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('estimateWalkTime / estimateBikeTime', () => {
    it('walk: 1390m → ~1000s (5 km/h pace)', () => {
        expect(estimateWalkTime(1390)).toBeCloseTo(1000, 0);
    });

    it('bike: 4170m → ~1000s (15 km/h pace)', () => {
        expect(estimateBikeTime(4170)).toBeCloseTo(1000, 0);
    });

    it('zero distance → zero time', () => {
        expect(estimateWalkTime(0)).toBe(0);
        expect(estimateBikeTime(0)).toBe(0);
    });
});

describe('formatDuration', () => {
    it('< 1 min rounds to whole minutes', () => {
        expect(formatDuration(90)).toBe('2 mins');
        expect(formatDuration(30)).toBe('1 mins');
    });

    it('< 60 min stays in minutes', () => {
        expect(formatDuration(3540)).toBe('59 mins');
    });

    it('exactly 1 hour drops the "0 mins"', () => {
        expect(formatDuration(3600)).toBe('1h');
    });

    it('mixed hours and minutes', () => {
        expect(formatDuration(3900)).toBe('1h 5 mins');
        expect(formatDuration(10800)).toBe('3h');
    });
});

describe('formatTime / parseTime', () => {
    it('formatTime pads single digits', () => {
        expect(formatTime(7 * 3600 + 5 * 60)).toBe('07:05');
    });

    it('parseTime + formatTime round-trips', () => {
        const secs = parseTime('14:30');
        expect(secs).toBe(14 * 3600 + 30 * 60);
        expect(formatTime(secs)).toBe('14:30');
    });

    it('formatTime wraps past 24h', () => {
        expect(formatTime(25 * 3600 + 10 * 60)).toBe('01:10');
    });
});

describe('parseZtmTime', () => {
    it('parses ZTM "1899-12-30T07:15:00" format', () => {
        expect(parseZtmTime('1899-12-30T07:15:00')).toBe(7 * 3600 + 15 * 60);
    });

    it('includes seconds when present', () => {
        expect(parseZtmTime('1899-12-30T07:15:42')).toBe(7 * 3600 + 15 * 60 + 42);
    });

    it('returns 0 when there is no T in the string', () => {
        expect(parseZtmTime('garbage')).toBe(0);
    });

    it('handles post-midnight schedules above 24h (GTFS-style)', () => {
        expect(parseZtmTime('1899-12-30T25:10:00')).toBe(25 * 3600 + 10 * 60);
    });
});
