import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Table2, RefreshCw, Plus, Search } from "lucide-react";
import { CreateTableDialog } from "@/components/create-table-dialog";

interface Props {
  databases: string[];
  currentDatabase: string;
  tables: string[];
  selectedTable: string | null;
  onDatabaseChange: (db: string) => void;
  onTableSelect: (table: string) => void;
  onRefresh: () => void;
  onTableCreated: () => void;
}

export function Sidebar({
  databases,
  currentDatabase,
  tables,
  selectedTable,
  onDatabaseChange,
  onTableSelect,
  onRefresh,
  onTableCreated,
}: Props) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-64 border-r flex flex-col bg-muted/30 shrink-0">
      {/* Database selector */}
      <div className="p-3 border-b space-y-2">
        <Select value={currentDatabase} onValueChange={onDatabaseChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select database" />
          </SelectTrigger>
          <SelectContent>
            {databases.map((db) => (
              <SelectItem key={db} value={db}>
                {db}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Table actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tables ({filteredTables.length})
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCreateOpen(true)}
            title="Create table"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Table list */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filteredTables.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {tables.length === 0 ? "No tables found" : "No matching tables"}
            </div>
          ) : (
            filteredTables.map((table) => (
              <button
                key={table}
                onClick={() => onTableSelect(table)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors text-left",
                  selectedTable === table
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground"
                )}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{table}</span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <CreateTableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onTableCreated}
      />
    </div>
  );
}
