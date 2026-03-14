// darwin/chains/wallet-manager.js
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import { createLogger } from '../core/logger.js';

const log = createLogger('wallet-manager');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

export class WalletManager {
  #passphrase;
  #dir;

  /**
   * @param {string} walletsDir — directory for encrypted wallet files
   * @param {string} passphrase — encryption passphrase (from env)
   */
  constructor(walletsDir, passphrase) {
    if (!passphrase || passphrase.length < 12) {
      throw new Error('Wallet passphrase must be at least 12 characters');
    }
    this.#passphrase = passphrase;
    this.#dir = walletsDir;
    fs.mkdirSync(walletsDir, { recursive: true });
  }

  /**
   * Generate a new Solana keypair, encrypt, and save.
   * @returns {string} Base58 public key
   */
  generateSolanaWallet() {
    const keypair = Keypair.generate();
    const secretBytes = Buffer.from(keypair.secretKey);

    this.#encryptAndSave('solana.enc', secretBytes);
    log.info({ publicKey: keypair.publicKey.toBase58() }, 'Solana wallet generated');

    return keypair.publicKey.toBase58();
  }

  /**
   * Generate a new EVM wallet, encrypt, and save.
   * @returns {string} Checksummed address (0x...)
   */
  generateEvmWallet() {
    const wallet = ethers.Wallet.createRandom();
    const secretBytes = Buffer.from(wallet.privateKey.slice(2), 'hex'); // Remove 0x prefix

    this.#encryptAndSave('evm.enc', secretBytes);
    log.info({ address: wallet.address }, 'EVM wallet generated');

    return wallet.address;
  }

  /**
   * Load and decrypt the Solana wallet.
   * @returns {{ publicKey: string, sign: Function }}
   */
  loadSolanaWallet() {
    const secretBytes = this.#loadAndDecrypt('solana.enc');
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretBytes));

    // Return a safe wrapper — no raw key exposure
    return {
      publicKey: keypair.publicKey.toBase58(),
      sign: (tx) => {
        tx.sign(keypair);
        return tx;
      },
      toJSON: () => ({ publicKey: keypair.publicKey.toBase58() }),
    };
  }

  /**
   * Load and decrypt the EVM wallet.
   * @returns {{ address: string, signTransaction: Function, connect: Function }}
   */
  loadEvmWallet() {
    const secretBytes = this.#loadAndDecrypt('evm.enc');
    const privateKey = '0x' + secretBytes.toString('hex');
    const wallet = new ethers.Wallet(privateKey);

    // Return a safe wrapper — no raw key exposure
    return {
      address: wallet.address,
      signTransaction: (tx) => wallet.signTransaction(tx),
      connect: (provider) => wallet.connect(provider),
      toJSON: () => ({ address: wallet.address }),
    };
  }

  /**
   * Encrypt data with AES-256-GCM and save to file.
   */
  #encryptAndSave(filename, data) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(this.#passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    // File format: salt (32) + iv (16) + tag (16) + ciphertext
    const output = Buffer.concat([salt, iv, tag, encrypted]);
    fs.writeFileSync(path.join(this.#dir, filename), output);
  }

  /**
   * Load and decrypt data from an encrypted file.
   */
  #loadAndDecrypt(filename) {
    const filePath = path.join(this.#dir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Wallet file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath);
    const salt = raw.subarray(0, SALT_LENGTH);
    const iv = raw.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = raw.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = raw.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = crypto.pbkdf2Sync(this.#passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
