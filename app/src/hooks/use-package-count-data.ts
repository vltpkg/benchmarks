import { useState, useEffect } from "react";
import type {
  Variation,
  Fixture,
  PackageCountData,
  PackageCountTableRow,
} from "@/types/chart-data";
import { sortFixtures } from "@/lib/utils";

interface UsePackageCountDataReturn {
  packageCountData: PackageCountTableRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const usePackageCountData = (
  variation: Variation,
): UsePackageCountDataReturn => {
  const [packageCountData, setPackageCountData] = useState<
    PackageCountTableRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fixtures: Fixture[] = sortFixtures([
    "next",
    "astro",
    "svelte",
    "vue",
    "large",
    "run",
  ]);

  const fetchPackageCountData = async () => {
    try {
      setLoading(true);
      setError(null);

      const results: PackageCountTableRow[] = [];

      for (const fixture of fixtures) {
        try {
          const url = `/latest/${fixture}-${variation}-package-count.json`;
          const response = await fetch(url);

          if (response.ok) {
            const packageCounts: PackageCountData = await response.json();
            results.push({
              fixture,
              variation,
              packageCounts,
            });
          } else {
            console.warn(
              `Package count data not found for ${fixture}-${variation}`,
            );
          }
        } catch (e) {
          console.warn(
            `Failed to load package count data for ${fixture}-${variation}:`,
            e,
          );
        }
      }

      setPackageCountData(results);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Unknown error occurred";
      console.error("Error fetching package count data:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackageCountData();
  }, [variation]);

  return {
    packageCountData,
    loading,
    error,
    refetch: fetchPackageCountData,
  };
};
