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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { modifyColumn } from "@/lib/api";
import type { TableColumn } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: string;
  column: TableColumn;
  onSuccess: () => void;
}

export function ModifyColumnDialog({ open, onOpenChange, table, column, onSuccess }: Props) {
  const [name, setName] = useState(column.Field);
  const [type, setType] = useState(column.Type);
  const [nullable, setNullable] = useState(column.Null === "YES");
  const [defaultValue, setDefaultValue] = useState(column.Default || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !type.trim()) return;

    setLoading(true);
    try {
      await modifyColumn(table, column.Field, name.trim(), type.trim(), nullable, defaultValue || undefined);
      toast.success(`Column "${column.Field}" modified`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error("Failed to modify column", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modify column "{column.Field}"</DialogTitle>
          <DialogDescription>Change the column definition</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Column name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="font-mono"
              placeholder="e.g. VARCHAR(255)"
            />
          </div>

          <div className="space-y-2">
            <Label>Nullable</Label>
            <Select value={nullable ? "yes" : "no"} onValueChange={(v) => setNullable(v === "yes")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">NULL (nullable)</SelectItem>
                <SelectItem value="no">NOT NULL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default value</Label>
            <Input
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder="Leave empty for no default"
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim() || !type.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
