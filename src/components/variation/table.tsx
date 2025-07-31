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
import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
} from "@/types/chart-data";

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
          header: pm,
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
    [packageManagers],
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
          <h3 className="text-lg font-semibold tracking-tight mb-2">{title}</h3>
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
                  <TableHead key={header.id}>
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
                    <TableCell key={cell.id} className="font-medium pl-6">
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
