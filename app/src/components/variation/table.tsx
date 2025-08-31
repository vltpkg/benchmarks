import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getPackageManagerVersion } from "@/lib/utils";
import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
} from "@/types/chart-data";

const ClockIcon = () => (
  <svg
    data-testid="geist-icon"
    height="18"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="18"
    style={{ color: "currentcolor" }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8ZM16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM8.75 4.75V4H7.25V4.75V7.875C7.25 8.18976 7.39819 8.48615 7.65 8.675L9.55 10.1L10.15 10.55L11.05 9.35L10.45 8.9L8.75 7.625V4.75Z"
      fill="currentColor"
    />
  </svg>
);

const StopwatchIcon = () => (
  <svg
    data-testid="geist-icon"
    height="18"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="18"
    style={{ color: "currentcolor" }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.35066 2.06247C5.96369 1.78847 6.62701 1.60666 7.32351 1.53473L7.16943 0.0426636C6.31208 0.1312 5.49436 0.355227 4.73858 0.693033L5.35066 2.06247ZM8.67651 1.53473C11.9481 1.87258 14.5 4.63876 14.5 8.00001C14.5 11.5899 11.5899 14.5 8.00001 14.5C4.63901 14.5 1.87298 11.9485 1.5348 8.67722L0.0427551 8.83147C0.459163 12.8594 3.86234 16 8.00001 16C12.4183 16 16 12.4183 16 8.00001C16 3.86204 12.8589 0.458666 8.83059 0.0426636L8.67651 1.53473ZM2.73972 4.18084C3.14144 3.62861 3.62803 3.14195 4.18021 2.74018L3.29768 1.52727C2.61875 2.02128 2.02064 2.61945 1.52671 3.29845L2.73972 4.18084ZM1.5348 7.32279C1.60678 6.62656 1.78856 5.96348 2.06247 5.35066L0.693033 4.73858C0.355343 5.4941 0.131354 6.31152 0.0427551 7.16854L1.5348 7.32279ZM8.75001 4.75V4H7.25001V4.75V7.875C7.25001 8.18976 7.3982 8.48615 7.65001 8.675L9.55001 10.1L10.15 10.55L11.05 9.35L10.45 8.9L8.75001 7.625V4.75Z"
      fill="currentColor"
    />
  </svg>
);

interface VariationTableProps {
  title: string;
  description?: string;
  variationData: FixtureResult[];
  packageManagers: PackageManager[];
  chartData: BenchmarkChartData;
  isPerPackage: boolean;
}

const columnHelper = createColumnHelper<FixtureResult>();

export const VariationTable = ({
  title,
  description,
  variationData,
  packageManagers,
  chartData,
  isPerPackage,
}: VariationTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("fixture", {
        header: "Fixture",
        cell: (info) => info.getValue(),
        enableSorting: true,
      }),
      ...packageManagers.map((pm) =>
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
                <span className="font-mono">
                  {value.toFixed(decimals)}
                  {unit}
                </span>
              );
            }
            return <span className="text-muted-foreground">-</span>;
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
    [packageManagers, chartData.versions, isPerPackage],
  );

  const table = useReactTable({
    data: variationData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: false,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight mb-2 flex items-center gap-2">
            {isPerPackage ? <StopwatchIcon /> : <ClockIcon />}
            {title}
          </h3>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute inset-0 my-auto ml-2" />
            <input
              placeholder="Filter data..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>
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
                      header.column.id === 'fixture' ? 'w-28' : 'w-18'
                    }`}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="dark:hover:bg-neutral-800 dark:hover:text-foreground hover:text-foreground hover:bg-neutral-200 text-muted-foreground h-8 px-2 ml-2 font-medium"
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
                        cell.column.id === 'fixture' ? 'pl-6 text-left' : 'px-3'
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

      <div className="flex border-border border-[1px] justify-between items-center text-sm text-muted-foreground bg-white dark:bg-muted/30 px-6 py-3 rounded-lg">
        <span>
          Showing{" "}
          <span className="font-mono">
            {table.getFilteredRowModel().rows.length}
          </span>{" "}
          of{" "}
          <span className="font-mono">
            {table.getCoreRowModel().rows.length}
          </span>{" "}
          results
        </span>
        <span className="font-medium">
          <span className="font-mono">
            {table.getFilteredRowModel().rows.length}
          </span>{" "}
          fixtures
        </span>
      </div>
    </div>
  );
};
