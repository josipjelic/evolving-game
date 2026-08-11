# Evolving Game

A browser survival game that **grows daily** via a Cursor AI agent — new features, assets, and content first; balance driven by **your play sessions**.

## Quick start

```bash
npm install
npm run dev          # play at http://localhost:5173
npm test
npm run telemetry    # aggregate your runs → telemetry/latest.json
npm run playtest     # bot sanity check (secondary)
npm run evolve       # daily agent (needs CURSOR_API_KEY)
```

## Your runs = primary signal

While `npm run dev` is running, every finished run (win or lose) auto-saves to `telemetry/sessions/`. You'll see **Telemetry: saved …** in the UI.

Then aggregate for the agent:

```bash
npm run telemetry
```

Commit sessions if you want them in the repo for CI evolution:

```bash
git add telemetry/sessions/*.json && git commit -m "telemetry: my play sessions"
```

## Evolution priority

```
1. Features (content/features.json backlog)
2. Assets (public/assets/sprites/*.svg)
3. New content (levels, enemies, dialog)
4. Balance — only when YOUR runs show pain (<25% or >75% win rate)
```

## Project layout

| Path | Purpose |
|------|---------|
| `content/features.json` | Feature backlog → agent picks from here |
| `content/assets.json` | Sprite manifest |
| `public/assets/` | SVG sprites the agent can add |
| `src/` | Game engine — agent wires new features here |
| `telemetry/sessions/` | Your human play sessions |
| `telemetry/latest.json` | Aggregated metrics (generated) |
| `EVOLUTION.md` | Agent memory |

## Daily loop

```bash
# You play → sessions saved automatically
npm run telemetry && npm run evolve && npm test
```

## License

MIT
