# Visual parity — The Ghost City (Pygame 2026)

The **source of truth** for the appearance is [original/the_ghost_city.py](original/the_ghost_city.py), not a new concept render. The web version preserves its flat, low-resolution graphics, conspicuous color coding, and text-heavy utility screens.

## Source → browser

| Original source | Browser module | Behavior |
|---|---|---|
| `TILE = 30` | `js/config.js` | 30 CSS-pixel tile grid, integer positions |
| `THEME_DATA` | `js/retro/palette.js` | Literal floor, wall, dim/seen, and treasure RGB |
| `draw_world()` | `js/retro/sprites.js`, `js/retro/renderer.js` | Flat squares/rectangles/circles with one-pixel grid borders |
| Pink/red/green/purple enemies | `js/retro/sprites.js` | The original kind-specific solid-color squares |
| Player `rect.inflate(-6,-6)` | `js/retro/sprites.js` | White 24×24 block with dark blue 2px outline |
| Boss `blocks()` | `js/retro/sprites.js` | One purple center tile + four diagonal leg tiles |
| `draw_attack_overlay()` | `js/retro/renderer.js` | Red tile overlays with borders, ~160ms |
| `draw_sniper_warning()` | `js/retro/renderer.js` | Flat red instant laser flash |
| `draw_pet()`, `draw_pet_laser()` | `js/retro/renderer.js` | Fixed four-corner blue angels and blue beam |
| `draw_start_screen()` | `js/classic/ui.js` | Original title, TOP 10 ranking list, name input |
| `draw_ui_bar()`, `draw_panel()` | `style.css`, `index.html` | Monospace dark HUD, rectangular panels, gold feedback |

## Literal palette

| Layer | Normal RGB | Dark RGB |
|---|---|---|
| Floor, visible | (60,55,78) | (34,30,50) |
| Wall, visible | (150,150,178) | (120,110,155) |
| Floor, explored/unseen | (10,10,16) | (4,4,9) |
| Wall, explored/unseen | (26,26,44) | (16,16,30) |
| Treasure floor | (95,55,145) | (80,30,140) |

Sprites: player (215,245,255); melee (220,90,150); sniper (255,0,0); digger (90,255,120); witch (170,60,255); boss (160,60,255). These values are pixel-tested in Chromium.

## Rules against stylistic drift

- No invented pixel character illustrations, rotating sprites, bloom, glows, smooth camera ease, gradient backgrounds, glass cards, parallax, scanlines, or imported display fonts.
- Keep floor visibility, entity occlusion, leg positions, and simple shape silhouettes tied to the Pygame source.
- A helpful web-only affordance (mobile buttons, keyboard help, collapsible minimap) may exist, but it should be simple and secondary to the main game screen.
- Draw calls must remain in Canvas2D with no graphics library or image download dependency.
- Gameplay and balance are owned by `classic/` modules; changing visuals must never change damage formulas, map logic or cooldowns.

## Automated acceptance

`npm test` verifies gameplay logic. `npm run test:browser` uses Chromium to validate normal floor RGB, normal wall RGB, dark floor RGB, visible player/enemy RGB, sharp nearest-neighbor pixels, flat background styles, centered player viewport, named high scores, and keyboard/mobile smoke tests.

Browser visuals are a **source-informed port**, not identical OS/font rasterization: exact glyph antialiasing, platform fonts and viewport dimensions differ between Pygame and web browsers.
