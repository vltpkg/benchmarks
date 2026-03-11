import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown, Terminal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  getPackageManagerDisplayName,
  getPackageManagerVersion,
  getFixtureDisplayName,
  sortFixtures,
  createSectionId,
  isRegistryVariation,
} from "@/lib/utils";
import { ShareButton } from "@/components/share-button";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";

import type {
  Fixture,
  PackageCountEntry,
  ProcessCountTableRow,
  PackageManager,
  PackageManagerVersions,
} from "@/types/chart-data";
import type { SortingState } from "@tanstack/react-table";

interface ProcessCountTableProps {
  title: string;
  description?: string;
  processCountData: ProcessCountTableRow[];
  packageManagers: PackageManager[];
  versions?: PackageManagerVersions;
  currentVariation: string;
}

interface TransposedProcessCountRow {
  packageManager: PackageManager;
  processCountsByFixture: Partial<Record<Fixture, PackageCountEntry>>;
}

const columnHelper = createColumnHelper<TransposedProcessCountRow>();

export const ProcessCountTable = ({
  title,
  description,
  processCountData,
  packageManagers,
  versions,
  currentVariation,
}: ProcessCountTableProps) => {
  const { enabledPackageManagers } = usePackageManagerFilter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const isRegistry = isRegistryVariation(currentVariation);
  const showVersions = !isRegistry;

  // Filter package managers based on global filter
  const filteredPackageManagers = useMemo(
    () => packageManagers.filter((pm) => enabledPackageManagers.has(pm)),
    [packageManagers, enabledPackageManagers],
  );

  const fixtures = useMemo(
    () =>
      sortFixtures(
        Array.from(new Set(processCountData.map((item) => item.fixture))) as Fixture[],
      ),
    [processCountData],
  );

  const transposedData = useMemo(
    () =>
      filteredPackageManagers.map((packageManager) => {
        const processCountsByFixture: Partial<Record<Fixture, PackageCountEntry>> = {};

        processCountData.forEach((fixtureResult) => {
          const entry = fixtureResult.processCounts[packageManager];
          if (entry && typeof entry.count === "number") {
            processCountsByFixture[fixtureResult.fixture] = entry;
          }
        });

        return {
          packageManager,
          processCountsByFixture,
        };
      }),
    [filteredPackageManagers, processCountData],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("packageManager", {
        header: isRegistry ? "Registry" : "Package Manager",
        cell: (info) => {
          const packageManager = info.getValue();
          const version = showVersions
            ? getPackageManagerVersion(packageManager, versions)
            : undefined;
          const displayName = getPackageManagerDisplayName(packageManager, {
            isRegistryVariation: isRegistry,
          });
          return version ? (
            <div className="text-left">
              <div className="font-bold">{displayName}</div>
              <div className="text-xs text-muted-foreground">{version}</div>
            </div>
          ) : (
            <span className="font-bold">{displayName}</span>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) =>
          getPackageManagerDisplayName(rowA.original.packageManager, {
            isRegistryVariation: isRegistry,
          }).localeCompare(
            getPackageManagerDisplayName(rowB.original.packageManager, {
              isRegistryVariation: isRegistry,
            }),
          ),
      }),
      ...fixtures.map((fixture) =>
        columnHelper.accessor((row) => row.processCountsByFixture[fixture], {
          id: fixture,
          header: () => <span className="font-bold">{getFixtureDisplayName(fixture)}</span>,
          cell: (info) => {
            const entry = info.getValue();
            if (entry && typeof entry.count === "number") {
              const { count, minCount, maxCount } = entry;

              if (
                minCount !== undefined &&
                maxCount !== undefined &&
                minCount !== maxCount
              ) {
                return (
                  <div className="text-center font-mono">
                    <div>{count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      ({minCount.toLocaleString()}-{maxCount.toLocaleString()})
                    </div>
                  </div>
                );
              }

              return (
                <div className="text-center">
                  <span className="font-mono">{count.toLocaleString()}</span>
                </div>
              );
            }
            return (
              <div className="text-center">
                <span className="text-muted-foreground">-</span>
              </div>
            );
          },
          enableSorting: true,
          sortingFn: (rowA, rowB, columnId) => {
            const entryA = rowA.getValue(columnId) as
              | { count: number }
              | undefined;
            const entryB = rowB.getValue(columnId) as
              | { count: number }
              | undefined;

            if (!entryA && !entryB) return 0;
            if (!entryA) return 1;
            if (!entryB) return -1;

            return entryA.count - entryB.count;
          },
        }),
      ),
    ],
    [fixtures, versions, showVersions, isRegistry],
  );

  const table = useReactTable({
    data: transposedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium tracking-tighter mb-2 flex items-center gap-2 group">
          <Terminal className="text-muted-foreground" />
          <span>{title}</span>
          <ShareButton
            variation={currentVariation}
            section={createSectionId(title)}
            size="sm"
            variant="ghost"
            className="ml-auto"
          />
        </h3>
        {description && (
          <p className="text-sm font-medium text-neutral-500">{description}</p>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <Table className="cursor-default min-w-[600px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`${
                      header.column.id === "packageManager"
                        ? "w-52"
                        : "w-18 text-center"
                    }`}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="dark:hover:bg-neutral-800 dark:hover:text-foreground hover:text-foreground hover:bg-neutral-200 text-muted-foreground h-8 px-3 font-medium"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        ) : header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <span className="font-medium">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`font-medium text-center ${
                        cell.column.id === "packageManager"
                          ? "pl-6 text-left"
                          : "pl-3 pr-7"
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No process count data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
