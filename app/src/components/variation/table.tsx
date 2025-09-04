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
import { Clock, StopWatch } from "@/components/icons";

import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
} from "@/types/chart-data";
import type { SortingState } from "@tanstack/react-table";

interface VariationTableProps {
  title: string;
  description?: string;
  variationData: FixtureResult[];
  packageManagers: PackageManager[];
  chartData: BenchmarkChartData;
  isPerPackage: boolean;
  currentVariation: string;
}

const columnHelper = createColumnHelper<FixtureResult>();

export const VariationTable = ({
  title,
  description,
  variationData,
  packageManagers,
  chartData,
  isPerPackage,
  currentVariation,
}: VariationTableProps) => {
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
        columnHelper.accessor(pm as keyof FixtureResult, {
          header: () => {
            const version = getPackageManagerVersion(pm, chartData.versions);
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
            const value = info.getValue();
            if (typeof value === "number") {
              const unit = isPerPackage ? "ms" : "s";
              const decimals = isPerPackage ? 4 : 2;
              return (
                <div className="text-center">
                  <span className="font-mono">
                    {value.toFixed(decimals)}
                    {unit}
                  </span>
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
            const valueA = rowA.getValue(columnId) as number | undefined;
            const valueB = rowB.getValue(columnId) as number | undefined;

            if (valueA === undefined && valueB === undefined) return 0;
            if (valueA === undefined) return 1;
            if (valueB === undefined) return -1;

            return valueA - valueB;
          },
        }),
      ),
    ],
    [filteredPackageManagers, chartData.versions, isPerPackage],
  );

  const table = useReactTable({
    data: variationData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const Icon = isPerPackage ? StopWatch : Clock;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg w-full font-medium tracking-tighter mb-2 flex items-center gap-2 group">
          <Icon className="text-muted-foreground" />
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
          <p className="text-neutral-600 dark:text-white">{description}</p>
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
