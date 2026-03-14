// darwin/strategies/airdrop/airdrop-strategy.js
import { BaseStrategy } from '../base-strategy.js';
import { ProtocolRegistry } from './protocol-registry.js';

/**
 * Airdrop farming strategy.
 * Performs daily interactions with DeFi protocols to build eligibility
 * for potential token airdrops (swaps, deposits, votes, claims).
 */
export class AirdropStrategy extends BaseStrategy {
  /**
   * @param {{ adapters: Record<string, { sendAirdropInteraction: Function }>, paper?: boolean }} opts
   */
  constructor({ adapters, paper }) {
    super('airdrop', { paper, minCapital: 10 });
    this.adapters = adapters;
    this.registry = new ProtocolRegistry();
    this._interactionsToday = 0;
    this._totalInteractions = 0;
  }

  /**
   * Returns protocols that need interaction today.
   * Public so tests can mock it.
   */
  _getProtocolsDue() {
    return this.registry.getProtocolsDue();
  }

  /** @override */
  async scan() {
    const due = this._getProtocolsDue();
    this.log.info({ count: due.length }, 'Protocols due for airdrop interaction');
    return due;
  }

  /** @override */
  async evaluate(opp) {
    const gasSpent = opp.gasSpentToday ?? 0;
    const estimatedGas = opp.estimatedGas ?? 0;
    const budget = opp.dailyGasBudget ?? 0;
    const shouldExecute = gasSpent + estimatedGas <= budget;

    return {
      ...opp,
      shouldExecute,
      gasSpentToday: gasSpent,
      estimatedGas,
      dailyGasBudget: budget,
    };
  }

  /** @override */
  async execute(evaluation) {
    const adapter = this.adapters[evaluation.chain];
    if (!adapter) {
      throw new Error(`No adapter for chain: ${evaluation.chain}`);
    }

    const result = await adapter.sendAirdropInteraction({
      protocol: evaluation.protocol,
      interaction: evaluation.interaction,
    });

    this.registry.recordInteraction(evaluation);
    this._interactionsToday += 1;
    this._totalInteractions += 1;

    this.log.info(
      { protocol: evaluation.protocol, chain: evaluation.chain, txHash: result.txHash },
      'Airdrop interaction executed',
    );

    return {
      protocol: evaluation.protocol,
      chain: evaluation.chain,
      interaction: evaluation.interaction,
      txHash: result.txHash,
    };
  }

  /** @override */
  report() {
    return {
      interactionsToday: this._interactionsToday,
      totalInteractions: this._totalInteractions,
    };
  }
}
