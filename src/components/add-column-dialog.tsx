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
import { addColumn } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const COMMON_TYPES = [
  "INT",
  "BIGINT",
  "TINYINT",
  "SMALLINT",
  "DECIMAL(10,2)",
  "FLOAT",
  "DOUBLE",
  "VARCHAR(255)",
  "VARCHAR(100)",
  "VARCHAR(50)",
  "CHAR(1)",
  "TEXT",
  "MEDIUMTEXT",
  "LONGTEXT",
  "DATE",
  "DATETIME",
  "TIMESTAMP",
  "TIME",
  "YEAR",
  "BOOLEAN",
  "BLOB",
  "JSON",
  "ENUM('a','b','c')",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: string;
  onSuccess: () => void;
}

export function AddColumnDialog({ open, onOpenChange, table, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("VARCHAR(255)");
  const [customType, setCustomType] = useState("");
  const [nullable, setNullable] = useState(true);
  const [defaultValue, setDefaultValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const colType = customType || type;
    if (!name.trim() || !colType) return;

    setLoading(true);
    try {
      await addColumn(table, name.trim(), colType, nullable, defaultValue || undefined);
      toast.success(`Column "${name}" added`);
      setName("");
      setType("VARCHAR(255)");
      setCustomType("");
      setNullable(true);
      setDefaultValue("");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error("Failed to add column", {
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
          <DialogTitle>Add column to "{table}"</DialogTitle>
          <DialogDescription>Define the new column</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Column name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="column_name"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setCustomType(""); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Or enter custom type..."
              className="font-mono text-sm"
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
            <Label>Default value (optional)</Label>
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
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
