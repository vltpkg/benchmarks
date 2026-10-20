"use client";

import { SnapshotBanner } from "@/components/snapshot-banner";
import Link from "next/link";
import { getMenuContent } from "./data";
import {
  NavigationMenu,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { isGroup, isItem } from "./types";
import { MenuGroupContent } from "./menu-group-content";
import { MobileMenu } from "./mobile-menu";

const isExternalLink = (href: string) => {
  return href.startsWith("http://") || href.startsWith("https://");
};

const menuContent = getMenuContent();

// vlt.io's marketing header in its flat `disableScrollEffect` form: no float-on-scroll, auth, or package search
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-13" as "Oct 13, 2026", read from the string: no time zone to get wrong. */
const runDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[(m ?? 0) - 1];
  return month === undefined ? iso : `${month} ${d}, ${y}`;
};

/*
 * The latest run beside the wordmark: its date, and the suite commit it ran,
 * linked to that commit. The commit is the run's own record (chart-data.json's
 * `commitSha`); a run that did not record one shows its date alone.
 */
const RunBadge = ({ date, commit }: { date: string; commit: string | null }) => (
  <span className="hidden h-6 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[0.6875rem] text-muted-foreground sm:inline-flex">
    <span className="sr-only">Latest run: </span>
    <time dateTime={date}>{runDate(date)}</time>
    {commit === null ? null : (
      <>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <a
          href={`https://github.com/vltpkg/benchmarks/commit/${commit}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm hover:text-foreground"
        >
          <span className="sr-only">commit </span>
          {commit.slice(0, 7)}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </>
    )}
  </span>
);

export const Navbar = ({
  className,
  run,
  ...props
}: React.ComponentProps<"header"> & {
  /** The latest run, from the root layout's catalog. */
  run?: { readonly date: string | null; readonly commit: string | null };
}) => {
  return (
    <header className={cn("sticky top-0 z-50 w-full", className)} {...props}>
      <nav
        className="bg-background border-border flex h-(--nav-height) w-full items-center justify-between gap-3 border-b px-3"
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-2">
          {/* opens the docs sidebar sheet on mobile */}
          <SidebarTrigger className="md:hidden" />
          <Logo />
          {run?.date == null ? null : <RunBadge date={run.date} commit={run.commit} />}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <NavigationMenu>
            <NavigationMenuList>
              {menuContent.map((item, i) => {
                if (isGroup(item)) {
                  return (
                    <NavigationMenuItem key={i}>
                      <NavigationMenuTrigger
                        className={cn("bg-transparent", item.hiddenDesktop && "hidden")}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={(e) => e.preventDefault()}
                      >
                        {item.group}
                      </NavigationMenuTrigger>
                      <MenuGroupContent group={item} />
                    </NavigationMenuItem>
                  );
                } else if (isItem(item)) {
                  const isExternal = isExternalLink(item.path);
                  return (
                    <NavigationMenuLink key={i} asChild className="rounded-md px-4">
                      {isExternal ? (
                        <a
                          className="hover:bg-accent rounded-md p-2 font-medium"
                          href={item.path}
                          target={item.target}
                          rel="noopener noreferrer"
                        >
                          {item.label}
                          {item.target === "_blank" && (
                            <span className="sr-only"> (opens in new window)</span>
                          )}
                        </a>
                      ) : (
                        <Link
                          className="hover:bg-accent rounded-md p-2 font-medium"
                          href={item.path}
                        >
                          {item.label}
                        </Link>
                      )}
                    </NavigationMenuLink>
                  );
                }
                return null;
              })}
              <NavigationMenuIndicator />
            </NavigationMenuList>
            <NavigationMenuViewport className="bg-white dark:bg-black" />
          </NavigationMenu>
        </div>
        <MobileMenu menuData={menuContent} />
      </nav>
      <SnapshotBanner latest={run?.date ?? null} />
    </header>
  );
};
