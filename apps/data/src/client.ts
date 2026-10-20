/**
 * Typed client over the served tree.
 *
 * This is the only thing `apps/www` should use to reach the data. Per the
 * mission's interface contract it talks HTTP against a base URL and never
 * reads across the workspace boundary on disk, so the same code works against
 * a local server and against the gh-pages origin.
 */
import type {
  BenchmarkFile,
  ChartData,
  Fixture,
  PackageCount,
  ProcessCount,
  Variation,
  Versions,
} from "@benchmarks/types";
import type { DataIndex, DataManifest, DirectoryEntry } from "./manifest.ts";
import {
  benchmarkFile,
  CHART_DATA_FILE,
  dataUrl,
  INDEX_FILE,
  MANIFEST_FILE,
  manifestShardPath,
  packageCountFile,
  processCountFile,
  VERSIONS_FILE,
} from "./paths.ts";

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface DataClientOptions {
  /** Base URL of the served tree, e.g. `https://benchmarks.vlt.sh`. */
  baseUrl: string;
  /** Injectable for tests; defaults to global fetch. */
  fetch?: FetchLike;
}

export class DataFetchError extends Error {
  readonly url: string;
  readonly status: number;

  constructor(url: string, status: number) {
    super(`Request for ${url} failed with status ${status}`);
    this.name = "DataFetchError";
    this.url = url;
    this.status = status;
  }
}

export class DataClient {
  readonly baseUrl: string;
  readonly #fetch: FetchLike;

  constructor(options: DataClientOptions) {
    this.baseUrl = options.baseUrl;
    this.#fetch =
      options.fetch ?? ((url: string) => fetch(url) as unknown as ReturnType<FetchLike>);
  }

  url(...segments: string[]): string {
    return dataUrl(this.baseUrl, ...segments);
  }

  async #get<T>(...segments: string[]): Promise<T> {
    const url = this.url(...segments);
    const response = await this.#fetch(url);
    if (!response.ok) throw new DataFetchError(url, response.status);
    return (await response.json()) as T;
  }

  /** The light index: which dates exist, and the observed vocabularies. */
  getIndex(): Promise<DataIndex> {
    return this.#get<DataIndex>(INDEX_FILE);
  }

  /**
   * The full per-directory detail: ~842KB over the real tree.
   *
   * Prefer {@link getDirectoryEntry} when one directory is wanted. Reach for
   * this only for genuinely cross-date work.
   */
  getManifest(): Promise<DataManifest> {
    return this.#get<DataManifest>(MANIFEST_FILE);
  }

  /**
   * One directory's entry, without fetching the whole manifest.
   *
   * `name` is a `yyyy-mm-dd` date or `latest`. The value is byte-for-byte the
   * same object as `getManifest().entries[name]`, so switching between the two
   * changes cost and nothing else.
   */
  getDirectoryEntry(name: string): Promise<DirectoryEntry> {
    return this.#get<DirectoryEntry>(...manifestShardPath(name));
  }

  getBenchmark(
    date: string,
    fixture: Fixture,
    variation: Variation | string,
  ): Promise<BenchmarkFile> {
    return this.#get<BenchmarkFile>(date, benchmarkFile(fixture, variation));
  }

  getPackageCount(
    date: string,
    fixture: Fixture,
    variation: Variation | string,
  ): Promise<PackageCount> {
    return this.#get<PackageCount>(date, packageCountFile(fixture, variation));
  }

  /**
   * Note that `registry-*` variations publish no process-count file at all, so
   * this rejects with a 404 for them rather than returning an empty object.
   * Check the manifest's `processCounts` before calling.
   */
  getProcessCount(
    date: string,
    fixture: Fixture,
    variation: Variation | string,
  ): Promise<ProcessCount> {
    return this.#get<ProcessCount>(date, processCountFile(fixture, variation));
  }

  getChartData(date: string): Promise<ChartData> {
    return this.#get<ChartData>(date, CHART_DATA_FILE);
  }

  /** `latest/` carries no `versions.json`; this rejects with a 404 there. */
  getVersions(date: string): Promise<Versions> {
    return this.#get<Versions>(date, VERSIONS_FILE);
  }
}
