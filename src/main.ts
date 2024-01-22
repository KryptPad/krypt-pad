import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.min.css'; // MDI font icons
import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
// Main component
import App from './App.vue';
import router from './router';

// Configure vuetify
const vuetify = createVuetify(
    {
        defaults: {
            global: {
                // I love the ripple effect
                ripple: true,
                density: "comfortable",
                elevation: 0
            }
        },
        theme: {
            defaultTheme: 'dark'
        },
        icons: {
            defaultSet: 'mdi',
            aliases,
            sets: {
                mdi,
            }
        },
        components,
        directives
    }
);

const app = createApp(App);

app.use(router);
app.use(vuetify);

app.mount('#app');