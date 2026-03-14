## Post-Mortem Analysis

A strategy has suffered significant losses.

**Strategy:** {{strategy}}
**Loss amount:** {{loss_eur}} EUR ({{loss_pct}}% of capital)
**Time period:** Last 24 hours

**Trades causing loss:**
{{trades}}

**Market conditions:**
{{market_context}}

**Strategy history (30 days):**
{{history}}

Respond ONLY with valid JSON:
{
  "root_cause": string,
  "was_preventable": boolean,
  "recommended_action": "continue" | "pause_24h" | "pause_48h" | "disable",
  "parameter_changes": [{ "param": string, "from": any, "to": any, "reason": string }],
  "lessons": string
}
