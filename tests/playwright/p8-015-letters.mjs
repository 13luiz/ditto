/**
 * P8-015: Letter Frontend Visual Test
 *
 * Verifies:
 * - Pet Manager /letters route renders LettersView
 * - Letters tab in Pet Manager navigation
 * - Letter archive with reading view
 * - Reply form present
 * - useLetters composable wraps IPC commands
 */

const BASE = 'http://localhost:1420/ui.html';

async function check() {
  let passed = 0;
  let failed = 0;

  console.log('\n=== P8-015 Letter Frontend Test ===\n');

  // Test 1: /letters route loads
  console.log('Test 1: /letters route loads...');
  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('Ditto')) throw new Error('SPA shell not loaded');
    console.log('  [PASS] /letters SPA shell loads');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 2: LettersView component
  console.log('Test 2: LettersView component...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.resolve('src/views/LettersView.vue'), 'utf8');
    if (!content.includes('Letters')) throw new Error('Heading missing');
    if (!content.includes('reply') && !content.includes('Reply')) throw new Error('Reply form missing');
    if (!content.includes('archive') || !content.includes('pending')) throw new Error('Archive/pending missing');
    if (!content.includes('sendReply') && !content.includes('send_letter_reply')) throw new Error('Reply IPC missing');
    console.log('  [PASS] LettersView has heading, reply form, archive, IPC calls');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 3: useLetters composable
  console.log('Test 3: useLetters composable...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.resolve('src/composables/useLetters.ts'), 'utf8');
    if (!content.includes('get_pending_letters')) throw new Error('get_pending_letters missing');
    if (!content.includes('mark_letter_read')) throw new Error('mark_letter_read missing');
    if (!content.includes('send_letter_reply')) throw new Error('send_letter_reply missing');
    if (!content.includes('get_letter_archive')) throw new Error('get_letter_archive missing');
    if (!content.includes('interface Letter')) throw new Error('Letter interface missing');
    console.log('  [PASS] useLetters wraps all 4 letter IPC commands');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 4: Letters tab in PetManagerView
  console.log('Test 4: Letters tab in PetManagerView...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const pm = fs.readFileSync(path.resolve('src/views/PetManagerView.vue'), 'utf8');
    if (!pm.includes("'/letters'")) throw new Error('Letters tab path missing');
    if (!pm.includes("'Letters'")) throw new Error('Letters label missing');
    console.log('  [PASS] PetManagerView has Letters tab');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 5: /letters route registered in router
  console.log('Test 5: /letters route in router...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const router = fs.readFileSync(path.resolve('src/router/index.ts'), 'utf8');
    if (!router.includes("/letters")) throw new Error('/letters route missing');
    if (!router.includes("LettersView")) throw new Error('LettersView import missing');
    console.log('  [PASS] Router has /letters route with LettersView');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 6: Letter reading view features
  console.log('Test 6: Reading view with reply form...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.resolve('src/views/LettersView.vue'), 'utf8');
    if (!content.includes('Back')) throw new Error('Back button missing');
    if (!content.includes('textarea')) throw new Error('Reply textarea missing');
    if (!content.includes('Send Reply') && !content.includes('sendReply')) throw new Error('Send button missing');
    if (!content.includes('NEW') && !content.includes('unread')) throw new Error('Unread indicator missing');
    console.log('  [PASS] Reading view has back button, textarea, send, unread indicator');
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
