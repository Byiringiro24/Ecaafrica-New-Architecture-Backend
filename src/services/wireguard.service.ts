/**
 * WireGuard VPN Management Service
 *
 * Runs on the Linux server to manage WireGuard peers via CLI.
 * The super admin uses the web UI — this service runs the actual wg/wg-quick
 * shell commands on the server so no one has to SSH in.
 *
 * Security: all shell inputs are validated/sanitised before execution.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

const WG_CONF = process.env.WG_CONF_PATH ?? "/etc/wireguard/wg0.conf";
const WG_PUBKEY_PATH = process.env.WG_PUBKEY_PATH ?? "/etc/wireguard/server_public.key";
const WG_INTERFACE = process.env.WG_INTERFACE ?? "wg0";

// VPN subnet — supports up to 65534 tablet peers (10.0.0.0/16).
// Override via VPN_SUBNET (e.g. "10.0" for 10.0.x.x range).
// Server is always the first host: 10.0.0.1
const VPN_SUBNET_PREFIX = process.env.VPN_SUBNET ?? "10.0";  // "10.0" → 10.0.x.x
const VPN_CIDR = process.env.VPN_CIDR ?? "16";               // /16 = 65534 hosts
const SERVER_VPN_IP = process.env.SERVER_VPN_IP ?? "10.0.0.1";

/** Validate a WireGuard base64 key (44 chars ending in =) */
const isValidKey = (key: string) => /^[A-Za-z0-9+/]{43}=$/.test(key.trim());

