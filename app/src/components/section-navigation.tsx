import { Link, useParams } from "react-router";
import { createDeepLink, createSectionId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BenchmarkChartData, Fixture } from "@/types/chart-data";

interface SectionNavigationProps {
  chartData: BenchmarkChartData;
  currentVariation: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
}

interface NavigationLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
}

const NavigationLink = ({ to, children, className, isActive }: NavigationLinkProps) => (
  <Link
    to={to}
    className={cn(
      "block px-3 py-2 text-sm rounded-md transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      isActive && "bg-primary text-primary-foreground",
      className
    )}
  >
    {children}
  </Link>
);

export const SectionNavigation = ({ chartData, currentVariation }: SectionNavigationProps) => {
  const { section } = useParams<{ section?: string }>();

  const sections: Section[] = [
    {
      id: "per-package-install-time-by-fixture",
      title: "Per Package Charts",
      description: "Performance per package installed"
    },
    {
      id: "total-install-time-by-fixture",
      title: "Total Time Charts",
      description: "Overall installation time"
    },
    {
      id: "total-install-time-data",
      title: "Total Time Tables",
      description: "Detailed timing data"
    },
    {
      id: "per-package-install-time-data",
      title: "Per Package Tables",
      description: "Per-package timing data"
    },
    {
      id: "package-count-data",
      title: "Package Counts",
      description: "Number of packages installed"
    }
  ];

  // Get fixtures for the current variation
  const fixtures = chartData.chartData.data[currentVariation]?.map(item => item.fixture) || [];

  return null;
};
