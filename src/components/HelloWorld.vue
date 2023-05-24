<template>
  <div class="h-100 w-100 d-flex flex-column align-center justify-center">

    <img src="../assets/safe.svg" alt="Krypt Pad" style="width: 10rem" />

    <div>
      <span>Welcome! Create a new file or open an existing one</span>
    </div>

    <div class="mt-3">
      <v-btn color="primary" class="mr-3" @click="kpAPI.createNewFile">Create New File</v-btn>
      <v-btn>Open File</v-btn>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue';

const kpAPI = inject("kpAPI");

</script>
