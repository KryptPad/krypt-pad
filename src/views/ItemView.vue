<template>
    <v-main v-if="currentItem" :scrollable="true">
        <v-container class="d-flex flex-column h-100" max-width="none">
            <v-row class="flex-grow-0">
                <v-col>
                    <v-text-field
                        v-model="currentItem.name"
                        type="text"
                        class="flex-grow-0"
                        label="card name"
                        :autofocus="true"
                        placeholder="enter the name of the card (e.g. My Bank Account)"
                    ></v-text-field>
                </v-col>
                <v-col>
                    <v-combobox
                        v-model="currentItem.categoryId"
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
                <v-textarea v-model="currentItem.notes" label="notes" class="d-flex flex-column fill-height mr-3" :hide-details="true"></v-textarea>

                <div class="">
                    Add any additional data fields you need.

                    <v-btn size="x-large" v-if="!isEditing" color="secondary" @click="isEditing = true" :block="true">ADD FIELD</v-btn>

                    <v-card v-else class="my-3" @keypress.enter="addField" @keypress.esc="isEditing = false">
                        <v-card-text>
                            <v-text-field v-model="fieldName" label="field name" placeholder="e.g. password" autofocus></v-text-field>
                            <v-btn color="primary" icon="mdi-check" class="mr-3" @click="addField"></v-btn>
                            <v-btn icon="mdi-close" @click="isEditing = false"></v-btn>
                        </v-card-text>
                    </v-card>

                    <v-card v-for="(_, index) in currentItem.fields" :key="index" class="mt-2">
                        <v-card-text>
                            <name-value v-model="currentItem.fields[index]" @delete="onDeleteField"></name-value>
                        </v-card-text>
                    </v-card>

                    <!-- Attachments, stored encrypted next to the vault -->
                    <div class="mt-6">Attach files to keep them encrypted with this item.</div>
                    <v-btn size="x-large" color="secondary" prepend-icon="mdi-paperclip" :block="true" @click="addAttachments">ATTACH FILES</v-btn>

                    <v-list v-if="currentItem.attachments.length" class="mt-2">
                        <v-list-item
                            v-for="attachment in currentItem.attachments"
                            :key="attachment.id"
                            prepend-icon="mdi-file-lock"
                            :title="attachment.name"
                            :subtitle="formatFileSize(attachment.size)"
                        >
                            <template v-slot:append>
                                <v-btn
                                    icon="mdi-content-save"
                                    variant="text"
                                    title="Save a decrypted copy"
                                    @click="kpAPI.saveAttachmentAsAsync(attachment)"
                                ></v-btn>
                                <v-btn icon="mdi-delete" variant="text" title="Remove" @click="onRemoveAttachment(attachment)"></v-btn>
                            </template>
                        </v-list-item>
                    </v-list>
                </div>
            </div>

            <div class="d-flex align-items-center">
                <v-btn-group>
                    <v-btn size="x-large" color="primary" prepend-icon="mdi-arrow-left" text="Done" @click="backHome"></v-btn>
                </v-btn-group>

                <v-btn-group class="ml-auto">
                    <v-btn size="x-large" color="red-accent-2" prepend-icon="mdi-delete" text="DELETE" @click="deleteItem"></v-btn>
                </v-btn-group>
            </div>
            <confirm-dialog ref="confirmDeletePrompt" color="red" :danger-mode="true"></confirm-dialog>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { Item, Field, Attachment, IDecryptedCategory } from '@/krypt-pad-profile'
import { formatFileSize } from '@/utils'
import { ref, inject, onMounted, onBeforeUnmount, watch } from 'vue'
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
const item = ref<Item>()

const currentItem = ref<Item>()
const categories = ref<Array<IDecryptedCategory>>()

let unwatch: (() => void) | null = null

onMounted(async () => {
    await initData()
})

// The profile is replaced when it is reloaded, e.g. with changes from another
// device, so edits must go to the item in the new profile
const unwatchProfile = watch(kpAPI.profile, async (profile) => {
    if (!profile) {
        return
    }

    await initData()
    if (!item.value) {
        // Deleted elsewhere
        router.push({ name: 'home' })
    }
})

onBeforeUnmount(() => {
    unwatchProfile()
    if (unwatch) {
        unwatch()
        unwatch = null
    }
})

async function addAttachments() {
    if (currentItem.value) {
        await kpAPI.addAttachmentsAsync(currentItem.value)
    }
}

async function onRemoveAttachment(attachment: Attachment) {
    if (!currentItem.value) {
        return
    }

    if (!(await confirmDeletePrompt.value?.confirm(`Are you sure you want to remove ${attachment.name}?`))) {
        return
    }

    await kpAPI.removeAttachmentAsync(currentItem.value, attachment)
}

function addField() {
    if (!fieldName.value) {
        return
    }

    isEditing.value = false
    const newField = new Field(fieldName.value, null)
    currentItem.value?.fields?.push(newField)
    fieldName.value = null
}

function backHome() {
    router.back()
}

async function deleteItem() {
    if (!kpAPI.profile.value || !currentItem.value) {
        return
    }

    if (!(await confirmDeletePrompt.value?.confirm('Are you sure you want to delete this item?'))) {
        return
    }

    if (kpAPI.profile.value.deleteItem(currentItem.value)) {
        await kpAPI.commitProfileAsync()
        router.back()
    }
}

async function onDeleteField(field: Field) {
    if (!currentItem.value) {
        return
    }

    if (!(await confirmDeletePrompt.value?.confirm('Are you sure you want to delete this field?'))) {
        return
    }

    const index = currentItem.value?.fields?.indexOf(field)
    if (index !== undefined && index !== null && index > -1) {
        currentItem.value?.fields?.splice(index, 1)
    }
}

async function initData() {
    if (!kpAPI.profile.value) {
        return
    }

    const profileCategories = await kpAPI.profile.value.getCategories()
    const defaultSelection: IDecryptedCategory = { id: undefined, name: 'None' }
    categories.value = [defaultSelection, ...profileCategories]

    item.value = kpAPI.profile.value?.items.find((i: Item) => i.id === props.id)
    if (!item.value) {
        currentItem.value = undefined
        return
    }

    // Stop watching first, so switching to the reloaded item isn't taken for an edit
    if (unwatch) {
        unwatch()
        unwatch = null
    }

    currentItem.value = item.value

    // Create a single watcher, tracked so it can be cleaned up
    unwatch = watch(
        currentItem,
        (newItem) => {
            if (newItem) {
                // Debounced autosave so edits are persisted shortly after typing
                // stops without writing to disk on every keystroke.
                kpAPI.scheduleCommit()
            }
        },
        { deep: true }
    )
}
</script>

<style>
.v-textarea > .v-input__control {
    height: 100%;
}

.v-textarea textarea.v-field__input {
    height: 100%;
}
</style>
