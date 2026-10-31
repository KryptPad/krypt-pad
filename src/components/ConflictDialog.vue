<template>
    <v-dialog v-model="showDialog" persistent max-width="640">
        <v-card>
            <v-card-title class="text-h5"> Vault Changed </v-card-title>

            <v-card-text>
                <div class="d-flex align-center mb-4">
                    <v-icon icon="mdi-sync-alert" color="warning" size="3rem" class="mr-3"></v-icon>
                    <div>
                        {{ conflictMessage }}
                    </div>
                </div>

                <v-list density="compact">
                    <v-list-item
                        prepend-icon="mdi-reload"
                        title="Reload"
                        subtitle="Load the vault as it is now. Your unsaved changes are discarded."
                    ></v-list-item>
                    <v-list-item
                        prepend-icon="mdi-content-save-alert"
                        title="Keep mine"
                        subtitle="Overwrite the vault with your version. Changes made elsewhere are lost."
                    ></v-list-item>
                    <v-list-item
                        prepend-icon="mdi-content-save-move"
                        title="Save as new vault"
                        subtitle="Save your version as a separate vault and leave this one as it is."
                    ></v-list-item>
                </v-list>
            </v-card-text>
            <v-card-actions class="flex-wrap">
                <v-btn color="primary" @click="choose('reload')"> Reload </v-btn>
                <v-btn color="red-accent-2" @click="choose('keep-mine')"> Keep Mine </v-btn>
                <v-btn color="secondary" @click="choose('save-as')"> Save As New Vault </v-btn>
                <v-spacer></v-spacer>
                <v-btn @click="choose(null)"> Decide Later </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ConflictResolution } from '@/interfaces'

const showDialog = ref(false)
const conflictMessage = ref<string | null>(null)
let conflictResolve: ((choice: ConflictResolution | null) => void) | null = null

/**
 * Asks the user how to handle a vault that was changed elsewhere
 * @param {String} message
 * @returns {Promise<ConflictResolution | null>} the choice, or null if the user put it off
 */
function resolve(message: string): Promise<ConflictResolution | null> {
    // Settle any earlier question so its caller isn't left waiting
    conflictResolve?.(null)

    showDialog.value = true
    conflictMessage.value = message
    return new Promise((res) => {
        conflictResolve = res
    })
}

/**
 * Closes the dialog without a choice
 */
function dismiss() {
    choose(null)
}

function choose(choice: ConflictResolution | null) {
    const res = conflictResolve
    conflictResolve = null
    showDialog.value = false
    res?.(choice)
}

defineExpose({ resolve, dismiss, choose })
</script>
