import { SegmentedLinks } from "@/components/segmented";
import { SECTION_DEFS, type SectionId } from "@/lib/sections";

/**
 * The explicit no-data state.
 *
 * This exists before any chart does, deliberately. `2026-04-14` publishes 49
 * benchmark files and **zero** `registry-*` files, while its `chart-data.json`
 * advertises both registry sections with populated rows for all six fixtures.
 * A page that enumerated the chart's own section list and then fetched would
 * render an empty chart on that date and present it as a result.
 *
 * So: when the manifest says a section published nothing for a date, say that,
 * name the date, and offer the dates that did.
 */
export const NoData = ({
  section,
  date,
  availableDates,
}: {
  section: SectionId;
  date: string;
  availableDates: readonly string[];
}) => (
  <section className="mt-8 max-w-[62ch]">
    <p className="text-base leading-[1.6] text-pretty text-muted-foreground">
      The run on {date} published nothing for {SECTION_DEFS[section].label.toLowerCase()}. This is a
      statement about the published data, not a loading state and not a zero. The manifest for{" "}
      {date} lists no files for this section, so there is nothing to chart. Some dates in the
      archive advertise sections in their chart data that they did not actually publish — this page
      trusts the file listing instead.
    </p>
    {availableDates.length === 0 ? null : (
      <div className="mt-8">
        <SegmentedLinks
          label="Recent runs that did"
          options={availableDates.slice(0, 12).map((d) => ({
            key: d,
            href: `/${section}?date=${d}`,
            selected: false,
            label: <span className="font-mono text-[0.78125rem]">{d}</span>,
          }))}
        />
      </div>
    )}
  </section>
);
