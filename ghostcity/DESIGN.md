# THE GHOST CITY: REBORN — DESIGN & ENGINE

A browser remake of the user's original Python/Pygame The Ghost City (2026). The goal is a playable action roguelite rather than a pixel-perfect port: it preserves the 20-floor descent, procedural city layouts, 10/20 boss floors, gem economy, elevators, shop, five weapon families and enemy archetypes while replacing the rendering/input/save engine.

## Playing
Open the HTML game at ./index.html through a static HTTP server or the repository's RawGitHack URL. No third-party runtime dependency or bundler.

- WASD / Arrow keys: move. Mouse aim + hold left click or J/K: attack.
- Space / Shift: i-frame dash, 2.5s initial cooldown.
- E: exit staircases, elevator (5 gems), shop. Boss exits stay locked until defeated.
- Q / 1–7: change weapons. H: potion. R: spirit burst (100 energy). I: inventory. Esc: pause.
- Touch: virtual analog stick plus attack, dash, interact, potion, burst buttons.
- Inventory capacity 7. Game auto-saves locally at floor transitions and during a live run. Continue from menu.
- No cloud save, no multiplayer, no external audio or images. Sound is synthesized with Web Audio, with mute option.

## Architecture
- js/config.js: immutable balancing definitions, seeded RNG and shared math.
- js/world.js: deterministic map generation; connected rooms and corridors, exit reachability, colliders, spatial utilities, LOS visibility and BFS navigation field.
- js/game.js: simulation with cooldowns, ranged/melee, collision, two bosses, pickups, economy, XP/perks, game progression and JSON save.
- js/render.js: Canvas2D atmospheric tile/sprite renderer, procedural animation, shadows, fog of war and minimap.
- js/main.js: browser UI, input translation, sound synthesis, persistence and modals.
- test/core.test.mjs: Node built-in test runner.

## Original inspiration / new interpretation

| Original Pygame concept | Reborn implementation |
|---|---|
| Large procedurally generated city floors | 62×38 seeded dungeon grids with connected rooms and corridors |
| Normal floors 1–9, dark floors 11–20 | Silent District and Drowned District visual biomes |
| 10F / 20F boss stages | Mega Spider and Ghost King with projectile patterns and reinforcements |
| AXE, SPEAR, SWORD, SHIELD, HAMMER | Sword, spear, axe, hammer, shield (timed counter) and ranged crossbow |
| Gems, potions, weapon drops, shop, elevators | Gems, potions, shield pickups, weapon caches, stores, elevators and recruitable angel companions |
| Melee, sniper, digger, witch | These plus ghost hounds, swamp spiders and sentinels |
| Fullscreen Pygame | Responsive Canvas2D with keyboard/mouse and touchscreen controller |

This is a reinterpretation and does not claim that all mechanics or art were copied from the old Pygame prototype.

## Quality gates
Run npm test from ghostcity/ with Node 20+. The test suite checks 160 floor/seed combinations for exit reachability. CI workflow runs on paths scoped to this game. No network or external assets needed for runtime.

## Next development targets
Environmental traps, more interactive lore/events, soundscape composition and additional boss telegraphs. Future ideas, not shipped claims.
