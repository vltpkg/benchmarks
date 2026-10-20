import { describe, expect, it, vi } from "vitest";
import { DataClient, DataFetchError, type FetchLike } from "../src/client.ts";

const stub = (body: unknown, ok = true, status = 200): { fetch: FetchLike; urls: string[] } => {
  const urls: string[] = [];
  const fetch: FetchLike = (url) => {
    urls.push(url);
    return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
  };
  return { fetch, urls };
};

describe("DataClient url construction", () => {
  it("requests the index and manifest from the tree root", async () => {
    const { fetch, urls } = stub({});
    const client = new DataClient({ baseUrl: "https://x.test", fetch });
    await client.getIndex();
    await client.getManifest();
    expect(urls).toEqual(["https://x.test/index.json", "https://x.test/manifest.json"]);
  });

  it("builds the three per-fixture paths correctly", async () => {
    const { fetch, urls } = stub({});
    const client = new DataClient({ baseUrl: "https://x.test", fetch });
    await client.getBenchmark("2026-09-30", "next", "clean");
    await client.getPackageCount("2026-09-30", "astro", "registry-clean");
    await client.getProcessCount("2026-09-30", "vue", "cache");
    expect(urls).toEqual([
      "https://x.test/2026-09-30/next-clean.json",
      "https://x.test/2026-09-30/astro-registry-clean-package-count.json",
      "https://x.test/2026-09-30/vue-cache-process-count.json",
    ]);
  });

  it("encodes + in variation names", async () => {
    const { fetch, urls } = stub({});
    const client = new DataClient({ baseUrl: "https://x.test", fetch });
    await client.getBenchmark("2026-09-30", "astro", "cache+lockfile+node_modules");
    expect(urls[0]).toBe("https://x.test/2026-09-30/astro-cache%2Blockfile%2Bnode_modules.json");
  });

  it("fetches one directory entry from its shard, not the whole manifest", async () => {
    const { fetch, urls } = stub({});
    const client = new DataClient({ baseUrl: "https://x.test", fetch });
    await client.getDirectoryEntry("2026-09-30");
    await client.getDirectoryEntry("latest");
    expect(urls).toEqual([
      "https://x.test/manifest/2026-09-30.json",
      "https://x.test/manifest/latest.json",
    ]);
    // The point of the method: it must not reach for manifest.json.
    expect(urls.some((u) => u.endsWith("/manifest.json"))).toBe(false);
  });

  it("reaches chart-data and versions per date", async () => {
    const { fetch, urls } = stub({});
    const client = new DataClient({ baseUrl: "https://x.test/", fetch });
    await client.getChartData("2026-09-30");
    await client.getVersions("2026-09-30");
    expect(urls).toEqual([
      "https://x.test/2026-09-30/chart-data.json",
      "https://x.test/2026-09-30/versions.json",
    ]);
  });
});

describe("DataClient errors", () => {
  it("throws DataFetchError carrying the url and status", async () => {
    const { fetch } = stub(undefined, false, 404);
    const client = new DataClient({ baseUrl: "https://x.test", fetch });
    await expect(client.getVersions("latest")).rejects.toBeInstanceOf(DataFetchError);
    await expect(client.getVersions("latest")).rejects.toMatchObject({
      status: 404,
      url: "https://x.test/latest/versions.json",
    });
  });

  it("does not swallow a 404 into an empty object", async () => {
    // registry-* variations have no process-count file. Callers must be able
    // to tell "absent" from "present but empty".
    const { fetch } = stub({}, false, 404);
    const client = new DataClient({ baseUrl: "https://x.test", fetch });
    const promise = client.getProcessCount("2026-09-30", "astro", "registry-clean");
    await expect(promise).rejects.toThrow(/failed with status 404/);
  });

  it("uses global fetch when none is injected", () => {
    const spy = vi.fn();
    const client = new DataClient({ baseUrl: "https://x.test" });
    expect(client.url("index.json")).toBe("https://x.test/index.json");
    expect(spy).not.toHaveBeenCalled();
  });
});
