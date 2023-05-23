<template>
  <v-app>
    <v-layout class="h-100">

      <v-app-bar title="Application bar"></v-app-bar>


      <title-bar></title-bar>



      <v-navigation-drawer :rail="true" permanent :absolute="false">
        <v-list-item prepend-avatar="https://randomuser.me/api/portraits/men/85.jpg" title="John Leider" nav>
          <!-- <template v-slot:append>
                  <v-btn variant="text" icon="mdi-chevron-left" @click.stop="rail = !rail"></v-btn>
                </template> -->
        </v-list-item>

        <v-divider></v-divider>

        <v-list nav>
          <v-list-item prepend-icon="mdi-home-city" title="Home" value="home"></v-list-item>
          <v-list-item prepend-icon="mdi-account" title="My Account" value="account"></v-list-item>
          <v-list-item prepend-icon="mdi-account-group-outline" title="Users" value="users"></v-list-item>
        </v-list>
      </v-navigation-drawer>


      <!-- <v-tabs>
              <v-tab key="doc1">Document 1</v-tab>
              <v-tab key="doc2">Item Two</v-tab>
              <v-tab>Item Three</v-tab>
            </v-tabs>

            <v-tabs-items class="flex-fill">
              <v-tab-item key="doc1" class="h-100 d-block">
                <textarea class="w-100 h-100"></textarea>
              </v-tab-item>

              <v-tab-item key="doc2" class="h-100 d-block">
                <textarea class="w-100 h-100"></textarea>
              </v-tab-item>

            </v-tabs-items> -->






    </v-layout>
  </v-app>
</template>

<script setup>

import TitleBar from './components/TitleBar.vue';

//const {remote} = require("electron");

//function minimize() {
  //remote.BrowserWindow.getFocusedWindow().minimize();
//}

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
