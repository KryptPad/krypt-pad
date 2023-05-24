<template>
  <div v-if="kpAPI.fileOpened">
    Home
  </div>

  <hello-world v-else></hello-world>
</template>

<script setup>
import { inject } from 'vue';
import HelloWorld from '@/components/HelloWorld.vue';

const kpAPI = inject("kpAPI");

</script>
