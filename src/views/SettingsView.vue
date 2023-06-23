<template>
    <!-- Main content -->
    <v-main :scrollable="true">
        <v-container class="">

            <h1>
                Settings
            </h1>

            <div class="d-flex">
                <v-card class="pa-3">
                    <v-switch v-model="lightMode" prepend-icon="mdi-weather-night"
                        append-icon="mdi-weather-sunny"></v-switch>
                </v-card>

            </div>

        </v-container>
    </v-main>
</template>

<script setup>

import { watch, ref } from 'vue';
import { useTheme } from 'vuetify/lib/framework.mjs';

const theme = useTheme();
const lightMode = ref(!theme.global.current.value.dark);

watch(lightMode, () => {
    console.log(theme)
    theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'

});

</script>