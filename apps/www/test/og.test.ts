import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/og/[[...path]]/route.tsx";
import { generateMetadata } from "../src/app/[section]/[[...params]]/page.tsx";
import { toolColors } from "../src/lib/opengraph/templates.tsx";
import { ellipsize } from "../src/lib/opengraph/truncate.ts";
import { DATA_URL, fakeFetch } from "./fixture-tree.ts";

const og = (path: string) =>
  GET(new Request(`https://benchmarks.vlt.sh/og/${path}`), {
    params: Promise.resolve({ path: path.split("?")[0]?.split("/").filter(Boolean) }),
  });

beforeAll(() => {
  vi.stubEnv("DATA_URL", DATA_URL);
  vi.stubGlobal("fetch", fakeFetch);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("social cards", () => {
  it.each([
    "package-managers/clean?fixture=astro",
    "",
    "nope/clean",
    "package-managers/nope",
    // One figure's card each: its chart drawn by ECharts on the server.
    "package-managers/clean?figure=time-trend",
    "package-managers/clean?figure=time-bars",
    "package-managers/clean?figure=time-by-fixture",
    "package-managers/clean?figure=per-package-chart",
    "package-managers/clean?figure=per-package-by-fixture&hide=npm",
  ])("/og/%s is a PNG", async (path) => {
    const res = await og(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const png = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(png.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  });

  it("a report page points its card at itself, with fixture and date", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ section: "package-managers", params: ["clean"] }),
      searchParams: Promise.resolve({ fixture: "astro", date: "2026-10-12", range: "60" }),
    });
    const url = "/og/package-managers/clean?date=2026-10-12&fixture=astro";
    expect(meta.openGraph?.images).toMatchObject([{ url }]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: [{ url }] });
  });

  it("a link to a figure points its card at that figure; a fragment alone cannot", async () => {
    const meta = (searchParams: Record<string, string>) =>
      generateMetadata({
        params: Promise.resolve({ section: "registries", params: ["average"] }),
        searchParams: Promise.resolve(searchParams),
      });
    // A section's anchor stands for its first chart, and the page's window and hidden tools go with it.
    expect(
      (await meta({ figure: "time", range: "90", hide: "npm" })).openGraph?.images,
    ).toMatchObject([{ url: "/og/registries/average?range=90&hide=npm&figure=time-trend" }]);
    // An anchor with no card of its own gets the report's card.
    expect((await meta({ figure: "leaderboard-table" })).openGraph?.images).toMatchObject([
      { url: "/og/registries/average" },
    ]);
  });

  it("tool colours come from the dark theme", async () => {
    expect((await toolColors())["vlt"]).toBe("#ffffff");
  });

  it("a cut never leaves a name open", () => {
    expect(ellipsize("is `yarn (berry)` fast", 10)).toBe("is `yarn`…");
  });
});
