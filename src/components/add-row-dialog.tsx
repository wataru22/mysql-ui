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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { insertRow } from "@/lib/api";
import type { TableColumn } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: string;
  columns: TableColumn[];
  onSuccess: () => void;
}

export function AddRowDialog({ open, onOpenChange, table, columns, onSuccess }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Build data object, excluding empty auto-increment fields
      const data: Record<string, unknown> = {};
      for (const col of columns) {
        const value = values[col.Field];
        if (col.Extra === "auto_increment" && (!value || value === "")) {
          continue; // Skip auto-increment columns with no value
        }
        if (value !== undefined && value !== "") {
          data[col.Field] = value;
        } else if (col.Null === "YES") {
          data[col.Field] = null;
        }
      }

      await insertRow(table, data);
      toast.success("Row inserted");
      setValues({});
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error("Failed to insert row", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Insert row into "{table}"</DialogTitle>
          <DialogDescription>Fill in the values for the new row</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-3">
            {columns.map((col) => (
              <div key={col.Field} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`add-${col.Field}`} className="font-mono text-xs">
                    {col.Field}
                  </Label>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {col.Type}
                  </Badge>
                  {col.Extra === "auto_increment" && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      AI
                    </Badge>
                  )}
                  {col.Null === "YES" && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      nullable
                    </Badge>
                  )}
                </div>
                <Input
                  id={`add-${col.Field}`}
                  value={values[col.Field] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [col.Field]: e.target.value }))
                  }
                  placeholder={
                    col.Extra === "auto_increment"
                      ? "Auto-generated"
                      : col.Default !== null
                      ? `Default: ${col.Default}`
                      : col.Null === "YES"
                      ? "NULL"
                      : "Required"
                  }
                  className="h-8 font-mono text-sm"
                />
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
