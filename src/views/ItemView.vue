<template>
    <v-main v-if="item" :scrollable="true">
        <v-container class="d-flex flex-column h-100 ">
            <v-row class="flex-grow-0">
                <v-col>
                    <!-- We are not using v-model here because v-model.lazy does not work on custom components. And We
                    do not want to trigger file update on every keypress! -->
                    <v-text-field v-model="item.title" type="text"
                        class="flex-grow-0" label="card name" :autofocus="true"
                        placeholder="enter the name of the card (e.g. My Bank Account)"></v-text-field>
                </v-col>
                <v-col>
                    <v-combobox v-model="item.categoryId" class="flex-grow-0" label="category"
                        :items="kpAPI.profile?.categories" item-value="id" :return-object="false"></v-combobox>
                </v-col>
            </v-row>

            <div class="flex-fill d-flex">
                <v-textarea v-model="item.notes" label="notes"
                    class="d-flex flex-column fill-height mr-3" hide-details="true"></v-textarea>

                <div class="">
                    Add any additioal data fields you need.
                </div>
            </div>
        </v-container>
    </v-main>
</template>

<script setup>
import { inject } from 'vue';
const kpAPI = inject("kpAPI");
kpAPI.redirectToStartWhenNoProfile();

const props = defineProps({ id: String });
const item = kpAPI.profile.items.find((item) => item.id === props.id);


</script>

<style>
.v-textarea>.v-input__control {
    height: 100%;
}

.v-textarea textarea.v-field__input {
    height: 100%;
}
</style>