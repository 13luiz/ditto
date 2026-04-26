<script setup lang="ts">
import { ref } from 'vue'

type RpsChoice = 'rock' | 'paper' | 'scissors'
const choices: RpsChoice[] = ['rock', 'paper', 'scissors']
const icons: Record<RpsChoice, string> = { rock: '🪨', paper: '📄', scissors: '✂️' }

const playerScore = ref(0)
const petScore = ref(0)
const round = ref(0)
const maxRounds = 5
const playerChoice = ref<RpsChoice | null>(null)
const petChoice = ref<RpsChoice | null>(null)
const roundResult = ref<string | null>(null)
const gameOver = ref(false)
const finalResult = ref<string | null>(null)

function petAiChoice(): RpsChoice {
  const idx = Math.floor(Date.now() % 3)
  return choices[idx]
}

function judge(player: RpsChoice, pet: RpsChoice): string {
  if (player === pet) return 'Draw!'
  if (
    (player === 'rock' && pet === 'scissors') ||
    (player === 'paper' && pet === 'rock') ||
    (player === 'scissors' && pet === 'paper')
  ) return 'You win!'
  return 'Pet wins!'
}

function play(choice: RpsChoice) {
  if (gameOver.value) return
  playerChoice.value = choice
  petChoice.value = petAiChoice()
  roundResult.value = judge(choice, petChoice.value)

  if (roundResult.value === 'You win!') playerScore.value++
  else if (roundResult.value === 'Pet wins!') petScore.value++

  round.value++
  if (round.value >= maxRounds) {
    gameOver.value = true
    if (playerScore.value > petScore.value) finalResult.value = 'You won the match!'
    else if (petScore.value > playerScore.value) finalResult.value = 'Pet won the match!'
    else finalResult.value = 'It\'s a tie!'
  }
}

function reset() {
  playerScore.value = 0
  petScore.value = 0
  round.value = 0
  playerChoice.value = null
  petChoice.value = null
  roundResult.value = null
  gameOver.value = false
  finalResult.value = null
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 p-4">
    <h2 class="text-lg font-bold text-white">Rock Paper Scissors</h2>
    <p class="text-sm text-gray-400">Round {{ round }} / {{ maxRounds }}</p>

    <div class="flex gap-2 text-sm text-white">
      <span>You: {{ playerScore }}</span>
      <span class="text-gray-500">|</span>
      <span>Pet: {{ petScore }}</span>
    </div>

    <div v-if="roundResult" class="text-sm text-yellow-300">
      {{ icons[playerChoice!] }} vs {{ icons[petChoice!] }} — {{ roundResult }}
    </div>

    <div v-if="!gameOver" class="flex gap-3">
      <button
        v-for="c in choices"
        :key="c"
        class="cursor-pointer rounded-lg border-none bg-white/10 px-4 py-2 text-2xl hover:bg-white/20"
        @click="play(c)"
      >
        {{ icons[c] }}
      </button>
    </div>

    <div v-if="gameOver" class="flex flex-col items-center gap-3">
      <p class="text-lg font-bold text-green-400">{{ finalResult }}</p>
      <button
        class="cursor-pointer rounded-lg border-none bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
        @click="reset"
      >
        Play Again
      </button>
    </div>
  </div>
</template>