/** Validate an IPv4 address */
const isValidIp = (ip: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
  ip.split(".").every((n) => parseInt(n, 10) <= 255);

/** Run a shell command and return stdout */
async function run(cmd: string): Promise<string> {
  const { stdout, stderr } = await execAsync(cmd);
  if (stderr && !stdout) throw new Error(stderr.trim());
  return stdout.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side WireGuard state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the server's WireGuard public key and current interface status.
 * Safe to call on every page load — read-only.
 */
export async function getServerStatus() {
  // ── Resolve server public key ─────────────────────────────────────────────
  // Strategy (in order of preference):
  //  1. Read pre-generated file (fastest, always available if setup was done)
  //  2. Derive from private key file using `wg pubkey`
  //  3. Ask the running wg interface via `wg show wg0 public-key`
  //  4. Return empty string with a clear log so admin knows what to run
  let serverPublicKey = "";

  // 1. Try pre-generated public key file
  try {
    serverPublicKey = (await readFile(WG_PUBKEY_PATH, "utf8")).trim();
  } catch { /* file not found — try next strategy */ }

  // 2. Derive from private key file
  if (!serverPublicKey) {
    const privateKeyPath = process.env.WG_PRIVKEY_PATH ?? "/etc/wireguard/server_private.key";
    try {
      const privKey = (await readFile(privateKeyPath, "utf8")).trim();
      // Pipe via stdin — never interpolate key material into a shell string
      const { stdout } = await execAsync(`wg pubkey`, { input: privKey } as any);
      serverPublicKey = String(stdout).trim();
      // Cache it for next time
      await writeFile(WG_PUBKEY_PATH, serverPublicKey + "\n", { mode: 0o600 }).catch(() => null);
    } catch { /* private key file not found — try wg show */ }
  }

  // 3. Ask the running wg interface
  if (!serverPublicKey) {
    try {
      serverPublicKey = (await run(`wg show ${WG_INTERFACE} public-key`)).trim();
      // Cache it for next time
      if (serverPublicKey) {
        await writeFile(WG_PUBKEY_PATH, serverPublicKey + "\n", { mode: 0o600 }).catch(() => null);
      }
    } catch { /* wg not running or not installed */ }
  }

  // 4. Try reading from the wg0.conf [Interface] PrivateKey line and deriving
  if (!serverPublicKey) {
    try {
      const conf = await readFile(WG_CONF, "utf8");
      const match = conf.match(/^\s*PrivateKey\s*=\s*(.+)$/m);
      if (match) {
        const privKey = match[1].trim();
        // Pipe via stdin — never interpolate key material into a shell string
        const { stdout } = await execAsync(`wg pubkey`, { input: privKey } as any);
        serverPublicKey = String(stdout).trim();
        if (serverPublicKey) {
          await writeFile(WG_PUBKEY_PATH, serverPublicKey + "\n", { mode: 0o600 }).catch(() => null);
        }
      }
    } catch { /* conf not readable */ }
  }

  if (!serverPublicKey) {
    logger.warn(
      { wgConf: WG_CONF, pubkeyPath: WG_PUBKEY_PATH },
      "[wireguard] Could not determine server public key. " +
      "Run: wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key"
    );
  }

  // Parse `wg show` output
  let interfaceUp = false;
  let peers: Array<{ publicKey: string; allowedIps: string; endpoint: string; latestHandshake: string; transferRx: string; transferTx: string }> = [];

  try {
    const wgShow = await run("wg show all dump");
    const lines = wgShow.split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split("\t");
      // Interface line: interface  privatekey  publickey  listenport  fwmark
      if (parts.length === 5 && parts[0] === WG_INTERFACE) {
        interfaceUp = true;
      }
      // Peer line: interface  publickey  preshared  endpoint  allowedips  latesthandshake  rx  tx  keepalive
      if (parts.length === 9 && parts[0] === WG_INTERFACE) {
        peers.push({
          publicKey: parts[1],
          endpoint: parts[3] === "(none)" ? "" : parts[3],
          allowedIps: parts[4],
          latestHandshake: parts[5] === "0" ? "never" : new Date(parseInt(parts[5]) * 1000).toISOString(),
          transferRx: parts[6],
          transferTx: parts[7],
        });
      }
    }
  } catch {
    interfaceUp = false;
  }

  // Find the next available VPN IP across the full /16 subnet (10.0.x.x)
  // Supports up to 65534 tablets (10.0.0.2 → 10.0.255.254, skipping .0.1 = server)
  const usedIps = new Set(peers.map((p) => p.allowedIps.split("/")[0]));
  usedIps.add(SERVER_VPN_IP);
  let nextIp = "";
  // Scan third octet 0–255, fourth octet 2–254
  outer: for (let c = 0; c <= 255; c++) {
    for (let d = c === 0 ? 2 : 1; d <= 254; d++) {
      const candidate = `${VPN_SUBNET_PREFIX}.${c}.${d}`;
      if (!usedIps.has(candidate)) { nextIp = candidate; break outer; }
    }
  }

  return {
    serverPublicKey,
    interfaceUp,
    serverVpnIp: SERVER_VPN_IP,
    nextAvailableIp: nextIp,
    peerCount: peers.length,
    peers,
    wgInterface: WG_INTERFACE,
    vpnSubnet: `${VPN_SUBNET_PREFIX}.0.0/${VPN_CIDR}`,
    serverEndpoint: `${process.env.SERVER_PUBLIC_IP ?? "169.58.124.150"}:${process.env.WG_PORT ?? "51820"}`,
  };
}

/**
 * Add a new peer to WireGuard (live, no restart needed).
 * Also persists to wg0.conf so it survives reboots.
 */
export async function addPeer(input: {
  publicKey: string;
  vpnIp: string;
  comment?: string;
}): Promise<{ vpnIp: string; publicKey: string }> {
  const { publicKey, vpnIp, comment } = input;

  if (!isValidKey(publicKey)) throw new Error("Invalid WireGuard public key format");
  if (!isValidIp(vpnIp)) throw new Error("Invalid VPN IP address");
  if (!vpnIp.startsWith(VPN_SUBNET_PREFIX + ".")) throw new Error(`VPN IP must be in subnet ${VPN_SUBNET_PREFIX}.x.x`);

  // Add peer live (no interface restart — zero downtime)
  await run(`wg set ${WG_INTERFACE} peer "${publicKey}" allowed-ips ${vpnIp}/32`);

  // Persist to config file
  await _persistPeerToConf(publicKey, vpnIp, comment ?? "");

  logger.info({ publicKey: publicKey.slice(0, 8) + "…", vpnIp }, "[wireguard] Peer added");
  return { vpnIp, publicKey };
}

/**
 * Remove a peer from WireGuard (live + config file).
 * Removes from running interface immediately (zero downtime),
 * then rewrites wg0.conf so the removal survives reboots.
 */
export async function removePeer(publicKey: string): Promise<void> {
  if (!isValidKey(publicKey)) throw new Error("Invalid WireGuard public key format");

  // 1. Remove from live running interface
  await run(`wg set ${WG_INTERFACE} peer "${publicKey}" remove`);

  // 2. Rewrite config file to remove the peer block permanently
  await _removePeerFromConf(publicKey);

  // 3. Sync in-memory state to conf file (belt-and-suspenders)
  await run(`wg-quick save ${WG_INTERFACE}`).catch(() => null);

  logger.info({ publicKey: publicKey.slice(0, 8) + "…" }, "[wireguard] Peer removed (live + conf)");
}

/**
 * Check if the WireGuard interface is running; start it if not.
 */
export async function ensureInterfaceUp(): Promise<{ wasAlreadyUp: boolean }> {
  try {
    await run(`wg show ${WG_INTERFACE}`);
    return { wasAlreadyUp: true };
  } catch {
    await run(`wg-quick up ${WG_INTERFACE}`);
    return { wasAlreadyUp: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config file helpers
// ─────────────────────────────────────────────────────────────────────────────

async function _persistPeerToConf(publicKey: string, vpnIp: string, comment: string) {
  if (!existsSync(WG_CONF)) return;
  const current = await readFile(WG_CONF, "utf8");

  // Don't add duplicate
  if (current.includes(publicKey)) return;

  const peerBlock = [
    "",
    comment ? `# ${comment}` : "",
    "[Peer]",
    `PublicKey = ${publicKey}`,
    `AllowedIPs = ${vpnIp}/32`,
    "",
  ]
    .filter((l, i) => i !== 1 || comment)
    .join("\n");

  await writeFile(WG_CONF, current + peerBlock, "utf8");
  // Save running config to file
  await run(`wg-quick save ${WG_INTERFACE}`).catch(() => null);
}

async function _removePeerFromConf(publicKey: string) {
  if (!existsSync(WG_CONF)) return;
  const current = await readFile(WG_CONF, "utf8");

  // Split into blocks separated by blank lines, filter out the [Peer] block
  // that contains the target public key, then rejoin.
  // This is more reliable than line-by-line scanning.
  const blocks = current.split(/\n(?=\[)/);
  const filtered = blocks.filter(block => !block.includes(publicKey));
  const cleaned = filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  await writeFile(WG_CONF, cleaned, "utf8");

  // Save running config to file (wg-quick save may fail if interface name differs — ignore)
  await run(`wg-quick save ${WG_INTERFACE}`).catch(() => null);
}

/**
 * Generate a config snippet the tablet needs to import.
 * The tablet receives this from the server — it never needs to know the private key format.
 */
export function buildTabletConfig(input: {
  tabletPrivateKey: string;
  tabletVpnIp: string;
  serverPublicKey: string;
  serverEndpoint: string;
  dns?: string;
}) {
  return [
    "[Interface]",
    `PrivateKey = ${input.tabletPrivateKey}`,
    `Address = ${input.tabletVpnIp}/32`,
    `DNS = ${input.dns ?? "1.1.1.1"}`,
    "",
    "[Peer]",
    `PublicKey = ${input.serverPublicKey}`,
    `AllowedIPs = ${VPN_SUBNET_PREFIX}.0.0/${VPN_CIDR}`,
    `Endpoint = ${input.serverEndpoint}`,
    "PersistentKeepalive = 25",
  ].join("\n");
}

/**
 * Ping a VPN IP from the server using Linux `ping`.
 * Returns raw output so the super admin can see exactly what the server sees —
 * same as running `ping -c 4 10.0.0.3` in the server terminal.
 *
 * @param target  IP address to ping — validated before use
 * @param count   Number of ICMP packets (default 4)
 */
export async function pingVpnIp(
  target: string,
  count = 4
): Promise<{ success: boolean; output: string; rttMs?: number }> {
  // Strict IP validation — prevent any command injection
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(target)) {
    throw new Error(`Invalid IP address: ${target}`);
  }
  if (target.split(".").some((n) => parseInt(n, 10) > 255)) {
    throw new Error(`Invalid IP address: ${target}`);
  }

  const safeCount = Math.min(Math.max(1, count), 10); // clamp 1–10
  try {
    // -c = packet count, -W = per-packet timeout (seconds), -q = quiet summary output
    const { stdout, stderr } = await execAsync(
      `ping -c ${safeCount} -W 2 -q ${target}`,
      { timeout: (safeCount * 3 + 5) * 1000 }
    );

    const out = (stdout || stderr || "").trim();
    // Linux ping success: output contains "X received" where X > 0
    const receivedMatch = out.match(/(\d+)\s+received/);
    const received = receivedMatch ? parseInt(receivedMatch[1], 10) : 0;
    const success = received > 0;

    // Extract average RTT from "rtt min/avg/max/mdev = 0.123/0.456/0.789/0.100 ms"
    const rttMatch = out.match(/rtt.*?=\s*[\d.]+\/([\d.]+)\//);
    const rttMs = rttMatch ? parseFloat(rttMatch[1]) : undefined;

    return { success, output: out, rttMs };
  } catch (err) {
    // execAsync throws on non-zero exit (all packets lost) — still return the output
    const anyErr = err as any;
    const out = (anyErr?.stdout || anyErr?.stderr || anyErr?.message || "ping failed").trim();
    const receivedMatch = out.match(/(\d+)\s+received/);
    const received = receivedMatch ? parseInt(receivedMatch[1], 10) : 0;
    return { success: received > 0, output: out };
  }
}
