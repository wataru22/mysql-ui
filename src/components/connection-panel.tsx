import { useState, useEffect, useCallback } from "react";
import type { ConnectionConfig } from "@/lib/types";
import { saveConnection, listDatabases, switchDatabase, listTables } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { DataTable } from "@/components/data-table";
import { StructureView } from "@/components/structure-view";
import { SqlEditor } from "@/components/sql-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableToolbar } from "@/components/table-toolbar";
import { Database, Terminal, Table2, Columns3 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  config: ConnectionConfig;
}

export function ConnectionPanel({ config }: Props) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [currentDatabase, setCurrentDatabase] = useState(config.database || "");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("data");
  const [refreshKey, setRefreshKey] = useState(0);

  // Activate this panel's connection in localStorage whenever it mounts or config changes
  useEffect(() => {
    saveConnection(config);
  }, [config]);

  // Load databases and tables
  useEffect(() => {
    const load = async () => {
      // Make sure this panel's connection is active before making API calls
      saveConnection({ ...config, database: currentDatabase || config.database });
      try {
        const dbs = await listDatabases();
        setDatabases(dbs);
        if (currentDatabase || config.database) {
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
  }, [config, currentDatabase, refreshKey]);

  const handleDatabaseChange = useCallback(async (db: string) => {
    try {
      await switchDatabase(db);
      // Update localStorage with the new database for this connection
      saveConnection({ ...config, database: db });
      setCurrentDatabase(db);
      setSelectedTable(null);
      const tbls = await listTables();
      setTables(tbls);
    } catch (err) {
      toast.error("Failed to switch database", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [config]);

  const handleTableSelect = useCallback((table: string) => {
    setSelectedTable(table);
    setActiveTab("data");
  }, []);

  const handleRefresh = useCallback(() => {
    // Re-activate this connection before refresh
    saveConnection({ ...config, database: currentDatabase });
    setRefreshKey((k) => k + 1);
  }, [config, currentDatabase]);

  const handleTableCreated = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  const handleTableChanged = useCallback(() => {
    setSelectedTable(null);
    handleRefresh();
  }, [handleRefresh]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        databases={databases}
        currentDatabase={currentDatabase || config.database || ""}
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
            <span className="font-semibold">{currentDatabase || config.database || "No database"}</span>
            {selectedTable && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{selectedTable}</span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {config.user}@{config.host}:{config.port}
          </span>
        </header>

        {/* Content */}
        {selectedTable ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="border-b px-4 flex items-center justify-between shrink-0">
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className={`flex flex-col ${activeTab === "sql" ? "flex-1" : ""}`}>
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
