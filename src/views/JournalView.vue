<script setup lang="ts">
import { ref, onMounted } from 'vue'

const entries = ref<any[]>([])
const loading = ref(false)
const currentMonth = ref('')

onMounted(() => {
  const now = new Date()
  currentMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto p-4">
    <h2 class="text-lg font-bold text-white">Journal</h2>
    <p class="text-sm text-gray-400">Month: {{ currentMonth }}</p>

    <div v-if="entries.length === 0 && !loading" class="py-8 text-center text-sm text-gray-500">
      No journal entries yet
    </div>
  </div>
</template>
