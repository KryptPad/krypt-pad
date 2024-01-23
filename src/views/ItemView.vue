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
                    <v-combobox v-model="item.categoryId" class="flex-grow-0" label="category" :items="categories"
                        item-value="id" :return-object="false"></v-combobox>
                </v-col>
            </v-row>

            <div class="flex-fill d-flex mb-3">
                <v-textarea :model-value="item.notes" @change="item.notes = $event.target.value" label="notes"
                    class="d-flex flex-column fill-height mr-3" :hide-details="true"></v-textarea>

                <div class="">
                    Add any additioal data fields you need.

                    <v-btn v-if="!isEditing" color="secondary" variant="tonal" @click="isEditing = true" :block="true">ADD
                        FIELD</v-btn>

                    <v-card v-else class="my-3" @keypress.enter="addField" @keypress.esc="isEditing = false">
                        <v-card-text>
                            <v-text-field v-model="fieldName" label="field name" placeholder="e.g. password"
                                autofocus></v-text-field>
                            <v-btn color="primary" icon="mdi-check" class="mr-3" @click="addField"></v-btn>
                            <v-btn icon="mdi-close" @click="isEditing = false"></v-btn>
                        </v-card-text>

                    </v-card>

                    <v-card v-for="(_, index) in item.fields" :key="index" class="mt-2">
                        <v-card-text>
                            <name-value v-model="item.fields[index]" @delete="onDeleteField"></name-value>
                        </v-card-text>

                    </v-card>


                </div>
            </div>

            <div class="d-flex align-items-center">
                <v-btn-group>
                    <v-btn variant="tonal" prepend-icon="mdi-arrow-left" text="BACK" @click="backHome"></v-btn>
                </v-btn-group>

                <v-btn-group class="ml-auto">

                    <v-btn color="red-accent-2" variant="tonal" prepend-icon="mdi-delete" text="DELETE"
                        @click="deleteItem"></v-btn>
                </v-btn-group>

            </div>
            <confirm-dialog ref="confirmDialog1"></confirm-dialog>

        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { Item, Field, IIdTitle } from '@/krypt-pad-profile';
import { ref, inject, computed } from 'vue';
import { useRouter } from 'vue-router';
import NameValue from '@/components/NameValue.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import KryptPadAPI from '@/krypt-pad-api';

const router = useRouter();

const kpAPI = inject<KryptPadAPI>("kpAPI")!;
kpAPI.redirectToStartWhenNoProfile();

const confirmDialog1 = ref<InstanceType<typeof ConfirmDialog>>();
const props = defineProps({ id: String });
const isEditing = ref(false);
const fieldName = ref<string | null>(null);

// Find the item by its id
const item = kpAPI.profile.value?.items.find((item: Item) => item.id === props.id);

const categories = computed(() => {
    // Create a default selection from the interface
    const defaultSelection: IIdTitle = {
        id: null,
        title: "None"
    }

    // If the profile is null, just return the default selection.
    if (!kpAPI.profile.value) { return [defaultSelection]; }

    return [defaultSelection, ...kpAPI.profile.value.categories];
})

// Event handlers
function addField() {
    if (!fieldName.value) { return; }

    isEditing.value = false;
    // Add the field to the profile
    item?.fields.push(new Field(fieldName.value, null));
    // Clear field name
    fieldName.value = null;
}

function backHome() {
    router.back();
}

async function deleteItem() {
    if (!kpAPI.profile.value || !item) { return; }

    if (!await confirmDialog1.value?.confirm('Are you sure you want to delete this item?')) {
        return;

    }

    // Remove item from list
    const index = kpAPI.profile.value.items.indexOf(item);
    if (index > -1) {
        kpAPI.profile.value.items.splice(index, 1);
        // Go back to the home page
        router.back();
    }
}

async function onDeleteField(field: Field) {
    if (!item) { return; }

    if (!await confirmDialog1.value?.confirm('Are you sure you want to delete this field?')) {
        return;

    }

    // Remove field from list
    const index = item.fields.indexOf(field);
    if (index > -1) {
        item.fields.splice(index, 1);

    }
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