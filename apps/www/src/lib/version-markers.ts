/**
 * Timeline markers derived from consecutive `versions.json` files.
 *
 * These are the only markers 5b draws that have a published source. Its
 * run-event marker ("RUNNER IMAGE UPDATED") has none and no honest derivation,
 * so that class is omitted entirely rather than drawn empty.
 *
 * Two measured constraints shape this:
 *
 * 1. `versions.json` is ABSENT AT THE START AND GAPLESS AFTER. 354 published
 *    dates, 11 missing, all contiguous (2025-08-22 .. 2025-09-01), none missing
 *    across the 343 dates after that. It is also absent from `latest/`
 *    entirely. So this is a START BOUNDARY, not scattered holes, and the
 *    treatment is to compare only consecutive dates that BOTH have the file.
 *    That also stops the first date with versions.json reporting every tool as
 *    newly added, which is the file appearing rather than anything happening.
 *
 * 2. Absence of a marker means "no version change observed between two
 *    PUBLISHED dates" -- never "nothing happened". 53 calendar days are missing
 *    from the archive, so two consecutive published dates can be weeks apart
 *    and any number of releases can sit between them unobserved. Copy that
 *    implies the stronger claim is wrong.
 */
import type { Versions } from "@benchmarks/types";

export type MarkerKind = "changed" | "added";

export interface VersionMarker {
  /** The published date on which the new value is first observed. */
  readonly date: string;
  readonly tool: string;
  readonly kind: MarkerKind;
  readonly version: string;
  /** Absent for `added`. */
  readonly previous?: string;
  /** "vlt 1.4.0" / "upm added 1.3.1", as 5b labels them. */
  readonly label: string;
}

export interface DatedVersions {
  readonly date: string;
  /** `null` when that date published no `versions.json`. */
  readonly versions: Versions | null;
}

/**
 * Diff consecutive dates into markers.
 *
 * Input must be in ascending date order. A date whose file is missing simply
 * breaks the chain: it yields no marker and is not compared across, so a gap
 * never manufactures a change.
 */
export const versionMarkers = (series: readonly DatedVersions[]): VersionMarker[] => {
  const markers: VersionMarker[] = [];

  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (prev?.versions == null || curr?.versions == null) continue;

    for (const [tool, version] of Object.entries(curr.versions)) {
      if (typeof version !== "string" || version === "") continue;
      const before = prev.versions[tool];

      /*
       * An empty previous value counts as "not yet observed", not as a change
       * from nothing.
       *
       * Real case: `upm` is absent on 2026-09-15, present as `""` on
       * 2026-09-29, and `"1.3.1"` on 2026-09-30 -- added to the suite before
       * its version reporting worked. Treating `""` as a previous version
       * would render a marker reading "upm  -> 1.3.1" with a blank on one
       * side, which is exactly the "marker with a missing version" this must
       * never produce.
       */
      if (before === undefined || before === "") {
        markers.push({
          date: curr.date,
          tool,
          kind: "added",
          version,
          label: `${tool} added ${version}`,
        });
      } else if (before !== version) {
        markers.push({
          date: curr.date,
          tool,
          kind: "changed",
          version,
          previous: before,
          label: `${tool} ${version}`,
        });
      }
    }
  }

  return markers;
};

/** Markers for the tools being compared, which is all 5b labels. */
export const markersForTools = (
  markers: readonly VersionMarker[],
  tools: readonly string[],
): VersionMarker[] => markers.filter((m) => tools.includes(m.tool));

/**
 * What a tooltip row says about a tool's version on a date: the change, if
 * one was observed on that date, and otherwise the version it ran. Empty when
 * that date published no version for it -- never a guess carried forward.
 */
export const versionNote = (version: string | undefined, marker?: VersionMarker): string =>
  marker === undefined
    ? (version ?? "")
    : marker.kind === "added"
      ? `added ${marker.version}`
      : `${marker.previous} → ${marker.version}`;
