import { createContext, useContext, useState, type ReactNode } from "react";
import type { PackageManager } from "@/types/chart-data";

interface PackageManagerFilterContextType {
  enabledPackageManagers: Set<PackageManager>;
  togglePackageManager: (pm: PackageManager) => void;
  isPackageManagerEnabled: (pm: PackageManager) => boolean;
  resetFilters: (allPackageManagers: PackageManager[]) => void;
  hasFilters: boolean;
}

const PackageManagerFilterContext = createContext<
  PackageManagerFilterContextType | undefined
>(undefined);

interface PackageManagerFilterProviderProps {
  children: ReactNode;
  initialPackageManagers: PackageManager[] | [];
}

export const PackageManagerFilterProvider = ({
  children,
  initialPackageManagers,
}: PackageManagerFilterProviderProps) => {
  const [enabledPackageManagers, setEnabledPackageManagers] = useState<
    Set<PackageManager>
  >(new Set(initialPackageManagers));

  const togglePackageManager = (pm: PackageManager) => {
    setEnabledPackageManagers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pm)) {
        newSet.delete(pm);
      } else {
        newSet.add(pm);
      }
      return newSet;
    });
  };

  const isPackageManagerEnabled = (pm: PackageManager) => {
    return enabledPackageManagers.has(pm);
  };

  const resetFilters = (allPackageManagers: PackageManager[]) => {
    setEnabledPackageManagers(new Set(allPackageManagers));
  };

  const hasFilters =
    enabledPackageManagers.size !== initialPackageManagers.length;

  return (
    <PackageManagerFilterContext.Provider
      value={{
        enabledPackageManagers,
        togglePackageManager,
        isPackageManagerEnabled,
        resetFilters,
        hasFilters,
      }}
    >
      {children}
    </PackageManagerFilterContext.Provider>
  );
};

export const usePackageManagerFilter = () => {
  const context = useContext(PackageManagerFilterContext);
  if (context === undefined) {
    throw new Error(
      "usePackageManagerFilter must be used within a PackageManagerFilterProvider",
    );
  }
  return context;
};
