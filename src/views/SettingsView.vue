<template>
    <!-- Main content -->
    <v-main :scrollable="true">
        <v-container>

            <h1>
                Settings
            </h1>

            <div>
                <!-- Visual settings -->
                <v-card elevation="3" class="w-100" style="max-width: 50rem;">
                    <v-card-title>Visual</v-card-title>
                    <v-card-text class="d-flex align-center">
                        <div class="mr-3">Theme</div>
                        <div class="ml-auto">
                            <v-switch v-model="lightMode" prepend-icon="mdi-weather-night"
                                append-icon="mdi-weather-sunny" :hide-details="true"></v-switch>
                        </div>
                    </v-card-text>

                </v-card>

                <!-- Security -->
                <v-card elevation="3" class="w-100 mt-5" style="max-width: 50rem;">
                    <v-card-title>Security</v-card-title>
                    <v-card-text class="d-flex align-center">
                        <div class="mr-3">
                            <v-checkbox label="Automatically close file after idle timeout."></v-checkbox>
                        </div>
                        <div class="ml-auto" style="width: 10rem;">
                            <v-text-field v-model="timeoutInSeconds" type="number" :rules="validationRules"
                            suffix="second(s)" ></v-text-field>
                        </div>
                    </v-card-text>

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

const validationRules =  [
    (v:number) => !!v || "This field is required",
    (v:number) => ( v && v >= 0 ) || "Timeout must be greater than 0",
    (v:number) => ( v && v <= 999 ) || "Timeout must be less than 1000",
];

const lightMode = ref(!theme.global.current.value.dark);
const timeoutInSeconds = ref<Number | unknown>();

watch(lightMode, (newValue) => {
    // Update theme
    theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
    // Set new value
    appSettings.lightMode = newValue;
    ipcBridge.saveConfigFile(appSettings);
});

</script>