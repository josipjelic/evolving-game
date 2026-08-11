import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const balance = JSON.parse(readFileSync(join(ROOT, "rules/balance.json"), "utf8"));
const level = JSON.parse(readFileSync(join(ROOT, "content/levels/level_1.json"), "utf8"));

describe("balance.json", () => {
  it("keeps player stronger than base enemy in a 1v1", () => {
    expect(balance.player.maxHp).toBeGreaterThan(balance.enemy.damage * 3);
    expect(balance.player.damage).toBeGreaterThan(0);
  });

  it("healing is affordable after collecting all coins", () => {
    const goldFromCoins = level.coins.length * balance.economy.coinValue;
    expect(goldFromCoins).toBeGreaterThanOrEqual(balance.economy.healCost);
  });

  it("spawn interval is not faster than human reaction time", () => {
    expect(balance.enemy.spawnIntervalMs).toBeGreaterThanOrEqual(1500);
  });

  it("win condition is achievable within level coin count", () => {
    expect(level.coins.length).toBeGreaterThanOrEqual(level.winCondition.coinsRequired);
  });
});
