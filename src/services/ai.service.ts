import Anthropic from '@anthropic-ai/sdk';
import prisma from '../db/client.js';
import { fetchUnifiedPortfolio } from './portfolio.service.js';
import { getCryptoPrices, getMacroData, getEconomicCalendar, getEarningsCalendar } from './market-data.service.js';
import { AIInsight, AIMessage } from '../types/common.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function buildPortfolioContext(): Promise<string> {
  const [portfolio, prices, macro, economicEvents, earningsEvents] = await Promise.all([
    fetchUnifiedPortfolio().catch(() => null),
    getCryptoPrices().catch(() => []),
    getMacroData().catch(() => null),
    getEconomicCalendar().catch(() => []),
    getEarningsCalendar().catch(() => []),
  ]);

  const settings = await prisma.userSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  const riskProfile = settings?.riskProfile ?? 'MODERATE';

  let ctx = `## Current Portfolio State\n`;
  if (portfolio) {
    ctx += `- **Total Value**: $${portfolio.totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}\n`;
    ctx += `- **24h PnL**: ${portfolio.pnl24h >= 0 ? '+' : ''}$${portfolio.pnl24h.toFixed(2)} (${portfolio.pnl24hPercent.toFixed(2)}%)\n`;
    ctx += `- **Allocation**:\n`;
    ctx += `  - Crypto: $${portfolio.breakdown.crypto.toFixed(2)} (${((portfolio.breakdown.crypto / portfolio.totalValue) * 100).toFixed(1)}%)\n`;
    ctx += `  - Traditional Finance: $${portfolio.breakdown.tradfi.toFixed(2)} (${((portfolio.breakdown.tradfi / portfolio.totalValue) * 100).toFixed(1)}%)\n`;
    ctx += `  - Prediction Markets: $${portfolio.breakdown.predictions.toFixed(2)} (${((portfolio.breakdown.predictions / portfolio.totalValue) * 100).toFixed(1)}%)\n`;
    ctx += `  - DeFi: $${portfolio.breakdown.defi.toFixed(2)} (${((portfolio.breakdown.defi / portfolio.totalValue) * 100).toFixed(1)}%)\n`;
    ctx += `  - Cash: $${portfolio.breakdown.cash.toFixed(2)}\n`;

    if (portfolio.positions.length > 0) {
      ctx += `\n## Active Positions (top ${Math.min(10, portfolio.positions.length)})\n`;
      for (const pos of portfolio.positions.slice(0, 10)) {
        ctx += `- **${pos.asset}** ${pos.side} ${pos.size} @ $${pos.entryPrice} | PnL: ${pos.pnl} (${pos.pnlPercent}%)\n`;
      }
    }
  }

  ctx += `\n## Risk Profile: ${riskProfile}\n`;

  if (macro) {
    ctx += `\n## Macro Environment\n`;
    ctx += `- Fed Funds Rate: ${macro.fedFundsRate}%\n`;
    ctx += `- CPI: ${macro.cpi}%\n`;
    ctx += `- 10Y Treasury: ${macro.tenYearYield}%\n`;
    ctx += `- DXY: ${macro.dxy}\n`;
    ctx += `- Fear & Greed: ${macro.fearGreedIndex} (${macro.fearGreedLabel})\n`;
  }

  if (prices.length > 0) {
    ctx += `\n## Crypto Market\n`;
    for (const p of prices.slice(0, 8)) {
      ctx += `- ${p.symbol}: $${p.price.toLocaleString()} (${p.change24hPercent >= 0 ? '+' : ''}${p.change24hPercent.toFixed(2)}% 24h)\n`;
    }
  }

  const upcomingEvents = [...economicEvents.slice(0, 5), ...earningsEvents.slice(0, 5)];
  if (upcomingEvents.length > 0) {
    ctx += `\n## Upcoming Events (7 days)\n`;
    for (const e of economicEvents.slice(0, 4)) {
      ctx += `- ${e.date} | **${e.event}** (${e.country}) — Impact: ${e.impact}\n`;
    }
    for (const e of earningsEvents.slice(0, 4)) {
      ctx += `- ${e.date} | **${e.company} (${e.ticker})** Earnings — EPS Est: ${e.epsEstimate ?? 'N/A'}\n`;
    }
  }

  return ctx;
}

