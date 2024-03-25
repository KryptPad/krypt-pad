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

<script setup lang="ts">

import { AppSettings } from '@/app-settings';
import { IPCBridge } from '@/bridge';
import { watch, ref, inject } from 'vue';
import { useTheme } from 'vuetify';

const ipcBridge = new IPCBridge();
const appSettings = inject<AppSettings>('appSettings')!;
const theme = useTheme();
const lightMode = ref(!theme.global.current.value.dark);

watch(lightMode, (newValue) => {
    // Update theme
    theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
    // Set new value
    appSettings.lightMode = newValue;
    ipcBridge.saveConfigFile(appSettings);
});

</script>