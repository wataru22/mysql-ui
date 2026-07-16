import type { VercelRequest, VercelResponse } from "@vercel/node";
import mysql from "mysql2/promise";
import { startTunnel } from "./_sshTunnel";

interface SshBody {
  enabled?: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  keyPath?: string;
  localPort?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { host, port, user, password, database, ssh } = req.body as {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssh?: SshBody;
  };

  if (!host || !user) {
    return res.status(400).json({ error: "Host and user are required" });
  }

  let mysqlHost = host;
  let mysqlPort = port || 3306;
  let tunnelId: string | undefined;
  let localPort: number | undefined;

  if (ssh?.enabled) {
    if (!ssh.host || !ssh.user) {
      return res.status(400).json({ error: "SSH host and user are required when tunnel is enabled" });
    }
    try {
      const tunnel = await startTunnel({
        sshHost: ssh.host,
        sshPort: ssh.port,
        sshUser: ssh.user,
        sshPassword: ssh.password,
        sshKeyPath: ssh.keyPath,
        remoteHost: host,
        remotePort: port || 3306,
        localPort: ssh.localPort,
      });
      tunnelId = tunnel.id;
      localPort = tunnel.localPort;
      mysqlHost = "127.0.0.1";
      mysqlPort = tunnel.localPort;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start SSH tunnel";
      return res.status(400).json({ error: message });
    }
  }

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: mysqlHost,
      port: mysqlPort,
      user,
      password: password || "",
      database: database || undefined,
      connectTimeout: 10000,
    });

    const [rows] = await conn.query("SHOW DATABASES");
    const databases = (rows as { Database: string }[]).map((r) => r.Database);

    return res.status(200).json({
      ok: true,
      databases,
      ...(tunnelId && localPort
        ? { tunnelId, localPort }
        : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return res.status(400).json({ error: message });
  } finally {
    if (conn) await conn.end();
  }
}
