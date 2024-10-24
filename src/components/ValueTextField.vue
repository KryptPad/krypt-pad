<template>
    <div class="mb-1">
        <v-text-field
            v-model="title"
            type="text"
            label="category name"
            :rules="rules"
            hide-details="auto"
            class="mb-3"
            @keypress.enter="save"
            @keydown.esc="close"
            autofocus
        >
        </v-text-field>

        <v-btn color="primary" icon="mdi-check" class="mr-3" @click="save"></v-btn>
        <v-btn icon="mdi-close" @click="close"></v-btn>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  target: Object
})

const title = ref<string | null>(null)
const rules = [(value: string) => !!value || 'Required.']

const emit = defineEmits(['closed', 'save'])

// Event handlers
async function save() {
    if (!title.value) {
        return
    }
    console.log('save', title.value, props.target)
    // Raise the save event
    emit('save', title.value, props.target)

    close()
}

function close() {
    emit('closed')
}
</script>
