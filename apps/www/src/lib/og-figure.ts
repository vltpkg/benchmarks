/**
 * Which anchors on a report have a social card of their own. A fragment never
 * reaches a server -- unfurlers fetch the page without it -- so a shared link
 * to a figure also carries it as `?figure=` (the copy-link button adds it),
 * and the page's metadata points `og:image` at that figure's card. A section's
 * anchor stands for its first chart; any other anchor gets the report's card.
 */
export const OG_FIGURES = {
  time: "time-trend",
  "trend-by-tool": "time-trend",
  "time-trend": "time-trend",
  "time-bars": "time-bars",
  "time-by-fixture": "time-by-fixture",
  "per-package": "per-package-chart",
  "per-package-chart": "per-package-chart",
  "per-package-by-fixture": "per-package-by-fixture",
} as const;

export type OgFigure = (typeof OG_FIGURES)[keyof typeof OG_FIGURES];

export const ogFigure = (anchor: string | null | undefined): OgFigure | null =>
  anchor != null && Object.hasOwn(OG_FIGURES, anchor)
    ? OG_FIGURES[anchor as keyof typeof OG_FIGURES]
    : null;
