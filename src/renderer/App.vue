<template>
  <div id="app">
    <v-app id="inspire" dark>
      
      <!-- Content area -->
      <router-view></router-view>

      <v-footer app fixed>
        <span>&copy; 2019</span>
      </v-footer>

    </v-app>
  </div>
</template>

<script>
  import SignIn from './components/SignIn'

  export default {
    name: "krypt-pad",
    components: {SignIn}
    
  };
</script>

<style>
</style>