<template>
    <v-navigation-drawer permanent elevation="3">
        <v-list>
            <v-list-item v-if="!isAdding">
                <v-list-item-title>CATEGORIES</v-list-item-title>
                <template v-slot:append>
                    <v-btn icon="mdi-plus" @click="isAdding = true"></v-btn>
                </template>
            </v-list-item>

            <v-list-item v-else>
                <!-- Component to add categories to the list -->
                <value-text-field @closed="isAdding = false" @save="addCategory"></value-text-field>
            </v-list-item>
        </v-list>

        <v-divider></v-divider>

        <v-card>
            <v-list>
                <!-- All items -->
                <v-list-item @click="categorySelected(null)" prepend-icon="mdi-all-inclusive">
                    <v-list-item-title>ALL</v-list-item-title>
                </v-list-item>

                <v-list-item @click="categorySelected(null, true)" prepend-icon="mdi-star">
                    <v-list-item-title>STARRED</v-list-item-title>
                </v-list-item>

                <!-- User defined categories -->
                <category-list-item
                    v-for="(category, index) in categories"
                    :name="category.name"
                    :key="index"
                    :active="selectedCategory === category"
                    @click="categorySelected(category)"
                    @updated="categoryUpdated(category, $event)"
                >
                </category-list-item>
            </v-list>
        </v-card>
    </v-navigation-drawer>

    <v-app-bar>
        <!-- Search and other things -->
        <v-icon icon="mdi-magnify" class="ml-3"></v-icon>
        <v-text-field v-model="searchText" type="type" class="mx-3" label="search" :clearable="true" :hide-details="true"></v-text-field>

        <template v-slot:append>
            <!-- Add new item -->
            <v-tooltip text="Add new item">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" color="secondary" variant="tonal" icon="mdi-plus" @click="addItemAsync"></v-btn>
                </template>
            </v-tooltip>
        </template>
    </v-app-bar>

    <!-- Main content for cards -->
    <v-main :scrollable="true">
        <v-container fluid class="d-flex flex-wrap">
            <!-- List of items -->
            <v-card v-for="item in filteredItems" :key="item.id" width="20rem" @click="itemSelected(item)" class="mr-3 mb-3">
                <v-card-title class="d-flex">
                    <span class="mr-3 text-truncate">{{ item.name }}</span>

                    <v-chip class="ml-auto" color="info" v-if="item.categoryId">{{ getCategory(item)?.name }}</v-chip>
                </v-card-title>

                <v-card-actions>
                    <v-btn icon="mdi-star" :color="item.starred ? 'yellow' : undefined" @click.stop="item.starred = !item.starred"></v-btn>
                </v-card-actions>
            </v-card>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import ValueTextField from '@/components/ValueTextField.vue'
import CategoryListItem from '@/components/CategoryListItem.vue'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import KryptPadAPI from '@/krypt-pad-api'
import { Category, Item, IDecryptedItem, IDecryptedCategory } from '@/krypt-pad-profile'

const router = useRouter()

// Inject Krypt Pad's core functionality
const kpAPI = inject<KryptPadAPI>('kpAPI')!

// Make sure we have a profile loaded or else redirect to the Start page
kpAPI.redirectToStartWhenNoProfile()

const isAdding = ref(false)
const selectedCategory = ref<IDecryptedCategory | null>(null)
const allStarred = ref(false)
const searchText = ref<string | null>(null)

// Map the decrypted categories from the profile
const categories = ref<Array<IDecryptedCategory>>([])
for (const category of kpAPI.profile.value?.categories ?? []) {
    // Decrypt the category and add it to the list
    categories.value.push(await category.decrypt(kpAPI.passphrase.value))
}

// Map the decrypted items from the profile
const items: Array<IDecryptedItem> = []
for (const item of kpAPI.profile.value?.items ?? []) {
    // Decrypt the item and add it to the list
    items.push(await item.decrypt(kpAPI.passphrase.value))
}

// Computed
const filteredItems = computed(() => {
    return items?.filter(
        (item) =>
            // Filter for category and starred
            ((!allStarred.value && !selectedCategory.value) ||
                (allStarred.value === item.starred && !selectedCategory.value) ||
                (selectedCategory.value && item.categoryId === selectedCategory.value.id)) &&
            // Filter search text
            (!searchText.value || item.name?.toLowerCase().includes(searchText.value?.toLowerCase()))
    )
})

/**
 * Adds a new category to the profile
 * @param title The title for the new category
 */
async function addCategory(title: string) {
    if (!kpAPI.passphrase.value) {
        return
    }

    const category = new Category(undefined)
    const categoryData: IDecryptedCategory = {
        id: category.id,
        name: title
    }

    await category.encrypt(categoryData, kpAPI.passphrase.value)

    // Add the category to the profile
    kpAPI.profile.value?.categories.push(category)
    // Add the decrypted category to the list
    categories.value.push(categoryData)
}

/**
 * Gets the category for an item
 * @param {Item} item
 */
function getCategory(item: IDecryptedItem): IDecryptedCategory | undefined {
    // Look up category and return it
    const category = categories.value.find((c) => c.id === item.categoryId)
    return category
}

function categorySelected(category: IDecryptedCategory | null, starred?: boolean) {
    selectedCategory.value = category
    allStarred.value = starred ?? false
}

async function categoryUpdated(category: IDecryptedCategory, title: string) {
    // Find the category in the profile
    const c = kpAPI.profile.value?.categories.find((c) => c.id === category.id)
    // Update the category in the profile
    category.name = title
    await c?.encrypt(category, kpAPI.passphrase.value)
}

async function addItemAsync() {
    // Create new item within the selected category
    const item = new Item(undefined)

    // Create a decrypted item
    const itemData: IDecryptedItem = {
        id: item.id,
        name: 'Untitled',
        starred: false,
        categoryId: selectedCategory.value?.id,
        notes: undefined
    }

    await item.encrypt(itemData, kpAPI.passphrase.value)

    // Add the item to the global items list
    kpAPI.profile.value?.items.push(item)
    // Go to item page
    router.push({ name: 'item', params: { id: item.id } })
}

function itemSelected(item: IDecryptedItem) {
    router.push({ name: 'item', params: { id: item.id } })
}
</script>

<!-- <style scoped>
.v-input__append>button {
  margin-top: calc(var(--v-input-padding-top) / 2 * -1);
}
</style> -->
