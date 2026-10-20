"use client";

import { ArrowRight, History } from "lucide-react";
import Link from "next/link";
import { WithLocation } from "@/components/with-location";
import { longDate } from "@/lib/findings";
import { isSectionId } from "@/lib/sections";

/**
 * On a benchmark pinned to a past run (`?date=`), a strip in the header,
 * always in view: this is a snapshot, not the latest, and the way back to the
 * latest -- the same view, every other choice kept. Its presence sets
 * `--banner-height` (globals.css), which moves everything under the header.
 */
const Banner = ({
  pathname,
  query,
  latest,
}: {
  pathname: string | null;
  query: string;
  latest: string | null;
}) => {
  const params = new URLSearchParams(query);
  const date = params.get("date");
  if (
    latest === null ||
    pathname === null ||
    date === null ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date >= latest ||
    !isSectionId(pathname.split("/")[1])
  )
    return null;
  params.delete("date");
  const rest = params.toString();
  return (
    <div
      data-snapshot-banner
      role="status"
      className="flex h-(--banner-height) items-center justify-center gap-2 border-b border-amber-600/50 bg-amber-500 px-3 text-[0.8125rem] text-amber-950"
    >
      <History aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 truncate">
        A snapshot report from <span className="font-medium">{longDate(date)}</span>
        <span className="max-sm:hidden">, not the latest run</span>.{" "}
        <Link
          href={rest ? `${pathname}?${rest}` : pathname}
          className="inline-flex items-center gap-0.5 font-medium underline decoration-amber-950/40 underline-offset-4 hover:decoration-amber-950"
        >
          See the latest
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </p>
    </div>
  );
};

export const SnapshotBanner = ({ latest }: { latest: string | null }) => (
  <WithLocation>
    {({ pathname, query }) => <Banner pathname={pathname} query={query} latest={latest} />}
  </WithLocation>
);
