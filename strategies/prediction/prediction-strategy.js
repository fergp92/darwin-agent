// darwin/strategies/prediction/prediction-strategy.js
import { BaseStrategy } from '../base-strategy.js';

/**
 * Prediction market strategy using Polymarket + Brain analysis.
 * Brain evaluates markets for edge, strategy places bets when confidence >= 0.6.
 */
export class PredictionStrategy extends BaseStrategy {
  constructor({ brain, polymarketClient, paper } = {}) {
    super('prediction', { paper, minCapital: 5 });
    this.brain = brain;
    this.polymarketClient = polymarketClient;
    this._activePredictions = [];
    this._totalPnl = 0;
  }

  /**
   * Fetch active prediction markets from Polymarket.
   * @returns {Promise<Array>}
   */
  async scan() {
    const markets = await this.polymarketClient.getActiveMarkets();
    this.log.info({ count: markets.length }, 'Scanned Polymarket markets');
    return markets;
  }

  /**
   * Ask the Brain to evaluate a market opportunity.
   * @param {object} market - Market data from scan()
   * @returns {Promise<{shouldExecute: boolean, action?: string, confidence?: number, estimated_probability?: number, suggested_size_eur?: number}>}
   */
  async evaluate(market) {
    const brainResponse = await this.brain.invoke({
      task: 'prediction_market_analysis',
      market: {
        id: market.id,
        title: market.title,
        probability: market.probability,
        volume: market.volume,
        liquidity: market.liquidity,
        resolutionDate: market.resolutionDate,
      },
    });

    const { action, confidence } = brainResponse;

    if (action === 'skip' || (confidence ?? 0) < 0.6) {
      this.log.info(
        { marketId: market.id, action, confidence },
        'Brain rejected market',
      );
      return { shouldExecute: false };
    }

    return {
      shouldExecute: true,
      action,
      confidence,
      estimated_probability: brainResponse.estimated_probability,
      suggested_size_eur: brainResponse.suggested_size_eur,
      marketId: market.id,
      marketTitle: market.title,
    };
  }

  /**
   * Execute a prediction bet via Polymarket.
   * @param {object} evaluation - Approved evaluation from evaluate()
   * @returns {Promise<object>}
   */
  async execute(evaluation) {
    const position = evaluation.action.includes('yes') ? 'yes' : 'no';
    const amount = evaluation.suggested_size_eur ?? this.minCapital;

    const result = await this.polymarketClient.placeBet(
      evaluation.marketId,
      position,
      amount,
    );

    const prediction = {
      ...evaluation,
      orderId: result.orderId,
      txHash: result.txHash,
      timestamp: Date.now(),
    };

    this._activePredictions.push(prediction);
    this.log.info(
      { marketId: evaluation.marketId, position, amount, orderId: result.orderId },
      'Prediction bet placed',
    );

    return prediction;
  }

  /**
   * Report current prediction strategy state.
   * @returns {{activePredictions: number, totalPnl: number, winRate: number}}
   */
  report() {
    const resolved = this._activePredictions.filter((p) => p.resolved);
    const wins = resolved.filter((p) => p.won);
    const winRate = resolved.length > 0 ? wins.length / resolved.length : 0;

    return {
      activePredictions: this._activePredictions.length,
      totalPnl: this._totalPnl,
      winRate,
    };
  }
}