const SYSTEM_PROMPT = `You are FinVault AI — an expert financial advisor and portfolio manager with deep expertise in:
- Equities, ETFs, bonds, and fixed income
- Cryptocurrency markets, DeFi protocols, and blockchain technology
- Derivatives (futures, options, perpetuals), leverage management
- Prediction markets (Polymarket, Kalshi)
- Swiss private banking, IBKR institutional trading, US brokerage accounts
- Macroeconomics, central bank policy, FX markets
- Risk management, portfolio theory (Modern Portfolio Theory, Black-Litterman)
- Tax optimization strategies for multi-jurisdictional portfolios

You always:
1. Give concrete, actionable advice based on the user's actual portfolio data
2. Quantify risks and opportunities with specific numbers when possible
3. Consider the user's stated risk profile when making recommendations
4. Flag concentration risks, fee drag, and inefficient allocations
5. Stay current with market conditions from the provided context

You never:
- Guarantee returns or make overly optimistic predictions
- Recommend illegal activities or market manipulation
- Ignore the user's risk profile when making recommendations

Respond in clear, professional language. Use markdown formatting for structure. Be direct and specific.`;

export async function chatWithAI(
  userMessage: string,
  history: AIMessage[] = []
): Promise<AsyncIterable<string>> {
  const context = await buildPortfolioContext();

  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user',
      content: `${context}\n\n---\n\n**User Question:** ${userMessage}`,
    },
  ];

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
  });

  return (async function* () {
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text;
      }
    }
  })();
}

export async function generateInsights(): Promise<AIInsight[]> {
  const portfolio = await fetchUnifiedPortfolio().catch(() => null);
  if (!portfolio || portfolio.totalValue === 0) {
    return [{
      type: 'INFO',
      title: 'Connect your accounts',
      body: 'Add your exchange and broker accounts in the Accounts page to get personalized insights.',
      priority: 1,
    }];
  }

  const insights: AIInsight[] = [];

  // Concentration check
  const dominant = Object.entries(portfolio.breakdown)
    .sort(([, a], [, b]) => b - a)[0];
  if (dominant && dominant[1] / portfolio.totalValue > 0.8) {
    insights.push({
      type: 'WARNING',
      title: 'High concentration risk',
      body: `${Math.round((dominant[1] / portfolio.totalValue) * 100)}% of your portfolio is in ${dominant[0]}. Consider diversifying across asset classes to reduce correlated risk.`,
      priority: 3,
    });
  }

  // Positive PnL
  if (portfolio.pnl24hPercent > 3) {
    insights.push({
      type: 'OPPORTUNITY',
      title: 'Strong 24h performance',
      body: `Your portfolio is up ${portfolio.pnl24hPercent.toFixed(2)}% in 24 hours ($${portfolio.pnl24h.toFixed(2)}). Consider whether to take partial profits on leveraged positions.`,
      priority: 2,
    });
  }

  // Generate AI-powered insight for high-value portfolios
  if (portfolio.totalValue > 1000 && process.env.ANTHROPIC_API_KEY) {
    try {
      const context = await buildPortfolioContext();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `${context}\n\nGenerate exactly 1 concise portfolio insight in JSON format: {"type": "WARNING|OPPORTUNITY|INFO", "title": "...", "body": "...", "asset": "optional asset name", "priority": 1-5}. Return only valid JSON, no other text.`,
        }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        insights.push(parsed);
      }
    } catch { /* skip AI insight if API unavailable */ }
  }

  insights.sort((a, b) => b.priority - a.priority);
  return insights;
}

export async function analyzePosition(asset: string, platform: string): Promise<string> {
  const context = await buildPortfolioContext();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `${context}\n\nProvide a detailed analysis of my ${asset} position on ${platform}. Include: current market outlook, key risk factors, support/resistance levels, and a specific recommendation (hold/reduce/add/close with rationale).`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

export async function saveConversation(messages: AIMessage[]): Promise<void> {
  await prisma.aIConversation.createMany({
    data: messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    })),
    skipDuplicates: true,
  });
}

export async function getConversationHistory(limit = 50): Promise<AIMessage[]> {
  const rows = await prisma.aIConversation.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return rows.reverse().map(r => ({
    role: r.role as 'user' | 'assistant',
    content: r.content,
    timestamp: r.timestamp.toISOString(),
  }));
}
