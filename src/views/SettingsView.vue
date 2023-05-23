<template>
    <div class="pb-3">
        Settings
    </div>

    <div class="d-flex">
        <v-card class="pa-3">
            <v-switch v-model="lightMode" prepend-icon="mdi-weather-night" append-icon="mdi-weather-sunny"></v-switch>
        </v-card>

    </div>
</template>

<script setup>

import { watch, ref } from 'vue';
import { useTheme } from 'vuetify/lib/framework.mjs';


const lightMode = ref(false);
const theme = useTheme();

watch(lightMode, ()=>{
    console.log(theme)
    theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
        
});

</script>