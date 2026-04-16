import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { testConnection, saveConnection } from "@/lib/api";
import type { ConnectionConfig } from "@/lib/types";
import { Database, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

interface Props {
  onConnect: (config: ConnectionConfig, databases: string[]) => void;
}

export function ConnectionForm({ onConnect }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ConnectionConfig>({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "",
  });

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

  const update = (field: keyof ConnectionConfig, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
