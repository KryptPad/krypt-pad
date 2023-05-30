<template>
    <v-dialog v-model="showDialog" persistent width="auto">
        <v-card>
            <v-card-title class="text-h5">
                Confirm
            </v-card-title>

            <v-card-text>
                <div class="d-flex">
                    <v-icon icon="mdi-alert" color="red" size="3rem" class="mr-3"></v-icon>
                    <div>
                        {{ confirmMessage }}
                    </div>
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary" @click="yesHandler">
                    Yes
                </v-btn>
                <v-btn @click="noHandler">
                    No
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref } from 'vue';

const showDialog = ref(false);
const confirmMessage = ref(null);
let confirmResolve = null;

/**
 * Shows the user a confirm message
 * @param {String} message 
 */
function confirm(message) {
    console.log("fsfsdfdf")
    showDialog.value = true;
    return new Promise((resolve) => {
        confirmResolve = resolve;
        confirmMessage.value = message;
    });
}

function yesHandler() {
    confirmResolve?.(true);
    showDialog.value = false;
}

function noHandler() {
    confirmResolve?.(false);
    showDialog.value = false;
}

defineExpose({ confirm })
</script>