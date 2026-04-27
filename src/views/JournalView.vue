<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJournal } from '../composables/useJournal'
import type { JournalEntry } from '../composables/useJournal'

const { entries, loading, error, fetchEntries } = useJournal()

const selectedEntry = ref<JournalEntry | null>(null)
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())

const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
})

const daysInMonth = computed(() => {
  return new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
})

const firstDayOffset = computed(() => {
  return new Date(viewYear.value, viewMonth.value, 1).getDay()
})

const entryMap = computed(() => {
  const map = new Map<string, JournalEntry>()
  for (const e of entries.value) {
    map.set(e.entry_date, e)
  }
  return map
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
  loadMonth()
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
  loadMonth()
}

function loadMonth() {
  const start = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-01`
  const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const end = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  fetchEntries(start, end)
}

function dayKey(day: number) {
  return `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function moodEmoji(mood: string | null): string {
  if (!mood) return ''
  const m = mood.toLowerCase()
  if (m.includes('happy') || m.includes('joy')) return '😊'
  if (m.includes('sad') || m.includes('down')) return '😢'
  if (m.includes('calm') || m.includes('peace')) return '😌'
  if (m.includes('excited') || m.includes('energ')) return '🎉'
  if (m.includes('curious')) return '🤔'
  return '📝'
}

function selectEntry(day: number) {
  const key = dayKey(day)
  const entry = entryMap.value.get(key)
  if (entry) selectedEntry.value = entry
}

onMounted(loadMonth)
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto p-4">
    <h2 class="text-lg font-bold text-white">Journal</h2>

    <div v-if="error" class="text-sm text-red-400">{{ error }}</div>

    <!-- Entry detail view -->
    <div v-if="selectedEntry" class="flex flex-col gap-3">
      <button
        class="w-fit cursor-pointer rounded border-none bg-white/10 px-3 py-1 text-xs text-gray-300 hover:text-white"
        @click="selectedEntry = null"
      >
        &larr; Back
      </button>

      <div class="rounded-lg bg-white/5 p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">{{ selectedEntry.entry_date }}</span>
          <span
            v-if="selectedEntry.milestone"
            class="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300"
          >
            {{ selectedEntry.milestone }}
          </span>
        </div>

        <div
          v-if="selectedEntry.mood_summary"
          class="mt-2 text-sm"
        >
          {{ moodEmoji(selectedEntry.mood_summary) }} {{ selectedEntry.mood_summary }}
        </div>

        <div class="mt-3 text-sm leading-relaxed text-white whitespace-pre-line">
          {{ selectedEntry.content }}
        </div>
      </div>
    </div>

    <!-- Calendar view -->
    <template v-else>
      <!-- Month navigation -->
      <div class="flex items-center justify-between">
        <button
          class="cursor-pointer rounded border-none bg-white/10 px-3 py-1 text-xs text-gray-300 hover:text-white"
          @click="prevMonth"
        >
          &larr;
        </button>
        <span class="text-sm text-white">{{ monthLabel }}</span>
        <button
          class="cursor-pointer rounded border-none bg-white/10 px-3 py-1 text-xs text-gray-300 hover:text-white"
          @click="nextMonth"
        >
          &rarr;
        </button>
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 gap-1 text-center">
        <span class="text-xs text-gray-500">Su</span>
        <span class="text-xs text-gray-500">Mo</span>
        <span class="text-xs text-gray-500">Tu</span>
        <span class="text-xs text-gray-500">We</span>
        <span class="text-xs text-gray-500">Th</span>
        <span class="text-xs text-gray-500">Fr</span>
        <span class="text-xs text-gray-500">Sa</span>

        <span v-for="_ in firstDayOffset" :key="'blank-' + _" />

        <button
          v-for="day in daysInMonth"
          :key="day"
          class="flex h-8 w-full cursor-pointer flex-col items-center justify-center rounded border-none bg-transparent text-xs"
          :class="entryMap.has(dayKey(day)) ? 'bg-blue-500/20 text-white hover:bg-blue-500/30' : 'text-gray-500'"
          @click="selectEntry(day)"
        >
          {{ day }}
          <span v-if="entryMap.has(dayKey(day)) && entryMap.get(dayKey(day))?.mood_summary" class="text-[10px]">
            {{ moodEmoji(entryMap.get(dayKey(day))!.mood_summary) }}
          </span>
        </button>
      </div>

      <div v-if="entries.length === 0 && !loading" class="py-8 text-center text-sm text-gray-500">
        No journal entries this month
      </div>
    </template>
  </div>
</template>
