/**
 * The headline finding for one scenario, computed from the numbers on the
 * page.
 *
 * The hero of every benchmark page is a sentence of the form "bun is fastest
 * at 1.53s, 12.5x faster than npm." A sentence like that is the most quotable
 * thing on the site and therefore the most dangerous: it has to be true in
 * every state the data can be in, and when it cannot be made true it has to
 * get plainer rather than stay confident.
 *
 * The rules, each with a test in the honesty inventory (item 17):
 *
 * - Only tools that completed EVERY fixture can be named fastest. A mean over
 *   five fixtures is not comparable with a mean over six, and the tool that
 *   skipped the slowest fixture would win by skipping it. A faster-but-partial
 *   tool is reported in `qualifier`, never crowned.
 * - A tie at the precision shown is called a tie. "a is fastest at 1.53s" next
 *   to a `b` at 1.53s is a claim the digits on screen contradict.
 * - The ratio clause exists only when the baseline was measured, completed
 *   every fixture, and is not itself the subject.
 * - With one tool there is no "fastest". With none there is no finding.
 */
import { spreadOf } from "./chart-model.ts";
import { formatSeconds, type FixtureRow, type ToolMean } from "./measurements.ts";

/** Seconds as read by a person: milliseconds below one second, with a
 *  decimal below ten of them so 4.2ms and 4.9ms are not both "4ms". */
export const formatDuration = (seconds: number): string =>
  seconds >= 1
    ? `${formatSeconds(seconds)}s`
    : `${(seconds * 1000).toFixed(seconds < 0.01 ? 1 : 0)}ms`;

/** A run date as read by a person: "Oct 13, 2026". */
export const longDate = (date: string): string => {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) return date;
  return new Date(time).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

/** A multiplier with only the digits it can support. */
export const formatRatio = (ratio: number): string =>
  `${ratio >= 100 ? ratio.toFixed(0) : ratio >= 2 ? ratio.toFixed(1) : ratio.toFixed(2)}×`;

/** "1.42× faster" / "1.20× slower", from baseline time over tool time. */
export const formatVersus = (ratio: number): string =>
  ratio >= 1 ? `${formatRatio(ratio)} faster` : `${formatRatio(1 / ratio)} slower`;

export interface Finding {
  /** The hero sentence. Always present, always true of the inputs. */
  readonly sentence: string;
  /**
   * The same sentence with each tool name between backticks, for a renderer
   * that sets names as inline code (`components/inline-code.tsx`).
   */
  readonly marked: string;
  /** The tool the sentence is about, or `null` when it names none. */
  readonly subject: string | null;
  /** Other tools level with the subject at the precision shown. */
  readonly tiedWith: readonly string[];
  /** The subject's mean seconds. */
  readonly mean: number | null;
  /** Baseline mean over subject mean; `null` unless both are comparable. */
  readonly ratio: number | null;
  /** Fixtures on which the subject was the fastest tool, of those it ran. */
  readonly wins: { readonly won: number; readonly of: number } | null;
  /** Slowest mean over fastest mean among comparable tools. */
  readonly spread: number | null;
  /** What the sentence leaves out, when leaving it out unsaid would mislead. */
  readonly qualifier: string | null;
  /** `qualifier`, its tool names between backticks like `marked`'s. */
  readonly qualifierMarked: string | null;
}

/** Strips the backticks `marked` puts around names. */
const plain = (text: string): string => text.replaceAll("`", "");

const list = (names: readonly string[]): string =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;

