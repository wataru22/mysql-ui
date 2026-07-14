import { useState, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { importSql } from "@/lib/api";
import { Upload, Loader2, FileUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  currentDatabase?: string;
}

export function ImportDialog({ open, onOpenChange, onImported, currentDatabase }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [newDatabase, setNewDatabase] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    executed: number;
    errors: { statement: number; error: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const sql = await file.text();
      const dbName = newDatabase.trim() || undefined;
      const res = await importSql(sql, dbName);
      setResult(res);

      if (res.errors.length === 0) {
        toast.success("Import complete", {
          description: `${res.executed} statement${res.executed !== 1 ? "s" : ""} executed`,
        });
        onImported();
      } else {
        toast.warning("Import completed with errors", {
          description: `${res.executed}/${res.total} statements succeeded`,
        });
        onImported();
      }
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setFile(null);
      setNewDatabase("");
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import SQL</DialogTitle>
          <DialogDescription>
            Import a .sql file to create tables and load data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File picker */}
          <div className="space-y-2">
            <Label>SQL file</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileUp className="h-5 w-5 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a .sql file
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* New database name (optional) */}
          <div className="space-y-2">
            <Label>Target database <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              placeholder={currentDatabase || "Leave empty to use current database"}
              value={newDatabase}
              onChange={(e) => setNewDatabase(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter a name to create a new database, or leave empty to import into "{currentDatabase}".
            </p>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span>
                  {result.executed}/{result.total} statements executed
                  {result.errors.length > 0 && `, ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="space-y-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">
                        Statement {e.statement}: {e.error}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {importing ? "Importing..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
