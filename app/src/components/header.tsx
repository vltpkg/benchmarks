import { forwardRef, useContext, createContext, useMemo } from "react";
import { useLocation, NavLink } from "react-router";
import { PackageManagerFilter } from "@/components/package-manager-filter";
import { FixtureFilter } from "@/components/fixture-filter";
import { VariationDropdown } from "@/components/variation-dropdown";
import { Benchmarks } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  cn,
  calculateLeaderboard,
  getAvailableFixtures,
  getAvailablePackageManagers,
  getVariationCategories,
  getPackageManagerDisplayName,
  sortVariations,
} from "@/lib/utils";
import { getPackageManagerIcon } from "@/lib/get-icons";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import type {
  BenchmarkChartData,
  PackageManager,
  Variation,
} from "@/types/chart-data";
import type { ComponentProps, PropsWithChildren } from "react";

interface HeaderContextValue {
  categories: ReturnType<typeof getVariationCategories> | null;
  location: ReturnType<typeof useLocation>;
  chartData: BenchmarkChartData | null;
  sortedVariations: Variation[];
  currentVariation: Variation | null;
}

const HeaderContext = createContext<HeaderContextValue | undefined>(undefined);

export const Header = ({
  chartData,
}: {
  chartData: HeaderContextValue["chartData"];
}) => {
  const location = useLocation();
  const sortedVariations = chartData
    ? sortVariations([...chartData.chartData.variations])
    : [];
  const currentVariation = (location.pathname.split("/")[2] ||
    sortedVariations[0]) as Variation;
  const categories = chartData
    ? getVariationCategories(chartData.chartData.variations)
    : null;

  return (
    <HeaderContext.Provider
      value={{
        location,
        categories,
        chartData,
        sortedVariations,
        currentVariation,
      }}
    >
      <HeaderWrapper>
        <HeaderSection>
          <div className="flex md:flex-row flex-col items-start md:items-center md:justify-between gap-6">
            <HeaderLogo />

            <HeaderNavigation />
          </div>
        </HeaderSection>
        <HeaderSection className="hidden md:block">
          <HeaderVariationNavigation />
        </HeaderSection>
        <HeaderSection className="hidden md:block">
          <HeaderLeaderboard />
        </HeaderSection>
      </HeaderWrapper>
    </HeaderContext.Provider>
  );
};

interface NavigationOption {
  label: string;
  href: string;
}

const HeaderNavigation = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    const { chartData, location, currentVariation, sortedVariations } =
      useHeaderContext();
    const variationData = chartData
      ? chartData.chartData.data[currentVariation as Variation] || []
      : [];
    const fixtures = useMemo(
      () => getAvailableFixtures(variationData),
      [variationData],
    );
    const packageManagers = useMemo(
      () =>
        chartData
          ? getAvailablePackageManagers(
              variationData,
              chartData.chartData.packageManagers,
            )
          : [],
      [chartData, variationData],
    );

    const navigationOptions: NavigationOption[] = [
      {
        label: "Package Managers",
        href: "package-managers",
      },
      {
        label: "Task Runners",
        href: "task-runners",
      },
      {
        label: "Registry",
        href: "registry",
      },
    ];

    return (
      <div
        ref={ref}
        className={cn("flex md:flex-row flex-col gap-6", className)}
        {...props}
      >
        <div className="flex gap-4 md:gap-2">
          {navigationOptions.map((option, idx) => {
            const isActive = location.pathname.split("/")[1] === option.href;

            return (
              <Button
                key={`${option.label}-${idx}`}
                size="sm"
                asChild
                className={cn(
                  "cursor-default rounded-lg shadow-none bg-transparent hover:bg-neutral-200 [&[data-state=open]>svg[data-id=chevron]]:rotate-90 dark:hover:bg-neutral-700 dark:bg-transparent text-black dark:text-white w-fit max-w-full",
                  isActive && "dark:bg-neutral-500 bg-neutral-200",
                )}
              >
                <NavLink to={`/${option.href}`}>{option.label}</NavLink>
              </Button>
            );
          })}
        </div>

        {chartData && (
          <div className="flex items-center md:justify-none md:w-fit w-full gap-2">
            <PackageManagerFilter packageManagers={packageManagers} />
            <FixtureFilter fixtures={fixtures} />
            <VariationDropdown
              currentVariation={currentVariation ?? "average"}
              sortedVariations={(() => {
                const baseRoute = location.pathname.split("/")[1];
                const categories = getVariationCategories(
                  chartData.chartData.variations,
                );
                if (baseRoute === "registry") {
                  const registry = categories.find(
                    (cat) => cat.title === "Registry",
                  );
                  return registry?.variations ?? [];
                } else if (baseRoute === "task-runners") {
                  const taskRunners = categories.find(
                    (cat) => cat.title === "Task Execution",
                  );
                  return taskRunners?.variations ?? [];
                } else {
                  const pm = categories.find(
                    (cat) => cat.title === "Package Management",
                  );
                  return pm?.variations ?? sortedVariations;
                }
              })()}
            />
          </div>
        )}
      </div>
    );
  },
);
HeaderNavigation.displayName = "HeaderNavigation";

const HeaderLogo = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex md:flex-row flex-col items-start md:items-center gap-2",
        className,
      )}
      {...props}
    >
      <Benchmarks className="size-10 md:size-6" />
      <div className="flex flex-col md:flex-row items-start md:items-center md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
      </div>
    </div>
  ),
);
HeaderLogo.displayName = "HeaderTitle";

const HeaderWrapper = forwardRef<
  HTMLDivElement,
  PropsWithChildren<ComponentProps<"header">>
