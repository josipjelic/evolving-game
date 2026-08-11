import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SESSIONS_DIR = join(ROOT, "telemetry", "sessions");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

interface Session {
  sessionId?: string;
  player?: string;
  outcome?: string;
  reason?: string;
  durationSeconds?: number;
  healsUsed?: number;
  coinsCollected?: number;
  events?: Array<{ type: string; reason?: string; wave?: number }>;
}

function summarizeHumanSessions(sessions: Session[]) {
  const human = sessions.filter((s) => s.player !== "bot");
  if (!human.length) return null;

  const wins = human.filter((s) => s.outcome === "win").length;
  const losses = human.filter((s) => s.outcome === "lose");
  const deaths = losses.filter((s) => s.reason === "death").length;
  const timeouts = losses.filter((s) => s.reason === "timeout").length;

  return {
    runs: human.length,
    win_rate: wins / human.length,
    avg_duration_seconds:
      human.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / human.length,
    avg_heals:
      human.reduce((sum, s) => sum + (s.healsUsed ?? 0), 0) / human.length,
    deaths,
    timeouts,
    avg_coins_at_end:
      human.reduce((sum, s) => sum + (s.coinsCollected ?? 0), 0) / human.length,
    recent: human.slice(-5).map((s) => ({
      sessionId: s.sessionId,
      outcome: s.outcome,
      reason: s.reason,
      durationSeconds: s.durationSeconds,
      healsUsed: s.healsUsed,
    })),
  };
}

/** Aggregate human sessions + bot playtest into telemetry/latest.json */
export function collectTelemetry() {
  mkdirSync(SESSIONS_DIR, { recursive: true });

  const sessionFiles = existsSync(SESSIONS_DIR)
    ? readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"))
    : [];

  const sessions: Session[] = sessionFiles.map((f) => readJson(join(SESSIONS_DIR, f)));
  const human = summarizeHumanSessions(sessions);

  let bot: Record<string, unknown> | null = null;
  const playtestPath = join(ROOT, "telemetry", "playtest.json");
  if (existsSync(playtestPath)) {
    bot = readJson(playtestPath);
  }

  const out = join(ROOT, "telemetry", "latest.json");
  const payload = {
    date: new Date().toISOString().slice(0, 10),
    human,
    bot: bot
      ? {
          win_rate: bot.win_rate,
          runs: bot.runs,
          avg_deaths: bot.avg_deaths,
          avg_coins: bot.avg_coins,
        }
      : null,
    sessionCount: sessions.length,
    hint: human
      ? "Human runs found — agent should prioritize features; balance only if human metrics show pain."
      : "No human runs yet — play at npm run dev, finish a run, then re-run telemetry.",
  };

  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${out}`);
  if (human) {
    console.log(`Human: ${human.runs} runs, ${(human.win_rate * 100).toFixed(0)}% win rate`);
  } else {
    console.log("No human sessions in telemetry/sessions/ — play the game first");
  }
  return payload;
}

collectTelemetry();
