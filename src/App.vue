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

            <v-list elevation="3">
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

        <template v-slot:info>
          {{ windowInfo }}
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

          <!-- Timer display -->
          <div class="mt-auto">
            <v-list-item class="text-center">
              {{ secondsRemaining }}
            </v-list-item>

            <!-- Bottom icons -->
            <v-tooltip text="Settings">
              <template v-slot:activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-cog" title="Settings" value="settings"
                  :to="{ name: 'settings' }"></v-list-item>
              </template>
            </v-tooltip>
          </div>
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

    <!-- Timeout alert -->
    <v-snackbar v-model="timeoutAlert" multi-line :timeout="-1" color="red">
      Your session is about to expire.

      <template v-slot:actions>
        <v-btn color="red" @click="timeoutAlert = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import TitleBar from '@/components/TitleBar.vue';
import PassphrasePrompt from '@/components/PassphrasePrompt.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AlertDialog from '@/components/AlertDialog.vue';
import { computed, provide, ref, inject, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { SHORTCUT_NEW, SHORTCUT_OPEN, SHORTCUT_CLOSE } from '@/constants';

// Import the krypt-pad api
import KryptPadAPI from '@/krypt-pad-api';
import { getFileName } from '@/utils';
import { SettingsManager } from '@/app-settings';

// Get the app settings singleton
const appSettings = inject<SettingsManager>('appSettings')!;

// Component refs
const passphrasePrompter = ref<InstanceType<typeof PassphrasePrompt>>();
const confirmDialogPrompt = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const alertDialogPrompt = ref<InstanceType<typeof AlertDialog> | null>(null);

// Data
const passphraseIsNew = ref(false);
const secondsRemaining = ref<number | undefined>(0);
const timeoutAlert = ref(false);

// Main API
const kpAPI = new KryptPadAPI();


// Initialize the API
kpAPI.router = useRouter();
kpAPI.route = useRoute();
kpAPI.confirmDialog = confirmDialogPrompt;
kpAPI.alertDialog = alertDialogPrompt;

// Provide the krypt pad API for other components to inject
provide("kpAPI", kpAPI);

const windowInfo = computed(() => {
  let infoText = getFileName(kpAPI.fileName.value ?? '');
  if (kpAPI.saving.value) {
    infoText += ' - Saving'
  }
  return infoText
});

// Register shortcut handler
kpAPI.ipcBridge.ipcRenderer.on('handle-shortcut', async (_, args) => {
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
        { title: 'Exit', handler: () => {kpAPI.ipcBridge.close();} }
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
function passphraseDialogClosed(passphrase: string) {
  passphraseResolver(passphrase);

}

let countdownId: NodeJS.Timeout | undefined;

/**
 * Clears the idle timeout
 */
function clearIdleTimeout() {
  // If there is a timeout id, clear it
  if (countdownId !== undefined) {
    clearInterval(countdownId);
  }

  // Close the snackbar
  timeoutAlert.value = false;
}

/**
 * Resets the idle timeout
 */
function resetIdleTimeout() {
  // If there is a timeout id, clear it
  clearIdleTimeout();

  // Check if the timeout should begin
  if (kpAPI.profile && appSettings.enableTimeout && appSettings.timeoutInSeconds.value) {
    // Get the new timeout value
    secondsRemaining.value = appSettings.timeoutInSeconds.value;

    // Begin count down timer
    countdownId = setInterval(() => {
      let tempSecondsRemaining = secondsRemaining.value;
      if (tempSecondsRemaining) {
        tempSecondsRemaining--;

        // When there is 15 seconds left, alert the user
        if (tempSecondsRemaining <= 15 && !timeoutAlert.value) {
          timeoutAlert.value = true;
        }

        // Check if the timeer has reached 0
        if (tempSecondsRemaining < 1) {
          tempSecondsRemaining = 0;
          // Close the file
          kpAPI.closeFile();

        }

      }

      secondsRemaining.value = tempSecondsRemaining;

    }, 1000);
  }
}

// Watch for file opened. This will start the timer if it is enabled
watch(kpAPI.profile, (newProfileValue) => {
  if (newProfileValue) {
    // A profile is opened. Start the timeout.
    resetIdleTimeout();

  }
  else {
    clearIdleTimeout();

  }

});

// Watch when the timeout value has changed
watch(appSettings.timeoutInSeconds, () => {
  // Reset the timeout
  resetIdleTimeout();
});

</script>

<style lang="scss">
html {
  overflow: hidden;
}
</style>
