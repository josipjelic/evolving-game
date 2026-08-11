# Evolution state — Day 0 (bootstrap)

## Goal this week
Establish baseline. Target win rate 40–60% for bot playtest.

## Metrics baseline
Run `npm run telemetry && npm run playtest` after each evolution.

## Open hypotheses
- Win rate too low → reduce enemy damage or spawn rate
- Players die before collecting coins → add coins or slow first wave
- Healing unused → lower heal cost or raise coin value

## Constraints
- ONE logical change per day
- Allowed paths: `content/**`, `rules/balance.json`, `tests/**`
- Forbidden: `src/**`, `scripts/**`, dependencies
- All changes must pass `npm test`

## Yesterday
_(none — project bootstrap)_

## Outcomes log
| Day | Change | Win rate before | Win rate after | Keep? |
|-----|--------|-----------------|----------------|-------|
| 0   | Initial game  | — | — | — |
