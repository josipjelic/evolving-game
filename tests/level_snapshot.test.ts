import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("level config", () => {
  const levelsDir = join(ROOT, "content/levels");
  const levels = readdirSync(levelsDir).filter((f) => f.endsWith(".json"));

  it("has at least one level template", () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  for (const file of levels) {
    it(`${file} defines procedural maze config`, () => {
      const level = JSON.parse(readFileSync(join(levelsDir, file), "utf8"));
      expect(level.maze?.cols).toBeGreaterThan(10);
      expect(level.maze?.rows).toBeGreaterThan(10);
      expect(level.generation?.coinCount).toBeGreaterThanOrEqual(level.winCondition.coinsRequired);
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
});
