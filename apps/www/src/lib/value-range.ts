/**
 * The trend's value-axis zoom, as the `y` parameter carries it: `fit` (the
 * axis spans the shown tools' data instead of starting at zero), or `lo~hi`
 * in the plotted metric's own units. Anything else -- a hand-edited URL, a
 * range a log axis cannot hold -- is no zoom at all.
 */
export type ValueRange = "fit" | readonly [lo: number, hi: number] | null;

export const parseValueRange = (value: string | null, log: boolean): ValueRange => {
  if (value === "fit") return "fit";
  const parts = value?.split("~") ?? [];
  if (parts.length !== 2) return null;
  const [lo, hi] = parts.map((p) => (p.trim() === "" ? NaN : Number(p)));
  if (lo === undefined || hi === undefined) return null;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) return null;
  if (log && lo <= 0) return null;
  return [lo, hi];
};

/**
 * Two axis values, either way round, as a `y` value. A linear range widens
 * to a round step, so its end labels land on ticks instead of crowding the
 * nearest one; a log axis ticks from its own ends, so it is kept as dragged.
 * Four figures is finer than a pixel.
 */
export const formatValueRange = (a: number, b: number, log: boolean): string => {
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  if (!log && hi > lo) {
    const raw = (hi - lo) / 10;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
  }
  return `${Number(lo.toPrecision(4))}~${Number(hi.toPrecision(4))}`;
};
