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
              <template v-for="(item, itemIndex) in menu.items" :key="itemIndex">

                <v-list-item v-if="!item.divider" :value="itemIndex" @click="item.handler"
                  :disabled="item.enabled !== undefined && item.enabled === false">
                  <div class="d-flex ">
                    <v-list-item-title>{{ item.title }}</v-list-item-title>

                    <span v-if="item.accelerator" class="ml-auto text-right text-medium-emphasis"><span class="ml-3">{{
                      item.accelerator }}</span></span>
                  </div>


                </v-list-item>

                <v-divider v-else></v-divider>

              </template>



            </v-list>
          </v-menu>

        </template>
      </title-bar>
    </v-sheet>

    <v-layout>

      <!-- App side bar -->
      <v-navigation-drawer permanent rail>
        <v-list nav class="d-flex flex-column h-100">
          <!-- Top icons -->
          <v-tooltip text="Home">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-home-city" title="Home" value="home"
                :to="homeRoute"></v-list-item>
            </template>
          </v-tooltip>

          <v-tooltip text="Tips">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-heart" title="Tips" value="tips"
                :to="{ name: 'tip-me' }"></v-list-item>
            </template>
          </v-tooltip>

          <v-tooltip text="About">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-information" title="About" value="about"
                :to="{ name: 'about' }"></v-list-item>
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
      <router-view v-slot="{ Component }">
        <keep-alive :include="['HomeView']" :key="kpAPI.fileName">
          <component :is="Component" />
        </keep-alive>
      </router-view>

    </v-layout>

    <!-- Passphrase prompt -->
    <passphrase-prompt ref="passphrasePrompter" :passphrase-is-new="passphraseIsNew"
      @closed="passphraseDialogClosed"></passphrase-prompt>

    <confirm-dialog ref="confirmDialog1"></confirm-dialog>
  </v-app>
</template>

<script setup lang="ts">
import TitleBar from '@/components/TitleBar.vue';
import PassphrasePrompt from '@/components/PassphrasePrompt.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { computed, provide, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { bridge } from '@/bridge';
import { SHORTCUT_NEW, SHORTCUT_OPEN, SHORTCUT_CLOSE } from '@/constants';

// Import the krypt-pad api
import kpAPI from '@/krypt-pad-api';

// Provide the krypt pad API for other components to inject
provide("kpAPI", kpAPI);

// Register shortcut handlers
bridge.onHandleShortcut(async (args: String) => {
  console.log(args)
  switch (args) {
    case SHORTCUT_NEW:
      await kpAPI.createNewFileAsync();
      break;

    case SHORTCUT_OPEN:
      await kpAPI.openExistingFileAsync();
      break;

    case SHORTCUT_CLOSE:
      kpAPI.closeFile();
      break;
  }

});

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
const menuItems = computed(() => {
  return [
    {
      title: 'File',
      items: [
        { title: 'New File...', handler: kpAPI.createNewFileAsync, accelerator: 'Ctrl + N' },
        // { title: 'Import KDF File' },
        { title: 'Open File...', handler: kpAPI.openExistingFileAsync, accelerator: 'Ctrl + O' },
        { divider: true },
        { title: 'Close File', handler: kpAPI.closeFile, enabled: kpAPI.fileOpened, accelerator: 'Ctrl + F4' },
        { divider: true },
        { title: 'Save File As...', handler: kpAPI.saveProfileAsAsync, enabled: kpAPI.fileOpened },
        { divider: true },
        { title: 'Exit', handler: bridge.close }
      ]
    },
    // {
    //   title: 'Tools',
    //   items: [
    //     { title: 'Password Generator...', handler: null },
    //   ]
    // }
  ];
});

const homeRoute = computed(() => {
  return { name: kpAPI.profile ? 'home' : 'start' };
})

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
function passphraseDialogClosed(passphrase: String) {
  passphraseResolve(passphrase);
}

// // Methods
// async function getMenu() {
//   // Get the menu from the main process
//   const menu = await bridge.getMenu();
//   console.log(menu)

// }

// getMenu();

</script>

<style lang="scss">
html {
  overflow: hidden;
}
</style>
