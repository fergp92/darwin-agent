import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupWallets } from '../../scripts/setup-wallets.js';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('setup-wallets script', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'darwin-wallets-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates encrypted wallet files for all chains', async () => {
    await setupWallets({ walletsDir: tempDir, passphrase: 'test-pass-123' });
    const files = readdirSync(tempDir);
    expect(files).toContain('solana.enc');
    expect(files).toContain('evm.enc');
  });

  it('does NOT overwrite existing wallets', async () => {
    await setupWallets({ walletsDir: tempDir, passphrase: 'test-pass-123' });
    const firstRun = readdirSync(tempDir);
    await setupWallets({ walletsDir: tempDir, passphrase: 'test-pass-123' });
    const secondRun = readdirSync(tempDir);
    expect(firstRun.length).toBe(secondRun.length);
  });

  it('prints public addresses to stdout', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    await setupWallets({ walletsDir: tempDir, passphrase: 'test-pass-123' });
    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toContain('Solana');
    expect(output).toContain('Base');
    expect(output).toContain('Polygon');
    consoleSpy.mockRestore();
  });
});
