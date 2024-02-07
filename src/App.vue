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
        <keep-alive :include="['HomeView']" :key="kpAPI.fileName.value">
          <component :is="Component" />
        </keep-alive>
      </router-view>

    </v-layout>

    <!-- Passphrase prompt -->
    <passphrase-prompt ref="passphrasePrompter" :passphrase-is-new="passphraseIsNew"
      @closed="passphraseDialogClosed"></passphrase-prompt>

    <confirm-dialog ref="confirmDialogPrompt"></confirm-dialog>
    <alert-dialog ref="alertDialogPrompt"></alert-dialog>
  </v-app>
</template>

<script setup lang="ts">
import TitleBar from '@/components/TitleBar.vue';
import PassphrasePrompt from '@/components/PassphrasePrompt.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AlertDialog from '@/components/AlertDialog.vue';
import { computed, provide, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { bridge } from '@/bridge';
import { SHORTCUT_NEW, SHORTCUT_OPEN, SHORTCUT_CLOSE } from '@/constants';

// Import the krypt-pad api
import KryptPadAPI from '@/krypt-pad-api';

// Component refs
const passphrasePrompter = ref<InstanceType<typeof PassphrasePrompt>>();
const confirmDialogPrompt = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const alertDialogPrompt = ref<InstanceType<typeof AlertDialog> | null>(null);

// Data
const passphraseIsNew = ref(false);

// Main API
const kpAPI = new KryptPadAPI();

// Initialize the API
kpAPI.router = useRouter();
kpAPI.route = useRoute();
kpAPI.confirmDialog = confirmDialogPrompt;
kpAPI.alertDialog = alertDialogPrompt;

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
        { title: 'Close File', handler: kpAPI.closeFile, enabled: kpAPI.fileOpened.value, accelerator: 'Ctrl + F4' },
        { divider: true },
        { title: 'Save File As...', handler: kpAPI.saveProfileAsAsync, enabled: kpAPI.fileOpened.value },
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
  return { name: kpAPI.profile.value ? 'home' : 'start' };
})

let passphraseResolver: Function;

// Create callback handler for passprhase prompt. When passphrase is required, this callback will be fired.
kpAPI.onRequirePassphrase((isNew: boolean) => {
  if (!passphrasePrompter.value) {
    return;
  }

  passphraseIsNew.value = isNew;
  passphrasePrompter.value.show();

  return new Promise((resolve) => {
    passphraseResolver = resolve;

  });
});

// Events
function passphraseDialogClosed(passphrase: String) {
  passphraseResolver(passphrase);
}

</script>

<style lang="scss">
html {
  overflow: hidden;
}
</style>
