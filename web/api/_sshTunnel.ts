import { spawn, type Subprocess } from "bun";
import { connect as netConnect } from "node:net";
import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

export interface SshTunnelRequest {
  sshHost: string;
  sshPort?: number;
  sshUser: string;
  sshPassword?: string;
  sshKeyPath?: string;
  /** MySQL host as seen from the SSH server */
  remoteHost: string;
  remotePort: number;
  /** Prefer this local port; 0 / omitted = auto */
  localPort?: number;
}

export interface ActiveTunnel {
  id: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  sshHost: string;
  sshUser: string;
  proc: Subprocess;
  askpassDir?: string;
}

const tunnels = new Map<string, ActiveTunnel>();

async function findFreePort(): Promise<number> {
  const server = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      data() {},
      open() {},
      close() {},
      error() {},
    },
  });
  const port = server.port;
  server.stop(true);
  if (!port) throw new Error("Could not allocate a local port for SSH tunnel");
  return port;
}

function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = netConnect({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`SSH tunnel did not open local port ${port} in time`));
          return;
        }
        setTimeout(tryConnect, 100);
      });
    };
    tryConnect();
  });
}

async function createAskpass(password: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mysql-ui-askpass-"));
  const script = join(dir, "askpass.sh");
  // Password via env so it never appears in `ps` argv
  await writeFile(
    script,
    `#!/bin/sh\nprintf '%s\\n' "$MYSQL_UI_SSH_PASSWORD"\n`,
    { mode: 0o700 }
  );
  await chmod(script, 0o700);
  return dir;
}

/** Reuse an existing tunnel with the same forward if still alive. */
export function findMatchingTunnel(req: SshTunnelRequest): ActiveTunnel | undefined {
  for (const t of tunnels.values()) {
    if (
      t.sshHost === req.sshHost &&
      t.sshUser === req.sshUser &&
      t.remoteHost === req.remoteHost &&
      t.remotePort === req.remotePort &&
      (!req.localPort || req.localPort === t.localPort) &&
      t.proc.exitCode === null
    ) {
      return t;
    }
  }
  return undefined;
}

export async function startTunnel(req: SshTunnelRequest): Promise<ActiveTunnel> {
  if (!req.sshHost?.trim() || !req.sshUser?.trim()) {
    throw new Error("SSH host and user are required");
  }
  if (!req.remoteHost?.trim() || !req.remotePort) {
    throw new Error("Remote MySQL host and port are required for SSH tunnel");
  }

  const existing = findMatchingTunnel(req);
  if (existing) return existing;

  const localPort = req.localPort && req.localPort > 0 ? req.localPort : await findFreePort();
  const sshPort = req.sshPort && req.sshPort > 0 ? req.sshPort : 22;

  let askpassDir: string | undefined;
  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  const args = [
    "-N",
    "-L",
    `${localPort}:${req.remoteHost}:${req.remotePort}`,
    "-p",
    String(sshPort),
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];

  if (req.sshKeyPath?.trim()) {
    args.push("-i", expandHome(req.sshKeyPath.trim()));
  }

  if (req.sshPassword) {
    askpassDir = await createAskpass(req.sshPassword);
    env.SSH_ASKPASS = join(askpassDir, "askpass.sh");
    env.SSH_ASKPASS_REQUIRE = "force";
    env.DISPLAY = env.DISPLAY || ":0";
    env.MYSQL_UI_SSH_PASSWORD = req.sshPassword;
    // Prefer password over agent/keys when user supplied one
    args.push("-o", "PreferredAuthentications=password,keyboard-interactive");
    args.push("-o", "NumberOfPasswordPrompts=1");
  }

  args.push(`${req.sshUser}@${req.sshHost}`);

  const proc = spawn(["ssh", ...args], {
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const id = crypto.randomUUID();
  const tunnel: ActiveTunnel = {
    id,
    localPort,
    remoteHost: req.remoteHost,
    remotePort: req.remotePort,
    sshHost: req.sshHost,
    sshUser: req.sshUser,
    proc,
    askpassDir,
  };

  // If ssh exits before port opens, surface stderr
  const exitPromise = proc.exited.then(async (code) => {
    tunnels.delete(id);
    if (askpassDir) {
      await rm(askpassDir, { recursive: true, force: true }).catch(() => {});
    }
    return code;
  });

  try {
    await Promise.race([
      waitForPort(localPort),
      exitPromise.then(async (code) => {
        const stderr = await new Response(proc.stderr).text().catch(() => "");
        throw new Error(
          stderr.trim() || `SSH exited with code ${code} before tunnel was ready`
        );
      }),
    ]);
  } catch (err) {
    try {
      proc.kill();
    } catch {
      /* already dead */
    }
    if (askpassDir) {
      await rm(askpassDir, { recursive: true, force: true }).catch(() => {});
    }
    throw err;
  }

  tunnels.set(id, tunnel);
  return tunnel;
}

export async function stopTunnel(id: string): Promise<boolean> {
  const t = tunnels.get(id);
  if (!t) return false;
  try {
    t.proc.kill();
  } catch {
    /* ignore */
  }
  tunnels.delete(id);
  if (t.askpassDir) {
    await rm(t.askpassDir, { recursive: true, force: true }).catch(() => {});
  }
  return true;
}

export function getTunnel(id: string): ActiveTunnel | undefined {
  return tunnels.get(id);
}
