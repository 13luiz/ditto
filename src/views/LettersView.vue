<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLetters } from '../composables/useLetters'
import type { Letter } from '../composables/useLetters'

const { pending, archive, loading, error, fetchPending, fetchArchive, sendReply } = useLetters()

const selectedLetter = ref<Letter | null>(null)
const replyText = ref('')
const sending = ref(false)
const sent = ref(false)

onMounted(async () => {
  await fetchPending()
  await fetchArchive()
})

function selectLetter(letter: Letter) {
  selectedLetter.value = letter
  replyText.value = ''
  sent.value = false
}

async function reply() {
  if (!selectedLetter.value || !replyText.value.trim()) return
  sending.value = true
  await sendReply(selectedLetter.value.id, replyText.value)
  sending.value = false
  sent.value = true
  replyText.value = ''
  await fetchArchive()
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto p-4">
    <h2 class="text-lg font-bold text-white">Letters</h2>

    <div v-if="error" class="text-sm text-red-400">{{ error }}</div>

    <!-- Unread indicator -->
    <div v-if="pending.length > 0 && !selectedLetter" class="rounded-lg bg-yellow-500/20 px-3 py-2 text-sm text-yellow-300">
      {{ pending.length }} unread letter{{ pending.length > 1 ? 's' : '' }}
    </div>

    <!-- Letter list -->
    <div v-if="!selectedLetter" class="flex flex-col gap-2">
      <button
        v-for="letter in [...pending, ...archive]"
        :key="letter.id"
        class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left"
        :class="letter.read_at ? 'text-gray-300' : 'border-yellow-400/40 bg-yellow-500/10 text-white'"
        @click="selectLetter(letter)"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">{{ letter.created_at }}</span>
          <span v-if="!letter.read_at" class="text-xs text-yellow-400">NEW</span>
        </div>
        <p class="mt-1 text-sm">{{ letter.content.slice(0, 80) }}{{ letter.content.length > 80 ? '...' : '' }}</p>
      </button>

      <div v-if="pending.length === 0 && archive.length === 0 && !loading" class="py-8 text-center text-sm text-gray-500">
        No letters yet
      </div>
    </div>

    <!-- Letter reading view -->
    <div v-if="selectedLetter" class="flex flex-col gap-3">
      <button
        class="w-fit cursor-pointer rounded border-none bg-white/10 px-3 py-1 text-xs text-gray-300 hover:text-white"
        @click="selectedLetter = null"
      >
        &larr; Back
      </button>

      <div class="rounded-lg bg-white/5 p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">{{ selectedLetter.created_at }}</span>
          <span class="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
            {{ selectedLetter.direction === 'to_user' ? 'From Pet' : 'From You' }}
          </span>
        </div>
        <p class="mt-3 text-sm leading-relaxed text-white">{{ selectedLetter.content }}</p>
      </div>

      <!-- Reply form -->
      <div v-if="selectedLetter.direction === 'to_user' && !sent" class="flex flex-col gap-2">
        <textarea
          v-model="replyText"
          class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-400"
          rows="3"
          placeholder="Write a reply..."
        />
        <button
          class="w-fit cursor-pointer rounded-lg border-none bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          :disabled="!replyText.trim() || sending"
          @click="reply"
        >
          {{ sending ? 'Sending...' : 'Send Reply' }}
        </button>
      </div>

      <div v-if="sent" class="text-sm text-green-400">Reply sent!</div>
    </div>
  </div>
</template>
