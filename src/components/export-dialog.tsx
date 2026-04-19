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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportTables } from "@/lib/api";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ExportMode = "structure" | "data" | "both";

function exportFilenameTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: string[];
  /** When set, exports only this table. Otherwise exports all tables. */
  singleTable?: string;
  databaseName?: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  tables,
  singleTable,
  databaseName,
}: Props) {
  const [mode, setMode] = useState<ExportMode>("both");
  const [exporting, setExporting] = useState(false);

  const targetTables = singleTable ? [singleTable] : tables;
  const label = singleTable
    ? `table "${singleTable}"`
    : `database "${databaseName}" (${tables.length} tables)`;

  const handleExport = async () => {
    if (targetTables.length === 0) return;
    setExporting(true);
    try {
      const sql = await exportTables(targetTables, mode);

      const stamp = exportFilenameTimestamp();
      const base = singleTable
        ? `${databaseName || "export"}-${singleTable}`
        : databaseName || "export";
      const filename = `${stamp} ${base}-${mode}.sql`;

      const blob = new Blob([sql], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export complete", { description: filename });
      onOpenChange(false);
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>Export {label} as SQL</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Export mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ExportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Structure + Data</SelectItem>
                <SelectItem value="structure">Structure only</SelectItem>
                <SelectItem value="data">Data only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === "structure" && "Exports CREATE TABLE statements only."}
              {mode === "data" && "Exports INSERT statements only. Tables must already exist on import."}
              {mode === "both" && "Exports CREATE TABLE and INSERT statements. Best for cloning."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting || targetTables.length === 0}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
