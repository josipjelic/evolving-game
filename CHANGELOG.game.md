# Game Changelog

Human-readable history of daily evolutions. The agent appends here.

## [Unreleased]

### Day 3 — SVG sprites
- Wired `content/assets.json` sprites into canvas renderer (shape fallback if load fails)
- Added wisp sprite for patrol enemies; shadow sprite for chasers
- Human signal: 50% win, 0 heals — no balance change

### Day 2 — Feature-first evolution + human telemetry
- Agent now prioritizes features/assets from `content/features.json`
- Human play sessions auto-save during `npm run dev` → `telemetry/sessions/`
- Added SVG sprite stubs in `public/assets/sprites/`
- Human runs are primary balance signal; bot is secondary

### Day 1 — Shorter survive window after crystal collection
- Reduced `surviveSeconds` 45 → 38 on level_1
- Hypothesis: most bot deaths happened after collecting all crystals while waiting for timer
- Updated tutorial line to clarify survive-after-collect goal

### Day 0 — Bootstrap
- Initial Crystal Cavern: collect 5 crystals, survive 45s, avoid shadow creatures
- Balance: player 100 HP, enemy 30 HP / 8 dmg, heal 15g for 25 HP
