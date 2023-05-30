<template>
  <v-navigation-drawer permanent>
    <v-list>
      <v-list-item v-if="!isAdding">
        <v-list-item-title> Categories </v-list-item-title>
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

    <v-card class="mx-auto" max-width="300">
      <v-list>
        <v-list-item v-for="(category, index) in kpAPI.profile?.categories" :key="index" :value="index"
          @click="categorySelected(category)">
          <v-list-item-title>{{ category.title }}</v-list-item-title>
          <template v-slot:append>
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn icon="mdi-dots-vertical" v-bind="props"></v-btn>
              </template>

              <v-list>
                <v-list-item prepend-icon="mdi-rename" value="rename">
                  <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>

                <v-list-item prepend-icon="mdi-delete" value="delete" @click="kpAPI.deleteCategory(category)">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </v-navigation-drawer>
</template>

<script setup>
import { inject, ref } from 'vue';
import AddCategory from '@/components/AddCategory.vue';

// Inject Krypt Pad's core functionality
const kpAPI = inject("kpAPI");

const isAdding = ref(false);

// Event handlers
function categorySelected(category) {
  console.log(category)
}

//function deleteCategory(){}
</script>

<!-- <style scoped>
.v-input__append>button {
  margin-top: calc(var(--v-input-padding-top) / 2 * -1);
}
</style> -->