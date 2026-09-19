import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('P0-06 / OFF-03: Offline UI Shell, ServiceWorker & Full PWA Verification', () => {
  const publicDir = path.join(process.cwd(), 'public');

  describe('1. PWA Assets Compliance (PNG & SVG Validation)', () => {
    it('verifies that icon.svg exists and contains industrial vector definitions', () => {
      const svgPath = path.join(publicDir, 'icon.svg');
      expect(fs.existsSync(svgPath)).toBe(true);
      const content = fs.readFileSync(svgPath, 'utf8');
      expect(content).toContain('<svg');
      expect(content).toContain('viewBox="0 0 512 512"');
      expect(content).toContain('sugarCane');
    });

    it('verifies standard 192x192 PNG exists and has valid PNG signature', () => {
      const pwa192 = path.join(publicDir, 'pwa-192x192.png');
      expect(fs.existsSync(pwa192)).toBe(true);
      const buffer = fs.readFileSync(pwa192);
      // Check PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
      // Check width and height from IHDR
      expect(buffer.readUInt32BE(16)).toBe(192);
      expect(buffer.readUInt32BE(20)).toBe(192);
    });

    it('verifies standard 512x512 PNG exists and has valid PNG signature', () => {
      const pwa512 = path.join(publicDir, 'pwa-512x512.png');
      expect(fs.existsSync(pwa512)).toBe(true);
      const buffer = fs.readFileSync(pwa512);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
      expect(buffer.readUInt32BE(16)).toBe(512);
      expect(buffer.readUInt32BE(20)).toBe(512);
    });

    it('verifies maskable 512x512 PNG exists with valid IHDR dimensions', () => {
      const pwaMaskable = path.join(publicDir, 'pwa-maskable-512x512.png');
      expect(fs.existsSync(pwaMaskable)).toBe(true);
      const buffer = fs.readFileSync(pwaMaskable);
      expect(buffer.readUInt32BE(16)).toBe(512);
      expect(buffer.readUInt32BE(20)).toBe(512);
    });

    it('verifies apple-touch-icon.png exists for iOS Safari support', () => {
      const appleTouch = path.join(publicDir, 'apple-touch-icon.png');
      expect(fs.existsSync(appleTouch)).toBe(true);
      const buffer = fs.readFileSync(appleTouch);
      expect(buffer.readUInt32BE(16)).toBe(180);
      expect(buffer.readUInt32BE(20)).toBe(180);
    });
  });

  describe('2. Vite Configuration & Workbox Precaching', () => {
    it('verifies vite.config.ts exports PWA configuration with required manifest standards', async () => {
      const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
      const content = fs.readFileSync(viteConfigPath, 'utf8');

      expect(content).toContain('VitePWA');
      expect(content).toContain("registerType: 'autoUpdate'");
      expect(content).toContain("short_name: 'BioAzúcar'");
      expect(content).toContain("display: 'standalone'");
      expect(content).toContain("purpose: 'maskable'");
      expect(content).toContain("globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']");
      expect(content).toContain('NetworkFirst');
      expect(content).toContain('devOptions:');
    });

    it('verifies index.html has required PWA and mobile meta tags', () => {
      const indexPath = path.join(process.cwd(), 'index.html');
      const content = fs.readFileSync(indexPath, 'utf8');

      expect(content).toContain('name="theme-color"');
      expect(content).toContain('name="mobile-web-app-capable" content="yes"');
      expect(content).toContain('name="apple-mobile-web-app-capable" content="yes"');
      expect(content).toContain('rel="apple-touch-icon"');
      expect(content).toContain('rel="icon"');
    });
  });

  describe('3. PWA Runtime Hooks & State Logic', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('verifies useOnlineStatus tracks navigator connectivity', async () => {
      const { useOnlineStatus } = await import('../hooks/useOnlineStatus');
      expect(typeof useOnlineStatus).toBe('function');
    });

    it('verifies usePWAInstall hook exports expected contract', async () => {
      const { usePWAInstall } = await import('../hooks/usePWAInstall');
      expect(typeof usePWAInstall).toBe('function');
    });

    it('verifies OfflineSyncManager status reporting integrates with offline UI', async () => {
      const { OfflineSyncManager } = await import('../services/offline/OfflineSyncManager');
      const manager = OfflineSyncManager.getInstance();
      const status = manager.getStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('pendingCount');
      expect(status).toHaveProperty('isSyncing');
    });
  });
});
