import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePortfolio } from '../../src/api/queries';
import { API_BASE_URL, describeError } from '../../src/api/client';
import { Freshness } from '../../src/components/Freshness';
import { ListRow } from '../../src/components/ListRow';
import { ListGroup, Section } from '../../src/components/Section';
import { ScreenFill, ScreenScroll } from '../../src/components/ScreenScroll';
import {
  ConfigurationNotice,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../src/components/StateViews';
import { Caption, Display, Mono, Overline } from '../../src/components/Type';
import { formatMoney, formatPercent, formatQuantity, toNumber } from '../../src/lib/format';
import { portfolioCurrency } from '../../src/lib/portfolio';
import { useRefresh } from '../../src/lib/useRefresh';
import { selectionFeedback } from '../../src/lib/haptics';
import { color, font, radius, space } from '../../src/theme/tokens';
import type { Balance, Position } from '../../src/api/types';

type Mode = 'holdings' | 'positions';

/**
 * Holdings and derivative positions.
 *
 * The segmented switch follows Quicken's Investments screen (Holdings /
 * Balances / Performance) and Fidelity's Positions / Details toggle, and rows use
 * the Fidelity layout: symbol with quantity on the left, value with change
 * stacked on the right.
 */
export default function HoldingsScreen() {
  const portfolioQuery = usePortfolio();
  const [mode, setMode] = useState<Mode>('holdings');

  const refetch = useCallback(() => portfolioQuery.refetch(), [portfolioQuery]);
  const { refreshing, onRefresh } = useRefresh(refetch);

  const portfolio = portfolioQuery.data;
  const currency = portfolioCurrency(portfolio);

  const groupedHoldings = useMemo(
    () => groupBySourceAccount(portfolio?.assets ?? []),
    [portfolio?.assets],
  );
  const groupedPositions = useMemo(
    () => groupBySourceAccount(portfolio?.positions ?? []),
    [portfolio?.positions],
  );

  if (!API_BASE_URL) {
    return (
      <ScreenFill>
        <ConfigurationNotice />
      </ScreenFill>
    );
  }

  if (portfolioQuery.isLoading) {
    return (
      <ScreenFill>
        <LoadingState label="Loading holdings…" />
      </ScreenFill>
    );
  }

  if (portfolioQuery.isError || !portfolio) {
    return (
      <ScreenFill>
        <ErrorState
          title="Couldn’t load holdings"
          message={describeError(portfolioQuery.error)}
          onRetry={() => void portfolioQuery.refetch()}
        />
      </ScreenFill>
    );
  }

  const positionCount = portfolio.positions.length;
  const groups = mode === 'holdings' ? groupedHoldings : groupedPositions;

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Display>Holdings</Display>
        <Freshness
          retrievedAt={portfolio.lastUpdated}
          isFetching={portfolioQuery.isFetching && !refreshing}
        />
      </View>

      <View style={styles.switcher} accessibilityRole="tablist">
        <SegmentButton
          label={`Assets · ${portfolio.assets.length}`}
          active={mode === 'holdings'}
          onPress={() => setMode('holdings')}
        />
        <SegmentButton
          label={`Positions · ${positionCount}`}
          active={mode === 'positions'}
          onPress={() => setMode('positions')}
        />
      </View>

      {groups.length === 0 ? (
        <EmptyState
          icon={mode === 'holdings' ? 'layers-outline' : 'swap-horizontal-outline'}
          title={mode === 'holdings' ? 'No assets reported' : 'No open positions'}
          message={
            mode === 'holdings'
              ? 'Connected sources returned no balances. Check account health in Accounts.'
              : 'Derivative positions appear here when a source reports perps, futures or options.'
          }
        />
      ) : (
        groups.map((group) => (
          <Section
            key={group.label}
            overline={group.label}
            caption={
              mode === 'holdings'
                ? formatMoney(group.total, currency)
                : `${group.items.length} position${group.items.length === 1 ? '' : 's'}`
            }
          >
            <ListGroup>
              {mode === 'holdings'
                ? (group.items as Balance[]).map((asset, index) => (
                    <HoldingRow
                      key={`${asset.asset}-${asset.chain}-${index}`}
                      asset={asset}
                      currency={currency}
                    />
                  ))
                : (group.items as Position[]).map((position, index) => (
                    <PositionRow
                      key={`${position.asset}-${index}`}
                      position={position}
                      currency={currency}
                    />
                  ))}
            </ListGroup>
          </Section>
        ))
      )}
    </ScreenScroll>
  );
}

function HoldingRow({ asset, currency }: { asset: Balance; currency: string }) {
  const value = toNumber(asset.usdValue);
  return (
    <ListRow
      title={asset.asset}
      subtitle={`${formatQuantity(asset.amount)} · ${asset.chain}`}
      trailing={<Mono>{formatMoney(value, currency)}</Mono>}
    />
  );
}

function PositionRow({
  position,
  currency,
}: {
  position: Position;
  currency: string;
}) {
  const pnl = toNumber(position.pnl);
  const positive = pnl >= 0;
  return (
    <ListRow
      title={`${position.asset} · ${position.side}`}
      subtitle={`${formatQuantity(position.size)} @ ${formatMoney(position.entryPrice, currency)} · ${position.leverage}x ${position.type.toLowerCase()}`}
      trailing={
        <>
          <Mono>{formatMoney(position.markPrice, currency)}</Mono>
          <Caption
            style={[styles.pnl, { color: positive ? color.gain : color.loss }]}
          >
            {formatMoney(pnl, currency, { signed: true })} (
            {formatPercent(position.pnlPercent)})
          </Caption>
        </>
      }
    />
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && styles.segmentPressed,
      ]}
    >
      <Overline style={active ? styles.segmentLabelActive : styles.segmentLabel}>
        {label}
      </Overline>
    </Pressable>
  );
}

/** Keeps each account's rows together, the way Fidelity sections its positions. */
function groupBySourceAccount<T extends { accountLabel?: string; usdValue?: string }>(
  items: T[],
): { label: string; total: number; items: T[] }[] {
  const groups = new Map<string, { total: number; items: T[] }>();
  for (const item of items) {
    const label = item.accountLabel ?? 'Unassigned';
    const group = groups.get(label) ?? { total: 0, items: [] };
    group.items.push(item);
    group.total += toNumber(item.usdValue);
    groups.set(label, group);
  }
  return [...groups.entries()]
    .map(([label, group]) => ({ label, ...group }))
    .sort((a, b) => b.total - a.total);
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  switcher: {
    flexDirection: 'row',
    gap: space.xs,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: color.muted,
    marginTop: -space.lg,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: color.surface },
  segmentPressed: { opacity: 0.7 },
  segmentLabel: { fontSize: 11 },
  segmentLabelActive: {
    fontSize: 11,
    color: color.foreground,
    fontFamily: font.bodySemi,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pnl: { fontFamily: font.mono, fontSize: 12 },
});
