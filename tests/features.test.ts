import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("features.json", () => {
  const features = JSON.parse(readFileSync(join(ROOT, "content/features.json"), "utf8"));

  it("has a backlog with prioritized items", () => {
    expect(features.backlog.length).toBeGreaterThan(0);
    expect(features.backlog[0].id).toBeTruthy();
    expect(features.backlog[0].priority).toBeGreaterThan(0);
  });

  it("shipped items are not in backlog", () => {
    const shippedIds = new Set(features.shipped.map((f: { id: string }) => f.id));
    for (const item of features.backlog) {
      expect(shippedIds.has(item.id)).toBe(false);
    }
  });
});

describe("assets.json", () => {
  const assets = JSON.parse(readFileSync(join(ROOT, "content/assets.json"), "utf8"));

  it("declares sprite paths", () => {
    expect(assets.sprites.player).toContain(".svg");
    expect(assets.sprites.crystal).toContain(".svg");
    expect(assets.sprites.wisp).toContain(".svg");
  });
});
