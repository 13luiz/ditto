<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const roomId = route.params.id
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-bold mb-4">Room {{ roomId }}</h1>
    <p class="text-gray-400">Group chat (coming soon)</p>
  </div>
</template>
