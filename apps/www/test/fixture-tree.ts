/**
 * A small served tree in memory, for tests that load reports: three runs
 * (with a calendar gap), two fixtures, and the states the report must say
 * out loud -- zpm crashes on babylon (DNF, so partial and not ranked), npm
 * did not run on one date (a gap in the trend), and versions change.
 */
import { buildSummary, DataClient, SUMMARY_PACKAGE_COUNTS } from "@benchmarks/data";

export const DATA_URL = "http://data.test";
export const DATES = ["2026-10-10", "2026-10-12", "2026-10-13"];
const FIXTURES = ["astro", "babylon"];

const result = (command: string, mean: number, exit = 0) => ({
  command,
  mean,
  stddev: mean * 0.05,
  median: mean,
  min: mean,
  max: mean,
  user: mean,
  system: 0,
  times: [mean],
  exit_codes: [exit],
});

/* Seconds per tool per fixture on the latest run; earlier runs scale them. */
const BASE: { [fixture: string]: { [tool: string]: number } } = {
  astro: { bun: 1, npm: 10, vlt: 2, zpm: 0.5 },
  babylon: { bun: 3, npm: 30, vlt: 6, zpm: 0 },
};

const files = new Map<string, unknown>();
const put = (path: string, value: unknown) => files.set(path, value);

put("index.json", {
  version: 1,
  generatedAt: "2026-10-13T00:00:00Z",
  latest: DATES.at(-1),
  hasLatestDir: false,
  dates: DATES,
  fixtures: FIXTURES,
  variations: ["clean", "registry-clean"],
});
DATES.forEach((date, i) => {
  const scale = 1 + (DATES.length - 1 - i) * 0.1;
  put(`manifest/${date}.json`, {
    name: date,
    isLatest: false,
    fileCount: 0,
    benchmarks: { astro: ["clean", "registry-clean"], babylon: ["clean", "registry-clean"] },
    packageCounts: { astro: ["clean"], babylon: ["clean"] },
    processCounts: {},
    hasChartData: false,
    hasVersions: true,
  });
  put(`${date}/versions.json`, { bun: "1.0.0", npm: "11.0.0", vlt: i === 2 ? "1.1.0" : "1.0.0" });
  for (const fixture of FIXTURES) {
    const tools = Object.entries(BASE[fixture] ?? {}).filter(
      ([tool]) => !(tool === "npm" && date === "2026-10-12"),
    );
    put(`${date}/${fixture}-clean.json`, {
      results: tools.map(([tool, s]) =>
        tool === "zpm" && fixture === "babylon" ? result(tool, 0, 1) : result(tool, s * scale),
      ),
    });
    put(`${date}/${fixture}-clean-package-count.json`, {
      bun: { count: 100 },
      npm: { count: 110, minCount: 108, maxCount: 112 },
      vlt: { count: 100 },
      zpm: { count: 90 },
    });
    put(`${date}/${fixture}-registry-clean.json`, {
      results: [result("npm", 20 * scale), result("vlt", 8 * scale)],
    });
  }
});

/** What `fetch` would answer for a URL on the fake data origin. */
export const fakeFetch = async (url: string | URL | Request) => {
  const path = decodeURIComponent(String(url).slice(DATA_URL.length + 1));
  const body = files.get(path);
  return {
    ok: body !== undefined,
    status: body === undefined ? 404 : 200,
    json: async () => body,
  };
};

export const fixtureClient = () => new DataClient({ baseUrl: DATA_URL, fetch: fakeFetch });

/**
 * The same tree with each date's summary, built by apps/data from these files,
 * and a log of every path fetched -- so a test can say both what a report
 * drew and what it cost. `old` serves the shape published before summaries
 * carried counts and versions: results only.
 */
export const summarisedClient = ({
  old = false,
  uncounted,
}: {
  old?: boolean;
  /** A fixture whose count the summaries leave out, as the build does a count file it cannot parse. */
  uncounted?: string;
} = {}) => {
  const fetched: string[] = [];
  const fetch = async (url: string | URL | Request) => {
    const path = decodeURIComponent(String(url).slice(DATA_URL.length + 1));
    fetched.push(path);
    const date = /^summary\/(.+)\.json$/.exec(path)?.[1];
    if (date === undefined || !DATES.includes(date)) return fakeFetch(url);
    const listing = {
      name: date,
      files: [...files.keys()]
        .filter((p) => p.startsWith(`${date}/`))
        .map((p) => p.slice(date.length + 1)),
    };
    const { summary } = buildSummary(listing, (file) =>
      JSON.stringify(files.get(`${date}/${file}`)),
    );
    if (uncounted !== undefined) {
      const counts = summary[SUMMARY_PACKAGE_COUNTS] as { [variation: string]: object } | undefined;
      for (const byFixture of Object.values(counts ?? {})) {
        delete (byFixture as { [fixture: string]: unknown })[uncounted];
      }
    }
    const served = old
      ? Object.fromEntries(Object.entries(summary).filter(([key]) => !key.startsWith("#")))
      : summary;
    return { ok: true, status: 200, json: async () => served };
  };
  return { client: new DataClient({ baseUrl: DATA_URL, fetch }), fetched };
};
