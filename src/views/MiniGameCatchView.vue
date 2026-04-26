<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const timeLeft = ref(30)
const gameOver = ref(false)
const finalScore = ref<number | null>(null)

const CANVAS_W = 360
const CANVAS_H = 400
const BASKET_W = 50
const BASKET_H = 30
const FOOD_SIZE = 24
const FOOD_EMOJIS = ['🍎', '🍕', '🍩', '🥕', '🍰']
const DROP_INTERVAL_MS = 800
const FALL_SPEED = 3

let basketX = CANVAS_W / 2 - BASKET_W / 2
let foods: { x: number; y: number; emoji: string }[] = []
let animFrame = 0
let dropTimer = 0
let gameTimer = 0
let keys: Record<string, boolean> = {}
let running = false

function onKeyDown(e: KeyboardEvent) {
  keys[e.key] = true
}
function onKeyUp(e: KeyboardEvent) {
  keys[e.key] = false
}

function startGame() {
  score.value = 0
  timeLeft.value = 30
  gameOver.value = false
  finalScore.value = null
  basketX = CANVAS_W / 2 - BASKET_W / 2
  foods = []
  running = true
  dropTimer = 0
  gameTimer = 0

  if (gameTimer) clearInterval(gameTimer as unknown as number)
  gameTimer = window.setInterval(() => {
    if (!running) return
    timeLeft.value--
    if (timeLeft.value <= 0) endGame()
  }, 1000)
}

function endGame() {
  running = false
  gameOver.value = true
  finalScore.value = score.value
  if (gameTimer) clearInterval(gameTimer as unknown as number)
}

function spawnFood() {
  const emoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
  foods.push({
    x: Math.random() * (CANVAS_W - FOOD_SIZE),
    y: -FOOD_SIZE,
    emoji,
  })
}

function gameLoop(ctx: CanvasRenderingContext2D) {
  if (!running) return

  // Move basket
  if (keys['ArrowLeft'] || keys['a']) basketX -= 6
  if (keys['ArrowRight'] || keys['d']) basketX += 6
  basketX = Math.max(0, Math.min(CANVAS_W - BASKET_W, basketX))

  // Spawn food
  dropTimer++
  if (dropTimer >= DROP_INTERVAL_MS / 16) {
    spawnFood()
    dropTimer = 0
  }

  // Update food
  for (let i = foods.length - 1; i >= 0; i--) {
    foods[i].y += FALL_SPEED
    // Catch check
    if (
      foods[i].y + FOOD_SIZE >= CANVAS_H - BASKET_H &&
      foods[i].x + FOOD_SIZE > basketX &&
      foods[i].x < basketX + BASKET_W
    ) {
      score.value++
      foods.splice(i, 1)
      continue
    }
    // Missed — remove
    if (foods[i].y > CANVAS_H) {
      foods.splice(i, 1)
    }
  }

  // Draw
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Foods
  ctx.font = `${FOOD_SIZE}px serif`
  for (const f of foods) {
    ctx.fillText(f.emoji, f.x, f.y + FOOD_SIZE)
  }

  // Basket
  ctx.fillStyle = '#8B5E3C'
  ctx.fillRect(basketX, CANVAS_H - BASKET_H, BASKET_W, BASKET_H)
  ctx.strokeStyle = '#5C3A1E'
  ctx.lineWidth = 2
  ctx.strokeRect(basketX, CANVAS_H - BASKET_H, BASKET_W, BASKET_H)

  animFrame = requestAnimationFrame(() => {
    if (canvas.value) gameLoop(ctx)
  })
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  startGame()
  const ctx = canvas.value?.getContext('2d')
  if (ctx) gameLoop(ctx)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  running = false
  if (gameTimer) clearInterval(gameTimer as unknown as number)
  if (animFrame) cancelAnimationFrame(animFrame)
})

function reset() {
  startGame()
  const ctx = canvas.value?.getContext('2d')
  if (ctx) gameLoop(ctx)
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 p-4">
    <h2 class="text-lg font-bold text-white">Catch the Food</h2>
    <div class="flex gap-2 text-sm text-white">
      <span>Score: {{ score }}</span>
      <span class="text-gray-500">|</span>
      <span>Time: {{ timeLeft }}s</span>
    </div>

    <canvas
      v-if="!gameOver"
      ref="canvas"
      :width="CANVAS_W"
      :height="CANVAS_H"
      class="rounded-lg bg-black/30"
    />

    <div v-if="gameOver" class="flex flex-col items-center gap-3">
      <p class="text-lg font-bold text-green-400">You caught {{ finalScore }} items!</p>
      <button
        class="cursor-pointer rounded-lg border-none bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
        @click="reset"
      >
        Play Again
      </button>
    </div>
  </div>
</template>
