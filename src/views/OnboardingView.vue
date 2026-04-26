<script setup lang="ts">
import { ref } from 'vue'
import { useWindow } from '../composables/useWindow'
import { invoke } from '@tauri-apps/api/core'

const { close } = useWindow()
const currentStep = ref(1)
const petName = ref('Ditto')
const providerType = ref('')
const apiKey = ref('')
const model = ref('')

async function next() {
  if (currentStep.value < 2) {
    currentStep.value++
  } else {
    await finish()
  }
}

async function skip() {
  await invoke('save_settings', { settings: { onboarding_done: 'true' } })
  close()
}

async function finish() {
  const name = petName.value || 'Ditto'
  let providerConfig = ''
  if (providerType.value) {
    const config: Record<string, string> = { type: providerType.value, model: model.value || 'gpt-4o' }
    if (apiKey.value) config.api_key = apiKey.value
    providerConfig = JSON.stringify(config)
  }

  await invoke('save_settings', {
    settings: {
      pet_name: name,
      provider_config: providerConfig,
      onboarding_done: 'true',
    },
  })
  close()
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center p-6">
    <h1 class="mb-2 text-xl font-bold">Welcome to Ditto</h1>
    <p class="mb-6 text-3 text-gray-400">Let's set up your desktop companion</p>

    <!-- Step 1: Pet Name -->
    <div v-if="currentStep === 1" class="w-full max-w-80">
      <div class="rounded-lg bg-white/5 p-4">
        <label class="mb-2 block text-3 text-gray-300">What would you like to name your pet?</label>
        <input
          v-model="petName"
          type="text"
          placeholder="Ditto"
          class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-3 text-white outline-none focus:border-blue-400"
        >
      </div>
    </div>

    <!-- Step 2: LLM Config -->
    <div v-if="currentStep === 2" class="w-full max-w-80">
      <div class="rounded-lg bg-white/5 p-4">
        <label class="mb-2 block text-3 text-gray-300">Configure your AI provider (optional)</label>
        <div class="mb-3">
          <select
            v-model="providerType"
            class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-3 text-white outline-none focus:border-blue-400"
          >
            <option value="">Skip for now</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>
        <template v-if="providerType">
          <div class="mb-3">
            <label class="mb-1 block text-2.5 text-gray-400">API Key</label>
            <input
              v-model="apiKey"
              type="password"
              placeholder="sk-..."
              class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-3 text-white outline-none focus:border-blue-400"
            >
          </div>
          <div>
            <label class="mb-1 block text-2.5 text-gray-400">Model</label>
            <input
              v-model="model"
              type="text"
              placeholder="gpt-4o"
              class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-3 text-white outline-none focus:border-blue-400"
            >
          </div>
        </template>
      </div>
    </div>

    <!-- Navigation -->
    <div class="mt-6 flex w-full max-w-80 gap-3">
      <button
        class="flex-1 cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-3 text-gray-300 hover:bg-gray-700"
        @click="skip"
      >
        Skip
      </button>
      <button
        class="flex-1 cursor-pointer rounded-lg border border-blue-500 bg-blue-500 px-4 py-2 text-3 text-white hover:bg-blue-600"
        @click="next"
      >
        {{ currentStep === 2 ? 'Finish' : 'Next' }}
      </button>
    </div>
  </div>
</template>
