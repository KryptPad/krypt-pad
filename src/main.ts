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
// Styles
import '@/styles/app.scss'
// Main component
import App from '@/App.vue'

function loadApp(platform: string, appSettings?: SettingsManager) {
    // Configure vuetify
    const vuetify = createVuetify({
        defaults: {
            global: {
                ripple: true,
                density: 'comfortable'
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
    app.provide('platform', platform)
    // Use plugins
    app.use(router)
    app.use(vuetify)

    app.mount('#app')

    hideSplash()
}

/**
 * Fades out the splash screen from index.html and removes it once the fade
 * has finished, so it can't sit on top of the app.
 */
function hideSplash() {
    const splash = document.getElementById('splash')
    if (!splash) {
        return
    }

    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    splash.classList.add('splash-hidden')
    // transitionend doesn't fire if transitions are disabled, so remove it regardless
    setTimeout(() => splash.remove(), 500)
}

/**
 * Initializes the application
 */
async function init() {
    const ipcBridge = new IPCBridge()
    // Load the settigns
    let appSettings: SettingsManager | undefined
    let platform = await ipcBridge.getPlatform()
    try {
        appSettings = await ipcBridge.loadConfigFile()
    } catch (ex) {
        console.error(ex)
    }

    // Initialize the app with the loaded settings
    loadApp(platform, appSettings)
}

init()
