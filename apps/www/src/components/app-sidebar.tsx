"use client";

import { useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { SidebarCite } from "@/components/cite";
import { Bluesky } from "@/components/icons/bluesky";
import { Discord } from "@/components/icons/discord";
import { Github } from "@/components/icons/github";
import { Linkedin } from "@/components/icons/linkedin";
import { TwitterX } from "@/components/icons/twitterx";
import { Rule } from "@/components/rule";
import { SearchDialog, SearchTrigger } from "@/components/search";
import type { SuggestionGroup } from "@/components/search";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type * as PageTree from "@/lib/page-tree";
import { WithLocation } from "@/components/with-location";
import { cn } from "@/lib/utils";

/*
 * The vlt docs' AppSidebar (vltpkg/www/docs/src/components/app-sidebar.tsx):
 * its header (search), its root view's groups -- the etched `Rule` between
 * them, the pixel-face labels, the rows and their current-page state -- and
 * its footer (socials, theme). What differs:
 *
 * - no drill-in. There are three benchmarks, so all three are open at the
 *   root, always: each a group headed by a link to the benchmark's own page,
 *   set as the docs set a section's title, then its scenarios. Package
 *   managers' sit under Cold / Warm / CI captions -- small, muted, sans, so
 *   they read as labels rather than links -- each run of pages indented on a
 *   hairline guide, as a nested menu. No back arrow, nothing collapses.
 * - the Methodology page is a loose page at the root, above the benchmarks,
 *   as the docs' root lists loose pages before a `Rule`
 * - the tree is `lib/page-tree.ts`'s, built from what the page's date
 *   published, not fumadocs' from MDX
 * - every link carries the page's query (fixture, hidden tools, window, ...),
 *   as the old scenario picker's did; a value another scenario does not hold
 *   is ignored there
 * - it is the root layout's, so it never remounts: its data is the latest
 *   run's catalog (`lib/catalog.ts`), and the current page comes from the
 *   address, not from the page
 * - above the footer, a card citing the page (`SidebarCite`)
 * - the sidebar keeps its right border (the docs pass `border-none`), and the
 *   socials' GitHub link points at this repository
 */
const decode = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

// paths in the tree are unencoded; `+` arrives as %2B from links that encoded it (`decode`)

const row =
  "h-9 rounded-lg px-3 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-foreground";

/* The row just clicked, while its page is on its way: a quiet dot at the row's end. */
const Pending = () =>
  useLinkStatus().pending ? (
    <span
      aria-hidden
      className="ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-foreground/40 motion-safe:animate-pulse"
    />
  ) : null;

const PageLink = ({ page, className }: { page: PageTree.Item; className?: string }) => {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <WithLocation>
        {({ pathname, query }) => (
          <SidebarMenuButton asChild className={cn(row, className)}>
            <Link
              href={query ? `${page.url}?${query}` : page.url}
              aria-current={pathname !== null && page.url === decode(pathname) ? "page" : undefined}
              onClick={() => setOpenMobile(false)}
            >
              <span>{page.name}</span>
              <Pending />
            </Link>
          </SidebarMenuButton>
        )}
      </WithLocation>
    </SidebarMenuItem>
  );
};

/* A page, or a captioned run of them: a non-interactive caption, then its pages on a guide line. */
const Entry = ({ node }: { node: PageTree.Node }) =>
  node.type === "page" ? (
    <PageLink page={node} />
  ) : node.type === "folder" ? (
    <li className="mt-3">
      <SidebarGroupLabel className="h-7 px-3 text-xs font-medium text-muted-foreground">
        {node.name}
      </SidebarGroupLabel>
      <SidebarMenu aria-label={node.name} className="ml-3 w-auto border-l pl-2">
        {node.children.map((child) => (
          <Entry key={child.$id ?? child.name} node={child} />
        ))}
      </SidebarMenu>
    </li>
  ) : null;

