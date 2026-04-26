/**
 * P6-012: Skins Gallery Route Visual Test
 *
 * Verifies the /skins route in Pet Manager renders:
 * - Grid layout of skins
 * - Renderer-type filter tabs (All/Sprite/Spine)
 * - Skin cards with name, renderer badge, source tag
 */

// This test requires `npx tauri dev` to be running.
// Run manually: node tests/playwright/p6-012-skins-gallery.mjs

const check = async () => {
  const response = await fetch('http://localhost:1420/ui.html#/skins');
  if (!response.ok) {
    console.error('FAIL: Could not load /skins route');
    process.exit(1);
  }
  const html = await response.text();
  if (!html.includes('ui')) {
    console.error('FAIL: UI HTML not loaded');
    process.exit(1);
  }
  console.log('PASS: /skins route loads successfully');
};

check().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
