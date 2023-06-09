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
        <add-category @closed="isAdding = false"></add-category>
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
        <category-list-item v-for="(category, index) in kpAPI.profile?.categories" :category="category" :key="index"
          :active="selectedCategory === category" @click="categorySelected(category)">
        </category-list-item>

      </v-list>
    </v-card>
  </v-navigation-drawer>

  <v-app-bar>

    <!-- Search and other things -->
    <v-text-field type="type" class="mx-3" label="search" :clearable="true" hide-details="true"></v-text-field>
    <v-btn icon="mdi-magnify"></v-btn>

    <template v-slot:append>

      <!-- Add new item -->
      <v-tooltip text="Add new item">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon="mdi-plus" @click="addItemAsync"></v-btn>
        </template>
      </v-tooltip>

    </template>

  </v-app-bar>

  <!-- Main content for cards -->
  <v-main :scrollable="true">

    <v-container fluid class="d-flex flex-wrap">
      <v-card v-for="item in filteredItems" :key="item.id" width="20rem" @click="itemSelected(item)" class="mr-3 mb-3">
        <v-card-title>{{ item.title }}</v-card-title>
        <v-card-actions>
          <v-btn icon="mdi-star" :color="item.starred ? 'yellow' : null" @click.stop="item.starred = !item.starred"></v-btn>
        </v-card-actions>
      </v-card>
    </v-container>

  </v-main>
</template>

<script setup>
import { inject, ref } from 'vue';
import AddCategory from '@/components/AddCategory.vue';
import CategoryListItem from '@/components/CategoryListItem.vue';
import { useRouter } from 'vue-router';
import { computed } from 'vue';

const router = useRouter();

// Inject Krypt Pad's core functionality
const kpAPI = inject("kpAPI");
kpAPI.redirectToStartWhenNoProfile();

const isAdding = ref(false);
const selectedCategory = ref(null);
const allStarred = ref(false);

// Computed
const filteredItems = computed(() => {
  return kpAPI.profile?.items?.filter((item) => !allStarred.value && !selectedCategory.value || allStarred.value === item.starred && !selectedCategory.value || selectedCategory.value && item.categoryId === selectedCategory.value.id);
});

// Event handlers
function categorySelected(category, starred) {
  console.log(starred)
  selectedCategory.value = category;
  allStarred.value = starred;
}

async function addItemAsync() {
  // Create new item within the selected category
  const item = await kpAPI.addItemAsync(selectedCategory.value?.id, null);
  router.push({ name: 'item', params: { id: item.id } });
}

function itemSelected(item){
  router.push({ name: 'item', params: { id: item.id } });
}

</script>

<!-- <style scoped>
.v-input__append>button {
  margin-top: calc(var(--v-input-padding-top) / 2 * -1);
}
</style> -->