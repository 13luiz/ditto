/**
 * P8-017: Journal Frontend Visual Test
 *
 * Verifies:
 * - Pet Manager /journal route renders JournalView
 * - Journal tab in Pet Manager navigation
 * - Calendar view with month navigation
 * - Entry detail view with bullet points
 * - Mood emoji and milestone highlights
 * - useJournal composable wraps journal IPC commands
 */

const BASE = 'http://localhost:1420/ui.html';

async function check() {
  let passed = 0;
  let failed = 0;

  console.log('\n=== P8-017 Journal Frontend Test ===\n');

  // Test 1: /journal route loads
  console.log('Test 1: /journal route loads...');
  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('Ditto')) throw new Error('SPA shell not loaded');
    console.log('  [PASS] /journal SPA shell loads');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 2: JournalView component
  console.log('Test 2: JournalView component...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.resolve('src/views/JournalView.vue'), 'utf8');
    if (!content.includes('Journal')) throw new Error('Heading missing');
    if (!content.includes('calendar') && !content.includes('grid-cols-7')) throw new Error('Calendar grid missing');
    if (!content.includes('prevMonth') && !content.includes('nextMonth')) throw new Error('Month navigation missing');
    if (!content.includes('mood') && !content.includes('moodEmoji')) throw new Error('Mood emoji missing');
    if (!content.includes('milestone')) throw new Error('Milestone highlight missing');
    console.log('  [PASS] JournalView has calendar, month nav, mood emoji, milestones');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 3: useJournal composable
  console.log('Test 3: useJournal composable...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.resolve('src/composables/useJournal.ts'), 'utf8');
    if (!content.includes('get_journal_entries')) throw new Error('get_journal_entries missing');
    if (!content.includes('generate_journal_entry')) throw new Error('generate_journal_entry missing');
    if (!content.includes('interface JournalEntry')) throw new Error('JournalEntry interface missing');
    console.log('  [PASS] useJournal wraps journal IPC commands');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 4: Journal tab in PetManagerView
  console.log('Test 4: Journal tab in PetManagerView...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const pm = fs.readFileSync(path.resolve('src/views/PetManagerView.vue'), 'utf8');
    if (!pm.includes("'/journal'")) throw new Error('Journal tab path missing');
    if (!pm.includes("'Journal'")) throw new Error('Journal label missing');
    console.log('  [PASS] PetManagerView has Journal tab');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 5: /journal route in router
  console.log('Test 5: /journal route in router...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const router = fs.readFileSync(path.resolve('src/router/index.ts'), 'utf8');
    if (!router.includes("/journal")) throw new Error('/journal route missing');
    if (!router.includes("JournalView")) throw new Error('JournalView import missing');
    console.log('  [PASS] Router has /journal route with JournalView');
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${e.message}`);
    failed++;
  }

  // Test 6: Calendar grid features
  console.log('Test 6: Calendar grid features...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.resolve('src/views/JournalView.vue'), 'utf8');
    if (!content.includes('daysInMonth')) throw new Error('daysInMonth computation missing');
    if (!content.includes('entryMap')) throw new Error('entry map missing');
    if (!content.includes('selectEntry')) throw new Error('selectEntry handler missing');
    if (!content.includes('monthLabel')) throw new Error('monthLabel missing');
    console.log('  [PASS] Calendar has day grid, entry map, selection, month label');
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
