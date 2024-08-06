<template>
    <v-dialog v-model="showDialog" persistent width="auto">
        <v-card>
            <v-card-title class="text-h5">
                {{ title }}
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
                <v-btn :color="color" @click="okHandler"> OK </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IAlertOptions } from '@/interfaces'

// defineProps({
//     color: { type: String, default: 'primary' },
//     icon: { type: String, default: 'mdi-alert' }
// });

const showDialog = ref(false)
const alertMessage = ref<string | null>(null)

const color = ref('primary')
const icon = ref('mdi-alert')
const title = ref('Alert')

let alertResolve: Function | null = null

/**
 *
 * @param message Shows the user a alert message
 * @param options Options to control how the alert is displayed
 */
function alert(message: string, options?: IAlertOptions): Promise<boolean> {
    if (options?.color) {
        color.value = options?.color
    }
    if (options?.icon) {
        icon.value = options?.icon
    }
    if (options?.title) {
        title.value = options?.title
    }

    showDialog.value = true
    return new Promise((resolve) => {
        alertResolve = resolve
        alertMessage.value = message
    })
}

/**
 * Displays an alert styled as an error message
 * @param message The error message to display
 */
function error(message: string) {
    return alert(message, { color: 'red', title: 'Error' })
}

/**
 * Handles when the user clicks ok and resolves the promise
 */
function okHandler() {
    alertResolve?.(true)
    showDialog.value = false
}

defineExpose({ alert, error })
</script>
