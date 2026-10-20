/**
 * `value` cut to `max` characters at a word boundary, with an ellipsis -- vlt.io's
 * (apps/www/src/lib/opengraph/truncate.ts). A cut inside a backticked name closes
 * the name, so the chip it becomes is never left open.
 */
export const ellipsize = (value: string, max: number): string => {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const kept = (cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut).trimEnd();
  return `${kept}${kept.split("`").length % 2 === 0 ? "`" : ""}…`;
};
