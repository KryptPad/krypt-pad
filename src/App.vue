<template>
  <v-app>

    <!-- Title bar -->
    <v-sheet>
      <title-bar title="Krypt Pad">

        <template v-slot:icon>
          <img src="./assets/safe.svg" alt="Logo" style="height: 1.8rem" />
        </template>

        <!-- Menu items -->
        <template v-slot:menu>

          <v-menu v-for="(menu, menuIndex) in menuItems" :key="menuIndex">

            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="small" flat>{{ menu.title }}</v-btn>
            </template>

            <v-list>
              <v-list-item v-for="(item, itemIndex) in menu.items" :key="itemIndex" :value="itemIndex"
                @click="item.handler">
                <v-list-item-title>{{ item.title }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

        </template>
      </title-bar>
    </v-sheet>

    <v-layout>

      <v-navigation-drawer permanent rail>

        <!-- Top icons -->
        <v-list nav class="d-flex flex-column h-100">
          <v-tooltip text="Home">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-home-city" title="Home" value="home" :to="{ name: 'home' }"></v-list-item>
            </template>
          </v-tooltip>
          

          <v-tooltip text="Starred">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-star" title="Starred" value="starred"
                :disabled="!kpAPI.fileOpened"></v-list-item>
            </template>
          </v-tooltip>


          <!-- Bottom icons -->
          <v-tooltip text="Settings">
            <template v-slot:activator="{ props }">
              <v-list-item class="mt-auto" v-bind="props" prepend-icon="mdi-cog" title="Settings" value="settings"
                :to="{ name: 'settings' }"></v-list-item>
            </template>
          </v-tooltip>
        </v-list>

      </v-navigation-drawer>

      <!-- Main content -->
      <v-main :scrollable="true">
        <v-container class="h-100 align-start d-flex">
          <router-view>
          </router-view>

        </v-container>
      </v-main>

    </v-layout>

  </v-app>
</template>

<script setup>
import { provide } from 'vue';
import TitleBar from './components/TitleBar.vue';
import { reactive } from 'vue';

const kpAPI = reactive({
  fileOpened: false,
  // Methods
  /**
  * Create a new file
  */
  createNewFile() {
    // If there is already a file open, prompt the user if they are sure they want to create a new file

    // Open save dialog to allow user to save a new file

    // Clear out the old file

    // Prompt for new passphrase

    // Set fileOpen flag
    kpAPI.fileOpened = true;
  }
})

// Provide the krypt pad API for other components to inject
provide("kpAPI", kpAPI);

// Define menu items
const menuItems = [
  {
    title: "File",
    items: [
      { title: "Create New File", handler: kpAPI.createNewFile },
      { title: "Import KDF File" }
    ]
  }
];

</script>

<style lang="scss">
// With custom title bar, we need to make some CSS adjustments
html {
  overflow: auto;
}

#app {
  height: 100%;
}

textarea {
  resize: none;
  outline: none;
  padding: 1rem;
  color: #fff;
}
</style>