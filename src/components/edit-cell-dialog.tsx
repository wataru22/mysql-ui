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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Record<string, unknown>;
  column: string;
  columns: string[];
  onSave: (row: Record<string, unknown>, column: string, value: unknown) => Promise<void>;
}

export function EditCellDialog({ open, onOpenChange, row, column, columns, onSave }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const col of columns) {
      v[col] = row[col] === null ? "" : String(row[col]);
    }
    return v;
  });
  const [loading, setLoading] = useState(false);
  const [editAll, setEditAll] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editAll) {
        // Save all changed fields
        const changes: Record<string, unknown> = {};
        for (const col of columns) {
          const originalValue = row[col] === null ? "" : String(row[col]);
          if (values[col] !== originalValue) {
            changes[col] = values[col] || null;
          }
        }
        if (Object.keys(changes).length > 0) {
          // Save each change (we pass the first column change, the API will handle it)
          for (const [col, val] of Object.entries(changes)) {
            await onSave(row, col, val);
          }
        }
      } else {
        const value = values[column] || null;
        await onSave(row, column, value);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentValue = row[column] === null ? "" : String(row[column]);
  const isLongValue = currentValue.length > 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit {editAll ? "row" : `"${column}"`}</DialogTitle>
          <DialogDescription>
            {editAll ? "Edit all fields in this row" : "Modify the cell value"}
          </DialogDescription>
        </DialogHeader>

        {editAll ? (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-3">
              {columns.map((col) => (
                <div key={col} className="space-y-1">
                  <Label className="font-mono text-xs">{col}</Label>
                  <Input
                    value={values[col]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [col]: e.target.value }))
                    }
                    className="h-8 font-mono text-sm"
                    placeholder="NULL"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-2">
            <Label className="font-mono text-xs">{column}</Label>
            {isLongValue ? (
              <Textarea
                value={values[column]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [column]: e.target.value }))
                }
                className="font-mono text-sm min-h-[120px]"
                placeholder="NULL"
              />
            ) : (
              <Input
                value={values[column]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [column]: e.target.value }))
                }
                className="font-mono text-sm"
                placeholder="NULL"
                autoFocus
              />
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setEditAll(!editAll)}>
            {editAll ? "Edit single field" : "Edit entire row"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
