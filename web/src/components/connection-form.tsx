import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  testConnection,
  saveConnection,
  getSavedConnections,
  saveNamedConnection,
  deleteSavedConnection,
  withTunnelAssignment,
} from "@/lib/api";
import type { ConnectionConfig, SavedConnection, SshTunnelConfig } from "@/lib/types";
import { Database, Loader2, Star, Trash2, Plug, Network } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onConnect: (config: ConnectionConfig, databases: string[]) => void;
  hideThemeToggle?: boolean;
}

const defaultSsh = (): SshTunnelConfig => ({
  enabled: false,
  host: "",
  port: 22,
  user: "",
  password: "",
  keyPath: "",
  localPort: undefined,
});

function savedToConfig(conn: SavedConnection, password: string, sshPassword = ""): ConnectionConfig {
  return {
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password,
    database: conn.database,
    ...(conn.ssh?.enabled
      ? {
          ssh: {
            enabled: true,
            host: conn.ssh.host,
            port: conn.ssh.port || 22,
            user: conn.ssh.user,
            password: sshPassword || undefined,
            keyPath: conn.ssh.keyPath,
            localPort: conn.ssh.localPort,
          },
        }
      : {}),
  };
}

export function ConnectionForm({ onConnect, hideThemeToggle }: Props) {
  const [loading, setLoading] = useState(false);
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [saveName, setSaveName] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [quickConnectTarget, setQuickConnectTarget] = useState<SavedConnection | null>(null);
  const [quickConnectPassword, setQuickConnectPassword] = useState("");
  const [quickConnectSshPassword, setQuickConnectSshPassword] = useState("");
  const [form, setForm] = useState<ConnectionConfig>({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "",
    ssh: defaultSsh(),
  });

  useEffect(() => {
    setSavedConnections(getSavedConnections());
  }, []);

  const ssh = form.ssh ?? defaultSsh();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: ConnectionConfig = {
        ...form,
        ssh: ssh.enabled
          ? {
              ...ssh,
              password: ssh.password || undefined,
              keyPath: ssh.keyPath || undefined,
              localPort: ssh.localPort && ssh.localPort > 0 ? ssh.localPort : undefined,
            }
          : undefined,
      };
      const result = await testConnection(payload);
      const connected = withTunnelAssignment(payload, result);
      saveConnection(connected);
      toast.success(
        ssh.enabled
          ? `Connected via SSH tunnel (localhost:${result.localPort})`
          : "Connected successfully"
      );
      onConnect(connected, result.databases);
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
      id: crypto.randomUUID(),
      name,
      host: form.host,
      port: form.port,
      user: form.user,
      database: form.database || undefined,
      ...(ssh.enabled
        ? {
            ssh: {
              enabled: true,
              host: ssh.host,
              port: ssh.port || 22,
              user: ssh.user,
              keyPath: ssh.keyPath || undefined,
              localPort: ssh.localPort && ssh.localPort > 0 ? ssh.localPort : undefined,
            },
          }
        : {}),
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

  const runQuickConnect = async (conn: SavedConnection, password: string, sshPassword: string) => {
    setConnectingId(conn.id);
    try {
      const config = savedToConfig(conn, password, sshPassword);
      const result = await testConnection(config);
      const connected = withTunnelAssignment(config, result);
      saveConnection(connected);
      toast.success(
        conn.ssh?.enabled
          ? `Connected to ${conn.name} via SSH (localhost:${result.localPort})`
          : `Connected to ${conn.name}`
      );
      onConnect(connected, result.databases);
      setQuickConnectTarget(null);
      setQuickConnectPassword("");
      setQuickConnectSshPassword("");
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
      password: "",
      database: conn.database ?? "",
      ssh: conn.ssh?.enabled
        ? {
            enabled: true,
            host: conn.ssh.host,
            port: conn.ssh.port || 22,
            user: conn.ssh.user,
            password: "",
            keyPath: conn.ssh.keyPath ?? "",
            localPort: conn.ssh.localPort,
          }
        : defaultSsh(),
    });
  };

  const update = (field: keyof ConnectionConfig, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateSsh = (field: keyof SshTunnelConfig, value: string | number | boolean | undefined) => {
    setForm((prev) => ({
      ...prev,
      ssh: { ...(prev.ssh ?? defaultSsh()), [field]: value },
    }));
  };

  return (
    <div className="min-h-screen flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      {!hideThemeToggle && (
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
      )}
      <div className="flex gap-6 w-full max-w-3xl items-start">
        {savedConnections.length > 0 && (
          <Card className="w-80 max-w-[min(20rem,calc(100vw-2rem))] shrink-0">
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
                      className="group flex items-start gap-1 rounded-md border p-2 hover:bg-accent transition-colors"
                    >
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => handleLoadSaved(conn)}
                        title={`${conn.name} — ${conn.user}@${conn.host}:${conn.port}${conn.database ? `/${conn.database}` : ""}${conn.ssh?.enabled ? ` via ${conn.ssh.user}@${conn.ssh.host}` : ""}`}
                      >
                        <div className="text-sm font-medium break-words flex items-center gap-1.5">
                          {conn.name}
                          {conn.ssh?.enabled && (
                            <Network
                              className="h-3 w-3 shrink-0 text-muted-foreground"
                              aria-label="SSH tunnel"
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 break-all">
                          {conn.user}@{conn.host}:{conn.port}
                          {conn.database ? `/${conn.database}` : ""}
                        </div>
                        {conn.ssh?.enabled && (
                          <div className="text-xs text-muted-foreground/80 mt-0.5 break-all">
                            SSH {conn.ssh.user}@{conn.ssh.host}:{conn.ssh.port || 22}
                          </div>
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setQuickConnectTarget(conn);
                          setQuickConnectPassword("");
                          setQuickConnectSshPassword("");
                        }}
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
                    placeholder={ssh.enabled ? "db.internal.example.com" : "localhost"}
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
                  autoComplete="current-password"
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

              <div className="rounded-md border p-3 space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => updateSsh("enabled", !ssh.enabled)}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Network className="h-4 w-4" />
                    SSH Tunnel
                  </span>
                  <span
                    className={cn(
                      "text-xs rounded px-2 py-0.5 border",
                      ssh.enabled
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {ssh.enabled ? "On" : "Off"}
                  </span>
                </button>
                {ssh.enabled && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Runs <code className="text-[11px]">ssh -L local:host:port user@ssh-host</code>.
                      MySQL Host/Port above are the remote destination.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="sshHost">SSH Host</Label>
                        <Input
                          id="sshHost"
                          value={ssh.host}
                          onChange={(e) => updateSsh("host", e.target.value)}
                          placeholder="bastion.example.com"
                          required={ssh.enabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sshPort">SSH Port</Label>
                        <Input
                          id="sshPort"
                          type="number"
                          value={ssh.port}
                          onChange={(e) => updateSsh("port", parseInt(e.target.value) || 22)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sshUser">SSH User</Label>
                      <Input
                        id="sshUser"
                        value={ssh.user}
                        onChange={(e) => updateSsh("user", e.target.value)}
                        placeholder="root"
                        required={ssh.enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sshPassword">SSH Password (optional)</Label>
                      <Input
                        id="sshPassword"
                        type="password"
                        autoComplete="off"
                        value={ssh.password ?? ""}
                        onChange={(e) => updateSsh("password", e.target.value)}
                        placeholder="Leave empty for key / agent"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sshKeyPath">Identity file (optional)</Label>
                      <Input
                        id="sshKeyPath"
                        value={ssh.keyPath ?? ""}
                        onChange={(e) => updateSsh("keyPath", e.target.value)}
                        placeholder="~/.ssh/id_ed25519"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sshLocalPort">Local port (optional)</Label>
                      <Input
                        id="sshLocalPort"
                        type="number"
                        value={ssh.localPort ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          updateSsh("localPort", v ? parseInt(v) || undefined : undefined);
                        }}
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {ssh.enabled ? "Starting tunnel…" : "Connecting..."}
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

      <Dialog
        open={quickConnectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setQuickConnectTarget(null);
            setQuickConnectPassword("");
            setQuickConnectSshPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password for {quickConnectTarget?.name}</DialogTitle>
            <DialogDescription>
              Saved connections store host and user only. Enter passwords to connect
              {quickConnectTarget?.ssh?.enabled ? " (SSH uses key/agent if left blank)" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label htmlFor="qc-db-password">Database password</Label>
              <Input
                id="qc-db-password"
                type="password"
                autoComplete="current-password"
                value={quickConnectPassword}
                onChange={(e) => setQuickConnectPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    quickConnectTarget &&
                    quickConnectPassword &&
                    !quickConnectTarget.ssh?.enabled
                  ) {
                    e.preventDefault();
                    void runQuickConnect(quickConnectTarget, quickConnectPassword, "");
                  }
                }}
              />
            </div>
            {quickConnectTarget?.ssh?.enabled && (
              <div className="space-y-2">
                <Label htmlFor="qc-ssh-password">SSH password (optional)</Label>
                <Input
                  id="qc-ssh-password"
                  type="password"
                  autoComplete="off"
                  value={quickConnectSshPassword}
                  onChange={(e) => setQuickConnectSshPassword(e.target.value)}
                  placeholder="Key / agent if empty"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && quickConnectTarget && quickConnectPassword) {
                      e.preventDefault();
                      void runQuickConnect(
                        quickConnectTarget,
                        quickConnectPassword,
                        quickConnectSshPassword
                      );
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground break-all">
                  Tunnel via {quickConnectTarget.ssh.user}@{quickConnectTarget.ssh.host}:
                  {quickConnectTarget.ssh.port || 22} → {quickConnectTarget.host}:
                  {quickConnectTarget.port}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setQuickConnectTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!quickConnectTarget || !quickConnectPassword.trim() || connectingId !== null}
              onClick={() =>
                quickConnectTarget &&
                runQuickConnect(quickConnectTarget, quickConnectPassword, quickConnectSshPassword)
              }
            >
              {connectingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
