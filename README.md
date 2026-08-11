# Evolving Game

A browser survival game that **improves itself daily** via a Cursor AI agent. The agent reads telemetry and playtest results, makes one small balance/content change, runs tests, and commits.

## Quick start

```bash
npm install
npm run dev          # play at http://localhost:5173
npm test             # balance + level integrity tests
npm run playtest     # headless bot, writes telemetry/playtest.json
npm run telemetry    # aggregate metrics → telemetry/latest.json
npm run evolve:dry   # print evolution prompt (no API call)
npm run evolve       # daily agent (needs CURSOR_API_KEY)
```

Copy `.env.example` → `.env` and set `CURSOR_API_KEY` for evolution runs.

## How it works

```
Players / bot playtest → telemetry → daily agent → content/balance change → tests → commit
```

| Path | Purpose | Agent can edit? |
|------|---------|-----------------|
| `src/` | Game engine (canvas, input) | No |
| `content/` | Levels, dialog, enemies | Yes |
| `rules/balance.json` | Numbers (HP, damage, economy) | Yes |
| `tests/` | Guardrails | Yes |
| `EVOLUTION.md` | Agent memory + hypotheses | Yes |
| `scripts/` | Telemetry, playtest, evolve runner | No |

## Daily evolution (local)

```bash
npm run telemetry && npm run playtest && npm run evolve && npm test
```

## Daily evolution (GitHub Actions)

Workflow `.github/workflows/daily-evolve.yml` runs at 03:00 UTC when `CURSOR_API_KEY` is set as a repo secret.

## Export player telemetry

The game stores events in `localStorage` under `evolving-game-telemetry`. Export and save as `telemetry/sessions/<date>.json`:

```json
{ "events": [ { "type": "win", "wave": 2 } ] }
```

## License

MIT
