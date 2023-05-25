<template>
  <template v-if="kpAPI.fileOpened">
    <v-card v-for="category in kpAPI.profile?.categories" :key="category.name" class="pa-3">
      {{ category.name }}
    </v-card>

  </template>

  <hello-world v-else></hello-world>
</template>

<script setup>
import { inject } from 'vue';
import HelloWorld from '@/components/HelloWorld.vue';

const kpAPI = inject("kpAPI");

</script>