export const findingFor = ({
  means,
  rows,
  fixtureCount,
  baseline,
  label: labelOf = (tool) => tool,
  where = null,
  hidden = [],
}: {
  /** Ranked means, fastest first, as `meanByTool` returns them. */
  readonly means: readonly ToolMean[];
  readonly rows: readonly FixtureRow[];
  readonly fixtureCount: number;
  /** The baseline key, or `null` when this data does not contain it. */
  readonly baseline: string | null;
  readonly label?: (tool: string) => string;
  /**
   * What the numbers are restricted to, as a phrase to open the sentence with
   * ("On Astro"). When one fixture is selected the sentence has to say so:
   * "bun is fastest at 1.10s" about one project, unqualified, reads as a claim
   * about all of them.
   */
  readonly where?: string | null;
  /**
   * Tools the reader has hidden. None of them leads, and the sentence opens
   * by naming them ("With `registry.vlt.io` hidden, ..."): a claim about the
   * tools left must not read as one about all of them. A ratio is still
   * against the baseline, hidden or not, as every ratio on the page is.
   */
  readonly hidden?: readonly string[];
}): Finding => {
  const label = (tool: string): string => `\`${labelOf(tool)}\``;
  const without =
    hidden.length === 0
      ? null
      : `with ${hidden.length <= 2 ? list(hidden.map(label)) : `${hidden.length} tools`} hidden`;
  const lead =
    where === null
      ? without === null
        ? null
        : without.charAt(0).toUpperCase() + without.slice(1)
      : without === null
        ? where
        : `${where}, ${without}`;
  const say = (text: string) => {
    const marked =
      lead === null
        ? text
        : `${lead}, ${/^(None|No) /.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text}`;
    return { sentence: plain(marked), marked };
  };
  const none: Omit<Finding, "sentence" | "marked"> = {
    subject: null,
    tiedWith: [],
    mean: null,
    ratio: null,
    wins: null,
    spread: null,
    qualifier: null,
    qualifierMarked: null,
  };

  if (means.length === 0) {
    return { ...none, ...say("No completed runs were published for this scenario.") };
  }

  const finished = (m: ToolMean) => !m.failed && m.fixtures >= fixtureCount;
  const shownMeans = means.filter((m) => !hidden.includes(m.tool));
  const complete = shownMeans.filter(finished);
  const partial = shownMeans.filter((m) => !complete.includes(m));

  if (complete.length === 0) {
    return {
      ...none,
      ...say(
        `None of the ${shownMeans.length} tools ${hidden.length === 0 ? "measured" : "shown"} completed every fixture, so none is ranked fastest.`,
      ),
    };
  }

  const first = complete[0] as ToolMean;
  const shown = formatDuration(first.mean);
  const tied = complete.slice(1).filter((m) => formatDuration(m.mean) === shown);
  const leaders = [first, ...tied];

  const reference = means.filter(finished).find((m) => m.tool === baseline);
  const ratio =
    reference !== undefined && !leaders.includes(reference) && first.mean > 0
      ? reference.mean / first.mean
      : null;

  const won = rows.filter(
    (row) =>
      spreadOf(row.values.filter((v) => !hidden.includes(v.tool))).fastest?.tool === first.tool,
  ).length;
  const ran = rows.filter((row) => row.values.some((v) => v.tool === first.tool)).length;

  const faster = partial.filter((m) => m.mean < first.mean);
  const qualifierMarked =
    faster.length === 0
      ? null
      : `${list(faster.map((m) => label(m.tool)))} posted a lower mean but did not complete every fixture, so ${faster.length === 1 ? "it is" : "they are"} not ranked against tools that did.`;

  const facts = {
    subject: first.tool,
    tiedWith: tied.map((m) => m.tool),
    mean: first.mean,
    ratio,
    wins: ran === 0 ? null : { won, of: ran },
    spread:
      complete.length < 2
        ? null
        : spreadOf(complete.map((m) => ({ tool: m.tool, value: m.mean }))).ratio,
    qualifier: qualifierMarked === null ? null : plain(qualifierMarked),
    qualifierMarked,
  };

  const name = label(first.tool);
  const versus =
    ratio === null || reference === undefined
      ? ""
      : `, ${formatVersus(ratio)} than ${label(reference.tool)}`;

  if (complete.length === 1) {
    return {
      ...facts,
      ...say(
        hidden.length === 0
          ? `${name} is the only tool that completed every fixture, at ${shown}.`
          : `${name} is the only tool shown that completed every fixture, at ${shown}${versus}.`,
      ),
    };
  }
  if (tied.length > 0) {
    return {
      ...facts,
      ...say(`${list(leaders.map((m) => label(m.tool)))} tie for fastest at ${shown}${versus}.`),
    };
  }
  if (first.tool === baseline) {
    return { ...facts, ...say(`${name}, the baseline, is fastest at ${shown}.`) };
  }
  return { ...facts, ...say(`${name} is fastest at ${shown}${versus}.`) };
};
