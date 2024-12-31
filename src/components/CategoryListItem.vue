<template>
    <!-- Category list item -->
    <v-list-item v-if="!isEditing" @click="emit('click', $event)" :active="active">
        <v-list-item-title>{{ name }}</v-list-item-title>

        <template v-slot:append>
            <v-menu>
                <template v-slot:activator="{ props }">
                    <v-btn icon="mdi-dots-vertical" v-bind="props"></v-btn>
                </template>

                <v-list>
                    <v-list-item prepend-icon="mdi-rename" value="rename" @click="enterEditMode">
                        <v-list-item-title>Rename</v-list-item-title>
                    </v-list-item>

                    <v-list-item prepend-icon="mdi-delete" value="delete" @click="emit('deleted', $event)">
                        <v-list-item-title>Delete</v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
        </template>
    </v-list-item>

    <!-- Edit category name -->
    <v-list-item v-else @keypress.enter="renameCategory" @keydown.esc="close()">
        <div class="mb-1" @click.stop>
            <v-text-field v-model="title" type="text" label="category name" :rules="rules" hide-details="auto" class="mb-3" autofocus> </v-text-field>

            <v-btn color="primary" icon="mdi-check" class="mr-3" @click="renameCategory"></v-btn>
            <v-btn icon="mdi-close" @click="close()"></v-btn>
        </div>
    </v-list-item>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
    // A reference to the category
    id?: String
    name?: String
    active: boolean
}>()

const isEditing = ref(false)
const title = ref()
const rules = [(value: string | null) => !!value || 'Required.']

const emit = defineEmits(['click', 'updated', 'deleted'])

/**
 * Puts the component into edit mode
 */
function enterEditMode() {
    // Set the title field to the category's title so we can rename it.
    title.value = props.name
    isEditing.value = true
}

/**
 * Renames the category
 */
function renameCategory() {
    if (!title.value) {
        return
    }
    // When change is fired, update the category title to trigger updating the profile.
    emit('updated', title.value)
    close()
}

/**
 * Closes out of editing mode
 */
function close() {
    isEditing.value = false
}
</script>
