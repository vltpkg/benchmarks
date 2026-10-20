import { createContext, useContext, useState, type ReactNode } from "react";
import type { Fixture } from "@/types/chart-data";

interface FixtureFilterContextType {
  enabledFixtures: Set<Fixture>;
  toggleFixture: (fixture: Fixture) => void;
  isFixtureEnabled: (fixture: Fixture) => boolean;
  resetFilters: (allFixtures: Fixture[]) => void;
  hasFilters: boolean;
}

const FixtureFilterContext = createContext<
  FixtureFilterContextType | undefined
>(undefined);

interface FixtureFilterProviderProps {
  children: ReactNode;
  initialFixtures: Fixture[] | [];
}

export const FixtureFilterProvider = ({
  children,
  initialFixtures,
}: FixtureFilterProviderProps) => {
  const [enabledFixtures, setEnabledFixtures] = useState<Set<Fixture>>(
    new Set(initialFixtures),
  );

  const toggleFixture = (fixture: Fixture) => {
    setEnabledFixtures((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fixture)) {
        newSet.delete(fixture);
      } else {
        newSet.add(fixture);
      }
      return newSet;
    });
  };

  const isFixtureEnabled = (fixture: Fixture) => {
    return enabledFixtures.has(fixture);
  };

  const resetFilters = (allFixtures: Fixture[]) => {
    setEnabledFixtures((prev) => {
      const next = new Set(prev);
      allFixtures.forEach((fixture) => next.add(fixture));
      return next;
    });
  };

  const hasFilters = enabledFixtures.size !== initialFixtures.length;

  return (
    <FixtureFilterContext.Provider
      value={{
        enabledFixtures,
        toggleFixture,
        isFixtureEnabled,
        resetFilters,
        hasFilters,
      }}
    >
      {children}
    </FixtureFilterContext.Provider>
  );
};

export const useFixtureFilter = () => {
  const context = useContext(FixtureFilterContext);
  if (context === undefined) {
    throw new Error(
      "useFixtureFilter must be used within a FixtureFilterProvider",
    );
  }
  return context;
};
