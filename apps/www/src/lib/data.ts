/**
 * The app's single door to the published benchmark data.
 *
 * Everything goes through `@benchmarks/data` over HTTP at
 * `NEXT_PUBLIC_DATA_URL` -- no filesystem reads across the workspace
 * boundary, so the same code works against the local server and against the
 * gh-pages origin.
 */
import { DataClient, DataFetchError } from "@benchmarks/data";
import { cacheLife } from "next/cache";

/**
 * The base URL of the served tree.
 *
 * Two names, because one of them cannot do the job alone. Next constant-folds
 * every `NEXT_PUBLIC_*` read at build time -- verified in the compiled SSR
 * chunk, where `dataBaseUrl` collapses to `let a = "http://localhost:8811"` and
 * the variable name is gone. So `NEXT_PUBLIC_DATA_URL` sets the endpoint the
 * build is baked against, and changing it means rebuilding.
 *
 * Every read in this app is server-side, so a plain server variable can be
 * consulted at request time instead. `DATA_URL` is that runtime override: it
 * repoints a built app at another origin without a rebuild. Unset, which is the
 * normal case, the baked value is used.
 */
export const dataBaseUrl = (): string => {
  const runtime = process.env["DATA_URL"];
  if (runtime !== undefined && runtime !== "") return runtime;

  const baked = process.env.NEXT_PUBLIC_DATA_URL;
  if (baked === undefined || baked === "") {
    throw new Error(
      "No data endpoint configured. Set NEXT_PUBLIC_DATA_URL (copy " +
        ".env.example to .env.local) before building, or DATA_URL to override " +
        "a built app at runtime.",
    );
  }
  return baked;
};

/*
 * GitHub Pages answers a burst with 429, and a prerender is one: a report
 * fans out to hundreds of files, on every build worker at once. So at most
 * MAX_IN_FLIGHT requests run per process, and a 429 waits and tries again.
 */
const MAX_IN_FLIGHT = 12;
const RETRIES = 5;
let inFlight = 0;
const waiting: (() => void)[] = [];

const acquire = (): Promise<void> => {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
};

/* A waiter takes the freed slot directly, so a newcomer cannot jump the queue. */
const release = (): void => {
  const next = waiting.shift();
  if (next === undefined) inFlight--;
  else next();
};

export const throttledFetch = async (url: string): Promise<Response> => {
  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url);
      if (response.status !== 429 || attempt === RETRIES) return response;
      await response.body?.cancel();
      const after = Number(response.headers.get("retry-after"));
      const ms = after > 0 ? after * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  } finally {
    release();
  }
};

/*
 * Every fetch of the served tree, cached. A dated file (`2026-10-13/…`,
 * `manifest/2026-10-13.json`) is written once by its night's run, so it is
 * kept for a day and refreshed behind the reader; the index, the full
 * manifest and `latest/` move with each run, and a 404 may be a date not yet
 * published, so those are kept a minute -- the shortest life that still lets
 * a page prerender. A failure other than a 404 throws, and is not cached.
 */
const cachedGet = async (url: string) => {
  "use cache";
  const response = await throttledFetch(url);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Request for ${url} failed with status ${response.status}`);
  }
  if (response.ok && /\/\d{4}-\d{2}-\d{2}(\/|\.json$)/.test(url)) cacheLife("days");
  else cacheLife("minutes");
  return {
    ok: response.ok,
    status: response.status,
    body: response.ok ? ((await response.json()) as unknown) : null,
  };
};

export const dataClient = (): DataClient =>
  new DataClient({
    baseUrl: dataBaseUrl(),
    fetch: async (url) => {
      const { body, ...rest } = await cachedGet(url);
      return { ...rest, json: async () => body };
    },
  });

/**
 * The result of one fetch, with "the file does not exist" kept distinct from
 * "the fetch broke".
 *
 * This distinction is the whole point. `process-count` is genuinely absent for
 * every `registry-*` variation and `versions.json` is genuinely absent from
 * `latest/`, so a 404 there is the honest answer and must never be rendered as
 * a zero or an em dash. A 500 is a different thing and says so.
 */
export type Probe<T> =
  | { readonly state: "present"; readonly value: T }
  | { readonly state: "absent"; readonly status: number; readonly url: string }
  | { readonly state: "failed"; readonly message: string };

export const probe = async <T>(fetcher: () => Promise<T>): Promise<Probe<T>> => {
  try {
    return { state: "present", value: await fetcher() };
  } catch (error) {
    if (error instanceof DataFetchError && error.status === 404) {
      return { state: "absent", status: error.status, url: error.url };
    }
    return { state: "failed", message: error instanceof Error ? error.message : String(error) };
  }
};
