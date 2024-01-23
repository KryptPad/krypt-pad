<template>
    <v-main>
        <v-container class="fill-height d-flex flex-column align-center justify-center">

            <img src="../assets/safe.svg" alt="Krypt Pad" style="width: 12rem" />
            
            <div class="text-center">Welcome! Create a new file or open an existing one.</div>

            <v-row class="mt-3 flex-grow-0">
                <v-col>
                    <v-btn color="secondary" @click="kpAPI.openExistingFileAsync">Open File</v-btn>
                </v-col>
                <v-col>
                    <v-btn  @click="kpAPI.createNewFileAsync">Create New File</v-btn>
                </v-col>                
            </v-row>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import KryptPadAPI from '@/krypt-pad-api';
import { inject } from 'vue';

// Inject Krypt Pad's core functionality
const kpAPI = inject<KryptPadAPI>("kpAPI")!;

</script>
