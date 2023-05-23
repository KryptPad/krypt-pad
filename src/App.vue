<template>
  <v-app>

    <!-- Title bar -->
    <v-sheet>
        <title-bar></title-bar>
    </v-sheet>

    <v-layout>

      <v-navigation-drawer permanent rail>

        <!-- Top icons -->
        <v-list nav>
          <v-list-item prepend-icon="mdi-home-city" title="Home" value="home"></v-list-item>
          <v-list-item prepend-icon="mdi-account" title="My Account" value="account"></v-list-item>
          <v-list-item prepend-icon="mdi-account-group-outline" title="Users" value="users"></v-list-item>
        </v-list>

        <!-- Bottom icons -->
        <template v-slot:append>
          <v-list nav>

            <v-tooltip text="Settings">
              <template v-slot:activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-cog" title="Settings" value="settings" :to="{name: 'settings'}"></v-list-item>
              </template>
            </v-tooltip>

          </v-list>

        </template>
      </v-navigation-drawer>

      <!-- Main content -->
      <v-main>
        <v-container class="flex-fill align-start" >
          <router-view>

          </router-view>
        </v-container>
        
        <!-- <v-container class="d-flex justify-center align-center text-h5" style="min-height: 300px;">
          Content
        </v-container> -->
      </v-main>
    </v-layout>



  </v-app>
</template>

<script setup>

import TitleBar from './components/TitleBar.vue';

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
