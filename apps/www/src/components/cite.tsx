"use client";

import { WithLocation } from "@/components/with-location";
import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";
import { citation, citeFor, CITE_FORMATS, type CiteFormat } from "@/lib/cite";
import { isSectionId, SECTION_DEFS } from "@/lib/sections";

const LABELS: { readonly [format in CiteFormat]: string } = {
  bibtex: "BibTeX",
  apa: "APA",
  url: "URL",
};

const never = () => () => {};

const decode = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/**
 * Cite this page, as the docs' page-aside call-to-action card
 * (vltpkg/www/docs/src/components/toc.tsx): a title, one muted line, and the
 * action -- the format as three small toggles beside an outline copy button.
 * The text itself is not shown; copying it is the point.
 *
 * The sidebar is the root layout's and gets no page props, so the citation
 * is built from the address: the benchmark and scenario from the path, the
 * run from `date` -- or, with none, the latest run's date -- and as its URL
 * this page pinned to that date. It claims no counts (`citeFor`). Off a
 * benchmark's pages (About, Methodology) it cites the page
 * itself. The origin is the reader's own.
 */
export const SidebarCite = ({ latest }: { latest: string | null }) => (
  <WithLocation>
    {({ pathname, query }) => <Cite latest={latest} raw={pathname ?? ""} query={query} />}
  </WithLocation>
);

const Cite = ({ latest, raw, query }: { latest: string | null; raw: string; query: string }) => {
  const [format, setFormat] = useState<CiteFormat>("url");
  const { status, copy } = useCopy(1500);
  const id = useId();
  const params = new URLSearchParams(query);
  const origin = useSyncExternalStore(
    never,
    () => window.location.origin,
    () => "",
  );

  const [, section, scenario] = decode(raw).split("/");
  const date = params.get("date") ?? latest;
  const run =
    isSectionId(section) && date !== null
      ? { benchmark: SECTION_DEFS[section].label, scenario, date }
      : null;
  const pinned = new URLSearchParams(params);
  if (run !== null) pinned.set("date", run.date);
  const url = run === null ? `${origin}${raw}` : `${origin}${raw}?${pinned.toString()}`;
  const cite = citeFor(run);
  const text = citation(
    format,
    raw === "/methodology" ? { ...cite, title: `${cite.title}: Methodology` } : cite,
    url,
  );

  return (
    <section aria-labelledby={id} className="rounded-2xl bg-muted/60 p-4 dark:bg-card">
      <h2 id={id} className="text-sm font-semibold">
        Cite this page
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
        {run === null
          ? "Cites this page, with a link back here."
          : "Cites this run by its date, with a link back here."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div role="group" aria-label="Citation format" className="flex gap-0.5">
          {CITE_FORMATS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === format}
              onClick={() => setFormat(value)}
              className="h-7 rounded-md px-1.5 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-xs dark:aria-pressed:bg-accent"
            >
              {LABELS[value]}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copy(text)}
          className="ml-auto"
          aria-label={`Copy the citation as ${LABELS[format]}`}
        >
          {status === "copied" ? (
            <CheckIcon aria-hidden />
          ) : status === "failed" ? (
            <CircleAlertIcon aria-hidden className="text-destructive" />
          ) : (
            <CopyIcon aria-hidden />
          )}
          Copy
        </Button>
        <span role="status" className="sr-only">
          {status === "copied"
            ? "Citation copied"
            : status === "failed"
              ? "Could not copy the citation"
              : ""}
        </span>
      </div>
    </section>
  );
};
