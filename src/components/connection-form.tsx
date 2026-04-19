import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { testConnection, saveConnection, getSavedConnections, saveNamedConnection, deleteSavedConnection } from "@/lib/api";
import type { ConnectionConfig, SavedConnection } from "@/lib/types";
import { Database, Loader2, Star, Trash2, Plug } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Props {
  onConnect: (config: ConnectionConfig, databases: string[]) => void;
  hideThemeToggle?: boolean;
}

export function ConnectionForm({ onConnect, hideThemeToggle }: Props) {
  const [loading, setLoading] = useState(false);
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [saveName, setSaveName] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionConfig>({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "",
  });

  useEffect(() => {
    setSavedConnections(getSavedConnections());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await testConnection(form);
      saveConnection(form);
      toast.success("Connected successfully");
      onConnect(form, result.databases);
    } catch (err) {
      toast.error("Connection failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = () => {
    const name = saveName.trim() || `${form.user}@${form.host}:${form.port}`;
    const conn: SavedConnection = {
      ...form,
      id: crypto.randomUUID(),
      name,
    };
    saveNamedConnection(conn);
    setSavedConnections(getSavedConnections());
    setSaveName("");
    toast.success(`Saved "${name}"`);
  };

  const handleDeleteSaved = (id: string, name: string) => {
    deleteSavedConnection(id);
    setSavedConnections(getSavedConnections());
    toast.success(`Deleted "${name}"`);
  };

  const handleQuickConnect = async (conn: SavedConnection) => {
    setConnectingId(conn.id);
    try {
      const config: ConnectionConfig = {
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database: conn.database,
      };
      const result = await testConnection(config);
      saveConnection(config);
      toast.success(`Connected to ${conn.name}`);
      onConnect(config, result.databases);
    } catch (err) {
      toast.error(`Failed to connect to ${conn.name}`, {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnectingId(null);
    }
  };

  const handleLoadSaved = (conn: SavedConnection) => {
    setForm({
      host: conn.host,
      port: conn.port,
      user: conn.user,
      password: conn.password,
      database: conn.database,
    });
  };

  const update = (field: keyof ConnectionConfig, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      {!hideThemeToggle && (
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
      )}
      <div className="flex gap-6 w-full max-w-3xl items-start">
        {/* Saved connections */}
        {savedConnections.length > 0 && (
          <Card className="w-72 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                Saved Connections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <div className="px-4 pb-4 space-y-1">
                  {savedConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className="group flex items-center gap-1 rounded-md border p-2 hover:bg-accent transition-colors"
                    >
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => handleLoadSaved(conn)}
                        title="Load into form"
                      >
                        <div className="text-sm font-medium truncate">{conn.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {conn.user}@{conn.host}:{conn.port}
                          {conn.database ? `/${conn.database}` : ""}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleQuickConnect(conn)}
                        disabled={connectingId === conn.id}
                        title="Quick connect"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {connectingId === conn.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plug className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteSaved(conn.id, conn.name)}
                        title="Delete"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Connection form */}
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">MySQL Admin</CardTitle>
            <CardDescription>Connect to your MySQL database</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={form.host}
                    onChange={(e) => update("host", e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={form.port}
                    onChange={(e) => update("port", parseInt(e.target.value) || 3306)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user">Username</Label>
                <Input
                  id="user"
                  value={form.user}
                  onChange={(e) => update("user", e.target.value)}
                  placeholder="root"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Enter password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">Database (optional)</Label>
                <Input
                  id="database"
                  value={form.database}
                  onChange={(e) => update("database", e.target.value)}
                  placeholder="Select after connecting"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveConnection}
                  title="Save this connection"
                >
                  <Star className="h-4 w-4 mr-1.5" />
                  Save
                </Button>
              </div>

              {/* Save name input - shown inline */}
              <div className="flex gap-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Connection name (optional for save)"
                  className="text-sm h-8"
                />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
