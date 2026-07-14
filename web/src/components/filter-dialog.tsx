import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterConfig } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

const OPERATORS = [
  { value: "=", label: "= (equals)" },
  { value: "!=", label: "!= (not equals)" },
  { value: ">", label: "> (greater than)" },
  { value: "<", label: "< (less than)" },
  { value: ">=", label: ">= (greater or equal)" },
  { value: "<=", label: "<= (less or equal)" },
  { value: "LIKE", label: "LIKE (contains)" },
  { value: "NOT LIKE", label: "NOT LIKE" },
  { value: "IS NULL", label: "IS NULL" },
  { value: "IS NOT NULL", label: "IS NOT NULL" },
  { value: "IN", label: "IN (comma-separated)" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: string[];
  filters: FilterConfig[];
  onFiltersChange: (filters: FilterConfig[]) => void;
}

export function FilterDialog({ open, onOpenChange, columns, filters, onFiltersChange }: Props) {
  const [localFilters, setLocalFilters] = useState<FilterConfig[]>(filters);

  const addFilter = () => {
    setLocalFilters((prev) => [
      ...prev,
      { column: columns[0] || "", operator: "=", value: "" },
    ]);
  };

  const removeFilter = (index: number) => {
    setLocalFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, field: keyof FilterConfig, value: string) => {
    setLocalFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const handleApply = () => {
    // Remove empty filters
    const valid = localFilters.filter((f) => {
      if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") return true;
      return f.column && f.value;
    });
    onFiltersChange(valid);
    onOpenChange(false);
  };

  const needsValue = (op: string) => op !== "IS NULL" && op !== "IS NOT NULL";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setLocalFilters(filters);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filter rows</DialogTitle>
          <DialogDescription>Add conditions to filter the table data</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-auto pr-2">
          {localFilters.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No filters. Click "Add Filter" to start.
            </p>
          )}
          {localFilters.map((filter, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={filter.column}
                onValueChange={(v) => updateFilter(i, "column", v)}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filter.operator}
                onValueChange={(v) => updateFilter(i, "operator", v)}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {needsValue(filter.operator) && (
                <Input
                  value={filter.value}
                  onChange={(e) => updateFilter(i, "value", e.target.value)}
                  placeholder="Value"
                  className="h-9 flex-1"
                />
              )}

              <Button variant="ghost" size="icon-sm" onClick={() => removeFilter(i)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={addFilter}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Filter
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