/* Search's empty-query list: the loose pages, and each benchmark's own page. */
const toSuggestions = (tree: PageTree.Root): SuggestionGroup[] => [
  {
    links: tree.children.flatMap((node) =>
      node.type === "page"
        ? [{ name: node.name, url: node.url }]
        : node.type === "folder" && node.index
          ? [{ name: node.name, url: node.index.url, folder: true }]
          : [],
    ),
  },
];

// from vlt.io's content/marketing/socials.ts; GitHub points at this repo rather than the org
const socials = [
  {
    href: "https://github.com/vltpkg/benchmarks",
    label: "vltpkg/benchmarks on GitHub",
    Icon: Github,
  },
  {
    href: "https://www.linkedin.com/company/vltpkg/",
    label: "vlt on LinkedIn",
    Icon: Linkedin,
  },
  { href: "https://x.com/vltpkg", label: "vlt on X", Icon: TwitterX },
  {
    href: "https://bsky.app/profile/vlt.sh",
    label: "vlt on Bluesky",
    Icon: Bluesky,
  },
  {
    href: "https://discord.gg/qdbXTqxZzZ",
    label: "vlt on Discord",
    Icon: Discord,
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  tree: PageTree.Root;
  /** The latest run's date, which the citation cites when the address pins none. */
  latest: string | null;
};

export function AppSidebar({ tree, latest, ...props }: AppSidebarProps) {
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // the dialog sits outside <Sidebar> so ⌘K still works while the mobile sheet is closed
  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader className="px-2 pt-4 pb-0">
          <SearchTrigger ref={searchTrigger} onClick={() => setSearchOpen(true)} />
        </SidebarHeader>
        {/* browsers without scroll-driven animations get no fade rather than a static one over the first rows */}
        <SidebarContent className="scroll-fade overflow-x-hidden pt-2 [--scroll-fade-size:--spacing(8)] not-supports-[animation-timeline:scroll()]:[--scroll-fade-size:0px]">
          <nav aria-label="Benchmarks" className="min-w-0 px-2 pb-4">
            {tree.children.map((node, i) =>
              node.type === "page" ? (
                /* Loose pages (About, Methodology) sit together: a rule only
                   where a page follows a benchmark, never between two pages. */
                <SidebarGroup
                  key={node.$id ?? node.name}
                  className={`px-0 ${tree.children[i - 1]?.type === "page" ? "-mt-2 pt-0" : ""}`}
                >
                  {i > 0 && tree.children[i - 1]?.type !== "page" && <Rule className="mb-2" />}
                  <SidebarMenu>
                    <PageLink page={node} />
                  </SidebarMenu>
                </SidebarGroup>
              ) : node.type !== "folder" ? null : (
                <SidebarGroup key={node.$id ?? node.name} className="px-0">
                  {i > 0 && <Rule className="mb-2" />}
                  <SidebarMenu>
                    {/* The benchmark's own page, `/{section}`, under its own name: the group's title. */}
                    {node.index && (
                      <PageLink
                        page={node.index}
                        className="font-semibold text-sidebar-foreground aria-[current=page]:font-semibold"
                      />
                    )}
                    {node.children.map((child) => (
                      <Entry key={child.$id ?? child.name} node={child} />
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              ),
            )}
          </nav>
        </SidebarContent>
        <div className="px-4 pt-2">
          <SidebarCite latest={latest} />
        </div>
        <SidebarFooter className="px-4">
          <div className="bg-card flex items-center rounded-xl border p-1">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 grid size-8 place-items-center rounded-md transition-colors outline-none focus-visible:ring-2"
              >
                <Icon aria-hidden className="size-4" />
              </a>
            ))}
            <div aria-hidden className="bg-border mr-1 ml-auto h-5 w-px" />
            <ThemeSwitcher />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        returnFocus={searchTrigger}
        suggestions={toSuggestions(tree)}
        tree={tree}
      />
    </>
  );
}
