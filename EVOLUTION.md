# Evolution state — Day 1

## Goal this week
Establish baseline. Target win rate 40–60% for bot playtest.

## Metrics baseline
- Day 0 playtest: 100% win (bot respawn bug — fixed)
- Day 0 retuned balance: **42% win** (50 runs)
- Loss pattern: collect all 5 crystals, die while kiting until timer

## Open hypotheses
- ~~Win rate too low~~ → balance tuned to 42%
- ~~Players die after collecting coins during survive phase~~ → **testing today**
- Healing unused → lower heal cost or raise coin value

## Constraints
- ONE logical change per day
- Allowed paths: `content/**`, `rules/balance.json`, `tests/**`
- Forbidden: `src/**`, `scripts/**`, dependencies
- All changes must pass `npm test`

## Yesterday (Day 0)
Bootstrap. Fixed playtest bot to treat death as loss (was respawning). Tuned enemy damage 5, speed 1.8, spawn 3800ms → 42% win rate.

## Outcomes log
| Day | Change | Win rate before | Win rate after | Keep? |
|-----|--------|-----------------|----------------|-------|
| 0   | Bootstrap + balance tune | 100% (buggy) / 0% (fixed bot) | 42% | ✓ |
| 1   | surviveSeconds 45→38 | 42% | 54% | ✓ |
