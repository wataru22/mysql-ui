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
import { ScrollArea } from "@/components/ui/scroll-area";
import { createTable } from "@/lib/api";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  defaultValue: string;
}

const TYPES = [
  "INT",
  "BIGINT",
  "TINYINT",
  "VARCHAR(255)",
  "VARCHAR(100)",
  "TEXT",
  "DATE",
  "DATETIME",
  "TIMESTAMP",
  "DECIMAL(10,2)",
  "FLOAT",
  "BOOLEAN",
  "JSON",
  "BLOB",
];

const defaultColumn = (): ColumnDef => ({
  name: "",
  type: "VARCHAR(255)",
  nullable: true,
  primaryKey: false,
  autoIncrement: false,
  defaultValue: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateTableDialog({ open, onOpenChange, onCreated }: Props) {
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: "id", type: "INT", nullable: false, primaryKey: true, autoIncrement: true, defaultValue: "" },
    { name: "created_at", type: "TIMESTAMP", nullable: false, primaryKey: false, autoIncrement: false, defaultValue: "CURRENT_TIMESTAMP" },
  ]);
  const [loading, setLoading] = useState(false);

  const addColumn = () => {
    setColumns((prev) => [...prev, defaultColumn()]);
  };

  const removeColumn = (index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof ColumnDef, value: string | boolean) => {
    setColumns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async () => {
    if (!tableName.trim() || columns.length === 0) return;

    const validColumns = columns.filter((c) => c.name.trim());
    if (validColumns.length === 0) {
      toast.error("At least one column with a name is required");
      return;
    }

    setLoading(true);
    try {
      await createTable(tableName.trim(), validColumns);
      toast.success(`Table "${tableName}" created`);
      setTableName("");
      setColumns([
        { name: "id", type: "INT", nullable: false, primaryKey: true, autoIncrement: true, defaultValue: "" },
        { name: "created_at", type: "TIMESTAMP", nullable: false, primaryKey: false, autoIncrement: false, defaultValue: "CURRENT_TIMESTAMP" },
      ]);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error("Failed to create table", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Create new table</DialogTitle>
          <DialogDescription>Define the table name and columns</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Table name</Label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="my_table"
              className="font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Columns</Label>
              <Button variant="outline" size="sm" onClick={addColumn}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>

            <ScrollArea className="max-h-[45vh]">
              <div className="space-y-2 pr-4">
                {/* Header */}
                <div className="grid grid-cols-[1fr_140px_70px_50px_50px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Null</span>
                  <span>PK</span>
                  <span>AI</span>
                  <span />
                </div>
                {columns.map((col, i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px_70px_50px_50px_40px] gap-2 items-center">
                    <Input
                      value={col.name}
                      onChange={(e) => updateColumn(i, "name", e.target.value)}
                      placeholder="column_name"
                      className="h-8 font-mono text-sm"
                    />
                    <Select
                      value={col.type}
                      onValueChange={(v) => updateColumn(i, "type", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={col.nullable}
                        onChange={(e) => updateColumn(i, "nullable", e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={col.primaryKey}
                        onChange={(e) => updateColumn(i, "primaryKey", e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={col.autoIncrement}
                        onChange={(e) => updateColumn(i, "autoIncrement", e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeColumn(i)}
                      disabled={columns.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !tableName.trim() || columns.every((c) => !c.name.trim())}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
