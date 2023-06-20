<template>
  <v-app>

    <!-- Title bar -->
    <v-sheet>
      <title-bar title="Krypt Pad">

        <template v-slot:icon>
          <img src="./assets/safe.svg" alt="Logo" style="height: 24px" />
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

      <!-- App side bar -->
      <v-navigation-drawer permanent rail>

        <!-- Top icons -->
        <v-list nav class="d-flex flex-column h-100">
          <v-tooltip text="Home">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-home-city" title="Home" value="home"
                :to="{ name: 'home' }"></v-list-item>
            </template>
          </v-tooltip>


          <v-tooltip text="Donate">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-heart" title="Donate" value="donate"
                :to="{ name: 'donate' }"></v-list-item>
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

      <!-- Display router view components here -->
      <router-view>
      </router-view>

    </v-layout>

    <!-- Passphrase prompt -->
    <passphrase-prompt ref="passphrasePrompter" :passphrase-is-new="passphraseIsNew"
      @closed="passphraseDialogClosed"></passphrase-prompt>

    <confirm-dialog ref="confirmDialog1"></confirm-dialog>
  </v-app>
</template>

<script setup>
import TitleBar from './components/TitleBar.vue';
import PassphrasePrompt from './components/PassphrasePrompt.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import { provide, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';

// Import the krypt-pad api
import kpAPI from '@/krypt-pad-api';

// Provide the krypt pad API for other components to inject
provide("kpAPI", kpAPI);

// Data
const passphrasePrompter = ref(null);
const passphraseIsNew = ref(false);
const confirmDialog1 = ref(null);

// Initialize the API
kpAPI.router = useRouter();
kpAPI.route = useRoute();
kpAPI.confirmDialog = confirmDialog1;

let passphraseResolve;
//let passphraseReject;

// Define menu items
const menuItems = [
  {
    title: "File",
    items: [
      { title: "Create New File", handler: kpAPI.createNewFileAsync },
      { title: "Import KDF File" },
      { title: "Open File", handler: kpAPI.openExistingFileAsync },
      { title: "Close File", handler: kpAPI.closeFile }
    ]
  }
];


// Create callback handler for passprhase prompt. When passphrase is required, this callback will be fired.
kpAPI.onRequirePassphrase((isNew) => {
  passphraseIsNew.value = isNew;
  passphrasePrompter.value.show();
  return new Promise((resolve) => {
    passphraseResolve = resolve;
    //passphraseReject = reject;
  });
});

// Events
function passphraseDialogClosed(passphrase) {
  passphraseResolve(passphrase);
}

</script>

<style lang="scss">
html {
  overflow: hidden;
}
</style>
