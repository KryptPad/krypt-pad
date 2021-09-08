import "vuetify/styles";
import {createApp} from "vue";
import { createVuetify } from "vuetify";
import home from "../components/home.vue";

// Create app
const app = createApp(home);
const vuetify = createVuetify(); // Replaces new Vuetify(...)

// Add plugins
app.use(vuetify);

// Mount the app
app.mount("#app");