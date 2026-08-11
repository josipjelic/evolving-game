# Game Changelog

Human-readable history of daily evolutions. The agent appends here.

## [Unreleased]

### Day 1 — Shorter survive window after crystal collection
- Reduced `surviveSeconds` 45 → 38 on level_1
- Hypothesis: most bot deaths happened after collecting all crystals while waiting for timer
- Updated tutorial line to clarify survive-after-collect goal

### Day 0 — Bootstrap
- Initial Crystal Cavern: collect 5 crystals, survive 45s, avoid shadow creatures
- Balance: player 100 HP, enemy 30 HP / 8 dmg, heal 15g for 25 HP
