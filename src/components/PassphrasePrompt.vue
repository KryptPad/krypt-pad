<template>
    <!-- Passphrase prompt -->
    <v-dialog v-model="dialogOpen" max-width="30rem">
        <v-card @keypress.enter="ok">
            <v-card-title>{{ passphraseIsNew ? 'Enter New Passphrase' : 'Enter Passphrase' }}</v-card-title>
            <v-card-text>
                <p v-if="passphraseIsNew">
                    Please enter a master passphrase to encrypt your data. Keep it safe and secure. If you lose it, THERE IS NO WAY TO RECOVER IT!!!
                </p>
                <p v-else>Please enter your passphrase to decrypt your data.</p>
                <v-text-field :autofocus="true" v-model.lazy="passphrase" type="password" class="mt-3"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn prepend-icon="mdi-check" color="primary" @click="ok">OK</v-btn>
                <v-btn prepend-icon="mdi-close" @click="cancel">CANCEL</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

// Props
defineProps({
    passphraseIsNew: Boolean
})

const emit = defineEmits(['closed'])
// Data
const passphrase = ref()
const dialogOpen = ref(false)

/**
 * Shows the passphrase prompt dialog
 */
function show() {
    dialogOpen.value = true
}

// Events
function ok() {
    // Close dialog.
    dialogOpen.value = false
}

function cancel() {
    // Clear the passphrase from the input.
    passphrase.value = undefined

    // Close dialog.
    dialogOpen.value = false
}

watch(dialogOpen, (newValue) => {
    if (!newValue) {
        // The dialog was closed.
        emit('closed', passphrase.value)
        // Clear the passphrase from the input.
        passphrase.value = undefined
    }
})

defineExpose({ show })
</script>
