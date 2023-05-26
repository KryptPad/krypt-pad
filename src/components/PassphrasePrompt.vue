<template>
    <!-- Passphrase prompt -->
    <v-dialog v-model="dialogOpen" :persistent="true">
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
                <v-text-field v-model="passphrase" type="password"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-btn color="primary" block @click="dialogOpen = false">Close Dialog</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>

import { watch, ref } from 'vue';

// Props
const props = defineProps({
    passphraseIsNew: Boolean,
    modelValue: String
});

// Data
const passphrase = ref(props.modelValue);
const dialogOpen = ref();

// Emits
const emit = defineEmits(['update:modelValue'])

function show(){
    dialogOpen.value = true;
}

// Watch
watch(passphrase, (newVal) => {
    emit('update:modelValue', newVal);
});

defineExpose({show});

</script>