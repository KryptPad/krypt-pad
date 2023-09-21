<template>
    <!-- Passphrase prompt -->
    <v-dialog v-model="dialogOpen" :persistent="true" max-width="30rem">
        <v-card @keypress.enter="close">
            <v-card-title>{{ passphraseIsNew ? 'Enter New Passphrase' : 'Enter Passphrase' }}</v-card-title>
            <v-card-text>
                <p v-if="passphraseIsNew">
                    Please enter a master passphrase to encrypt your data. Keep it safe and secure. If you lose it, THERE IS
                    NO WAY TO RECOVER IT!!!
                </p>
                <p v-else>
                    Please enter your passphrase to decrypt your data.
                </p>
                <v-text-field :autofocus="true" v-model.lazy="passphrase" type="password" class="mt-3"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-btn color="primary" block @click="close">DONE</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>

import { ref } from 'vue';

// Props
defineProps({
    passphraseIsNew: Boolean
});

const emit = defineEmits(["closed"]);
// Data
const passphrase = ref(null);
const dialogOpen = ref(false);

/**
 * Shows the passphrase prompt dialog
 */
function show(){
    dialogOpen.value = true;
}

defineExpose({show});

// Events
function close(){
    emit("closed", passphrase.value);

    // Close dialog
    dialogOpen.value = false;

    // Clear the passphrase from the input
    passphrase.value = null;
}

</script>