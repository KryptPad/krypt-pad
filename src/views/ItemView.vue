<template>
    <v-main v-if="decryptedItem" :scrollable="true">
        <v-container class="d-flex flex-column h-100">
            <v-row class="flex-grow-0">
                <v-col>
                    <!-- We are not using v-model here because v-model.lazy does not work on custom components. And We
                    do not want to trigger file update on every keypress! -->
                    <v-text-field
                        :model-value="decryptedItem.name"
                        @change="decryptedItem.name = $event.target.value"
                        type="text"
                        class="flex-grow-0"
                        label="card name"
                        :autofocus="true"
                        placeholder="enter the name of the card (e.g. My Bank Account)"
                    ></v-text-field>
                </v-col>
                <v-col>
                    <v-combobox
                        v-model="decryptedItem.categoryId"
                        class="flex-grow-0"
                        label="category"
                        :items="categories"
                        item-value="id"
                        item-title="name"
                        :return-object="false"
                    ></v-combobox>
                </v-col>
            </v-row>

            <div class="flex-fill d-flex mb-3">
                <v-textarea
                    :model-value="decryptedItem.notes"
                    @change="decryptedItem.notes = $event.target.value"
                    label="notes"
                    class="d-flex flex-column fill-height mr-3"
                    :hide-details="true"
                ></v-textarea>

                <div class="">
                    Add any additioal data fields you need.

                    <v-btn v-if="!isEditing" color="secondary" variant="tonal" @click="isEditing = true" :block="true">ADD FIELD</v-btn>

                    <v-card v-else class="my-3" @keypress.enter="addField" @keypress.esc="isEditing = false">
                        <v-card-text>
                            <v-text-field v-model="fieldName" label="field name" placeholder="e.g. password" autofocus></v-text-field>
                            <v-btn color="primary" icon="mdi-check" class="mr-3" @click="addField"></v-btn>
                            <v-btn icon="mdi-close" @click="isEditing = false"></v-btn>
                        </v-card-text>
                    </v-card>

                    <v-card v-for="(_, index) in decryptedItem.fields" :key="index" class="mt-2">
                        <v-card-text>
                            <name-value v-model="decryptedItem.fields[index]" @delete="onDeleteField"></name-value>
                        </v-card-text>
                    </v-card>
                </div>
            </div>

            <div class="d-flex align-items-center">
                <v-btn-group>
                    <v-btn variant="tonal" prepend-icon="mdi-arrow-left" text="BACK" @click="backHome"></v-btn>
                </v-btn-group>

                <v-btn-group class="ml-auto">
                    <v-btn color="red-accent-2" variant="tonal" prepend-icon="mdi-delete" text="DELETE" @click="deleteItem"></v-btn>
                </v-btn-group>
            </div>
            <confirm-dialog ref="confirmDeletePrompt" color="red"></confirm-dialog>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { Item, Field, IDecryptedCategory, IDecryptedItem } from '@/krypt-pad-profile'
import { ref, inject, watch } from 'vue'
import { useRouter } from 'vue-router'
import NameValue from '@/components/NameValue.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import KryptPadAPI from '@/krypt-pad-api'

const router = useRouter()

const kpAPI = inject<KryptPadAPI>('kpAPI')!
kpAPI.redirectToStartWhenNoProfile()

const confirmDeletePrompt = ref<InstanceType<typeof ConfirmDialog>>()
const props = defineProps({ id: String })
const isEditing = ref(false)
const fieldName = ref<string | null>(null)

// Find the item by its id
const decryptedItem = ref<IDecryptedItem>()
// Store the decrypted categories
const categories = ref<Array<IDecryptedCategory>>()

// Event handlers
function addField() {
    if (!fieldName.value) {
        return
    }

    isEditing.value = false
    // Add the field to the profile
    decryptedItem.value?.fields.push(new Field(fieldName.value, null))
    // Clear field name
    fieldName.value = null
}

function backHome() {
    router.back()
}

/**
 * Delete the item from the profile
 */
async function deleteItem() {
    if (!kpAPI.profile.value || !decryptedItem) {
        return
    }

    if (!(await confirmDeletePrompt.value?.confirm('Are you sure you want to delete this item?'))) {
        return
    }

    // Find the item by its id
    const index = kpAPI.profile.value.items.findIndex((i: Item) => i.id === decryptedItem.value?.id)
    if (index > -1) {
        kpAPI.profile.value.items.splice(index, 1)
        // Go back to the home page
        router.back()
    }
}

/**
 * Delete a field from the item
 * @param {Field} field
 */
async function onDeleteField(field: Field) {
    if (!decryptedItem) {
        return
    }

    if (!(await confirmDeletePrompt.value?.confirm('Are you sure you want to delete this field?'))) {
        return
    }

    // Remove field from list
    const index = decryptedItem.value?.fields.indexOf(field)
    if (index && index > -1) {
        decryptedItem.value?.fields.splice(index, 1)
    }
}

/**
 * Load the item from the profile
 */
async function initData() {
    // Create a default selection from the interface
    const defaultSelection: IDecryptedCategory = {
        id: undefined,
        name: 'None'
    }

    // If the profile is null, just return the default selection.
    if (!kpAPI.profile.value) {
        return [defaultSelection]
    }

    const profileCategories = await kpAPI.profile.value.getCategories(kpAPI.passphrase.value)

    categories.value = [defaultSelection, ...profileCategories]
    console.log(categories.value)
    decryptedItem.value = await kpAPI.profile.value?.items.find((item: Item) => item.id === props.id)?.decrypt(kpAPI.passphrase.value)
}

initData()

// Watch for changes in the item
watch(decryptedItem, async () => {
    if (decryptedItem.value) {
        // Encrypt and save the item
        kpAPI.profile.value?.items.find((item: Item) => item.id === props.id)
        //await item.value.encrypt(kpAPI.passphrase.value)
    }
})
</script>

<style>
.v-textarea > .v-input__control {
    height: 100%;
}

.v-textarea textarea.v-field__input {
    height: 100%;
}
</style>
