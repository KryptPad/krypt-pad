import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
    resolve: {
        /* Resolve aliases */
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/*.spec.ts', 'common/**/*.spec.ts'],
        css: true,
        server: {
            deps: {
                inline: ['vuetify']
            }
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html']
        }
    }
})
