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
                    v-for="(category) in categories"
                    :name="category.name"
                    :key="category.id"
                    :active="selectedCategory === category"
                    @click="categorySelected(category)"
                    @updated="categoryUpdated(category, $event)"
                    @deleted="onDeleteCategory(category)"
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
            <v-card elevation="3" v-for="item in filteredItems" :key="item.id" width="20rem" @click="itemSelected(item)" class="mr-3 mb-3">
                <v-card-title class="d-flex">
                    <span class="mr-3 text-truncate">{{ item.name }}</span>

                    <v-chip class="ml-auto" color="info" v-if="item.categoryId">{{ getCategory(item)?.name }}</v-chip>
                </v-card-title>

                <v-card-actions>
                    <v-btn icon="mdi-star" :color="item.starred ? 'yellow' : undefined" @click.stop="toggleStarred(item)"></v-btn>
                </v-card-actions>
            </v-card>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { inject, onActivated, ref } from 'vue'
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
const showOnlyStarred = ref(false)
const searchText = ref<string | null>(null)

const categories = ref<Array<IDecryptedCategory>>([])
const items = ref<Array<IDecryptedItem>>([])

// Computed
const filteredItems = computed(() => {
    const fi = items.value?.filter(
        (item) => {
            // Category / starred filter
            if (selectedCategory.value && item.categoryId !== selectedCategory.value.id) {
                return false
            }
            if (showOnlyStarred.value && !item.starred) {
                return false
            }
            // Text search filter
            if (searchText.value && !item.name?.toLowerCase().includes(searchText.value?.toLowerCase())) {
                return false
            }
            return true
        }
    )

    return fi
})

onActivated(async () => {
    await getCategories()
    await getItems()
})

/**
 * Decrypts categories from the profile
 */
async function getCategories() {
    categories.value = []
    if (!kpAPI.profile.value) {
        return
    }
    for (const category of kpAPI.profile.value.categories) {
        categories.value.push(await category.decrypt(kpAPI.passphrase.value))
    }
}

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
    // Commit the profile
    await kpAPI.commitProfileAsync()
    // Add the decrypted category to the list
    categories.value.push(categoryData)
}

/**
 * Gets the category for an item
 */
function getCategory(item: IDecryptedItem): IDecryptedCategory | undefined {
    const category = categories.value.find((c) => c.id === item.categoryId)
    return category
}

/**
 * Handles when a category is selected from the list
 * @param category The category that was selected or null for all items
 * @param starred Whether to show starred items only
 */
function categorySelected(category: IDecryptedCategory | null, starred?: boolean) {
    selectedCategory.value = category
    showOnlyStarred.value = starred ?? false
}

/**
 * Updates a category's title
 */
async function categoryUpdated(category: IDecryptedCategory, title: string) {
    const c = kpAPI.profile.value?.categories.find((c) => c.id === category.id)
    category.name = title
    await c?.encrypt(category, kpAPI.passphrase.value)
    await kpAPI.commitProfileAsync()
}

/**
 * Deletes a category
 */
async function onDeleteCategory(category: IDecryptedCategory) {
    await kpAPI.deleteCategory(
        kpAPI.profile.value?.categories.find((c) => c.id === category.id) as Category
    )
    await getCategories()
    await getItems()
    // Deselect if it was selected
    if (selectedCategory.value?.id === category.id) {
        selectedCategory.value = null
    }
}

/**
 * Adds a new item to the profile
 */
async function addItemAsync() {
    const item = new Item(undefined)

    const itemData: IDecryptedItem = {
        id: item.id,
        name: 'Untitled',
        starred: false,
        categoryId: selectedCategory.value?.id,
        notes: undefined,
        fields: []
    }

    await item.encrypt(itemData, kpAPI.passphrase.value)

    kpAPI.profile.value?.items.push(item)
    await kpAPI.commitProfileAsync()
    items.value?.push(itemData)
    itemSelected(itemData)
}

/**
 * Toggles the starred state of an item
 */
function toggleStarred(itemData: IDecryptedItem) {
    itemData.starred = !itemData.starred
    const item = kpAPI.profile.value?.items.find((it) => it.id === itemData.id)
    if (!item) {
        return
    }
    item.starred = itemData.starred
    kpAPI.commitProfileAsync()
}

/**
 * Handles when an item is selected from the list
 */
function itemSelected(item: IDecryptedItem) {
    router.push({ name: 'item', params: { id: item.id } })
}

/**
 * Gets the items from the profile and decrypts them
 */
async function getItems() {
    items.value = []
    for (const item of kpAPI.profile.value?.items ?? []) {
        items.value?.push(await item.decrypt(kpAPI.passphrase.value))
    }
}
</script>
