/**
 * How to cite what is on screen. Pure, so the wording can be tested.
 *
 * A run is cited by its DATE: the published tree records no run id and no
 * commit, so there is nothing else that names one. `date` is `null` where
 * the page is about no single run, and then no year is claimed.
 */
export const CITE_FORMATS = ["url", "bibtex", "apa"] as const;
export type CiteFormat = (typeof CITE_FORMATS)[number];

export interface Citation {
  readonly title: string;
  readonly date: string | null;
  readonly note: string;
}

export const AUTHOR = "vlt technology inc";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const citation = (format: CiteFormat, cite: Citation, url: string): string => {
  if (format === "url") return url;
  const [year, month, day] = (cite.date ?? "").split("-").map(Number);
  const name = MONTHS[(month ?? 0) - 1];
  const dated = cite.date !== null && name !== undefined;
  if (format === "apa") {
    const when = dated ? `${year}, ${name} ${day}` : "n.d.";
    return `${AUTHOR}. (${when}). ${cite.title} [Data set]. ${url}`;
  }
  return [
    `@misc{vlt-benchmarks${dated ? `-${cite.date}` : ""},`,
    `  title  = {${cite.title}},`,
    `  author = {{${AUTHOR}}},`,
    ...(dated ? [`  year   = {${year}},`, `  month  = ${name.slice(0, 3).toLowerCase()},`] : []),
    `  note   = {${cite.note}},`,
    `  url    = {${url}}`,
    `}`,
  ].join("\n");
};

const CADENCE = "results regenerate nightly on GitHub-hosted ubuntu-24.04-arm runners.";

/**
 * The citation for a page: the site, or a benchmark's scenario on one run.
 * No counts: the sidebar builds this from the address alone, and for a
 * pinned older run it cannot know them correctly, so it claims none.
 */
export const citeFor = (
  page: { readonly benchmark: string; readonly scenario?: string; readonly date: string } | null,
): Citation =>
  page === null
    ? {
        title: "vlt benchmarks",
        date: null,
        note: `Results regenerate nightly on GitHub-hosted ubuntu-24.04-arm runners.`,
      }
    : {
        title: `vlt benchmarks: ${page.benchmark}${page.scenario === undefined ? "" : `, ${page.scenario}`}`,
        date: page.date,
        note: `Run of ${page.date}; ${CADENCE}`,
      };
