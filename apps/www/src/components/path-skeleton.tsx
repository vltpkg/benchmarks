"use client";

import { usePathname } from "next/navigation";
import { ReportSkeleton } from "@/components/report-shell";
import { isSectionId } from "@/lib/sections";

/**
 * The report's skeleton for the address. Every link to a report shares one
 * prefetched shell, which cannot know the benchmark or the scenario; a client
 * navigation knows the path at once, so the trail and the scenario still
 * paint with the shell.
 */
export const PathSkeleton = () => {
  const [, section, scenario] = usePathname().split("/");
  if (!isSectionId(section)) return null;
  return (
    <ReportSkeleton
      section={section}
      variation={scenario === undefined ? undefined : decodeURIComponent(scenario)}
      sectionHref={`/${section}`}
    />
  );
};
