## Prediction Market Analysis

Analyze this prediction market opportunity:

**Market:** {{market_title}}
**Current probability:** {{current_probability}}%
**Volume:** ${{volume}}
**Liquidity:** ${{liquidity}}
**Resolution date:** {{resolution_date}}

**Our available capital for this trade:** {{available_eur}} EUR
**Current predictions portfolio:** {{current_predictions}}

Respond ONLY with valid JSON:
{
  "action": "buy_yes" | "buy_no" | "skip",
  "confidence": 0.0-1.0,
  "estimated_probability": 0.0-1.0,
  "reasoning": "1-2 sentences",
  "suggested_size_eur": number
}
