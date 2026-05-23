import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
    plugins: [cloudflare()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            // Proxy /graphhopper/* → GraphHopper server on the Docker host
            '/graphhopper': {
                target: 'http://localhost:8989',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/graphhopper/, ''),
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/data/**', 'src/routing/**'],
            exclude: ['src/ui/**', 'src/main.js'],
        },
    },
});