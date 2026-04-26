import { invoke } from '@tauri-apps/api/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const petName = ref('Ditto')
  const providerType = ref('ollama')
  const apiKey = ref('')
  const model = ref('')
  const baseUrl = ref('')
  const autoLaunch = ref(false)

  async function load() {
    try {
      const settings = await invoke<Record<string, string>>('get_settings')
      petName.value = settings.pet_name ?? 'Ditto'
      autoLaunch.value = settings.auto_launch === 'true'

      if (settings.provider_config) {
        const config = JSON.parse(settings.provider_config)
        providerType.value = config.type ?? 'ollama'
        apiKey.value = config.api_key ?? ''
        model.value = config.model ?? ''
        baseUrl.value = config.base_url ?? ''
      }
    } catch (e) {
      console.error('[ditto] load_settings error:', e)
    }
  }

  async function save() {
    const providerConfig = JSON.stringify({
      type: providerType.value,
      api_key: apiKey.value,
      model: model.value,
      base_url: baseUrl.value,
    })

    await invoke('save_settings', {
      settings: {
        pet_name: petName.value,
        provider_config: providerConfig,
        auto_launch: String(autoLaunch.value),
      },
    })
  }

  return { petName, providerType, apiKey, model, baseUrl, autoLaunch, load, save }
})
