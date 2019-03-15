<template>
  <v-form>
    <v-container>
      <v-layout row wrap>
        <v-flex xs12>
          <v-text-field v-model="email" label="Email" box clearable></v-text-field>
        </v-flex>

        <v-flex xs12>
          <v-text-field v-model="password" type="password" box label="Password" clearable></v-text-field>
        </v-flex>
      </v-layout>
      <div>
        <v-switch v-model="rememberMe" :label="'Remember me'"></v-switch>
      </div>
      <div>
        <v-btn :loading="loading" :disabled="loading" @click="loading = true">Sign In</v-btn>
      </div>
    </v-container>
  </v-form>
</template>

<script>
export default {
  name: "sign-in",
  data: () => ({
    email: null,
    password: null,
    rememberMe: false,
    loader: null,
    loading: false,
    drawer: null
  }),
  props: {
    source: String
  },
  watch: {
    loading() {
      var vm = this;
      setTimeout(() => (vm.loading = false), 3000);
    }
  }
};
</script>

<style>
</style>