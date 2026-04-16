import { useState, useEffect, useCallback } from "react";
import type { ConnectionConfig } from "@/lib/types";
import { loadConnection, clearConnection, listDatabases, switchDatabase, listTables } from "@/lib/api";
import { ConnectionForm } from "@/components/connection-form";
import { Sidebar } from "@/components/sidebar";
import { DataTable } from "@/components/data-table";
import { StructureView } from "@/components/structure-view";
import { SqlEditor } from "@/components/sql-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableToolbar } from "@/components/table-toolbar";
import { Database, Terminal, Table2, Columns3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export default function App() {
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("data");
  const [refreshKey, setRefreshKey] = useState(0);

  // Check for saved connection on mount
  useEffect(() => {
    const saved = loadConnection();
    if (saved?.database) {
      setConnection(saved);
    }
  }, []);

  // Load databases and tables when connection changes
  useEffect(() => {
    if (!connection) return;

    const load = async () => {
      try {
        const dbs = await listDatabases();
        setDatabases(dbs);
        if (connection.database) {
          const tbls = await listTables();
          setTables(tbls);
        }
      } catch (err) {
        toast.error("Failed to load databases", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    };
    load();
  }, [connection, refreshKey]);

  const handleConnect = useCallback((config: ConnectionConfig, dbs: string[]) => {
    setConnection(config);
    setDatabases(dbs);
    setSelectedTable(null);
    setTables([]);
    if (config.database) {
      // Tables will load via the useEffect
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    clearConnection();
    setConnection(null);
    setDatabases([]);
    setTables([]);
    setSelectedTable(null);
  }, []);

  const handleDatabaseChange = useCallback(async (db: string) => {
    try {
      await switchDatabase(db);
      setConnection((prev) => (prev ? { ...prev, database: db } : null));
      setSelectedTable(null);
      const tbls = await listTables();
      setTables(tbls);
    } catch (err) {
      toast.error("Failed to switch database", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  const handleTableSelect = useCallback((table: string) => {
    setSelectedTable(table);
    setActiveTab("data");
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleTableCreated = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  const handleTableChanged = useCallback(() => {
    setSelectedTable(null);
    handleRefresh();
  }, [handleRefresh]);

  if (!connection) {
    return <ConnectionForm onConnect={handleConnect} />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        databases={databases}
        currentDatabase={connection.database || ""}
        tables={tables}
        selectedTable={selectedTable}
        onDatabaseChange={handleDatabaseChange}
        onTableSelect={handleTableSelect}
        onRefresh={handleRefresh}
        onTableCreated={handleTableCreated}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">{connection.database || "No database"}</span>
            {selectedTable && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{selectedTable}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {connection.user}@{connection.host}:{connection.port}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon-sm" onClick={handleDisconnect} title="Disconnect">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        {selectedTable ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="border-b px-4 flex items-center justify-between">
                <TabsList className="h-10 bg-transparent p-0 gap-1">
                  <TabsTrigger
                    value="data"
                    className="data-[state=active]:bg-muted rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <Table2 className="h-4 w-4 mr-1.5" />
                    Data
                  </TabsTrigger>
                  <TabsTrigger
                    value="structure"
                    className="data-[state=active]:bg-muted rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <Columns3 className="h-4 w-4 mr-1.5" />
                    Structure
                  </TabsTrigger>
                  <TabsTrigger
                    value="sql"
                    className="data-[state=active]:bg-muted rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <Terminal className="h-4 w-4 mr-1.5" />
                    Query
                  </TabsTrigger>
                </TabsList>
                <TableToolbar
                  table={selectedTable}
                  onTableChanged={handleTableChanged}
                  onRefresh={handleRefresh}
                />
              </div>

              <TabsContent value="data" className="flex-1 mt-0 overflow-hidden">
                <DataTable table={selectedTable} key={`${selectedTable}-${refreshKey}`} />
              </TabsContent>
              <TabsContent value="structure" className="flex-1 mt-0 overflow-auto p-4">
                <StructureView
                  table={selectedTable}
                  key={`struct-${selectedTable}-${refreshKey}`}
                  onRefresh={handleRefresh}
                />
              </TabsContent>
              <TabsContent value="sql" className="flex-1 mt-0 overflow-hidden">
                <SqlEditor defaultTable={selectedTable} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="border-b px-4">
                <TabsList className="h-10 bg-transparent p-0">
                  <TabsTrigger
                    value="sql"
                    className="data-[state=active]:bg-muted rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <Terminal className="h-4 w-4 mr-1.5" />
                    Query
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="data" className="flex-1 mt-0" />
              <TabsContent value="sql" className="flex-1 mt-0 overflow-hidden">
                <SqlEditor />
              </TabsContent>
            </Tabs>
            {activeTab !== "sql" && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Database className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Select a table from the sidebar</p>
                  <p className="text-sm mt-1">or open the Query tab to run SQL</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
