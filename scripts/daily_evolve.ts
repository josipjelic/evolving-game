import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";

const ROOT = join(import.meta.dirname, "..");
const AGENT_ID_FILE = join(ROOT, ".agent-id");
const DRY_RUN = process.argv.includes("--dry-run");

const EVOLUTION_PROMPT = `You are the daily evolution agent for Crystal Cavern, a browser survival game.

## Priority (in order)
1. **New features** from content/features.json backlog (pick highest priority not yet shipped)
2. **New assets** — SVG sprites in public/assets/sprites/, wire up in content/assets.json + src/
3. **New content** — levels, enemies, dialog, mechanics driven by data in content/
4. **Balance tweaks** — ONLY if human telemetry shows clear pain (see telemetry/latest.json → human)

Balance-only days are discouraged unless human win rate is <25% or >75%.

## Read first
- EVOLUTION.md
- content/features.json (backlog + shipped)
- content/assets.json
- telemetry/latest.json (human runs — PRIMARY signal)
- telemetry/playtest.json (bot — secondary sanity check)
- rules/balance.json, content/**

## Allowed edits
- content/** (levels, enemies, dialog, features.json, assets.json)
- public/assets/** (SVG sprites, sfx as small files)
- src/** (wire new features — keep changes minimal)
- rules/balance.json (only when human telemetry justifies it)
- tests/** (guard new features)
- CHANGELOG.game.md, EVOLUTION.md

## Forbidden
- scripts/**, .github/**, package.json (no new dependencies without explicit need)
- Large refactors or rewrites

## Task — ONE feature or asset per day
1. Pick the top backlog item from content/features.json (or infer from human session patterns)
2. Implement it end-to-end: data + assets + minimal src wiring + test
3. Move the item from backlog → shipped in content/features.json
4. Append CHANGELOG.game.md (what shipped, why, what to playtest)
5. Update EVOLUTION.md outcomes log

Human telemetry patterns to watch:
- deaths before collecting crystals → easier early game OR new defensive feature
- healsUsed always 0 → healing not discoverable OR new UI cue
- timeouts → level pacing feature, not just number tweaks

Keep diff under 200 lines. Ship playable increments.`;

function readAgentId(): string | null {
  if (!existsSync(AGENT_ID_FILE)) return null;
  return readFileSync(AGENT_ID_FILE, "utf8").trim() || null;
}

function saveAgentId(id: string) {
  writeFileSync(AGENT_ID_FILE, id + "\n");
}

async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("CURSOR_API_KEY is required. Copy .env.example → .env");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("Dry run — prompt that would be sent:\n");
    console.log(EVOLUTION_PROMPT);
    process.exit(0);
  }

  const previousId = readAgentId();
  console.log(previousId ? `Resuming agent ${previousId}` : "Creating new evolution agent");

  try {
    await using agent = previousId
      ? await Agent.resume(previousId, { apiKey, local: { cwd: ROOT, settingSources: [] } })
      : await Agent.create({
          apiKey,
          model: { id: "composer-2.5" },
          local: { cwd: ROOT, settingSources: [] },
        });

    const run = await agent.send(EVOLUTION_PROMPT);
    console.log(`Run started: ${run.id}, agent: ${agent.agentId}`);
    const result = await run.wait();

    saveAgentId(agent.agentId);

    if (result.status === "error") {
      console.error(`Run failed: ${run.id}`);
      process.exit(2);
    }

    console.log("Evolution run finished.");
    if (result.result) console.log(result.result.slice(0, 500));
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`Startup failed: ${err.message} (retryable=${err.isRetryable})`);
      process.exit(1);
    }
    throw err;
  }
}

main();
