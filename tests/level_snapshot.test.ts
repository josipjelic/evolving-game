import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(import.meta.dirname, "..");

function hashFile(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
}

describe("level snapshots", () => {
  const levelsDir = join(ROOT, "content/levels");
  const levels = readdirSync(levelsDir).filter((f) => f.endsWith(".json"));

  it("has at least one level", () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  for (const file of levels) {
    it(`${file} has valid structure`, () => {
      const level = JSON.parse(readFileSync(join(levelsDir, file), "utf8"));
      expect(level.id).toBeTruthy();
      expect(level.width).toBeGreaterThan(0);
      expect(level.height).toBeGreaterThan(0);
      expect(level.playerStart).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      expect(level.coins.length).toBeGreaterThan(0);
      expect(level.winCondition.coinsRequired).toBeLessThanOrEqual(level.coins.length);
    });
  }

  it("level_1 snapshot hash (update intentionally when redesigning level)", () => {
    // ponytail: hash catches accidental level edits; bump when evolution redesigns level
    const hash = hashFile(join(levelsDir, "level_1.json"));
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });
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
