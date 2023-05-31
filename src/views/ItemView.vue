<template>
    <v-main scrollable="true">
        <v-container class="d-flex flex-column h-100 ">
            <v-text-field type="text" class="flex-grow-0" label="card name" placeholder="enter the name of the card (e.g. My Bank Account)"></v-text-field>
            <div class="flex-fill d-flex">
                <v-textarea label="notes" class="flex-fill h-100" hide-details="true" ></v-textarea>

                <div class="">
                    fields
                </div>
            </div>
        </v-container>
    </v-main>
</template>

<script setup>

defineProps({id: String});

</script>