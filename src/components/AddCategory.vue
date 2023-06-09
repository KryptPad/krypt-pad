<template>
    <div class="mb-1">
        <v-text-field v-model="title" type="text" label="category name" :rules="rules" hide-details="auto" class="mb-3"
            autofocus>
        </v-text-field>

        <v-btn color="primary" icon="mdi-check" class="mr-3" @click="addCategory"></v-btn>
        <v-btn icon="mdi-close" @click="close"></v-btn>
    </div>
</template>

<script setup>
import kpAPI from '@/krypt-pad-api';
import { Category } from '@/krypt-pad-profile';
import { ref } from 'vue';

const title = ref();
const rules = [
    value => !!value || 'Required.'
];

const emit = defineEmits(['closed']);

// Event handlers
function addCategory() {
    // Add the category to the profile
    kpAPI.profile.categories.push(new Category(null, title));
    
    close();
}

function close() {
    emit('closed');
}

</script>