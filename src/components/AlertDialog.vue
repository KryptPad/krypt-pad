<template>
    <v-dialog v-model="showDialog" persistent width="auto">
        <v-card>
            <v-card-title class="text-h5">
                Alert
            </v-card-title>

            <v-card-text>
                <div class="d-flex">
                    <v-icon :icon="icon" :color="color" size="3rem" class="mr-3"></v-icon>
                    <div>
                        {{ alertMessage }}
                    </div>
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn :color="color" @click="okHandler">
                    OK
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {IAlertOptions} from '@/interfaces';

// defineProps({
//     color: { type: String, default: 'primary' },
//     icon: { type: String, default: 'mdi-alert' }
// });

const showDialog = ref(false);
const alertMessage = ref<string | null>(null);

const color = ref('primary');
const icon = ref('mdi-alert');

let alertResolve: Function | null = null;

/**
 * Shows the user a alert message
 * @param {String} message 
 */
function alert(message: string, options?:IAlertOptions) {
    color.value = options?.color ?? color.value;
    icon.value = options?.icon ?? icon.value;

    showDialog.value = true;
    return new Promise((resolve) => {
        alertResolve = resolve;
        alertMessage.value = message;
    });
}

function okHandler() {
    alertResolve?.(true);
    showDialog.value = false;
}

defineExpose({ alert })
</script>