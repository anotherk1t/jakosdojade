import { beforeEach, vi } from 'vitest';

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

export function mockFetch(impl) {
    const fn = typeof impl === 'function' ? vi.fn(impl) : vi.fn().mockResolvedValue(impl);
    vi.stubGlobal('fetch', fn);
    return fn;
}

export function jsonResponse(body, { ok = true, status = 200 } = {}) {
    return {
        ok,
        status,
        json: async () => body,
    };
}
