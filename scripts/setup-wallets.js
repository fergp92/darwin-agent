// darwin/scripts/setup-wallets.js
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WalletManager } from '../chains/wallet-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHAINS = [
  { name: 'Solana', file: 'solana.enc', type: 'solana' },
  { name: 'Base',    file: 'evm.enc',    type: 'evm' },
  { name: 'Polygon', file: 'evm.enc',    type: 'evm' },
];

/**
 * Generate encrypted wallet files for all supported chains.
 * Skips any wallet that already exists on disk.
 *
 * @param {object}  opts
 * @param {string}  [opts.walletsDir] — directory for .enc files (default: ../wallets)
 * @param {string}  opts.passphrase   — encryption passphrase (>= 12 chars)
 */
export async function setupWallets({ walletsDir, passphrase } = {}) {
  const dir = walletsDir ?? join(__dirname, '..', 'wallets');
  mkdirSync(dir, { recursive: true });

  const wm = new WalletManager(dir, passphrase);
  const generated = [];

  for (const chain of CHAINS) {
    const filePath = join(dir, chain.file);

    if (existsSync(filePath)) {
      // Already exists — load to show address, but don't overwrite
      const wallet = chain.type === 'solana'
        ? wm.loadSolanaWallet()
        : wm.loadEvmWallet();
      const addr = chain.type === 'solana' ? wallet.publicKey : wallet.address;
      console.log(`${chain.name}: already exists  ${addr}`);
    } else {
      // Generate new wallet
      const addr = chain.type === 'solana'
        ? wm.generateSolanaWallet()
        : wm.generateEvmWallet();
      console.log(`${chain.name}: created  ${addr}  (${filePath})`);
      generated.push(chain.name);
    }
  }

  // Funding instructions
  console.log('\n--- Funding instructions ---');
  console.log('Solana : send SOL to the Solana address above (devnet faucet: https://faucet.solana.com)');
  console.log('Base   : send ETH on Base network to the EVM address above');
  console.log('Polygon: send MATIC on Polygon network to the same EVM address');
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const passphrase = process.env.DARWIN_WALLET_PASSPHRASE;
  if (!passphrase) {
    console.error('Set DARWIN_WALLET_PASSPHRASE env var (>= 12 chars)');
    process.exit(1);
  }
  setupWallets({ passphrase });
}
