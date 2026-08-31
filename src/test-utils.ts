import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

function createVuetifyInstance() {
    return createVuetify({
        components,
        directives,
        icons: {
            defaultSet: 'mdi',
            aliases,
            sets: { mdi }
        }
    })
}

/**
 * Mounts a Vue component with Vuetify installed so components that render
 * Vuetify UI elements in their templates can be tested.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountWithVuetify(component: any, options: any = {}) {
    const vuetify = createVuetifyInstance()

    return mount(component, {
        ...options,
        global: {
            ...options.global,
            plugins: [...(options.global?.plugins ?? []), vuetify]
        }
    })
}
