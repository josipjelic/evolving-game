import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";

const ROOT = join(import.meta.dirname, "..");
const AGENT_ID_FILE = join(ROOT, ".agent-id");
const DRY_RUN = process.argv.includes("--dry-run");

const EVOLUTION_PROMPT = `You are the daily evolution agent for Crystal Cavern, a browser survival game.

Read these files first:
- EVOLUTION.md (current goals, constraints, history)
- telemetry/latest.json (player metrics)
- telemetry/playtest.json (bot playtest results)
- rules/balance.json
- content/levels/level_1.json
- content/dialog.json

Allowed edits ONLY:
- content/** (levels, dialog, enemies)
- rules/balance.json
- tests/** (add/update tests for your change)
- CHANGELOG.game.md (append today's entry)
- EVOLUTION.md (update hypotheses and yesterday's outcome)

FORBIDDEN:
- src/** (game engine — do not touch)
- scripts/**, .github/**, package.json, vite.config.ts

Task — pick ONE hypothesis and make ONE smallest change:
1. Infer the biggest pain from metrics/playtest (e.g. win rate too low, deaths too early)
2. Change one knob: enemy HP, spawn rate, coin count, heal cost, tutorial dialog, etc.
3. Add or update one test in tests/ that would fail if the change regressed badly
4. Append a 3-line entry to CHANGELOG.game.md
5. Update EVOLUTION.md: mark hypothesis tested, note expected metric impact

Keep the diff under 80 lines. Do not refactor. Do not add dependencies.`;

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
