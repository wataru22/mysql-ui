import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { dropTable, renameTable, truncateTable, duplicateTable } from "@/lib/api";
import { ExportDialog } from "@/components/export-dialog";
import {
  MoreVertical,
  Edit3,
  Trash2,
  AlertTriangle,
  Copy,
  RefreshCw,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  table: string;
  onTableChanged: () => void;
  onRefresh: () => void;
}

export function TableToolbar({ table, onTableChanged, onRefresh }: Props) {
  const [dropOpen, setDropOpen] = useState(false);
  const [truncateOpen, setTruncateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleDrop = async () => {
    try {
      await dropTable(table);
      toast.success(`Table "${table}" dropped`);
      setDropOpen(false);
      onTableChanged();
    } catch (err) {
      toast.error("Failed to drop table", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleTruncate = async () => {
    try {
      await truncateTable(table);
      toast.success(`Table "${table}" truncated`);
      setTruncateOpen(false);
      onRefresh();
    } catch (err) {
      toast.error("Failed to truncate table", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      await renameTable(table, newName.trim());
      toast.success(`Table renamed to "${newName.trim()}"`);
      setRenameOpen(false);
      onTableChanged();
    } catch (err) {
      toast.error("Failed to rename table", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleDuplicate = async () => {
    if (!newName.trim()) return;
    try {
      await duplicateTable(table, newName.trim());
      toast.success(`Table duplicated as "${newName.trim()}"`);
      setDuplicateOpen(false);
      onTableChanged();
    } catch (err) {
      toast.error("Failed to duplicate table", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setNewName(table);
                setRenameOpen(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5 mr-2" />
              Rename table
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setNewName(`${table}_copy`);
                setDuplicateOpen(true);
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2" />
              Duplicate table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Export table
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTruncateOpen(true)} className="text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 mr-2" />
              Truncate table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDropOpen(true)} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Drop table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename table</DialogTitle>
            <DialogDescription>Enter a new name for "{table}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim() || newName.trim() === table}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate table</DialogTitle>
            <DialogDescription>
              Create a copy of "{table}" with structure and data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New table name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDuplicate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={!newName.trim()}>
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Truncate confirmation */}
      <AlertDialog open={truncateOpen} onOpenChange={setTruncateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Truncate "{table}"</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL rows from the table. The table structure will remain.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTruncate}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Truncate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop confirmation */}
      <AlertDialog open={dropOpen} onOpenChange={setDropOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop "{table}"</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the table and ALL its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        tables={[table]}
        singleTable={table}
      />
    </>
  );
}
