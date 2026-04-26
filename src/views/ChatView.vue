<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useChat } from '../composables/useChat'
import { useWindow } from '../composables/useWindow'

const { messages, inputText, isTyping, init, send } = useChat()
const { close } = useWindow()
const messagesEl = ref<HTMLDivElement>()

onMounted(init)

watch(messages, async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}, { deep: true })

async function handleSend() {
  await send()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-[rgba(30,30,40,0.95)]">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/5 px-3 py-2 text-3 text-white/50 select-none">
      <span>Ditto</span>
      <button class="cursor-pointer border-none bg-transparent px-1 text-4 leading-none text-white/40 hover:text-white/80" @click="close">×</button>
    </div>

    <!-- Messages -->
    <div ref="messagesEl" class="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="max-w-90% flex"
        :class="msg.role === 'user' ? 'self-end' : 'self-start'"
      >
        <div
          class="break-words rounded-xl px-2.5 py-1.5 text-3 leading-snug"
          :class="msg.role === 'user'
            ? 'rounded-br-sm bg-blue-500/85 text-white'
            : 'rounded-bl-sm bg-white/12 text-gray-200'"
        >
          {{ msg.content }}
        </div>
      </div>
    </div>

    <!-- Typing indicator -->
    <div v-if="isTyping" class="flex items-center gap-1 px-3 pb-2">
      <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" style="animation-delay:0ms" />
      <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" style="animation-delay:200ms" />
      <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" style="animation-delay:400ms" />
    </div>

    <!-- Input -->
    <div class="flex border-t border-white/10 bg-black/20">
      <input
        v-model="inputText"
        type="text"
        placeholder="Say something..."
        autofocus
        class="flex-1 border-none bg-transparent px-2.5 py-2 text-3 text-gray-200 outline-none"
        @keydown="handleKeydown"
      >
      <button
        class="cursor-pointer border-none bg-blue-500/80 px-3.5 py-2 text-2.5 text-white hover:bg-blue-500"
        @click="handleSend"
      >
        Send
      </button>
    </div>
  </div>
</template>
