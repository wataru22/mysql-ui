import type { VercelRequest, VercelResponse } from "@vercel/node";
import { startTunnel, stopTunnel, getTunnel } from "./_sshTunnel";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const body = req.body || {};
    try {
      const tunnel = await startTunnel({
        sshHost: body.sshHost,
        sshPort: body.sshPort,
        sshUser: body.sshUser,
        sshPassword: body.sshPassword,
        sshKeyPath: body.sshKeyPath,
        remoteHost: body.remoteHost,
        remotePort: body.remotePort,
        localPort: body.localPort,
      });
      return res.status(200).json({
        ok: true,
        tunnelId: tunnel.id,
        localPort: tunnel.localPort,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start SSH tunnel";
      return res.status(400).json({ error: message });
    }
  }

  if (req.method === "DELETE") {
    const id =
      (typeof req.query?.id === "string" && req.query.id) ||
      (typeof req.body?.id === "string" && req.body.id) ||
      "";
    if (!id) {
      return res.status(400).json({ error: "Tunnel id is required" });
    }
    const stopped = await stopTunnel(id);
    return res.status(200).json({ ok: true, stopped });
  }

  if (req.method === "GET") {
    const id = typeof req.query?.id === "string" ? req.query.id : "";
    if (!id) {
      return res.status(400).json({ error: "Tunnel id is required" });
    }
    const t = getTunnel(id);
    if (!t || t.proc.exitCode !== null) {
      return res.status(404).json({ error: "Tunnel not found" });
    }
    return res.status(200).json({
      ok: true,
      tunnelId: t.id,
      localPort: t.localPort,
      remoteHost: t.remoteHost,
      remotePort: t.remotePort,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
