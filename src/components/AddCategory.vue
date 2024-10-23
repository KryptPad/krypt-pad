<template>
    <div class="mb-1">
        <v-text-field
            v-model="title"
            type="text"
            label="category name"
            :rules="rules"
            hide-details="auto"
            class="mb-3"
            @keypress.enter="addCategory"
            @keydown.esc="close"
            autofocus
        >
        </v-text-field>

        <v-btn color="primary" icon="mdi-check" class="mr-3" @click="addCategory"></v-btn>
        <v-btn icon="mdi-close" @click="close"></v-btn>
    </div>
</template>

<script setup lang="ts">
import KryptPadAPI from '@/krypt-pad-api'
import { Category } from '@/krypt-pad-profile'
import { inject, ref } from 'vue'

// Inject Krypt Pad's core functionality
const kpAPI = inject<KryptPadAPI>('kpAPI')!

const title = ref<string | null>(null)
const rules = [(value: string) => !!value || 'Required.']

const emit = defineEmits(['closed'])

// Event handlers
async function addCategory() {
    if (!title.value) {
        return
    }
    // Add the category to the profile
    kpAPI.profile.value?.categories.push(await Category.create(title.value, kpAPI.passphrase.value))

    close()
}

function close() {
    emit('closed')
}
</script>
