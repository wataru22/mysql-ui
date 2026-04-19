import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getTableData, getTableStructure, deleteRow, updateRow } from "@/lib/api";
import type { SortConfig, FilterConfig, TableColumn } from "@/lib/types";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AddRowDialog } from "@/components/add-row-dialog";
import { EditCellDialog } from "@/components/edit-cell-dialog";
import { FilterDialog } from "@/components/filter-dialog";

interface Props {
  table: string;
}

export function DataTable({ table }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [structure, setStructure] = useState<TableColumn[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sort, setSort] = useState<SortConfig | undefined>();
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [editCell, setEditCell] = useState<{
    row: Record<string, unknown>;
    column: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTableData(table, page, pageSize, sort, filters, search);
      setRows(data.rows);
      setColumns(data.columns);
      setTotal(data.total);
    } catch (err) {
      toast.error("Failed to load data", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [table, page, pageSize, sort, filters, search]);

  const fetchStructure = useCallback(async () => {
    try {
      const data = await getTableStructure(table);
      setStructure(data.columns);
    } catch {
      // Non-critical
    }
  }, [table]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  const primaryKeys = structure.filter((c) => c.Key === "PRI").map((c) => c.Field);

  const getPrimaryKey = (row: Record<string, unknown>): Record<string, unknown> => {
    if (primaryKeys.length > 0) {
      const pk: Record<string, unknown> = {};
      for (const key of primaryKeys) {
        pk[key] = row[key];
      }
      return pk;
    }
    // Fallback: use all columns
    return { ...row };
  };

  const handleSort = (column: string) => {
    setSort((prev) => {
      if (prev?.column === column) {
        if (prev.direction === "asc") return { column, direction: "desc" };
        return undefined; // Third click removes sort
      }
      return { column, direction: "asc" };
    });
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const pk = getPrimaryKey(deleteTarget);
      await deleteRow(table, pk);
      toast.success("Row deleted");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to delete row", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleCellSave = async (row: Record<string, unknown>, column: string, value: unknown) => {
    try {
      const pk = getPrimaryKey(row);
      const result = await updateRow(table, pk, { [column]: value });
      if (result.affectedRows === 0) {
        toast.error("Update failed", {
          description: "No matching row found. The row may have been modified or deleted.",
        });
        return;
      }
      toast.success("Cell updated");
      setEditCell(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to update cell", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across text columns..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 h-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-0.5"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}>
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          Filters
          {filters.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {filters.length}
            </Badge>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAddRowOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Row
        </Button>
      </div>

      {/* Active filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b bg-muted/30">
          {filters.map((f, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {f.column} {f.operator} {f.value || ""}
              <button
                onClick={() => {
                  setFilters((prev) => prev.filter((_, idx) => idx !== i));
                  setPage(1);
                }}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              setFilters([]);
              setPage(1);
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No data</p>
              <p className="text-sm mt-1">
                {search || filters.length > 0
                  ? "Try adjusting your search or filters"
                  : "This table is empty"}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="min-w-[120px]">
                    <button
                      onClick={() => handleSort(col)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col}
                      {sort?.column === col ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                      )}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(page - 1) * pageSize + rowIdx + 1}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      className="font-mono-data max-w-[300px] truncate cursor-pointer hover:bg-accent/50"
                      onDoubleClick={() => setEditCell({ row, column: col })}
                      title={formatCellValue(row[col])}
                    >
                      {row[col] === null ? (
                        <span className="text-muted-foreground italic">NULL</span>
                      ) : (
                        formatCellValue(row[col])
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="p-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditCell({ row, column: columns[0] })}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit row
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete row
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t shrink-0 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{" "}
              {total.toLocaleString()} rows
            </>
          ) : (
            "No rows"
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setPage(1)}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm px-2">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Add row dialog */}
      <AddRowDialog
        open={addRowOpen}
        onOpenChange={setAddRowOpen}
        table={table}
        columns={structure}
        onSuccess={fetchData}
      />

      {/* Edit cell dialog */}
      {editCell && (
        <EditCellDialog
          open={!!editCell}
          onOpenChange={(open) => !open && setEditCell(null)}
          row={editCell.row}
          column={editCell.column}
          columns={columns}
          onSave={handleCellSave}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete row</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this row? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filter dialog */}
      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        columns={columns}
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
    </div>
  );
}
