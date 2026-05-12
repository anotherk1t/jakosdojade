import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCached, setCache, clearCache } from '../../src/data/cache.js';

afterEach(() => {
    vi.useRealTimers();
});

describe('cache', () => {
    it('round-trips a stored value via setCache/getCached', () => {
        setCache('stops_2026-05-12', [{ id: 1, name: 'A' }]);
        expect(getCached('stops_2026-05-12')).toEqual([{ id: 1, name: 'A' }]);
    });

    it('returns null when key is missing', () => {
        expect(getCached('nope')).toBeNull();
    });

    it('returns null after the 12h TTL has expired', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-12T08:00:00Z'));
        setCache('routes', { foo: 1 });
        expect(getCached('routes')).toEqual({ foo: 1 });

        // 12h + 1s later
        vi.setSystemTime(new Date('2026-05-12T20:00:01Z'));
        expect(getCached('routes')).toBeNull();
    });

    it('removes the expired entry from localStorage on read', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-12T08:00:00Z'));
        setCache('routes', { foo: 1 });
        vi.setSystemTime(new Date('2026-05-13T08:00:00Z'));
        getCached('routes'); // triggers removal
        expect(localStorage.getItem('bikerouter_ztm_routes')).toBeNull();
    });

    it('namespaces keys with bikerouter_ztm_', () => {
        setCache('foo', 42);
        expect(localStorage.getItem('bikerouter_ztm_foo')).not.toBeNull();
    });

    it('clearCache removes only namespaced keys', () => {
        setCache('foo', 1);
        setCache('bar', 2);
        localStorage.setItem('unrelated', 'keep me');

        clearCache();

        expect(getCached('foo')).toBeNull();
        expect(getCached('bar')).toBeNull();
        expect(localStorage.getItem('unrelated')).toBe('keep me');
    });

    it('getCached returns null on malformed JSON without throwing', () => {
        localStorage.setItem('bikerouter_ztm_corrupt', '{not json');
        expect(getCached('corrupt')).toBeNull();
    });
});
