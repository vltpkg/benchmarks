import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getPackageManagerVersion, createSectionId } from "@/lib/utils";
import { ShareButton } from "@/components/share-button";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { Package } from "@/components/icons";

import type {
  PackageCountTableRow,
  PackageManager,
  PackageManagerVersions,
} from "@/types/chart-data";
import type { SortingState } from "@tanstack/react-table";

interface PackageCountTableProps {
  title: string;
  description?: string;
  packageCountData: PackageCountTableRow[];
  packageManagers: PackageManager[];
  versions?: PackageManagerVersions;
  currentVariation: string;
}

const columnHelper = createColumnHelper<PackageCountTableRow>();

export const PackageCountTable = ({
  title,
  description,
  packageCountData,
  packageManagers,
  versions,
  currentVariation,
}: PackageCountTableProps) => {
  const { enabledPackageManagers } = usePackageManagerFilter();
  const [sorting, setSorting] = useState<SortingState>([]);

  // Filter package managers based on global filter
  const filteredPackageManagers = useMemo(
    () => packageManagers.filter((pm) => enabledPackageManagers.has(pm)),
    [packageManagers, enabledPackageManagers],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("fixture", {
        header: "Fixture",
        cell: (info) => info.getValue(),
        enableSorting: true,
      }),
      ...filteredPackageManagers.map((pm) =>
        columnHelper.accessor((row) => row.packageCounts[pm], {
          id: pm,
          header: () => {
            const version = getPackageManagerVersion(pm, versions);
            return version ? (
              <div className="text-center">
                <div className="font-bold">{pm}</div>
                <div className="text-xs text-muted-foreground">{version}</div>
              </div>
            ) : (
              <span className="font-bold">{pm}</span>
            );
          },
          cell: (info) => {
            const entry = info.getValue();
            if (entry && typeof entry.count === "number") {
              const { count, minCount, maxCount } = entry;

              // For vlt, show range if min/max are available
              if (
                pm === "vlt" &&
                minCount !== undefined &&
                maxCount !== undefined &&
                minCount !== maxCount
              ) {
                return (
                  <div className="text-center font-mono">
                    <div>{count}</div>
                    <div className="text-xs text-muted-foreground">
                      ({minCount}-{maxCount})
                    </div>
                  </div>
                );
              }

              return (
                <div className="text-center">
                  <span className="font-mono">{count}</span>
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
    [filteredPackageManagers, versions],
  );

  const table = useReactTable({
    data: packageCountData,
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
          <Package className="text-muted-foreground" />
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

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table className="cursor-default">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`${
                      header.column.id === "fixture"
                        ? "w-28"
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
                        cell.column.id === "fixture"
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
                  No package count data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
