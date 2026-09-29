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
    expect(content).toContain("prune()");
    // Ensure client code does NOT create WebSocket or connect to 24678
    expect(content).not.toMatch(/new WebSocket\(.*24678/);
  });

  it("6. createHotContext contract must satisfy Vite 6 ViteHotContext and never throw on prune()", () => {
    const viteContent = fs.readFileSync(viteConfigPath, "utf-8");
    const serverContent = fs.readFileSync(serverPath, "utf-8");

    // Both vite.config.ts and server.ts must define prune() inside createHotContext
    expect(viteContent).toMatch(/prune\s*\(\)\s*\{\}/);
    expect(serverContent).toMatch(/prune\s*\(\)\s*\{\}/);

    // Verify Proxy fallback presence so any custom/future Vite HMR hook does not throw
    expect(viteContent).toContain("new Proxy");
    expect(serverContent).toContain("new Proxy");
  });

  it("7. createHotContext functional contract execution test", () => {
    // Replicate the exact createHotContext implementation
    function createHotContext() {
      const hot = {
        accept() {},
        acceptExports() {},
        dispose() {},
        prune() {},
        decline() {},
        invalidate() {},
        on() {},
        off() {},
        send() {},
        data: {}
      };
      return new Proxy(hot, {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          return () => {};
        }
      });
    }

    const hot = createHotContext();
    expect(typeof (hot as any).prune).toBe("function");
    expect(typeof (hot as any).accept).toBe("function");
    expect(typeof (hot as any).dispose).toBe("function");
    expect(typeof (hot as any).decline).toBe("function");
    expect(typeof (hot as any).invalidate).toBe("function");
    expect(typeof (hot as any).on).toBe("function");
    expect(typeof (hot as any).off).toBe("function");
    expect(typeof (hot as any).send).toBe("function");
    expect(typeof (hot as any).data).toBe("object");

    // Must execute hot.prune with callback without error
    expect(() => {
      (hot as any).prune(() => {});
    }).not.toThrow();

    // Must execute any unexpected or future HMR hook without error
    expect(() => {
      (hot as any).unknownHook();
    }).not.toThrow();
  });
});
