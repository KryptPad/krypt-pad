import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.min.css' // MDI font icons
import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import router from '@/router'
import { IPCBridge } from '@/bridge'
import { SettingsManager } from '@/app-settings'
// Main component
import App from '@/App.vue'

function loadApp(appSettings?: SettingsManager) {
    // Configure vuetify
    const vuetify = createVuetify({
        defaults: {
            global: {
                // I love the ripple effect
                ripple: true,
                density: 'comfortable',
                elevation: 0
            }
        },
        theme: {
            defaultTheme: appSettings?.lightMode.value ? 'light' : 'dark'
        },
        icons: {
            defaultSet: 'mdi',
            aliases,
            sets: {
                mdi
            }
        },
        components,
        directives
    })

    const app = createApp(App)

    // Provide the settings as a global object. If none exist, then create a new one.
    app.provide('appSettings', appSettings ?? new SettingsManager())
    // Use plugins
    app.use(router)
    app.use(vuetify)

    app.mount('#app')
}

/**
 * Initializes the application
 */
async function init() {
    const ipcBridge = new IPCBridge()
    // Load the settigns
    let appSettings
    try {
        appSettings = await ipcBridge.loadConfigFile()
    } catch (ex) {
        console.error(ex)
    } finally {
        // Initialize the app with the loaded settings
        loadApp(appSettings)
    }
}

init()
