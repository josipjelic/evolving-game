import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseLevel, isWalkableTile } from "../src/map.js";

const ROOT = join(import.meta.dirname, "..");

describe("level snapshots", () => {
  const levelsDir = join(ROOT, "content/levels");
  const levels = readdirSync(levelsDir).filter((f) => f.endsWith(".json"));

  it("has at least one level", () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  for (const file of levels) {
    it(`${file} maze layout is valid`, () => {
      const level = JSON.parse(readFileSync(join(levelsDir, file), "utf8"));
      expect(level.layout.length).toBeGreaterThan(0);
      const cols = level.layout[0].length;
      for (const row of level.layout) {
        expect(row.length).toBe(cols);
      }

      const map = parseLevel(level);
      expect(map.width).toBe(cols * level.tileSize);
      expect(isWalkableTile(level.layout, level.playerStart.tx, level.playerStart.ty)).toBe(true);

      for (const coin of level.coins) {
        expect(isWalkableTile(level.layout, coin.tx, coin.ty)).toBe(true);
      }

      expect(level.coins.length).toBeGreaterThanOrEqual(level.winCondition.coinsRequired);
    });
  }
});

describe("content integrity", () => {
  it("enemies referenced by level exist", () => {
    const enemies = JSON.parse(readFileSync(join(ROOT, "content/enemies.json"), "utf8"));
    const level = JSON.parse(readFileSync(join(ROOT, "content/levels/level_1.json"), "utf8"));
    const types = enemies.levelEnemyMap[level.id] ?? [];
    for (const t of types) {
      expect(enemies.enemies[t]).toBeDefined();
    }
  });

  it("doors reference defined keys", () => {
    const level = JSON.parse(readFileSync(join(ROOT, "content/levels/level_1.json"), "utf8"));
    const keyIds = new Set((level.keys ?? []).map((k: { id: string }) => k.id));
    for (const door of level.doors ?? []) {
      expect(keyIds.has(door.keyId)).toBe(true);
    }
  });
});

describe("map collision", () => {
  it("detects wall tiles", () => {
    const level = JSON.parse(readFileSync(join(ROOT, "content/levels/level_1.json"), "utf8"));
    expect(isWalkableTile(level.layout, 0, 0)).toBe(false);
    expect(isWalkableTile(level.layout, 1, 1)).toBe(true);
  });
});
