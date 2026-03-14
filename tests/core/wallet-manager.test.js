// darwin/tests/core/wallet-manager.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WalletManager } from '../../chains/wallet-manager.js';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DIR = 'wallets/test';
const TEST_PASSPHRASE = 'test-passphrase-for-darwin-2026';

describe('WalletManager', () => {
  let wm;

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    wm = new WalletManager(TEST_DIR, TEST_PASSPHRASE);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('generates and encrypts a Solana keypair', () => {
    const pubkey = wm.generateSolanaWallet();
    expect(pubkey).toBeDefined();
    expect(typeof pubkey).toBe('string');
    expect(pubkey.length).toBeGreaterThan(20); // Base58 public key

    // Encrypted file should exist
    const encFile = path.join(TEST_DIR, 'solana.enc');
    expect(fs.existsSync(encFile)).toBe(true);
  });

  it('generates and encrypts an EVM key', () => {
    const address = wm.generateEvmWallet();
    expect(address).toBeDefined();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const encFile = path.join(TEST_DIR, 'evm.enc');
    expect(fs.existsSync(encFile)).toBe(true);
  });

  it('loads and decrypts Solana wallet', () => {
    const originalPubkey = wm.generateSolanaWallet();

    // Create new manager (simulates restart)
    const wm2 = new WalletManager(TEST_DIR, TEST_PASSPHRASE);
    const loaded = wm2.loadSolanaWallet();
    expect(loaded.publicKey).toBe(originalPubkey);
  });

  it('loads and decrypts EVM wallet', () => {
    const originalAddress = wm.generateEvmWallet();

    const wm2 = new WalletManager(TEST_DIR, TEST_PASSPHRASE);
    const loaded = wm2.loadEvmWallet();
    expect(loaded.address).toBe(originalAddress);
  });

  it('fails to decrypt with wrong passphrase', () => {
    wm.generateSolanaWallet();

    const wmBad = new WalletManager(TEST_DIR, 'wrong-passphrase');
    expect(() => wmBad.loadSolanaWallet()).toThrow();
  });

  it('never exposes private keys via toString or JSON', () => {
    wm.generateSolanaWallet();
    const loaded = wm.loadSolanaWallet();

    // The returned object should NOT contain raw secret key
    const str = JSON.stringify(loaded);
    expect(str).not.toContain('secretKey');
    expect(str).not.toContain('privateKey');
  });
});
