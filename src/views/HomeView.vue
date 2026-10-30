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
                <v-list-item @click="categorySelected(allCategory)" prepend-icon="mdi-all-inclusive" :active="selectedCategory?.id === ALL">
                    <v-list-item-title>{{ allCategory.name }}</v-list-item-title>
                </v-list-item>

                <v-list-item @click="categorySelected(starredCategory)" prepend-icon="mdi-star" :active="selectedCategory?.id === STARRED">
                    <v-list-item-title>{{ starredCategory.name }}</v-list-item-title>
                </v-list-item>

                <!-- User defined categories -->
                <category-list-item
                    v-for="category in categories"
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
            <v-btn size="large" color="primary" prepend-icon="mdi-plus" @click="addItemAsync">Add new</v-btn>
        </template>
    </v-app-bar>

    <!-- Main content for cards -->
    <v-main :scrollable="true">
        <v-container fluid class="d-flex flex-wrap pa-3">
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
import { Category, Item } from '@/krypt-pad-profile'
import { ICategoryDescriptor } from '@/interfaces'

const router = useRouter()

// Inject Krypt Pad's core functionality
const kpAPI = inject<KryptPadAPI>('kpAPI')!

// Make sure we have a profile loaded or else redirect to the Start page
kpAPI.redirectToStartWhenNoProfile()

// Default category filters
const ALL = 'all'
const STARRED = 'starred'

const isAdding = ref(false)
const searchText = ref<string | null>(null)
const categories = ref<Array<ICategoryDescriptor>>([])
const allCategory: ICategoryDescriptor = { name: 'ALL', id: ALL }
const starredCategory: ICategoryDescriptor = { name: 'STARRED', id: STARRED }
const items = ref<Array<Item>>([])
// Selected category. Defaults to ALL
const selectedCategory = ref<ICategoryDescriptor>(allCategory)

// Computed
const filteredItems = computed(() => {
    const fi = items.value?.filter((item) => {
        // Category filter. Filter out any items that are not the selected category and if the category is not the all items category
        if (selectedCategory.value?.id !== ALL && selectedCategory.value.id !== STARRED) {
            if (selectedCategory.value && item.categoryId !== selectedCategory.value.id) {
                return false
            }
        }
        
        // Filter out any items that are not starred if the starred category is selected
        if (selectedCategory.value?.id === STARRED && !item.starred) {
            return false
        }

        // Text search filter
        if (searchText.value && !item.name?.toLowerCase().includes(searchText.value?.toLowerCase())) {
            return false
        }
        return true
    })

    return fi
})

onActivated(async () => {
    await getCategories()
    await getItems()
})

/**
 * Gets categories from the unlocked profile
 */
async function getCategories() {
    if (!kpAPI.profile.value) {
        categories.value = []
        return
    }

    // Convert the profile categories
    categories.value = kpAPI.profile.value.categories.map((c) => {
        return { name: c.name, id: c.id } as ICategoryDescriptor
    })
}

/**
 * Adds a new category to the profile
 * @param title The title for the new category
 */
async function addCategory(title: string) {
    const category = new Category(undefined)
    category.name = title

    // Add the category to the profile
    kpAPI.profile.value?.categories.push(category)
    // Commit the profile
    await kpAPI.commitProfileAsync()

    // Push the new category into the list
    categories.value.push({ name: category.name, id: category.id })
}

/**
 * Gets the category for an item
 */
function getCategory(item: Item): Category | undefined {
    const category = categories.value.find((c) => c.id === item.categoryId)
    return category
}

/**
 * Handles when a category is selected from the list
 * @param category The category that was selected or null for all items
 * @param starred Whether to show starred items only
 */
function categorySelected(category: ICategoryDescriptor) {
    selectedCategory.value = category
}

/**
 * Updates a category's title
 */
async function categoryUpdated(category: Category, title: string) {
    const c = kpAPI.profile.value?.categories.find((c) => c.id === category.id)
    category.name = title
    if (c) {
        c.name = title
    }
    await kpAPI.commitProfileAsync()
}

/**
 * Deletes a category
 */
async function onDeleteCategory(category: Category) {
    await kpAPI.deleteCategory(kpAPI.profile.value?.categories.find((c) => c.id === category.id) as Category)
    await getCategories()
    await getItems()
    // Deselect if it was selected
    if (selectedCategory.value?.id === category.id) {
        selectedCategory.value = allCategory
    }
}

/**
 * Adds a new item to the profile
 */
async function addItemAsync() {
    const item = new Item(undefined)
    item.name = 'Untitled'
    item.starred = false
    item.categoryId = selectedCategory.value?.id
    item.notes = undefined
    item.fields = []

    kpAPI.profile.value?.items.push(item)
    await kpAPI.commitProfileAsync()
    itemSelected(item)
}

/**
 * Toggles the starred state of an item
 */
function toggleStarred(itemData: Item) {
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
function itemSelected(item: Item) {
    router.push({ name: 'item', params: { id: item.id } })
}

/**
 * Gets the items from the unlocked profile
 */
async function getItems() {
    items.value = kpAPI.profile.value?.items ?? []
}
</script>
