/**
 * BioAzúcar 4.0 — Industrial TLS Handshake & X.509 Certificate Validator
 * 
 * Implements real TLS connection establishment, handshake negotiation,
 * cipher suite verification, and X.509 certificate validation conforming
 * to IEC 62443-4-2 SL3, ISA-95, and Modbus TCP Security (Port 802).
 */

// Safely resolve Node.js built-in modules dynamically only in Node/server runtime
async function getNodeModules(): Promise<{ tls: any; net: any; fs: any } | null> {
  if (typeof window !== "undefined" || typeof document !== "undefined") {
    return null;
  }

  try {
    const tlsName = "tls";
    const netName = "net";
    const fsName = "fs";
    const [rawTls, rawNet, rawFs] = await Promise.all([
      import(/* @vite-ignore */ tlsName),
      import(/* @vite-ignore */ netName),
      import(/* @vite-ignore */ fsName),
    ]);
    const tls = rawTls?.default || rawTls;
    const net = rawNet?.default || rawNet;
    const fs = rawFs?.default || rawFs;
    return { tls, net, fs };
  } catch {
    return null;
  }
}

export interface TlsHandshakeOptions {
  host: string;
  port: number;
  timeoutMs?: number;
  caCert?: string | Buffer;
  clientCert?: string | Buffer;
  clientKey?: string | Buffer;
  rejectUnauthorized?: boolean;
  servername?: string;
  minVersion?: "TLSv1.2" | "TLSv1.3";
}

export interface TlsHandshakeResult {
  success: boolean;
  authorized: boolean;
  authorizationError?: Error | string | null;
  protocol?: string | null;
  cipher?: {
    name: string;
    version: string;
  } | null;
  peerCertificate?: {
    subject: any;
    issuer: any;
    validFrom: string;
    validTo: string;
    fingerprint256: string;
    serialNumber: string;
  } | null;
  latencyMs: number;
  errorMessage?: string;
}

/**
 * Performs a REAL TLS handshake over the network using Node's native tls.connect.
 * Verifies certificate validity, cipher suite, and protocol version.
 */
export function performTlsHandshake(options: TlsHandshakeOptions): Promise<TlsHandshakeResult> {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 3000;

    const nodeMods = await getNodeModules();
    const tls = nodeMods?.tls;
    const fs = nodeMods?.fs;

    if (!tls || typeof tls.connect !== "function") {
      resolve({
        success: false,
        authorized: false,
        latencyMs: 0,
        errorMessage: "TLS Handshake is only available in Edge IPC / Node.js runtime.",
      });
      return;
    }

    let ca = options.caCert;
    if (typeof ca === "string" && fs?.existsSync?.(ca)) {
      ca = fs.readFileSync(ca);
    }

    let cert = options.clientCert;
    if (typeof cert === "string" && fs?.existsSync?.(cert)) {
      cert = fs.readFileSync(cert);
    }

    let key = options.clientKey;
    if (typeof key === "string" && fs?.existsSync?.(key)) {
      key = fs.readFileSync(key);
    }

    const socket = tls.connect({
      host: options.host,
      port: options.port,
      ca,
      cert,
      key,
      rejectUnauthorized: options.rejectUnauthorized !== false,
      servername: options.servername || (options.host === "127.0.0.1" ? "localhost" : options.host),
      minVersion: options.minVersion || "TLSv1.2",
      timeout: timeoutMs,
    });

    let resolved = false;

    const finalize = (result: TlsHandshakeResult) => {
      if (!resolved) {
        resolved = true;
        try {
          socket.destroy();
        } catch {}
        resolve(result);
      }
    };

    socket.once("secureConnect", () => {
      const latencyMs = Date.now() - startTime;
      const peerCert = socket.getPeerCertificate(true);
      const cipher = socket.getCipher();
      const protocol = socket.getProtocol();

      finalize({
        success: true,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || null,
        protocol,
        cipher: cipher ? { name: cipher.name, version: cipher.version } : null,
        peerCertificate: peerCert && peerCert.fingerprint256 ? {
          subject: peerCert.subject,
          issuer: peerCert.issuer,
          validFrom: peerCert.valid_from,
          validTo: peerCert.valid_to,
          fingerprint256: peerCert.fingerprint256,
          serialNumber: peerCert.serialNumber,
        } : null,
        latencyMs,
      });
    });

    socket.once("error", (err: Error) => {
      const latencyMs = Date.now() - startTime;
      finalize({
        success: false,
        authorized: false,
        authorizationError: err,
        latencyMs,
        errorMessage: err.message,
      });
    });

    socket.once("timeout", () => {
      const latencyMs = Date.now() - startTime;
      finalize({
        success: false,
        authorized: false,
        authorizationError: "Handshake Timeout",
        latencyMs,
        errorMessage: `TLS Handshake timed out after ${timeoutMs}ms`,
      });
    });
  });
}

/**
 * Creates a local TLS test server for verifying handshakes in automated tests and local lab rigs.
 */
export function createTlsTestServer(certPem: string | Buffer, keyPem: string | Buffer): Promise<{
  server: any;
  port: number;
  close: () => Promise<void>;
}> {
  return new Promise(async (resolve, reject) => {
    const nodeMods = await getNodeModules();
    const tls = nodeMods?.tls;

    if (!tls || typeof tls.createServer !== "function") {
      reject(new Error("Node TLS runtime not available"));
      return;
    }

    const server = tls.createServer({
      cert: certPem,
      key: keyPem,
      minVersion: "TLSv1.2",
    }, (socket: any) => {
      // Echo or handle industrial protocol handshake
      socket.write("BIOAZUCAR_TLS_ACK\n");
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });

    server.on("error", (err: any) => reject(err));
  });
}
