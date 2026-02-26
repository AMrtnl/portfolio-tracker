import prisma from '../db/client.js';
import { getCryptoPrice } from './market-data.service.js';
import { fetchUnifiedPortfolio } from './portfolio.service.js';
import { AlertConfig } from '../types/common.js';

export async function getAlerts(): Promise<AlertConfig[]> {
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: 'desc' } });
  return alerts.map(a => ({
    id: a.id,
    type: a.type as AlertConfig['type'],
    asset: a.asset ?? undefined,
    threshold: a.threshold,
    isActive: a.isActive,
  }));
}

export async function createAlert(config: Omit<AlertConfig, 'id'>): Promise<AlertConfig> {
  const alert = await prisma.alert.create({
    data: {
      type: config.type,
      asset: config.asset,
      threshold: config.threshold,
      isActive: config.isActive,
    },
  });
  return { id: alert.id, type: alert.type as AlertConfig['type'], asset: alert.asset ?? undefined, threshold: alert.threshold, isActive: alert.isActive };
}

export async function updateAlert(id: string, data: Partial<AlertConfig>): Promise<void> {
  await prisma.alert.update({ where: { id }, data });
}

export async function deleteAlert(id: string): Promise<void> {
  await prisma.alert.delete({ where: { id } });
}

// Called by scheduler every 60s
export async function checkAlerts(): Promise<void> {
  const alerts = await prisma.alert.findMany({ where: { isActive: true, triggered: false } });
  if (alerts.length === 0) return;

  const portfolio = await fetchUnifiedPortfolio().catch(() => null);

  for (const alert of alerts) {
    try {
      let triggered = false;

      switch (alert.type) {
        case 'PRICE_ABOVE':
        case 'PRICE_BELOW': {
          if (!alert.asset) break;
          const price = await getCryptoPrice(alert.asset);
          triggered = alert.type === 'PRICE_ABOVE'
            ? price >= alert.threshold
            : price <= alert.threshold;
          break;
        }
        case 'NET_WORTH_ABOVE':
        case 'NET_WORTH_BELOW': {
          if (!portfolio) break;
          triggered = alert.type === 'NET_WORTH_ABOVE'
            ? portfolio.totalValue >= alert.threshold
            : portfolio.totalValue <= alert.threshold;
          break;
        }
        case 'PNL_PERCENT': {
          if (!portfolio) break;
          triggered = Math.abs(portfolio.pnl24hPercent) >= alert.threshold;
          break;
        }
      }

      if (triggered) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { triggered: true, triggeredAt: new Date() },
        });
        console.log(`🔔 Alert triggered: ${alert.type} ${alert.asset ?? ''} @ ${alert.threshold}`);
      }
    } catch {
      // ignore individual alert check failures
    }
  }
}
