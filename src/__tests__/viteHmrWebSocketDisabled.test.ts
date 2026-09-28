import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("[BioAzúcar 4.0] P0 — Vite WebSocket / HMR Complete Eradication Verification", () => {
  const rootDir = process.cwd();
  const viteConfigPath = path.join(rootDir, "vite.config.ts");
  const serverPath = path.join(rootDir, "server.ts");
  const indexHtmlPath = path.join(rootDir, "index.html");

  it("1. vite.config.ts must explicitly configure hmr: false and watch: null", () => {
    const content = fs.readFileSync(viteConfigPath, "utf-8");
    expect(content).toContain("hmr: false");
    expect(content).toContain("watch: null");
    // Ensure no dynamic re-enabling via process.env.DISABLE_HMR !== 'true'
    expect(content).not.toContain("hmr: process.env.DISABLE_HMR !== 'true'");
  });

  it("2. server.ts must configure Vite server with middlewareMode: true, hmr: false, ws: false", () => {
    const content = fs.readFileSync(serverPath, "utf-8");
    expect(content).toMatch(/middlewareMode:\s*true/);
    expect(content).toMatch(/hmr:\s*false/);
    expect(content).toMatch(/ws:\s*false/);
    expect(content).toContain('process.env.DISABLE_HMR = "true"');
  });

  it("3. index.html must NOT contain artificial console monkey-patching or [vite] error filters", () => {
    const content = fs.readFileSync(indexHtmlPath, "utf-8");
    // Must NOT contain monkey-patched console.error or console.warn for vite
    expect(content).not.toContain("isViteOrExtensionLog");
    expect(content).not.toContain("origConsoleError");
    expect(content).not.toContain("origConsoleWarn");
    expect(content).not.toContain("failed to connect to websocket");
    expect(content).not.toContain("vite-hmr");
  });

  it("4. server.ts must NOT inject HTML string replacement to suppress [vite] console logs", () => {
    const content = fs.readFileSync(serverPath, "utf-8");
    expect(content).not.toContain("isViteNoise");
    expect(content).not.toContain("failed to connect to websocket");
    expect(content).not.toContain("vite-hmr");
  });

  it("5. noHmrWebSocketPlugin must eliminate WebSocket and 24678 references in client runtime", () => {
    const content = fs.readFileSync(viteConfigPath, "utf-8");
    expect(content).toContain("noHmrWebSocketPlugin");
    expect(content).toContain("virtual:vite-no-hmr-client");
    expect(content).toContain("updateStyle");
    expect(content).toContain("removeStyle");
    expect(content).toContain("createHotContext");
    // Ensure client code does NOT create WebSocket or connect to 24678
    expect(content).not.toMatch(/new WebSocket\(.*24678/);
  });
});
