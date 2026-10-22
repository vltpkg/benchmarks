import Link from "next/link";
import { cacheLife } from "next/cache";
import { BotIcon } from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";

const LINK =
  "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2";

/**
 * The site footer.
 *
 * THE FOOTER (`SiteFooter`) is the root layout's, once in the document: full
 * width below the sidebar and the content, under a plain top border, holding
 * the copyright and the way to /methodology. The Method, Environment,
 * resources and trademark notice it used to carry are that page's
 * (app/methodology/page.tsx), from the constants in lib/metadata.ts.
 *
 * DATA AND SOURCE (`DataAndSource`, components/raw-results.tsx) is the page's,
 * ending its content column: the raw result files it fetched.
 *
 * Citing is the sidebar's (`SidebarCite`, in components/cite.tsx).
 *
 * A RUN IS CITED BY ITS DATE. The published tree records no run id and no
 * commit sha, so neither is shown or cited; the citation's URL is the page
 * pinned to its `date`. The cadence is nightly.
 *
 * THE WORDING IS FACT-CHECKED; restyle it freely, reword it carefully. It was
 * ported from the previous app's footer (tmp/app/src/components/footer.tsx,
 * `app/` on origin/main) with two corrections, and these are the reasons the
 * wording is what it is:
 *
 * 1. The original said the suite counts packages "& use that to determine the
 *    average speed relative to the number of packages installed", which
 *    describes a site that ranks on a normalised figure. This one does not.
 *    docs/METHODOLOGY.md is explicit that both numbers are published and
 *    neither alone is the answer. The copy says that.
 *
 * 2. The original listed the processor as "4 cores (Ampere Altra Arm)". The
 *    model name has no source in this repository, so it is gone. The workflow
 *    label is read off .github/workflows/benchmark.yaml, which runs every
 *    benchmark job on ubuntu-24.04-arm; Ubuntu 24.04 and arm64 follow from it.
 *    The remaining figures are GitHub's published specification for standard
 *    public runners, attributed as such rather than stated as measured here.
 *
 *    Note for whoever touches the root README: it still says the workflow
 *    label is `ubuntu-latest`, which has not been true since the suite moved
 *    to arm runners.
 *
 * No commit sha is shown: nothing in the published tree records one.
 *
 * The colour-scheme switcher is not here: it is in the sidebar's footer, as
 * in the vlt docs, and only there.
 */
/* The year, read once a day rather than on every render, so the footer prerenders. */
const Year = async () => {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
};

/** The site footer, full width below the sidebar and the content: nothing in it depends on the page. */
export const SiteFooter = () => (
  <footer className="w-full border-t">
    {/* The navbar's measure, mirrored: its height and its px-3, so the page is
        framed the same at the top and the bottom. Wraps to more rows on a phone. */}
    <div className="flex min-h-(--nav-height) flex-wrap items-center justify-between gap-x-6 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
      <p className="tabular">
        &copy; <Year /> vlt technology inc, All rights reserved
      </p>
      {/* Data mode stands apart from the links: twice their gap. */}
      <div className="flex flex-wrap items-center gap-x-10">
        <nav aria-label="Site" className="flex flex-wrap items-center gap-x-5">
          {(
            [
              ["About", "/about"],
              ["Methodology", "/methodology"],
            ] as const
          ).map(([label, href]) => (
            <Link key={href} href={href} className={`${LINK} h-8`}>
              {label}
            </Link>
          ))}
          <Link href="/about#set-up-your-agent" className={`${LINK} h-8`}>
            <BotIcon aria-hidden className="size-3.5" />
            For agents
          </Link>
        </nav>
        <ViewToggle />
      </div>
    </div>
  </footer>
);
