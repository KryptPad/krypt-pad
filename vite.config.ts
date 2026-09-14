import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'
// import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    build: {
        // Strip logging from production builds. Profile data must never reach
        // the console of a shipped build, and this keeps a stray log from
        // becoming a leak.
        rolldownOptions: {
            output: {
                minify: command === 'build' ? { compress: { dropConsole: true, dropDebugger: true } } : undefined
            }
        }
    },
    resolve: {
        /* Resolve aliases */
        alias: {
            '@': '/src'
        }
    },
    plugins: [
        //nodePolyfills(),
        vue(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'electron/main.ts'
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: path.join(__dirname, 'electron/preload.ts')
            },
            // Ployfill the Electron and Node.js built-in modules for Renderer process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: {}
        })
    ]
}))
