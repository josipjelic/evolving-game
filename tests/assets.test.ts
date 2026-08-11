import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import assets from "../content/assets.json";

const ROOT = join(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "public");

describe("sprite assets on disk", () => {
  for (const [key, urlPath] of Object.entries(assets.sprites)) {
    it(`${key} svg exists`, () => {
      const file = join(PUBLIC, urlPath.replace(/^\//, ""));
      expect(existsSync(file)).toBe(true);
    });
  }
});
