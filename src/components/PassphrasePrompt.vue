<template>
    <!-- Passphrase prompt -->
    <v-dialog v-model="dialogOpen" :persistent="true" max-width="30rem">
        <v-card>
            <v-card-title>{{ passphraseIsNew ? 'Enter New Passphrase' : 'Enter Passphrase' }}</v-card-title>
            <v-card-text>
                <p v-if="passphraseIsNew">
                    Please enter a master passphrase to encrypt your data. Keep it safe and secure. If you lose it, THERE IS
                    NO WAY TO RECOVER IT!!!
                </p>
                <p v-else>
                    Please enter your passphrase to decrypt your data.
                </p>
                <v-text-field v-model.lazy="passphrase" type="password" class="mt-3"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-btn color="primary" block @click="closed">DONE</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>

import { watch, ref } from 'vue';
import kpAPI from '@/krypt-pad-api';

// Props
defineProps({
    passphraseIsNew: Boolean
});

const emit = defineEmits(["closed"]);
// Data
const passphrase = ref(null);
const dialogOpen = ref(false);

function show(){
    dialogOpen.value = true;
}

// Watch
watch(passphrase, (newVal) => {
    kpAPI.passphrase = newVal;
});

defineExpose({show});

// Events
function closed(){
    dialogOpen.value = false;
    emit("closed", kpAPI.passphrase);
}

</script>