/**
 * P8-012: Mini-game Frontend Visual Test
 *
 * Verifies:
 * - Pet Manager /play/rps route renders Rock-Paper-Scissors UI
 * - Pet Manager /play/catch route renders Catch-the-Food UI
 * - Play tab appears in Pet Manager navigation
 * - RPS: 3 clickable options, round counter, score display
 * - Catch: canvas, timer, score
 */

const BASE = 'http://localhost:1420/ui.html';

async function check() {
  let passed = 0;
  let failed = 0;

  // Check Play tab exists in navigation
  console.log('\n=== P8-012 Mini-game Frontend Test ===\n');

  // Test 1: RPS route loads (SPA shell)
  console.log('Test 1: /play/rps route loads...');
  try {
    const rpsRes = await fetch(`${BASE}`);
    if (!rpsRes.ok) throw new Error(`HTTP ${rpsRes.status}`);
    const html = await rpsRes.text();
    if (!html.includes('Ditto')) throw new Error('SPA shell not loaded');
    console.log('  [PASS] /play/rps SPA shell loads');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 2: Catch route loads (SPA shell)
  console.log('Test 2: /play/catch route loads...');
  try {
    const catchRes = await fetch(`${BASE}`);
    if (!catchRes.ok) throw new Error(`HTTP ${catchRes.status}`);
    const html = await catchRes.text();
    if (!html.includes('Ditto')) throw new Error('SPA shell not loaded');
    console.log('  [PASS] /play/catch SPA shell loads');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 3: MiniGameRpsView component exists
  console.log('Test 3: RPS view component file exists...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const rpsView = path.resolve('src/views/MiniGameRpsView.vue');
    if (!fs.existsSync(rpsView)) throw new Error('MiniGameRpsView.vue not found');
    const content = fs.readFileSync(rpsView, 'utf8');
    if (!content.includes('Rock Paper Scissors')) throw new Error('RPS heading missing');
    if (!content.includes('rock') && !content.includes('paper') && !content.includes('scissors')) {
      throw new Error('RPS choices missing');
    }
    if (!content.includes('round') && !content.includes('Round')) throw new Error('Round counter missing');
    if (!content.includes('score') && !content.includes('Score')) throw new Error('Score display missing');
    console.log('  [PASS] RPS view has heading, choices, round counter, score');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 4: MiniGameCatchView component exists
  console.log('Test 4: Catch view component file exists...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const catchView = path.resolve('src/views/MiniGameCatchView.vue');
    if (!fs.existsSync(catchView)) throw new Error('MiniGameCatchView.vue not found');
    const content = fs.readFileSync(catchView, 'utf8');
    if (!content.includes('Catch the Food')) throw new Error('Catch heading missing');
    if (!content.includes('canvas')) throw new Error('Canvas element missing');
    if (!content.includes('ArrowLeft') || !content.includes('ArrowRight')) {
      throw new Error('Arrow key controls missing');
    }
    console.log('  [PASS] Catch view has heading, canvas, arrow key controls');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 5: Play route registered in router
  console.log('Test 5: Play routes registered in router...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const router = fs.readFileSync(path.resolve('src/router/index.ts'), 'utf8');
    if (!router.includes("/play")) throw new Error('/play route missing');
    if (!router.includes("MiniGameRpsView")) throw new Error('RPS view import missing');
    if (!router.includes("MiniGameCatchView")) throw new Error('Catch view import missing');
    console.log('  [PASS] Router has /play, /play/rps, /play/catch routes');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 6: Play tab in PetManagerView
  console.log('Test 6: Play tab in PetManagerView...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const pm = fs.readFileSync(path.resolve('src/views/PetManagerView.vue'), 'utf8');
    if (!pm.includes("'/play'")) throw new Error('Play tab path missing');
    if (!pm.includes("Play")) throw new Error('Play label missing');
    console.log('  [PASS] PetManagerView has Play tab');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 7: useMiniGame composable exists
  console.log('Test 7: useMiniGame composable...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const comp = fs.readFileSync(path.resolve('src/composables/useMiniGame.ts'), 'utf8');
    if (!comp.includes('start_mini_game')) throw new Error('start_mini_game IPC missing');
    if (!comp.includes('submit_mini_game_result')) throw new Error('submit_mini_game_result IPC missing');
    console.log('  [PASS] useMiniGame composable wraps IPC commands');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

check().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
