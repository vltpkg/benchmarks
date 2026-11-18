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
 *
 * It also answers some requests with a 5xx that a retry does not see again --
 * seen on 2026-11-18, where a path that does not exist was a 503 one minute
 * and a 404 the next. A 5xx is tried SERVER_RETRIES more times with a short
 * backoff before it is believed.
 *
 * The queue is inside "use cache", in the fill: a prerender's second pass
 * must find every entry already filled, so nothing may wait before the cached
 * call. `next dev` skips it, since it reports a fill idle for 10s as a
 * deadlock (re-run in isolation, where the queue is empty, it completes), and
 * a long queue is exactly that. Dev reads the local data server, which does
 * not rate-limit; pointed at GitHub Pages, the retries still apply.
 */
const MAX_IN_FLIGHT = 12;
const RETRIES = 5;
const SERVER_RETRIES = 2;
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

export const throttle = async <T>(task: () => Promise<T>): Promise<T> => {
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
};

export const fetchRetrying = async (url: string): Promise<Response> => {
  let limited = 0;
  let broken = 0;
  for (;;) {
    const response = await fetch(url);
    if (response.status === 429 && limited < RETRIES) limited++;
    else if (response.status >= 500 && broken < SERVER_RETRIES) broken++;
    else return response;
    await response.body?.cancel();
    const after = Number(response.headers.get("retry-after"));
    const ms = after > 0 ? after * 1000 : 250 * 2 ** (limited + broken - 1);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
};

const throttledFetch = (url: string): Promise<Response> =>
  process.env.NODE_ENV === "development" ? fetchRetrying(url) : throttle(() => fetchRetrying(url));

/*
 * Every fetch of the served tree, cached. A dated file (`2026-10-13/…`,
 * `manifest/2026-10-13.json`) is written once by its night's run, so it is
 * kept for a day and refreshed behind the reader; the index, the full
 * manifest and `latest/` move with each run, and a 404 may be a date not yet
 * published, so those are kept a minute -- the shortest life that still lets
 * a page prerender.
 *
 * A 5xx that outlasts `fetchRetrying` is returned like a 404, for the same
 * minute, and `DataClient` turns it into a `DataFetchError` the caller sees.
 * It is not thrown here: on 2026-11-18 every build failed on a 503 thrown from
 * this function for a process-count file reached only through {@link probe},
 * which catches it -- the prerender fails a page on an error thrown inside
 * "use cache" whether or not the caller catches it. Any other failure throws,
 * and is not cached.
 */
const cachedGet = async (url: string) => {
  "use cache";
  const response = await throttledFetch(url);
  if (!response.ok && response.status !== 404 && response.status < 500) {
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
 *
 * Everything probed is data a page renders without: a count file, a run's
 * `versions.json`, a summary. So a 5xx that outlasts the retries is reported
 * as `failed` -- which every reader shows as missing -- and warned about on
 * the server, rather than failing the page. Data a page cannot render without
 * (the index, a run's shard) is never probed, and its `DataFetchError` is
 * thrown, so a real outage still fails the build instead of publishing an
 * empty site.
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
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Treating optional data as missing: ${message}`);
    return { state: "failed", message };
  }
};
