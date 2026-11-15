# THE GHOST CITY — CLASSIC WEB PORT

This is a browser-based reconstruction of the user's Python/Pygame game, **not** a conversion into a free-motion action game. It intentionally uses grid/tile movement, cardinal attacks, cooldown-based monster actions and the original-style inventory/economy. The web artwork and renderer are new; some map details and less-common behaviors are still reinterpretations and should not be described as exact source parity.

## Architecture (dependency direction)

The browser layer only translates input and paints state. It never mutates combat balance directly.

\`\`\`text
index.html                 browser entrypoint
style.css                  theme, HUD and responsive layout
js/
  classic-main.js          composition root: wires game, UI, controls, audio, storage
  classic.js               ClassicGame orchestration: fixed update, lifecycle, delegates
  classic/
    base.js                independent run lifecycle, feedback and event transport
    rules.js               timing constants, weapon stats, price table, grid helpers
    inventory.js           seven shared slots, equip, drops, shop and consumables
    combat.js              straight-line attacks, spear dash, damage and boss hits
    enemies.js             discrete enemy AI, sniper, witch and boss patterns
    progression.js         XP/HP, stairs, elevator, floor transitions
    persistence.js         game state JSON serialization and restoration
    ui.js                  HUD, menus, inventory/shop view and action delegation
    controls.js            keyboard, touch joystick, action mapping, frame loop
    storage.js             browser localStorage and high scores
    audio.js               synthesized optional sound cues
  config.js                shared immutable tile and biome definitions
  world.js                 procedural generation, collision, line of sight and pathing
  render.js                Canvas2D scene rendering and fog of war
test/
  classic.test.mjs         original behavior regression tests
  world.test.mjs           deterministic map connectivity tests
  browser-smoke.mjs        desktop and touchscreen Chromium smoke tests
\`\`\`

Boundary rules:
- No DOM, browser storage or sound engine calls inside game rules, enemy AI or map generation.
- UI uses public game methods to perform actions; it does not copy combat mechanics.
- Inventory slots remain a single collection of seven items. Weapons and consumables share capacity.
- All original timing coefficients and five weapon definitions live in one place.
- Rendering is read-only over world/game state.
- Save keys are versioned separately to avoid loading incompatible free-movement prototype saves.
- The former free-movement simulation has been removed; it is not silently treated as original gameplay.

## Original game mechanics restored or represented

- Player one-tile cardinal movement around every 90 ms while held.
- Enemy discrete grid steps around every 340 ms (world clock continues while the player is idle, so this is **not** a strict turn-based game).
- Space: forward cardinal line attack, cooldown depending on weapon type and level. Weapon upgrades primarily reduce attack cooldown instead of scaling damage.
- Shift+Space: limited spear dash when equipped spear is level 3+.
- Tutorial floor before regular levels. Initial spear level -3 and a cheap potion.
- 7-slot shared item inventory, drops, weapon levels and consumables.
- Stairs open a fixed four-offer shop; shop exit proceeds to next floor. Gems serve as currency.
- 10F/20F bosses with 72/96 base HP in the classic adaptation.
- Optional angel companion, recovery, timed monster actions and local save/continue.
- A new Canvas2D presentation with procedural tiles, visibility/fog and minimap.

**Remaining discrepancies:** This is not yet a mechanically byte-for-byte port. Procedural room layouts, exact enemy placement and some rarer events differ from the Pygame source. Original gameplay design remains the source of truth for further changes.

## Execution and verification

Use a local HTTP server (ES modules cannot reliably load via file://):

\`\`\`bash
cd ghostcity
python -m http.server 8000
\`\`\`

Open http://localhost:8000/. No build step is necessary.

\`\`\`bash
npm test
npm install
npx playwright install chromium
npm run test:browser
\`\`\`

The Node tests cover timing, movement, original weapons, inventory/shop, enemy behavior, bosses and 160 procedural floors. Playwright covers launch, desktop keyboard attack, pause/resume, persistence and touch input. GitHub Actions runs both suites on changes under ghostcity/.
