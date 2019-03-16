<template>
  <div id="app">
    <v-app id="inspire" dark>
      <!-- Navigation -->
      <v-navigation-drawer clipped fixed v-model="drawer" app>
        <v-list dense>
          <!-- Menu item -->
          <v-list-tile @click>
            <v-list-tile-action>
              <v-icon>dashboard</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>Dashboard</v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
          <!-- Menu item -->
          <v-list-tile @click>
            <v-list-tile-action>
              <v-icon>settings</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>Settings</v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-navigation-drawer>
      <!-- Top header toolbar -->
      <v-toolbar app fixed clipped-left>
        <v-toolbar-side-icon @click.stop="drawer = !drawer"></v-toolbar-side-icon>
        <v-toolbar-title>Krypt Pad</v-toolbar-title>
      </v-toolbar>

      <!-- Content area -->
      <v-content>
        <v-container fluid fill-height>
          <v-layout justify-center align-center>
            <router-view></router-view>
            
          </v-layout>
        </v-container>
      </v-content>
      <v-footer app fixed>
        <span>&copy; 2017</span>
      </v-footer>
    </v-app>
  </div>
</template>

<script>

export default {
  name: "krypt-pad",
  data: () => ({
    drawer: null
  }),
  props: {
    source: String
  }
};
</script>

<style>
</style>