import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLevel, isSolvable, carveMaze, createRng } from "../src/maze-gen.js";
import { isWalkableTile } from "../src/map.js";

const ROOT = join(import.meta.dirname, "..");
const template = JSON.parse(readFileSync(join(ROOT, "content/levels/level_1.json"), "utf8"));

describe("maze generation", () => {
  it("carves rectangular layouts", () => {
    const layout = carveMaze(31, 25, createRng(42));
    expect(layout.length).toBe(25);
    expect(layout[0].length).toBe(31);
  });

  it("generates solvable levels for 30 consecutive seeds", () => {
    for (let i = 0; i < 30; i++) {
      const level = generateLevel(template, 5000 + i);
      expect(isSolvable(level)).toBe(true);
      expect(level.coins.length).toBeGreaterThanOrEqual(template.winCondition.coinsRequired);
      expect(isWalkableTile(level.layout, level.playerStart.tx, level.playerStart.ty)).toBe(true);
      for (const coin of level.coins) {
        expect(isWalkableTile(level.layout, coin.tx, coin.ty)).toBe(true);
      }
    }
  });

  it("places a key reachable before the vault door opens", () => {
    const level = generateLevel(template, 999);
    const startReach = new Set();
    const q = [level.playerStart];
    const k = (tx: number, ty: number) => `${tx},${ty}`;
    startReach.add(k(level.playerStart.tx, level.playerStart.ty));
    while (q.length) {
      const { tx, ty } = q.shift()!;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        const key = k(nx, ny);
        if (startReach.has(key)) continue;
        if (!isWalkableTile(level.layout, nx, ny)) continue;
        startReach.add(key);
        q.push({ tx: nx, ty: ny });
      }
    }
    const iron = level.keys[0];
    expect(startReach.has(k(iron.tx, iron.ty))).toBe(true);
  });
});