>(({ className, children, ...props }, ref) => (
  <header
    ref={ref}
    className={cn("bg-card/50 backdrop-blur-sm sticky top-0 z-50", className)}
    {...props}
  >
    {children}
  </header>
));
HeaderWrapper.displayName = "HeaderWrapper";

const HeaderSection = forwardRef<
  HTMLDivElement,
  PropsWithChildren<ComponentProps<"div">>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-border/50 border-b empty:hidden", className)}
    {...props}
  >
    <div className="md:max-w-7xl md:mx-auto py-6 px-6 md:py-4">{children}</div>
  </div>
));
HeaderSection.displayName = "HeaderSection";

interface LeaderBoardItemProps {
  packageManager: PackageManager;
  averageTime: number;
  idx: number;
}

const LeaderBoardItem = ({
  packageManager,
  averageTime,
  idx,
}: LeaderBoardItemProps) => {
  const Icon = getPackageManagerIcon(packageManager);
  const rank = idx + 1;
  const displayName = getPackageManagerDisplayName(packageManager);

  return (
    <div className="relative flex bg-card items-center gap-2 px-2 py-1.5 rounded-lg border border-border/50">
      <div className="text-lg text-muted-foreground font-mono font-medium flex-shrink-0 px-1">
        {rank}
      </div>

      <div className="flex items-center gap-2">
        <div className="items-center justify-center flex">
          {Icon && (
            <Icon
              size={28}
              className={cn(packageManager === "vlt" && "dark:text-white")}
            />
          )}
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium">{displayName}</p>
          <p className="text-[10px] text-muted-foreground">
            {averageTime.toFixed(1)}ms/pkg
          </p>
        </div>
      </div>
    </div>
  );
};

const HeaderLeaderboard = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    const { enabledPackageManagers } = usePackageManagerFilter();
    const { chartData, location, currentVariation } = useHeaderContext();

    // Only show leaderboard on package-managers routes, not task-runners routes
    const baseRoute = location.pathname.split("/")[1];

    const leaderboard = useMemo(() => {
      if (chartData && currentVariation) {
        const fullLeaderboard = calculateLeaderboard(
          chartData,
          currentVariation,
        );
        return fullLeaderboard.filter((item) =>
          enabledPackageManagers.has(item.packageManager),
        );
      }
    }, [chartData, enabledPackageManagers, currentVariation]);

    if (baseRoute !== "package-managers") return null;

    if (leaderboard && leaderboard.length === 0) return null;

    return (
      <ScrollArea className="relative max-w-7xl">
        <div ref={ref} className={cn("flex gap-2", className)} {...props}>
          {leaderboard &&
            leaderboard.map((item, idx) => (
              <LeaderBoardItem
                key={`${item.packageManager}-${idx}`}
                idx={idx}
                averageTime={item.averageTime}
                packageManager={item.packageManager}
              />
            ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  },
);
HeaderLeaderboard.displayName = "HeaderLeaderboard";

const VariationButton = ({
  baseRoute,
  variation,
  isActive,
}: {
  variation: string;
  isActive: boolean;
  baseRoute: string;
}) => {
  return (
    <Button
      key={variation}
      size="sm"
      asChild
      className={cn(
        "cursor-default rounded-lg dark:border-neutral-700 dark:hover:border-neutral-600 border hover:border-neutral-300 border-neutral-200 shadow-none bg-neutral-100 hover:bg-neutral-200 [&[data-state=open]>svg[data-id=chevron]]:rotate-90 dark:hover:bg-neutral-700 dark:bg-neutral-800 text-black dark:text-white w-fit max-w-full",
        isActive &&
          "dark:bg-neutral-600 bg-neutral-300 border-neutral-400 dark:border-neutral-500",
      )}
    >
      <NavLink to={`/${baseRoute}/${variation}`}>{variation}</NavLink>
    </Button>
  );
};

const HeaderVariationNavigation = forwardRef<
  HTMLDivElement,
  ComponentProps<"div">
>(({ className }, ref) => {
  const { location, categories } = useHeaderContext();
  const baseRoute = location.pathname.split("/")[1];

  if (!categories) return null;

  const packageManagement = categories.find(
    (cat) => cat.title === "Package Management",
  );
  const taskRunners = categories.find((cat) => cat.title === "Task Execution");
  const registry = categories.find((cat) => cat.title === "Registry");

  if (!packageManagement) return null;

  return (
    <ScrollArea ref={ref} className="max-w-7xl">
      <div className={cn("relative flex gap-2", className)}>
        {baseRoute === "package-managers" &&
          packageManagement.variations.map((variation) => {
            const isActive = location.pathname.split("/")[2] === variation;

            return (
              <VariationButton
                key={variation}
                variation={variation}
                isActive={isActive}
                baseRoute="package-managers"
              />
            );
          })}
        {baseRoute === "task-runners" &&
          taskRunners?.variations.map((variation) => {
            const isActive = location.pathname.split("/")[2] === variation;

            return (
              <VariationButton
                key={variation}
                variation={variation}
                isActive={isActive}
                baseRoute="task-runners"
              />
            );
          })}
        {baseRoute === "registry" &&
          registry?.variations.map((variation) => {
            const isActive = location.pathname.split("/")[2] === variation;

            return (
              <VariationButton
                key={variation}
                variation={variation}
                isActive={isActive}
                baseRoute="registry"
              />
            );
          })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
});
HeaderVariationNavigation.displayName = "HeaderVariationNavigation";

const useHeaderContext = () => {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error("useHeaderContext must be used within a HeaderProvider");
  }
  return context;
};
