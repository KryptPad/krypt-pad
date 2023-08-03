<template>
    <!-- When in normal mode, the field's value can be edited -->
    <div v-if="!isEditing" class="d-flex" @keypress.enter="saveField">
        <v-text-field :model-value="internalField.value" @change="onValueChange" :label="internalField.name"
            :hide-details="true" class="mr-3"></v-text-field>

        <v-menu>
            <template v-slot:activator="{ props }">
                <v-btn icon="mdi-dots-vertical" v-bind="props"></v-btn>
            </template>

            <v-list>
                <v-list-item prepend-icon="mdi-rename" value="rename" @click="isEditing = true">
                    <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>

                <v-list-item prepend-icon="mdi-delete" value="delete" @click="deleteField">
                    <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>
    </div>

    <!-- In edit mode, the field's name can be edited -->
    <template v-else>
        <v-text-field v-model="internalField.name" label="name" placeholder="e.g. password" @keypress.enter="saveField"
            autofocus></v-text-field>
        <v-btn color="primary" icon="mdi-check" class="mr-3" @click="saveField"></v-btn>
        <v-btn icon="mdi-close" @click="isEditing = false"></v-btn>
    </template>
</template>

<script setup>

import { ref, toRefs } from 'vue';

const props = defineProps({ modelValue: Object });
const emit = defineEmits(['delete', 'update:modelValue']);

const isEditing = ref(false);
const { modelValue: internalField } = toRefs(props);

// Event handler
function saveField() {
    emit('update:modelValue', internalField);

    isEditing.value = false;
}

function onValueChange(ev) {
    internalField.value = ev.target.value;
    // Update v-model
    emit('update:modelValue', internalField);
}

function deleteField() {
    emit('delete', internalField);

}

</script>