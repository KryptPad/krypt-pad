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

    <v-card class="mx-auto">
      <v-list>
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
          <v-btn v-bind="props" icon="mdi-plus" :to="{name: 'item'}"></v-btn>
        </template>
      </v-tooltip>

    </template>

  </v-app-bar>

  <!-- Main content for cards -->
  <v-main :scrollable="true">

    <v-container fluid class="d-flex">
      <v-card width="20rem">
        <v-card-title>Sample card</v-card-title>
      </v-card>
    </v-container>

  </v-main>
</template>

<script setup>
import { inject, ref } from 'vue';
import AddCategory from '@/components/AddCategory.vue';
import CategoryListItem from '@/components/CategoryListItem.vue';
import { useRouter } from 'vue-router';

// Inject Krypt Pad's core functionality
const kpAPI = inject("kpAPI");

// Check if there is not an open profile
if (!kpAPI.fileOpened) {
  useRouter().push({ name: "start" });
}

const isAdding = ref(false);
const selectedCategory = ref(null);

// Event handlers
function categorySelected(category) {
  console.log(category)
  selectedCategory.value = category;
}

</script>

<!-- <style scoped>
.v-input__append>button {
  margin-top: calc(var(--v-input-padding-top) / 2 * -1);
}
</style> -->