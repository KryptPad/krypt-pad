<template>
    <!-- When in normal mode, the field's value can be edited -->
    <div v-if="!isEditing" class="d-flex" @keypress.enter="saveField">
        <v-text-field :label="field.name" :hide-details="true" class="mr-3"></v-text-field>

        <v-menu>
            <template v-slot:activator="{ props }">
                <v-btn icon="mdi-dots-vertical" v-bind="props"></v-btn>
            </template>

            <v-list>
                <v-list-item prepend-icon="mdi-rename" value="rename" @click="isEditing = true">
                    <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>

                <v-list-item prepend-icon="mdi-delete" value="delete">
                    <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>
    </div>

    <!-- In edit mode, the field's name can be edited -->
    <template v-else>
        <v-text-field v-model="fieldName" label="field name" placeholder="e.g. password" autofocus></v-text-field>
        <v-btn color="primary" icon="mdi-check" class="mr-3" @click="saveField"></v-btn>
        <v-btn icon="mdi-close" @click="isEditing = false"></v-btn>
    </template>
</template>

<script setup>
import { Field } from '@/krypt-pad-profile';
import { ref } from 'vue';

const props = defineProps({ field: Field });
const emit = defineEmits(['renamed']);

const isEditing = ref(false);
const fieldName = ref(props.field?.name);

// Event handler
function saveField() {
    emit("renamed", { field: props.field, fieldName: fieldName.value });

    isEditing.value = false;
}

</script>