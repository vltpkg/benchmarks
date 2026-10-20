import { describe, expect, it } from "vitest";
import { formatValueRange, parseValueRange } from "../src/lib/value-range.ts";

describe("the trend's value-axis zoom (`y`)", () => {
  it("reads fit and lo~hi, and nothing else", () => {
    expect(parseValueRange("fit", false)).toBe("fit");
    expect(parseValueRange("3.4~4.6", true)).toEqual([3.4, 4.6]);
    expect(parseValueRange("-12.5~3", false)).toEqual([-12.5, 3]);
    for (const bad of [null, "", "~", "3~", "~4", "4~3", "3~3", "a~4", "1~2~3", "1e999~2"])
      expect(parseValueRange(bad, false), String(bad)).toBeNull();
  });

  it("refuses a range a log axis cannot hold", () => {
    expect(parseValueRange("0~4", true)).toBeNull();
    expect(parseValueRange("-1~4", true)).toBeNull();
    expect(parseValueRange("0~4", false)).toEqual([0, 4]);
  });

  it("writes a log range as dragged, at four figures, either way round", () => {
    expect(formatValueRange(4.61234, 3.40987, true)).toBe("3.41~4.612");
    expect(parseValueRange(formatValueRange(0.000123456, 0.0002, true), true)).toEqual([
      0.0001235, 0.0002,
    ]);
  });

  it("widens a linear range to a round step, so its ends fall on ticks", () => {
    expect(formatValueRange(2.83, 7.96, false)).toBe("2~8");
    expect(formatValueRange(4.55, 3.48, false)).toBe("3.4~4.6");
    expect(formatValueRange(-17.3, 3.1, false)).toBe("-20~5");
  });
});
