<template>
    <v-main v-if="item" :scrollable="true">
        <v-container class="d-flex flex-column h-100 ">
            <v-row class="flex-grow-0">
                <v-col>
                    <!-- We are not using v-model here because v-model.lazy does not work on custom components. And We
                    do not want to trigger file update on every keypress! -->
                    <v-text-field :model-value="item.title" @change="item.title = $event.target.value" type="text"
                        class="flex-grow-0" label="card name" :autofocus="true"
                        placeholder="enter the name of the card (e.g. My Bank Account)"></v-text-field>
                </v-col>
                <v-col>
                    <v-combobox v-model="item.categoryId" class="flex-grow-0" label="category"
                        :items="kpAPI.profile?.categories" item-value="id" :return-object="false"></v-combobox>
                </v-col>
            </v-row>

            <div class="flex-fill d-flex">
                <v-textarea :model-value="item.notes" @change="item.notes = $event.target.value" label="notes"
                    class="d-flex flex-column fill-height mr-3" hide-details="true"></v-textarea>

                <div class="">
                    Add any additioal data fields you need.

                    <v-btn v-if="!isEditing" color="secondary" @click="isEditing = true" block="true">ADD FIELD</v-btn>

                    <v-card v-else class="my-3" @keypress.enter="addField" @keypress.esc="isEditing = false">
                        <v-card-text>
                            <v-text-field label="field name" placeholder="e.g. password"></v-text-field>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn color="primary" icon="mdi-check" class="mr-3" @click="addField"></v-btn>
                            <v-btn icon="mdi-close" @click="isEditing = false"></v-btn>
                        </v-card-actions>
                    </v-card>


                </div>
            </div>
        </v-container>
    </v-main>
</template>

<script setup>
import { ref, inject } from 'vue';
const kpAPI = inject("kpAPI");
kpAPI.redirectToStartWhenNoProfile();

const props = defineProps({ id: String });
const isEditing = ref(false);
const item = kpAPI.profile.items.find((item) => item.id === props.id);

// Event handlers
function addField() {

    isEditing.value = false;
}


</script>

<style>
.v-textarea>.v-input__control {
    height: 100%;
}

.v-textarea textarea.v-field__input {
    height: 100%;
}
</style>