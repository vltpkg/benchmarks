import { afterEach, expect, it, vi } from "vitest";
import { fetchRetrying, throttle } from "@/lib/data";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("caps requests in flight and retries a 429", async () => {
  let inFlight = 0;
  let peak = 0;
  const seen = new Map<string, number>();
  vi.stubGlobal("fetch", async (url: string) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
    const tries = (seen.get(url) ?? 0) + 1;
    seen.set(url, tries);
    // Every request is rate-limited once, as GitHub Pages does under a burst.
    return tries === 1
      ? new Response(null, { status: 429, headers: { "retry-after": "0" } })
      : new Response("{}", { status: 200 });
  });

  const responses = await Promise.all(
    Array.from({ length: 50 }, (_, i) => throttle(() => fetchRetrying(`https://x/${i}.json`))),
  );

  expect(responses.every((r) => r.status === 200)).toBe(true);
  expect(peak).toBeLessThanOrEqual(12);
  expect([...seen.values()].every((n) => n === 2)).toBe(true);
});
