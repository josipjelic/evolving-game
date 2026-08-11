import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SESSIONS_DIR = join(ROOT, "telemetry", "sessions");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Aggregate session exports into telemetry/latest.json */
export function collectTelemetry() {
  mkdirSync(SESSIONS_DIR, { recursive: true });

  const sessionFiles = existsSync(SESSIONS_DIR)
    ? readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"))
    : [];

  const sessions = sessionFiles.map((f) => readJson(join(SESSIONS_DIR, f)));

  const seeded = sessions.length === 0;
  const events = seeded
    ? [
        { type: "coin_collect", wave: 1 },
        { type: "coin_collect", wave: 1 },
        { type: "lose", reason: "death", wave: 2 },
        { type: "lose", reason: "timeout", wave: 1 },
        { type: "win", wave: 3 },
      ]
    : sessions.flatMap((s) => s.events ?? []);

  const deaths = events.filter((e) => e.type === "lose").length;
  const wins = events.filter((e) => e.type === "win").length;
  const total = events.length || 1;

  const metrics = {
    date: new Date().toISOString().slice(0, 10),
    sessions: sessions.length || 1,
    seeded,
    d1_retention: wins / Math.max(wins + deaths, 1),
    win_rate: wins / total,
    death_rate: deaths / total,
    avg_wave_at_death:
      events.filter((e) => e.type === "lose").reduce((s, e) => s + (e.wave ?? 1), 0) /
        Math.max(deaths, 1),
    coin_collect_events: events.filter((e) => e.type === "coin_collect").length,
    heal_events: events.filter((e) => e.type === "heal").length,
  };

  const out = join(ROOT, "telemetry", "latest.json");
  writeFileSync(out, JSON.stringify({ metrics, events: events.slice(-100) }, null, 2));
  console.log(`Wrote ${out}${seeded ? " (seeded demo data)" : ""}`);
  return metrics;
}

collectTelemetry();
