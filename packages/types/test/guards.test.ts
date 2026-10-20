import { describe, expect, it } from "vitest";
import {
  benchmarkFileStem,
  DATE_KEY_PATTERN,
  FIXTURES,
  isDateKey,
  isFixture,
  isVariation,
  VARIATIONS,
} from "../src/index.ts";

describe("enumerations", () => {
  it("lists the seven fixtures the suite exposes", () => {
    expect([...FIXTURES]).toEqual(["astro", "babylon", "large", "next", "run", "svelte", "vue"]);
  });

  it("lists the fifteen variations, five of which contain a plus", () => {
    expect(VARIATIONS).toHaveLength(15);
    expect(VARIATIONS.filter((v) => v.includes("+"))).toEqual([
      "cache+lockfile",
      "cache+lockfile+node_modules",
      "cache+node_modules",
      "ci+setup",
      "lockfile+node_modules",
    ]);
  });
});

describe("isFixture / isVariation", () => {
  it("accepts every declared member", () => {
    for (const f of FIXTURES) expect(isFixture(f)).toBe(true);
    for (const v of VARIATIONS) expect(isVariation(v)).toBe(true);
  });

  it("rejects near-misses and non-strings", () => {
    for (const value of ["Astro", "nextjs", "", "clean ", "registry_clean"]) {
      expect(isFixture(value)).toBe(false);
    }
    for (const value of [undefined, null, 7, {}, ["clean"]]) {
      expect(isFixture(value)).toBe(false);
      expect(isVariation(value)).toBe(false);
    }
  });
});

describe("isDateKey", () => {
  it("accepts real published directory names", () => {
    for (const d of ["2025-08-22", "2026-02-28", "2026-09-30", "2024-02-29"]) {
      expect(isDateKey(d), d).toBe(true);
    }
  });

  it("rejects impossible calendar dates that match the pattern", () => {
    for (const d of ["2026-02-30", "2026-13-01", "2026-00-10", "2025-02-29"]) {
      expect(DATE_KEY_PATTERN.test(d), `${d} should match the pattern`).toBe(true);
      expect(isDateKey(d), `${d} should not be a valid date`).toBe(false);
    }
  });

  it("rejects malformed strings, `latest`, and non-strings", () => {
    for (const d of ["latest", "2026-9-30", "26-09-30", "2026/09/30", ""]) {
      expect(isDateKey(d), d).toBe(false);
    }
    for (const d of [undefined, null, 20260930]) expect(isDateKey(d)).toBe(false);
  });
});

describe("benchmarkFileStem", () => {
  it("joins fixture and variation with a hyphen", () => {
    expect(benchmarkFileStem("next", "clean")).toBe("next-clean");
  });

  it("leaves the plus in place rather than encoding it", () => {
    expect(benchmarkFileStem("astro", "cache+lockfile+node_modules")).toBe(
      "astro-cache+lockfile+node_modules",
    );
  });
});
