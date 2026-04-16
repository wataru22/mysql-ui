import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getTableStructure, dropColumn } from "@/lib/api";
import type { TableColumn, TableIndex } from "@/lib/types";
import { Plus, Pencil, Trash2, Key, Code } from "lucide-react";
import { toast } from "sonner";
import { AddColumnDialog } from "@/components/add-column-dialog";
import { ModifyColumnDialog } from "@/components/modify-column-dialog";
import { Separator } from "@/components/ui/separator";

interface Props {
  table: string;
  onRefresh: () => void;
}

export function StructureView({ table, onRefresh }: Props) {
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [createSql, setCreateSql] = useState("");
  const [loading, setLoading] = useState(true);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editColumn, setEditColumn] = useState<TableColumn | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const fetchStructure = async () => {
    setLoading(true);
    try {
      const data = await getTableStructure(table);
      setColumns(data.columns);
      setIndexes(data.indexes);
      setCreateSql(data.createSql);
    } catch (err) {
      toast.error("Failed to load structure", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructure();
  }, [table]);

  const handleDropColumn = async () => {
    if (!dropTarget) return;
    try {
      await dropColumn(table, dropTarget);
      toast.success(`Column "${dropTarget}" dropped`);
      setDropTarget(null);
      fetchStructure();
      onRefresh();
    } catch (err) {
      toast.error("Failed to drop column", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Columns */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Columns</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSql(!showSql)}>
              <Code className="h-3.5 w-3.5 mr-1.5" />
              {showSql ? "Hide" : "Show"} CREATE SQL
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddColumnOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Column
            </Button>
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Extra</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => (
                <TableRow key={col.Field}>
                  <TableCell className="font-medium font-mono-data">
                    {col.Key === "PRI" && <Key className="h-3 w-3 inline mr-1 text-amber-500" />}
                    {col.Field}
                  </TableCell>
                  <TableCell className="font-mono-data">{col.Type}</TableCell>
                  <TableCell>
                    <Badge variant={col.Null === "YES" ? "secondary" : "outline"}>
                      {col.Null === "YES" ? "NULL" : "NOT NULL"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {col.Key && (
                      <Badge
                        variant={col.Key === "PRI" ? "default" : "secondary"}
                      >
                        {col.Key}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono-data text-muted-foreground">
                    {col.Default === null ? (
                      <span className="italic">NULL</span>
                    ) : (
                      col.Default || "-"
                    )}
                  </TableCell>
                  <TableCell className="font-mono-data text-muted-foreground">
                    {col.Extra || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditColumn(col)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDropTarget(col.Field)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* CREATE SQL */}
      {showSql && (
        <div>
          <h3 className="text-lg font-semibold mb-3">CREATE TABLE SQL</h3>
          <pre className="p-4 border rounded-md bg-muted/50 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
            {createSql}
          </pre>
        </div>
      )}

      <Separator />

      {/* Indexes */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Indexes</h3>
        {indexes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No indexes</p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Column</TableHead>
                  <TableHead>Unique</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cardinality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indexes.map((idx, i) => (
                  <TableRow key={`${idx.Key_name}-${idx.Seq_in_index}-${i}`}>
                    <TableCell className="font-mono-data font-medium">{idx.Key_name}</TableCell>
                    <TableCell className="font-mono-data">{idx.Column_name}</TableCell>
                    <TableCell>
                      <Badge variant={idx.Non_unique === 0 ? "default" : "secondary"}>
                        {idx.Non_unique === 0 ? "UNIQUE" : "NON-UNIQUE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono-data">{idx.Index_type}</TableCell>
                    <TableCell>{idx.Cardinality}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add column dialog */}
      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        table={table}
        onSuccess={() => {
          fetchStructure();
          onRefresh();
        }}
      />

      {/* Modify column dialog */}
      {editColumn && (
        <ModifyColumnDialog
          open={!!editColumn}
          onOpenChange={(open) => !open && setEditColumn(null)}
          table={table}
          column={editColumn}
          onSuccess={() => {
            fetchStructure();
            onRefresh();
          }}
        />
      )}

      {/* Drop column confirmation */}
      <AlertDialog open={!!dropTarget} onOpenChange={(open) => !open && setDropTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop column "{dropTarget}"</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop this column? All data in this column will be lost. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDropColumn}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
