## Portfolio Rebalance Evaluation

**Total balance:** {{total_balance}} EUR
**Per-chain:** Solana: {{solana}} EUR | Base: {{base}} EUR | Polygon: {{polygon}} EUR
**Current tier:** {{tier}} ({{tier_name}})
**Mode:** {{mode}}

**Strategy P&L (7 days):**
{{strategy_pnl}}

**Target allocation (tier {{tier}}):**
{{target_allocation}}

**Current allocation:**
{{current_allocation}}

**Active circuit breakers:** {{breakers}}

Respond ONLY with valid JSON:
{
  "rebalance_needed": boolean,
  "moves": [{ "from_chain": string, "to_chain": string, "amount_eur": number, "reason": string }],
  "strategy_adjustments": [{ "strategy": string, "action": "increase" | "decrease" | "pause" | "resume", "reason": string }],
  "tier_recommendation": string
}
