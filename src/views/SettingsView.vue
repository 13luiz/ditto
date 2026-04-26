<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useWindow } from '../composables/useWindow'

const store = useSettingsStore()
const { close } = useWindow()
const status = ref('')
const saving = ref(false)

onMounted(() => store.load())

async function save() {
  saving.value = true
  status.value = ''
  try {
    await store.save()
    status.value = 'Settings saved!'
    setTimeout(() => close(), 800)
  } catch (e) {
    status.value = `Error: ${e}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col p-4 gap-4">
    <div class="flex items-center justify-between">
      <span class="text-15px font-bold">Settings</span>
      <button class="cursor-pointer border-none bg-transparent px-1 text-4 text-gray-500 hover:text-gray-300" @click="close">×</button>
    </div>

    <div class="rounded-lg bg-white/5 p-3">
      <div class="mb-2.5 text-3 font-bold uppercase tracking-0.5 text-gray-400">Appearance</div>
      <div class="mb-2.5">
        <label class="mb-1 block text-2.5 text-gray-300">Pet Name</label>
        <input
          v-model="store.petName"
          type="text"
          placeholder="Ditto"
          class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-3 text-white outline-none focus:border-blue-400"
        >
      </div>
    </div>

    <div class="rounded-lg bg-white/5 p-3">
      <div class="mb-2.5 text-3 font-bold uppercase tracking-0.5 text-gray-400">LLM Provider</div>
      <div class="mb-2.5">
        <label class="mb-1 block text-2.5 text-gray-300">Provider</label>
        <select
          v-model="store.providerType"
          class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-3 text-white outline-none focus:border-blue-400"
        >
          <option value="">Not configured</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>
      <div class="mb-2.5">
        <label class="mb-1 block text-2.5 text-gray-300">API Key</label>
        <input
          v-model="store.apiKey"
          type="password"
          placeholder="sk-..."
          class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-3 text-white outline-none focus:border-blue-400"
        >
      </div>
      <div class="mb-2.5">
        <label class="mb-1 block text-2.5 text-gray-300">Model</label>
        <input
          v-model="store.model"
          type="text"
          placeholder="gpt-4o"
          class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-3 text-white outline-none focus:border-blue-400"
        >
      </div>
      <div class="mb-0">
        <label class="mb-1 block text-2.5 text-gray-300">Base URL (optional)</label>
        <input
          v-model="store.baseUrl"
          type="text"
          placeholder="https://api.openai.com/v1"
          class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-3 text-white outline-none focus:border-blue-400"
        >
      </div>
    </div>

    <div class="rounded-lg bg-white/5 p-3">
      <div class="mb-2.5 text-3 font-bold uppercase tracking-0.5 text-gray-400">Behavior</div>
      <label class="flex items-center gap-1.5 text-2.5 text-gray-300">
        <input v-model="store.autoLaunch" type="checkbox" class="w-auto">
        Start with system
      </label>
    </div>

    <div class="min-h-4 text-center text-2.5 text-green-400">{{ status }}</div>

    <div class="mt-1 flex gap-2">
      <button
        class="flex-1 cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-3 text-gray-300 hover:bg-gray-700"
        @click="close"
      >
        Cancel
      </button>
      <button
        class="flex-1 cursor-pointer rounded-lg border border-blue-500 bg-blue-500 px-2 py-2 text-3 text-white hover:bg-blue-600"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </div>
</template>
