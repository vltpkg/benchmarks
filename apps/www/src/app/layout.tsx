import type { Metadata } from "next";
import { Geist_Mono, Geist_Pixel, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { rootMetadata } from "@/lib/metadata";
import { treeFor } from "@/lib/page-tree";

/*
 * The vlt docs site's three faces (vltpkg/www/docs/src/lib/fonts.ts).
 *
 * Inter sets everything that is read, headings included -- emphasis comes from
 * weight and tracking, not from a second family. Geist Mono carries every
 * label, column head and number, which is what makes the data read as data.
 * Geist Pixel is the docs' sidebar labels and breadcrumbs, and only those.
 */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const pixel = Geist_Pixel({
  subsets: ["latin"],
  variable: "--font-geist-pixel",
  // next has no metrics for this face, so an explicit fallback stops turbopack trying to size one
  fallback: ["monospace"],
});

/* The title template and site name, shared with every page: `lib/metadata.ts`.
   The icons are files in this directory, vlt.io's own, found by Next. */
export const metadata: Metadata = rootMetadata;

/*
 * The docs' shell (vltpkg/www/docs/src/app/layout.tsx and its providers): the
 * sidebar provider as a column -- the navbar on top, then the row of sidebar
 * and content on the docs' inset, then the footer, full width under both.
 *
 * All of it is the layout's, so a navigation re-renders the page and nothing
 * else: the sidebar keeps its scroll and its search. Its data
 * is the latest run's catalog, fetched here once per full load. Changed from
 * the docs: the sidebar is `sticky` in its row rather than `fixed`, so it stops
 * where the footer starts; the inset has `min-w-0`, so a wide chart shrinks to
 * the column instead of pushing it; and its top padding is the sidebar
 * header's (`pt-4`), so a page's first row -- breadcrumbs and filters -- lines
 * up with the search button across the page. The content sits on `max-w-6xl`.
 */
const RootLayout = async ({ children }: { children: ReactNode }) => {
  const catalog = await loadCatalog(dataClient());
  const tree = treeFor(catalog.scenarios);
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable} ${pixel.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* The reader's Report or Data choice, on <html> before paint (components/view-toggle.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("view")==="data")document.documentElement.dataset.view="data"}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col text-body">
        <ThemeProvider>
          {/* nuqs: every query parameter is defined in lib/params.ts. */}
          <NuqsAdapter>
            <TooltipProvider>
              <SidebarProvider
                className="flex-col"
                style={{ "--sidebar-width": "18rem" } as CSSProperties}
              >
                <Navbar run={{ date: catalog.latest, commit: catalog.commit }} />
                <div className="flex flex-1">
                  <AppSidebar
                    tree={tree}
                    latest={catalog.latest}
                    className="sticky top-(--header-height) h-[calc(100svh-var(--header-height))]!"
                  />
                  <SidebarInset className="min-w-0 px-4 pt-4 pb-8 md:px-16 md:pb-12 data-mode:md:pl-8">
                    <div aria-hidden className="page-fade page-fade-top" />
                    {/* Data mode is charts and tables, so it takes more of the screen (the right gutter stays, for the minimap). */}
                    <div className="mx-auto w-full max-w-6xl data-mode:max-w-[96rem]">
                      {children}
                    </div>
                    <div aria-hidden className="page-fade page-fade-bottom" />
                  </SidebarInset>
                </div>
                <SiteFooter />
                <ScrollToTop />
              </SidebarProvider>
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
